import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from PIL import Image

from app import db
from app.schemas import GroupPreviewPayload
from app.services.group_service import preview_group_layers


class GroupPreviewServiceTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp_dir = Path(self._tmp.name)
        self.db_path = self.tmp_dir / "app.db"
        self.previews_dir = self.tmp_dir / "previews"
        self.previews_dir.mkdir(parents=True, exist_ok=True)
        self.psd_path = self.tmp_dir / "template.psd"
        self.psd_path.write_bytes(b"fake-psd")

        self._db_patch = patch.object(db, "DB_PATH", self.db_path)
        self._db_patch.start()
        db.init_db()

        with db.get_conn() as conn:
            conn.execute(
                """
                INSERT INTO templates (id, name, file_path, width, height, preview_path, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "tpl-1",
                    "demo.psd",
                    str(self.psd_path),
                    100,
                    80,
                    str(self.previews_dir / "template-preview.png"),
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
            conn.execute(
                """
                INSERT INTO replace_groups (id, template_id, name, region_json, layer_rules_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    "group-1",
                    "tpl-1",
                    "商品主图",
                    '{"x":0,"y":0,"width":100,"height":80}',
                    '[{"layer_id":"layer-a","action":"replace"}]',
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
            conn.commit()

    def tearDown(self):
        self._db_patch.stop()
        self._tmp.cleanup()

    def test_preview_group_layers_returns_preview_and_unmatched_ids(self):
        preview_image = Image.new("RGBA", (10, 8), (255, 255, 255, 255))

        with (
            patch("app.services.group_service.PREVIEWS_DIR", self.previews_dir),
            patch("app.services.group_service.PSDImage.open", return_value=object()) as open_mock,
            patch("app.services.group_service.build_layer_map", return_value={"layer-a": object()}),
            patch(
                "app.services.group_service.composite_without_layers",
                return_value=(preview_image, {"effective_hide_count": 1}),
            ) as composite_mock,
        ):
            result = preview_group_layers(
                "tpl-1",
                GroupPreviewPayload(layer_ids=["layer-a", "layer-missing"]),
            )

        self.assertEqual(result["matched_count"], 1)
        self.assertEqual(result["requested_count"], 2)
        self.assertEqual(result["unmatched_layer_ids"], ["layer-missing"])
        self.assertTrue(result["preview_url"].startswith("/files/previews/group-preview-tpl-1-"))
        output_path = self.previews_dir / Path(result["preview_url"]).name
        self.assertTrue(output_path.exists())
        open_mock.assert_called_once_with(str(self.psd_path))
        composite_mock.assert_called_once()

        with db.get_conn() as conn:
            count = conn.execute("SELECT COUNT(*) FROM replace_groups WHERE template_id = ?", ("tpl-1",)).fetchone()[0]
        self.assertEqual(count, 1, "preview should not mutate replace_groups")

    def test_preview_group_layers_raises_when_template_missing(self):
        with self.assertRaises(ValueError) as ctx:
            preview_group_layers("tpl-missing", GroupPreviewPayload(layer_ids=["layer-a"]))
        self.assertIn("模板不存在", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
