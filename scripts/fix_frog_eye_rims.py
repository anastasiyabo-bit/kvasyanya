#!/usr/bin/env python3
"""Redraw the dark rim on top of Kvasi's eyes.

wipe_frog_pupils() flattened each eye to white, which also erased the rim
where the baked pupils touched it. Wherever the eye white now meets the
green lid directly, paint the rim back on the inside edge of the white.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

SHEET = Path(__file__).resolve().parent.parent / "public" / "chars" / "frog.png"
FW = 624
RIM = 7.0
INK = np.array([2, 2, 2], dtype=np.float64)


def fix_frame(fr: np.ndarray) -> int:
    rgb = fr[:, :, :3].astype(np.int32)
    a = fr[:, :, 3]
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    green = (g > r + 30) & (g > b + 30) & (a > 120)
    light = (a > 200) & (lum > 150) & ~green
    light[230:, :] = False

    labels, n = ndimage.label(light)
    painted = 0
    for k in range(1, n + 1):
        eye = labels == k
        if eye.sum() < 3000:
            continue
        eye = ndimage.binary_fill_holes(eye)
        dist = ndimage.distance_transform_edt(~green)
        ring = eye & (dist <= RIM + 0.8)
        ys, xs = np.where(ring)
        for y, x in zip(ys, xs):
            t = float(np.clip(RIM + 0.8 - dist[y, x], 0.0, 1.0))
            src = fr[y, x, :3].astype(np.float64)
            fr[y, x, :3] = np.round(src * (1 - t) + INK * t).astype(np.uint8)
            fr[y, x, 3] = 255
        painted += len(ys)
    return painted


def main() -> None:
    sheet = np.array(Image.open(SHEET).convert("RGBA"))
    frames = sheet.shape[1] // FW
    for f in range(frames):
        fr = sheet[:, f * FW : (f + 1) * FW]
        n = fix_frame(fr)
        print(f"frame {f}: rim pixels {n}")
    Image.fromarray(sheet).save(SHEET, optimize=True)


if __name__ == "__main__":
    main()
