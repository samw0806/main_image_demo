import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Generator

from .config import DB_PATH


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                last_summary TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                summary TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES chat_sessions (id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_message_assets (
                id TEXT PRIMARY KEY,
                message_id TEXT NOT NULL,
                asset_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (message_id) REFERENCES chat_messages (id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS library_assets (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                source_type TEXT NOT NULL,
                session_id TEXT,
                file_path TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                width INTEGER,
                height INTEGER,
                preview_path TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS layers (
                id TEXT PRIMARY KEY,
                template_id TEXT NOT NULL,
                parent_id TEXT,
                name TEXT,
                x INTEGER,
                y INTEGER,
                width INTEGER,
                height INTEGER,
                stack_index INTEGER NOT NULL DEFAULT 0,
                visible INTEGER NOT NULL DEFAULT 1,
                payload_json TEXT,
                FOREIGN KEY (template_id) REFERENCES templates (id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS replace_groups (
                id TEXT PRIMARY KEY,
                template_id TEXT NOT NULL,
                name TEXT NOT NULL,
                region_json TEXT NOT NULL,
                layer_rules_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (template_id) REFERENCES templates (id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS assets (
                id TEXT PRIMARY KEY,
                name_no_ext TEXT NOT NULL UNIQUE,
                original_path TEXT NOT NULL,
                cutout_path TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                template_id TEXT NOT NULL,
                excel_path TEXT NOT NULL,
                status TEXT NOT NULL,
                progress REAL NOT NULL,
                log_json TEXT,
                output_dir TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (template_id) REFERENCES templates (id)
            )
            """
        )
        _ensure_layers_stack_index_column(conn)
        conn.commit()


def _ensure_layers_stack_index_column(conn: sqlite3.Connection) -> None:
    columns = {
        row[1]
        for row in conn.execute("PRAGMA table_info(layers)").fetchall()
    }
    if "stack_index" in columns:
        return
    conn.execute("ALTER TABLE layers ADD COLUMN stack_index INTEGER NOT NULL DEFAULT 0")


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def get_conn() -> Generator[sqlite3.Connection, Any, None]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def row_to_dict(row: sqlite3.Row) -> dict:
    return {k: row[k] for k in row.keys()}


def dump_json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False)


def load_json(text: str | None, default: Any) -> Any:
    if not text:
        return default
    return json.loads(text)
