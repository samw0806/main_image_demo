import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from PIL import Image

from app import db
from app.services import chat_service


class ChatServiceTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp_dir = Path(self._tmp.name)
        self.db_path = self.tmp_dir / "app.db"
        self.storage_dir = self.tmp_dir / "storage"
        self.library_dir = self.storage_dir / "library"
        self.chat_dir = self.storage_dir / "chat"
        self.library_dir.mkdir(parents=True, exist_ok=True)
        self.chat_dir.mkdir(parents=True, exist_ok=True)

        self._db_patch = patch.object(db, "DB_PATH", self.db_path)
        self._db_patch.start()
        db.init_db()

        self._chat_storage_patch = patch.object(chat_service, "CHAT_STORAGE_DIR", self.chat_dir)
        self._chat_storage_patch.start()
        self._library_service_patch = patch("app.services.library_service.LIBRARY_DIR", self.library_dir)
        self._library_service_patch.start()

        self.base_image = self.library_dir / "base.png"
        self.ref_image = self.library_dir / "ref.png"
        Image.new("RGB", (16, 16), (255, 255, 255)).save(self.base_image)
        Image.new("RGB", (16, 16), (128, 128, 128)).save(self.ref_image)

        with db.get_conn() as conn:
            conn.execute(
                """
                INSERT INTO library_assets (
                    id, filename, source_type, session_id, file_path, mime_type, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                ("asset-base", "base.png", "upload", None, str(self.base_image), "image/png", datetime.now(timezone.utc).isoformat()),
            )
            conn.execute(
                """
                INSERT INTO library_assets (
                    id, filename, source_type, session_id, file_path, mime_type, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                ("asset-ref", "ref.png", "upload", None, str(self.ref_image), "image/png", datetime.now(timezone.utc).isoformat()),
            )
            conn.commit()

    def tearDown(self):
        self._chat_storage_patch.stop()
        self._library_service_patch.stop()
        self._db_patch.stop()
        self._tmp.cleanup()

    def test_create_session_persists_and_lists(self):
        created = chat_service.create_session("Demo Session")
        listed = chat_service.list_sessions()

        self.assertEqual(created["title"], "Demo Session")
        self.assertEqual([row["id"] for row in listed], [created["id"]])

    def test_generate_reply_persists_messages_summary_and_generated_asset(self):
        session = chat_service.create_session("Demo Session")

        def fake_generate(*, prompt, asset_paths, session_dir, previous_summary):
            output = session_dir / "generated.png"
            Image.new("RGB", (16, 16), (12, 34, 56)).save(output)
            return {
                "output_path": output,
                "summary": f"summary:{prompt}:{len(asset_paths)}:{previous_summary or 'none'}",
                "request_payload": {"prompt": prompt},
                "result_url": "https://example.com/generated.png",
            }

        with patch.object(chat_service, "run_generation", side_effect=fake_generate):
            result = chat_service.generate_reply(
                session["id"],
                prompt="replace the product hero",
                asset_ids=["asset-base", "asset-ref"],
            )

        self.assertEqual(result["assistant"]["summary"], "summary:replace the product hero:2:none")
        self.assertEqual(len(result["assets"]), 1)
        self.assertEqual(result["assets"][0]["source_type"], "generated")

        messages = chat_service.list_messages(session["id"])
        self.assertEqual([message["role"] for message in messages], ["user", "assistant"])
        self.assertEqual(messages[1]["summary"], "summary:replace the product hero:2:none")

    def test_generate_reply_uses_previous_summary_on_follow_up_turn(self):
        session = chat_service.create_session("Demo Session")
        seen_previous_summaries: list[str | None] = []

        def fake_generate(*, prompt, asset_paths, session_dir, previous_summary):
            seen_previous_summaries.append(previous_summary)
            output = session_dir / f"generated-{len(seen_previous_summaries)}.png"
            Image.new("RGB", (16, 16), (12, 34, 56)).save(output)
            return {
                "output_path": output,
                "summary": f"summary-{len(seen_previous_summaries)}",
                "request_payload": {"prompt": prompt},
                "result_url": "https://example.com/generated.png",
            }

        with patch.object(chat_service, "run_generation", side_effect=fake_generate):
            chat_service.generate_reply(session["id"], prompt="first", asset_ids=["asset-base", "asset-ref"])
            chat_service.generate_reply(session["id"], prompt="second", asset_ids=["asset-base", "asset-ref"])

        self.assertEqual(seen_previous_summaries, [None, "summary-1"])


if __name__ == "__main__":
    unittest.main()
