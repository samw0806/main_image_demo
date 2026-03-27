from __future__ import annotations

import mimetypes
import uuid
from pathlib import Path

from ..config import LIBRARY_DIR
from ..db import get_conn, utcnow_iso


def _guess_mime_type(filename: str) -> str:
    return mimetypes.guess_type(filename)[0] or "application/octet-stream"


def save_upload(filename: str, file_bytes: bytes, *, source_type: str = "upload", session_id: str | None = None) -> dict:
    asset_id = uuid.uuid4().hex
    suffix = Path(filename).suffix.lower() or ".bin"
    stored_name = f"{asset_id}{suffix}"
    output_path = LIBRARY_DIR / stored_name
    output_path.write_bytes(file_bytes)
    record = {
        "id": asset_id,
        "filename": filename,
        "source_type": source_type,
        "session_id": session_id,
        "file_path": str(output_path),
        "mime_type": _guess_mime_type(filename),
        "created_at": utcnow_iso(),
        "file_url": f"/api/library/assets/{asset_id}/file",
    }
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO library_assets (id, filename, source_type, session_id, file_path, mime_type, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record["id"],
                record["filename"],
                record["source_type"],
                record["session_id"],
                record["file_path"],
                record["mime_type"],
                record["created_at"],
            ),
        )
        conn.commit()
    return record


def list_assets() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, filename, source_type, session_id, file_path, mime_type, created_at
            FROM library_assets
            ORDER BY created_at DESC
            """
        ).fetchall()
    return [
        {
            "id": row["id"],
            "filename": row["filename"],
            "source_type": row["source_type"],
            "session_id": row["session_id"],
            "file_path": row["file_path"],
            "mime_type": row["mime_type"],
            "created_at": row["created_at"],
            "file_url": f"/api/library/assets/{row['id']}/file",
        }
        for row in rows
    ]


def get_asset(asset_id: str) -> dict:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT id, filename, source_type, session_id, file_path, mime_type, created_at
            FROM library_assets WHERE id = ?
            """,
            (asset_id,),
        ).fetchone()
    if not row:
        raise ValueError("素材不存在")
    return {
        "id": row["id"],
        "filename": row["filename"],
        "source_type": row["source_type"],
        "session_id": row["session_id"],
        "file_path": row["file_path"],
        "mime_type": row["mime_type"],
        "created_at": row["created_at"],
        "file_url": f"/api/library/assets/{row['id']}/file",
    }
