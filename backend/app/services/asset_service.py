from __future__ import annotations

import hashlib
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path

from PIL import Image

# Configure writable runtime dirs before importing rembg/numba stack.
os.environ.setdefault("NUMBA_CACHE_DIR", "/tmp/numba_cache")
os.environ.setdefault("XDG_CACHE_HOME", "/tmp/xdg_cache")
os.environ.setdefault("U2NET_HOME", "/tmp/u2net")
for env_key in ("NUMBA_CACHE_DIR", "XDG_CACHE_HOME", "U2NET_HOME"):
    Path(os.environ[env_key]).mkdir(parents=True, exist_ok=True)

from rembg import remove

from ..config import ASSETS_DIR
from ..db import get_conn

logger = logging.getLogger(__name__)


def _env_flag(name: str) -> bool:
    value = str(os.environ.get(name, "")).strip().lower()
    return value in {"1", "true", "yes", "on"}


def _u2net_model_ready() -> bool:
    """
    Check whether a usable local u2net model exists.
    A partial/corrupted download should not trigger rembg attempts.
    """
    model_path = Path(os.environ.get("U2NET_HOME", "/tmp/u2net")) / "u2net.onnx"
    if not model_path.exists():
        return False
    try:
        return model_path.stat().st_size >= 50 * 1024 * 1024
    except OSError:
        return False


def _write_fallback_cutout(original_path: Path, out_path: Path) -> None:
    """
    Fallback: no background removal, just normalize source to RGBA PNG.
    This keeps generation chain working in offline/no-model environments.
    """
    img = Image.open(original_path).convert("RGBA")
    img.save(out_path)


def save_asset(filename: str, file_bytes: bytes) -> dict:
    stem = Path(filename).stem
    ext = Path(filename).suffix.lower() or ".png"
    path = ASSETS_DIR / f"{stem}{ext}"
    path.write_bytes(file_bytes)

    with get_conn() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO assets (id, name_no_ext, original_path, cutout_path, created_at)
            VALUES (
                COALESCE((SELECT id FROM assets WHERE name_no_ext = ?), ?),
                ?, ?, COALESCE((SELECT cutout_path FROM assets WHERE name_no_ext = ?), NULL), ?
            )
            """,
            (stem, uuid.uuid4().hex, stem, str(path), stem, datetime.utcnow().isoformat()),
        )
        conn.commit()

    return {"name": stem, "path": str(path)}


def cutout_asset(asset_name: str) -> str:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT original_path, cutout_path FROM assets WHERE name_no_ext = ?",
            (asset_name,),
        ).fetchone()
        if not row:
            raise ValueError(f"素材不存在: {asset_name}")

        if row["cutout_path"] and Path(row["cutout_path"]).exists():
            return row["cutout_path"]

        original_path = Path(row["original_path"])
        raw = original_path.read_bytes()
        digest = hashlib.md5(raw).hexdigest()[:8]
        out_path = ASSETS_DIR / f"{asset_name}_cutout_{digest}.png"
        strict_cutout_required = _env_flag("STRICT_CUTOUT_REQUIRED")
        disable_rembg = _env_flag("DISABLE_REMBG")

        # Prefer rembg when local model is ready; otherwise use fast RGBA fallback.
        if disable_rembg:
            if strict_cutout_required:
                raise RuntimeError("DISABLE_REMBG=1 while STRICT_CUTOUT_REQUIRED=1")
            logger.warning("rembg disabled by env, fallback cutout for asset: %s", asset_name)
            _write_fallback_cutout(original_path, out_path)
        elif _u2net_model_ready():
            try:
                output = remove(raw)
                out_path.write_bytes(output)
                img = Image.open(out_path).convert("RGBA")
                img.save(out_path)
            except Exception as exc:
                if strict_cutout_required:
                    raise RuntimeError(f"rembg cutout failed for {asset_name}: {exc}") from exc
                logger.warning("rembg cutout failed for %s, fallback to RGBA source: %s", asset_name, exc)
                _write_fallback_cutout(original_path, out_path)
        else:
            if strict_cutout_required:
                raise RuntimeError("u2net model not ready while STRICT_CUTOUT_REQUIRED=1")
            logger.warning("u2net model not ready, fallback cutout for asset: %s", asset_name)
            _write_fallback_cutout(original_path, out_path)

        conn.execute(
            "UPDATE assets SET cutout_path = ? WHERE name_no_ext = ?",
            (str(out_path), asset_name),
        )
        conn.commit()
        return str(out_path)


def list_assets() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT name_no_ext, original_path, cutout_path FROM assets ORDER BY name_no_ext ASC"
        ).fetchall()
    return [
        {"name": row["name_no_ext"], "original_path": row["original_path"], "cutout_path": row["cutout_path"]}
        for row in rows
    ]
