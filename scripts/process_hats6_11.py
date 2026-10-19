#!/usr/bin/env python3
"""Chroma-key hats 6–11 (worn + shop) into public/hats."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from process_chars import bbox, bg_color

SRC = Path("/Users/anastasiyamakarova/.cursor/projects/Users-anastasiyamakarova-nabey-bryushko/assets")
OUT = Path("/Users/anastasiyamakarova/Документы/скилы/nabey-bryushko/public/hats")
PREV = Path("/tmp/hats6-11")
PREV.mkdir(exist_ok=True)


def is_magenta_bg(rgb: np.ndarray, bg: np.ndarray) -> np.ndarray:
    """True magenta/hot-pink, not fire-engine red or pink highlights on red."""
    r = rgb[:, :, 0].astype(np.int32)
    g = rgb[:, :, 1].astype(np.int32)
    b = rgb[:, :, 2].astype(np.int32)
    br, bg_, bb = int(bg[0]), int(bg[1]), int(bg[2])
    dist2 = (r - br) ** 2 + (g - bg_) ** 2 + (b - bb) ** 2
    near = dist2 < 34 * 34
    # hue: R and B high, G tiny — red helmets have low B
    hue = (r > 160) & (g < 36) & (b > 70) & (b > g + 50) & (r - g > 90)
    return near | hue


def flood_magenta(rgb: np.ndarray) -> np.ndarray:
    from collections import deque

    h, w = rgb.shape[:2]
    bg = bg_color(rgb)
    close = is_magenta_bg(rgb, bg)
    mask = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if close[y, x]:
                mask[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if close[y, x] and not mask[y, x]:
                mask[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and not mask[ny, nx] and close[ny, nx]:
                mask[ny, nx] = True
                q.append((ny, nx))
    return mask


def chroma_hat(path: Path) -> Image.Image:
    img = Image.open(path).convert("RGB")
    arr = np.array(img)
    bg = flood_magenta(arr)
    rgba = np.dstack([arr, np.where(bg, 0, 255).astype(np.uint8)])
    im = Image.fromarray(rgba)
    alpha = im.getchannel("A").filter(ImageFilter.MinFilter(3))
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.5))
    im.putalpha(alpha)
    return im


def enclosed_magenta(im: Image.Image) -> np.ndarray:
    arr = np.array(im)
    rgb, a = arr[:, :, :3], arr[:, :, 3]
    bg = bg_color(rgb)
    return (a > 8) & is_magenta_bg(rgb, bg)


def key_enclosed_magenta(im: Image.Image) -> Image.Image:
    arr = np.array(im)
    holes = enclosed_magenta(im)
    arr[:, :, 3] = np.where(holes, 0, arr[:, :, 3])
    out = Image.fromarray(arr)
    alpha = out.getchannel("A").filter(ImageFilter.MinFilter(3))
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.4))
    out.putalpha(alpha)
    return out


def fill_enclosed_magenta(im: Image.Image, fill: tuple[int, int, int]) -> Image.Image:
    arr = np.array(im)
    holes = enclosed_magenta(im)
    arr[holes, 0] = fill[0]
    arr[holes, 1] = fill[1]
    arr[holes, 2] = fill[2]
    return Image.fromarray(arr)


def fit_box(im: Image.Image, size: int, mode: str, sit_frac: float | None = None) -> Image.Image:
    box = bbox(im, cut=16)
    crop = im.crop(box)
    cw, ch = crop.size
    if mode == "ushanka":
        canvas_w, canvas_h = size, int(size * 1.42)
        pad = 8
        scale = min((canvas_w - pad * 2) / cw, (canvas_h - pad * 2) / ch)
        nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
        resized = crop.resize((nw, nh), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        # sit line ≈ bottom of the front fur / top of hanging flaps
        sit = sit_frac if sit_frac is not None else 0.40
        sit_src = int(nh * sit)
        sit_dst = int(canvas_h * 0.40)
        x = (canvas_w - nw) // 2
        y = sit_dst - sit_src
        canvas.alpha_composite(resized, (x, y))
        return canvas

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pad = 8 if mode == "center" else 4
    scale = min((size - pad * 2) / cw, (size - pad * 2) / ch)
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    resized = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (size - nw) // 2
    y = (size - nh) // 2 if mode == "center" else size - pad - nh
    canvas.alpha_composite(resized, (x, max(0, y)))
    return canvas


def checker_preview(im: Image.Image, dest: Path) -> None:
    w, h = im.size
    bg = Image.new("RGB", (w, h), (40, 40, 48))
    for yy in range(0, h, 16):
        for xx in range(0, w, 16):
            if ((xx // 16) + (yy // 16)) % 2 == 0:
                bg.paste((72, 72, 84), (xx, yy, min(xx + 16, w), min(yy + 16, h)))
    bg.paste(im, mask=im.split()[-1])
    bg.save(dest, quality=92)


WORN = [
    # i, file, mode, extra
    (6, "hat-ushanka-worn2.jpg", "ushanka", None),
    (7, "hat-fire-worn2.jpg", "bottom", None),
    (8, "hat-nurse-worn.jpg", "bottom", None),
    (9, "hat-beanie-worn2.jpg", "bottom", "fill_beanie"),
    (10, "hat-wreath-worn.jpg", "bottom", "key_holes"),
    (11, "hat-tophat-worn.jpg", "bottom", None),
]

SHOP = [
    (6, "hatshop-ushanka.jpg"),
    (7, "hatshop-fire.jpg"),
    (8, "hatshop-nurse.jpg"),
    (9, "hatshop-beanie.jpg"),
    (10, "hatshop-wreath.jpg"),
    (11, "hatshop-tophat.jpg"),
]


def process_worn(i: int, name: str, mode: str, extra: str | None) -> None:
    im = chroma_hat(SRC / name)
    if extra == "fill_beanie":
        im = fill_enclosed_magenta(im, (36, 78, 128))
    elif extra == "key_holes":
        im = key_enclosed_magenta(im)
    packed = fit_box(im, 240 if mode != "ushanka" else 240, mode)
    dest = OUT / f"hat{i}.png"
    packed.save(dest)
    checker_preview(packed, PREV / f"hat{i}.jpg")
    a = np.array(packed)[:, :, 3]
    ys, xs = np.where(a > 12)
    print(
        f"hat{i}.png {packed.size} content {xs.max()-xs.min()+1}x{ys.max()-ys.min()+1} "
        f"top={ys.min()} bottom_pad={packed.size[1]-1-ys.max()} extra={extra}"
    )


def process_shop(i: int, name: str) -> None:
    im = chroma_hat(SRC / name)
    im = key_enclosed_magenta(im)
    packed = fit_box(im, 256, "center")
    dest = OUT / f"hatshop{i}.png"
    packed.save(dest)
    checker_preview(packed, PREV / f"hatshop{i}.jpg")
    a = np.array(packed)[:, :, 3]
    ys, xs = np.where(a > 12)
    print(
        f"hatshop{i}.png {packed.size} content {xs.max()-xs.min()+1}x{ys.max()-ys.min()+1} "
        f"top={ys.min()} bottom_pad={packed.size[1]-1-ys.max()}"
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for i, name, mode, extra in WORN:
        process_worn(i, name, mode, extra)
    for i, name in SHOP:
        process_shop(i, name)


if __name__ == "__main__":
    main()
