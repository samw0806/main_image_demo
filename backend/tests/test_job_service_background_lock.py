import unittest

from PIL import Image

from app.services.job_service import (
    SlotResult,
    _apply_background_lock,
    _build_slots_mask,
    _count_outside_mask_diff_pixels,
)


class BackgroundLockTests(unittest.TestCase):
    def test_background_lock_restores_pixels_outside_slots(self):
        baseline = Image.new("RGBA", (4, 4), (10, 20, 30, 255))
        candidate = Image.new("RGBA", (4, 4), (200, 1, 1, 255))
        slot_img = Image.new("RGBA", (1, 1), (0, 255, 0, 255))
        slots = [SlotResult(slot_img, 1, 1)]

        mask = _build_slots_mask((4, 4), slots, dilate_px=0)
        locked = _apply_background_lock(candidate, baseline, mask)

        for y in range(4):
            for x in range(4):
                px = locked.getpixel((x, y))
                if (x, y) == (1, 1):
                    self.assertEqual(px, (200, 1, 1, 255))
                else:
                    self.assertEqual(px, (10, 20, 30, 255))

    def test_outside_diff_count_drops_to_zero_after_lock(self):
        baseline = Image.new("RGBA", (3, 3), (0, 0, 0, 255))
        candidate = Image.new("RGBA", (3, 3), (255, 0, 0, 255))
        slots = [SlotResult(Image.new("RGBA", (1, 1), (1, 1, 1, 255)), 0, 0)]
        mask = _build_slots_mask((3, 3), slots)

        before = _count_outside_mask_diff_pixels(candidate, baseline, mask)
        self.assertGreater(before, 0)

        locked = _apply_background_lock(candidate, baseline, mask)
        after = _count_outside_mask_diff_pixels(locked, baseline, mask)
        self.assertEqual(after, 0)

    def test_mask_uses_alpha_not_full_slot_rect(self):
        # slot is 2x2 but only top-left pixel has alpha > 0
        slot_img = Image.new("RGBA", (2, 2), (255, 0, 0, 0))
        slot_img.putpixel((0, 0), (255, 0, 0, 255))
        mask = _build_slots_mask((3, 3), [SlotResult(slot_img, 0, 0)], dilate_px=0)

        self.assertEqual(mask.getpixel((0, 0)), 255)
        self.assertEqual(mask.getpixel((1, 0)), 0)
        self.assertEqual(mask.getpixel((0, 1)), 0)
        self.assertEqual(mask.getpixel((1, 1)), 0)


if __name__ == "__main__":
    unittest.main()
