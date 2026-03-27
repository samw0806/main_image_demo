import unittest
from types import SimpleNamespace

from PIL import Image

from app.services.psd_service import composite_without_layers


class _DummyLayer:
    def __init__(self, visible: bool = True):
        self.visible = visible
        self._record = SimpleNamespace(tagged_blocks={})


class _DummyPSD:
    def __init__(
        self,
        layer: _DummyLayer,
        *,
        width: int = 4,
        height: int = 4,
        fail_force: bool = False,
        fail_when_hidden: bool = False,
    ):
        self.layer = layer
        self.width = width
        self.height = height
        self.fail_force = fail_force
        self.fail_when_hidden = fail_when_hidden
        self.force_flags: list[bool] = []

    def composite(self, force: bool = False):
        self.force_flags.append(force)
        if force and self.fail_force:
            raise RuntimeError("force composite failed")
        if force and self.fail_when_hidden and not self.layer.visible:
            raise RuntimeError("force composite failed")
        img = Image.new("RGBA", (self.width, self.height), (255, 255, 255, 255))
        # Simulate a layer contributing pixels only when visible.
        if self.layer.visible:
            img.putpixel((0, 0), (255, 0, 0, 255))
        else:
            img.putpixel((0, 0), (255, 255, 255, 255))
        return img


class CompositeWithoutLayersTests(unittest.TestCase):
    def test_force_composite_and_metadata(self):
        layer = _DummyLayer(visible=True)
        psd = _DummyPSD(layer)

        result_img, meta = composite_without_layers(psd, ["layer-1"], {"layer-1": layer})

        self.assertEqual(psd.force_flags, [True, True])
        self.assertEqual(result_img.size, (4, 4))
        self.assertEqual(meta["composite_mode"], "force")
        self.assertEqual(meta["requested_hide_count"], 1)
        self.assertEqual(meta["effective_hide_count"], 1)
        self.assertTrue(meta["pixel_changed"])
        self.assertFalse(meta["fallback_used"])
        self.assertIsNone(meta["composite_error"])
        self.assertTrue(layer.visible, "layer visibility should be restored after compositing")

    def test_force_failure_raises_for_caller_fallback(self):
        layer = _DummyLayer(visible=True)
        psd = _DummyPSD(layer, fail_when_hidden=True, width=8, height=6)

        with self.assertRaises(RuntimeError) as ctx:
            composite_without_layers(psd, ["layer-1"], {"layer-1": layer})

        self.assertIn("force composite failed", str(ctx.exception))
        self.assertEqual(psd.force_flags, [True, True])
        self.assertTrue(layer.visible, "layer visibility should be restored on error path too")


if __name__ == "__main__":
    unittest.main()
