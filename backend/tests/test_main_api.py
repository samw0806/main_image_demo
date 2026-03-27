import io
import importlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import UploadFile
from PIL import Image

from app import db
from app.main import app, config, health
from app.routers.chat import create_chat_session, generate_chat_reply
from app.services.library_service import save_upload
from app.schemas import ChatGenerateIn, ChatSessionCreateIn


class MainApiTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp_dir = Path(self._tmp.name)
        self.db_path = self.tmp_dir / "app.db"
        self.storage_dir = self.tmp_dir / "storage"
        self.library_dir = self.storage_dir / "library"
        self.chat_dir = self.storage_dir / "chat"
        self.psd_templates_dir = self.storage_dir / "psd" / "templates"
        self.psd_previews_dir = self.storage_dir / "psd" / "previews"
        self.psd_assets_dir = self.storage_dir / "psd" / "assets"
        self.psd_outputs_dir = self.storage_dir / "psd" / "outputs"
        for path in [
            self.library_dir,
            self.chat_dir,
            self.psd_templates_dir,
            self.psd_previews_dir,
            self.psd_assets_dir,
            self.psd_outputs_dir,
        ]:
            path.mkdir(parents=True, exist_ok=True)

        patches = [
            patch.object(db, "DB_PATH", self.db_path),
            patch("app.services.library_service.LIBRARY_DIR", self.library_dir),
            patch("app.services.chat_service.CHAT_STORAGE_DIR", self.chat_dir),
            patch("app.services.asset_service.ASSETS_DIR", self.psd_assets_dir),
            patch("app.services.psd_service.TEMPLATES_DIR", self.psd_templates_dir),
            patch("app.services.psd_service.PREVIEWS_DIR", self.psd_previews_dir),
            patch("app.services.group_service.PREVIEWS_DIR", self.psd_previews_dir),
            patch("app.services.job_service.OUTPUTS_DIR", self.psd_outputs_dir),
        ]
        self._patches = patches
        for item in patches:
            item.start()
        db.init_db()

    def tearDown(self):
        for item in reversed(self._patches):
            item.stop()
        self._tmp.cleanup()

    def test_health_and_config_endpoints(self):
        self.assertEqual(health(), {"ok": True})
        self.assertIn("image_model", config())

    def test_library_upload_and_chat_session_flow(self):
        image = io.BytesIO()
        Image.new("RGB", (12, 12), (200, 100, 50)).save(image, format="PNG")
        image.seek(0)

        asset_id = save_upload("sample.png", image.getvalue())["id"]

        session = create_chat_session(ChatSessionCreateIn(title="Demo"))
        with patch("app.routers.chat.generate_reply") as generate_reply_mock:
            generate_reply_mock.return_value = {
                "user": {"id": "user-1", "role": "user", "content": "prompt", "summary": None, "created_at": "now", "assets": []},
                "assistant": {"id": "assistant-1", "role": "assistant", "content": "done", "summary": "summary", "created_at": "now", "assets": []},
                "assets": [],
            }
            generate = generate_chat_reply(
                session["id"],
                ChatGenerateIn(prompt="prompt", asset_ids=[asset_id]),
            )

        self.assertEqual(generate["assistant"]["summary"], "summary")
        generate_reply_mock.assert_called_once()

    def test_psd_namespace_exposes_upload_route(self):
        self.assertTrue(any(route.path == "/api/psd/templates/upload" for route in app.routes))

    def test_config_loads_env_file_when_present(self):
        env_dir = self.tmp_dir / "config-reload"
        env_dir.mkdir(parents=True, exist_ok=True)
        env_path = env_dir / ".env"
        env_path.write_text(
            "\n".join(
                [
                    "IMAGE_API_KEY=test-key-from-env-file",
                    "IMAGE_API_BASE_URL=https://example.test",
                    "IMAGE_MODEL=test-model",
                ]
            ),
            encoding="utf-8",
        )

        with (
            patch.dict("os.environ", {}, clear=True),
            patch("pathlib.Path.resolve", return_value=env_dir / "app" / "config.py"),
        ):
            import app.config as config_module

            reloaded = importlib.reload(config_module)

        self.assertEqual(reloaded.IMAGE_API_KEY, "test-key-from-env-file")
        self.assertEqual(reloaded.IMAGE_API_BASE_URL, "https://example.test")
        self.assertEqual(reloaded.IMAGE_API_MODEL, "test-model")


if __name__ == "__main__":
    unittest.main()
