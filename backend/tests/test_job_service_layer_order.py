import unittest

from PIL import Image

from app.services.job_service import SlotResult, _render_layer_aware_canvas


class _DummyLayer:
    def __init__(self, rgba: tuple[int, int, int, int], *, size: tuple[int, int] = (2, 2)):
        self.visible = True
        self._size = size
        self._rgba = rgba

    def composite(self, force: bool = True):
        image = Image.new("RGBA", self._size, (0, 0, 0, 0))
        image.putpixel((0, 0), self._rgba)
        return image


class LayerAwareCanvasTests(unittest.TestCase):
    def test_replacement_is_inserted_between_neighbor_layers(self):
        layer_a = _DummyLayer((255, 0, 0, 255))
        layer_b = _DummyLayer((0, 255, 0, 255))
        layer_c = _DummyLayer((255, 255, 255, 128))
        layers = [layer_a, layer_b, layer_c]
        layer_id_by_obj = {id(layer_a): "a", id(layer_b): "b", id(layer_c): "c"}

        replacement = Image.new("RGBA", (1, 1), (0, 0, 255, 255))
        canvas = _render_layer_aware_canvas(
            ordered_layers=layers,
            layer_id_by_object_id=layer_id_by_obj,
            replace_layer_ids={"b"},
            replacement_slots={"b": SlotResult(replacement, 0, 0)},
            canvas_size=(2, 2),
        )

        # Expected stack: A -> D -> C.
        expected = Image.new("RGBA", (2, 2), (0, 0, 0, 0))
        expected.alpha_composite(layer_a.composite(), (0, 0))
        expected.alpha_composite(replacement, (0, 0))
        expected.alpha_composite(layer_c.composite(), (0, 0))
        self.assertEqual(canvas.getpixel((0, 0)), expected.getpixel((0, 0)))

        # Wrong (old) behavior would be: A -> C -> D (new image always on top).
        wrong_old = Image.new("RGBA", (2, 2), (0, 0, 0, 0))
        wrong_old.alpha_composite(layer_a.composite(), (0, 0))
        wrong_old.alpha_composite(layer_c.composite(), (0, 0))
        wrong_old.alpha_composite(replacement, (0, 0))
        self.assertNotEqual(canvas.getpixel((0, 0)), wrong_old.getpixel((0, 0)))

    def test_missing_replacement_keeps_layer_hidden(self):
        layer_a = _DummyLayer((255, 0, 0, 255))
        layer_b = _DummyLayer((0, 255, 0, 255))
        layer_c = _DummyLayer((0, 0, 255, 255))
        layers = [layer_a, layer_b, layer_c]
        layer_id_by_obj = {id(layer_a): "a", id(layer_b): "b", id(layer_c): "c"}

        canvas = _render_layer_aware_canvas(
            ordered_layers=layers,
            layer_id_by_object_id=layer_id_by_obj,
            replace_layer_ids={"b"},
            replacement_slots={},
            canvas_size=(2, 2),
        )

        expected = Image.new("RGBA", (2, 2), (0, 0, 0, 0))
        expected.alpha_composite(layer_a.composite(), (0, 0))
        expected.alpha_composite(layer_c.composite(), (0, 0))
        self.assertEqual(canvas.getpixel((0, 0)), expected.getpixel((0, 0)))


if __name__ == "__main__":
    unittest.main()
