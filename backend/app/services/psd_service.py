from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import datetime
from pathlib import Path

from PIL import Image
from psd_tools import PSDImage

from ..config import PREVIEWS_DIR, TEMPLATES_DIR
from ..db import dump_json, get_conn

logger = logging.getLogger(__name__)


def _hash_rgba_image(image: Image.Image) -> str:
    """Return an md5 hash of RGBA pixels for fast before/after comparison."""
    return hashlib.md5(image.convert("RGBA").tobytes()).hexdigest()


def _safe_bbox(layer) -> tuple[int, int, int, int]:
    bbox = layer.bbox
    if not bbox:
        return 0, 0, 0, 0
    # psd-tools 在不同版本/图层类型下，bbox 可能是对象或 4 元组。
    if isinstance(bbox, (tuple, list)) and len(bbox) >= 4:
        return int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])
    return int(getattr(bbox, "x1")), int(getattr(bbox, "y1")), int(getattr(bbox, "x2")), int(getattr(bbox, "y2"))


def import_template(file_bytes: bytes, filename: str) -> dict:
    template_id = uuid.uuid4().hex
    ext = Path(filename).suffix.lower() or ".psd"
    template_path = TEMPLATES_DIR / f"{template_id}{ext}"
    template_path.write_bytes(file_bytes)

    psd = PSDImage.open(template_path)
    preview_path = PREVIEWS_DIR / f"{template_id}.png"
    _build_preview_with_fallback(psd, preview_path)

    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO templates (id, name, file_path, width, height, preview_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                template_id,
                filename,
                str(template_path),
                int(psd.width),
                int(psd.height),
                str(preview_path),
                datetime.utcnow().isoformat(),
            ),
        )
        conn.execute("DELETE FROM layers WHERE template_id = ?", (template_id,))
        _insert_layers(conn, template_id, psd, parent_id=None, level=0, stack_counter=[0])
        conn.commit()

    return {
        "template_id": template_id,
        "name": filename,
        "width": int(psd.width),
        "height": int(psd.height),
        "preview_url": f"/files/previews/{preview_path.name}",
    }


def _build_preview_with_fallback(psd: PSDImage, preview_path: Path) -> None:
    # 优先使用合成图；失败时降级为纯白占位图，避免上传接口直接 500。
    try:
        preview = psd.composite()
        if isinstance(preview, Image.Image):
            preview.save(preview_path)
            return
    except Exception as exc:
        logger.warning("PSD composite failed, fallback to blank preview: %s", exc)

    width = int(psd.width or 1)
    height = int(psd.height or 1)
    placeholder = Image.new("RGBA", (max(1, width), max(1, height)), (255, 255, 255, 255))
    placeholder.save(preview_path)


def _insert_layers(
    conn,
    template_id: str,
    group,
    parent_id: str | None,
    level: int,
    stack_counter: list[int],
) -> None:
    for layer in group:
        layer_id = uuid.uuid4().hex
        x1, y1, x2, y2 = _safe_bbox(layer)
        width = max(0, x2 - x1)
        height = max(0, y2 - y1)
        stack_index = stack_counter[0]
        stack_counter[0] += 1
        conn.execute(
            """
            INSERT INTO layers (id, template_id, parent_id, name, x, y, width, height, stack_index, visible, payload_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                layer_id,
                template_id,
                parent_id,
                layer.name or "Unnamed Layer",
                x1,
                y1,
                width,
                height,
                stack_index,
                1 if layer.visible else 0,
                dump_json(
                    {
                        "level": level,
                        "kind": layer.kind,
                        "opacity": int(layer.opacity or 255),
                    }
                ),
            ),
        )
        if layer.is_group():
            _insert_layers(
                conn,
                template_id,
                layer,
                parent_id=layer_id,
                level=level + 1,
                stack_counter=stack_counter,
            )


def _flatten_psd_layers(group, result: list) -> None:
    """Recursively collect all leaf and group layers into a flat list."""
    for layer in group:
        result.append(layer)
        if layer.is_group():
            _flatten_psd_layers(layer, result)


def build_layer_map(psd: PSDImage, template_id: str) -> dict:
    """
    Return a mapping of DB layer_id -> PSD layer object.
    Matching is done by (name, x1, y1, x2, y2).

    When multiple PSD layers share the same key (same name + same bbox),
    each DB row is matched to a distinct PSD layer in order so that
    duplicates don't silently collapse to the last one.
    """
    with get_conn() as conn:
        db_layers = conn.execute(
            "SELECT id, name, x, y, width, height FROM layers WHERE template_id = ? ORDER BY stack_index ASC, rowid ASC",
            (template_id,),
        ).fetchall()

    all_psd_layers: list = []
    _flatten_psd_layers(psd, all_psd_layers)

    # Build lookup: (name, x1, y1, x2, y2) -> list[psd_layer] (preserving order)
    from collections import defaultdict
    psd_lookup: dict[tuple, list] = defaultdict(list)
    for psd_layer in all_psd_layers:
        x1, y1, x2, y2 = _safe_bbox(psd_layer)
        key = (psd_layer.name or "", x1, y1, x2, y2)
        psd_lookup[key].append(psd_layer)

    # Keep a per-key consumption index so duplicate keys are matched one-to-one
    psd_consume: dict[tuple, int] = {}

    layer_map: dict[str, object] = {}
    for row in db_layers:
        x1 = row["x"]
        y1 = row["y"]
        x2 = x1 + row["width"]
        y2 = y1 + row["height"]
        key = (row["name"] or "", x1, y1, x2, y2)
        candidates = psd_lookup.get(key)
        if not candidates:
            continue
        idx = psd_consume.get(key, 0)
        if idx < len(candidates):
            layer_map[row["id"]] = candidates[idx]
            psd_consume[key] = idx + 1

    return layer_map


def composite_without_layers(
    psd: PSDImage,
    hide_layer_ids: list[str],
    layer_map: dict,
) -> tuple[Image.Image, dict[str, object]]:
    """
    Hide specified layers (by DB id) and render with force=True so visibility
    changes are reflected even when the PSD contains embedded previews.

    Returns:
        (rendered_image, meta)
        meta keys:
            composite_mode: str
            requested_hide_count: int
            effective_hide_count: int
            pixel_changed: bool | None
            fallback_used: bool
            composite_error: str | None
    """
    requested = len(hide_layer_ids)
    hidden_layers = []
    skipped_invisible = []
    baseline_hash: str | None = None

    # Baseline render before visibility mutation for pixel delta check.
    try:
        baseline = psd.composite(force=True)
        if isinstance(baseline, Image.Image):
            baseline_hash = _hash_rgba_image(baseline)
    except Exception as exc:
        logger.warning("composite_without_layers baseline force render failed: %s", exc)

    for layer_id in hide_layer_ids:
        psd_layer = layer_map.get(layer_id)
        if psd_layer is None:
            continue
        if not psd_layer.visible:
            skipped_invisible.append(layer_id)
            continue
        try:
            psd_layer._record.tagged_blocks
            psd_layer.visible = False
            hidden_layers.append(psd_layer)
        except Exception as exc:
            logger.warning("Could not hide layer %s: %s", layer_id, exc)

    effective = len(hidden_layers) + len(skipped_invisible)
    pixel_changed: bool | None = None

    try:
        result = psd.composite(force=True)
        if not isinstance(result, Image.Image):
            raise RuntimeError("force composite returned non-image result")

        result_rgba = result.convert("RGBA")
        if baseline_hash is not None:
            pixel_changed = baseline_hash != _hash_rgba_image(result_rgba)

        logger.debug(
            "composite_without_layers: mode=force requested=%d effective=%d pixel_changed=%s",
            requested,
            effective,
            pixel_changed,
        )
        return result_rgba, {
            "composite_mode": "force",
            "requested_hide_count": requested,
            "effective_hide_count": effective,
            "pixel_changed": pixel_changed,
            "fallback_used": False,
            "composite_error": None,
        }
    except Exception as exc:
        logger.warning("composite_without_layers force render failed: %s", exc)
        raise RuntimeError(f"force composite failed: {exc}") from exc
    finally:
        for psd_layer in hidden_layers:
            try:
                psd_layer.visible = True
            except Exception:
                pass


def get_layers(template_id: str) -> dict:
    with get_conn() as conn:
        tpl = conn.execute(
            "SELECT id, name, width, height, preview_path FROM templates WHERE id = ?",
            (template_id,),
        ).fetchone()
        if not tpl:
            raise ValueError("模板不存在")

        layer_rows = conn.execute(
            """
            SELECT id, parent_id, name, x, y, width, height, stack_index, visible, payload_json
            FROM layers WHERE template_id = ?
            ORDER BY stack_index ASC, rowid ASC
            """,
            (template_id,),
        ).fetchall()

    layers = []
    for row in layer_rows:
        payload = row["payload_json"]
        level = 0
        if payload:
            import json

            level = json.loads(payload).get("level", 0)
        layers.append(
            {
                "id": row["id"],
                "parent_id": row["parent_id"],
                "name": row["name"],
                "x": row["x"],
                "y": row["y"],
                "width": row["width"],
                "height": row["height"],
                "stack_index": row["stack_index"],
                "visible": bool(row["visible"]),
                "level": level,
            }
        )

    return {
        "template": {
            "id": tpl["id"],
            "name": tpl["name"],
            "width": tpl["width"],
            "height": tpl["height"],
            "preview_url": f"/files/previews/{Path(tpl['preview_path']).name}",
        },
        "layers": layers,
    }
