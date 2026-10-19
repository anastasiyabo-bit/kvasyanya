#!/usr/bin/env python3
"""Punch lock shackle hole, pack open epic chest, make a red prize star."""

from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path("/Users/anastasiyamakarova/Документы/скилы/nabey-bryushko")
ASSETS = Path("/Users/anastasiyamakarova/.cursor/projects/Users-anastasiyamakarova-nabey-bryushko/assets")
UI = ROOT / "public" / "ui"

CHEST_SRC = ASSETS / "nano_nb21_1792394673661_1-a26ccfe7-250f-4ec1-a175-9487d8843a41.png"


def flood_white(rgb: np.ndarray, thresh: float = 38) -> np.ndarray:
    h, w = rgb.shape[:2]
    luma = rgb.mean(axis=2)
    close = luma > 255 - thresh
    mask = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if close[y, x]:
                mask[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if not mask[y, x] and close[y, x]:
                mask[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and not mask[ny, nx] and close[ny, nx]:
                mask[ny, nx] = True
                q.append((ny, nx))
    return mask


def components(mask: np.ndarray) -> list[np.ndarray]:
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    out: list[np.ndarray] = []
    for y in range(h):
        for x in range(w):
            if mask[y, x] and not seen[y, x]:
                q = deque([(y, x)])
                seen[y, x] = True
                pix = [(y, x)]
                while q:
                    cy, cx = q.popleft()
                    for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            q.append((ny, nx))
                            pix.append((ny, nx))
                coords = np.array(pix)
                out.append(coords)
    return out


def punch_lock() -> None:
    path = UI / "ico_lock.png"
    im = Image.open(path).convert("RGBA")
    a = np.array(im)
    rgb = a[:, :, :3].astype(np.int16)
    al = a[:, :, 3]
    luma = rgb.mean(axis=2)
    bright = (luma > 198) & (al > 18)
    comps = components(bright)
    h, w = al.shape
    hole = None
    best = 0
    for c in comps:
        ys, xs = c[:, 0], c[:, 1]
        cy, cx = float(ys.mean()), float(xs.mean())
        # shackle hole sits in the upper-center opening, not metal highlights
        if 14 < cy < 42 and 22 < cx < 58 and len(c) > best:
            hole = c
            best = len(c)
    if hole is None:
        raise SystemExit("lock hole not found")
    punch = np.zeros((h, w), dtype=bool)
    punch[hole[:, 0], hole[:, 1]] = True
    # grow 1px so no white fringe remains in the opening
    grow = punch.copy()
    grow[1:, :] |= punch[:-1, :]
    grow[:-1, :] |= punch[1:, :]
    grow[:, 1:] |= punch[:, :-1]
    grow[:, :-1] |= punch[:, 1:]
    a[grow, 3] = 0
    out = Image.fromarray(a)
    alpha = out.getchannel("A").filter(ImageFilter.MinFilter(3))
    # only erode inside the punched region, keep the rest of the lock crisp
    old_a = np.array(im.split()[-1])
    new_a = np.array(alpha)
    mixed = np.where(grow, np.minimum(old_a, new_a), old_a)
    out.putalpha(Image.fromarray(mixed.astype(np.uint8)))
    out.save(path)
    print("lock punched", best, "px hole")


def pack_chest() -> None:
    img = Image.open(CHEST_SRC).convert("RGB")
    arr = np.array(img)
    bg = flood_white(arr, 36)
    rgba = np.dstack([arr, np.where(bg, 0, 255).astype(np.uint8)])
    im = Image.fromarray(rgba)
    alpha = im.getchannel("A").filter(ImageFilter.MinFilter(3))
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.45))
    im.putalpha(alpha)
    a = np.array(im.split()[-1])
    ys, xs = np.where(a > 12)
    pad = 8
    box = (
        max(0, int(xs.min()) - pad),
        max(0, int(ys.min()) - pad),
        min(im.width, int(xs.max()) + 1 + pad),
        min(im.height, int(ys.max()) + 1 + pad),
    )
    crop = im.crop(box)
    # open chest is taller; keep aspect, fit into 140x120
    tw, th = 140, 120
    scale = min(tw / crop.width, th / crop.height)
    nw, nh = max(1, int(crop.width * scale)), max(1, int(crop.height * scale))
    crop = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    canvas.paste(crop, ((tw - nw) // 2, (th - nh) // 2), crop)
    dest = UI / "tier3_open.png"
    canvas.save(dest)
    print("open chest", canvas.size, dest)


def make_red_star() -> None:
    gold = Image.open(UI / "star_gold.png").convert("RGBA")
    a = np.array(gold).astype(np.float32)
    rgb = a[:, :, :3]
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    # gold -> candy red, keep highlights
    nr = np.clip(r * 0.55 + g * 0.55 + 40, 0, 255)
    ng = np.clip(g * 0.22 + r * 0.08, 0, 255)
    nb = np.clip(b * 0.28 + r * 0.05, 0, 255)
    # preserve near-white sparkles
    luma = rgb.mean(axis=2)
    spark = luma > 225
    nr = np.where(spark, np.minimum(255, r + 8), nr)
    ng = np.where(spark, np.minimum(255, g * 0.85), ng)
    nb = np.where(spark, np.minimum(255, b * 0.85), nb)
    a[:, :, 0] = nr
    a[:, :, 1] = ng
    a[:, :, 2] = nb
    Image.fromarray(a.astype(np.uint8)).save(UI / "star_red.png")
    print("star_red", Image.open(UI / "star_red.png").size)


if __name__ == "__main__":
    punch_lock()
    pack_chest()
    make_red_star()
