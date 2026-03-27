from __future__ import annotations

import uuid
from pathlib import Path

from ..config import CHAT_STORAGE_DIR
from ..db import get_conn, utcnow_iso
from .generation_service import run_generation
from .library_service import get_asset, save_upload


def _session_dir(session_id: str) -> Path:
    return CHAT_STORAGE_DIR / session_id


def create_session(title: str | None = None) -> dict:
    session_id = uuid.uuid4().hex
    now = utcnow_iso()
    record = {
        "id": session_id,
        "title": title or "未命名会话",
        "last_summary": None,
        "created_at": now,
        "updated_at": now,
    }
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO chat_sessions (id, title, last_summary, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (record["id"], record["title"], record["last_summary"], record["created_at"], record["updated_at"]),
        )
        conn.commit()
    _session_dir(session_id).mkdir(parents=True, exist_ok=True)
    return record


def list_sessions() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, title, last_summary, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC"
        ).fetchall()
    return [dict(row) for row in rows]


def get_session(session_id: str) -> dict:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, title, last_summary, created_at, updated_at FROM chat_sessions WHERE id = ?",
            (session_id,),
        ).fetchone()
    if not row:
        raise ValueError("会话不存在")
    return dict(row)


def _message_assets(message_id: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT la.id, la.filename, la.source_type, la.session_id, la.file_path, la.mime_type, la.created_at
            FROM chat_message_assets cma
            JOIN library_assets la ON la.id = cma.asset_id
            WHERE cma.message_id = ?
            ORDER BY cma.created_at ASC
            """,
            (message_id,),
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


def list_messages(session_id: str) -> list[dict]:
    get_session(session_id)
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, role, content, summary, created_at
            FROM chat_messages
            WHERE session_id = ?
            ORDER BY created_at ASC
            """,
            (session_id,),
        ).fetchall()
    messages = []
    for row in rows:
        item = dict(row)
        item["assets"] = _message_assets(row["id"])
        messages.append(item)
    return messages


def _insert_message(session_id: str, role: str, content: str, *, summary: str | None = None, asset_ids: list[str] | None = None) -> dict:
    message_id = uuid.uuid4().hex
    created_at = utcnow_iso()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO chat_messages (id, session_id, role, content, summary, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (message_id, session_id, role, content, summary, created_at),
        )
        if asset_ids:
            for asset_id in asset_ids:
                conn.execute(
                    """
                    INSERT INTO chat_message_assets (id, message_id, asset_id, created_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (uuid.uuid4().hex, message_id, asset_id, created_at),
                )
        conn.execute(
            "UPDATE chat_sessions SET updated_at = ?, last_summary = COALESCE(?, last_summary) WHERE id = ?",
            (created_at, summary, session_id),
        )
        conn.commit()
    item = {
        "id": message_id,
        "role": role,
        "content": content,
        "summary": summary,
        "created_at": created_at,
        "assets": [_asset_with_url(asset_id) for asset_id in (asset_ids or [])],
    }
    return item


def _asset_with_url(asset_id: str) -> dict:
    return get_asset(asset_id)


def generate_reply(session_id: str, *, prompt: str, asset_ids: list[str]) -> dict:
    session = get_session(session_id)
    if not prompt.strip() and not asset_ids:
        raise ValueError("请输入文本或上传素材")
    if not asset_ids:
        raise ValueError("当前版本至少需要一张图片素材")

    asset_records = [_asset_with_url(asset_id) for asset_id in asset_ids]
    user_message = _insert_message(session_id, "user", prompt, asset_ids=asset_ids)
    generation_dir = _session_dir(session_id) / uuid.uuid4().hex
    generation_dir.mkdir(parents=True, exist_ok=True)
    generation = run_generation(
        prompt=prompt,
        asset_paths=[Path(record["file_path"]) for record in asset_records],
        session_dir=generation_dir,
        previous_summary=session.get("last_summary"),
    )

    output_path = Path(generation["output_path"])
    generated_asset = save_upload(
        output_path.name,
        output_path.read_bytes(),
        source_type="generated",
        session_id=session_id,
    )
    assistant_message = _insert_message(
        session_id,
        "assistant",
        "已生成一张新的主图结果。",
        summary=str(generation["summary"]),
        asset_ids=[generated_asset["id"]],
    )
    return {
        "user": user_message,
        "assistant": assistant_message,
        "assets": [generated_asset],
    }
