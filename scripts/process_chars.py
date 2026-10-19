#!/usr/bin/env python3
"""Chroma-key cartoon character frames and pack Phaser spritesheets."""

from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

SRC = Path("/Users/anastasiyamakarova/.cursor/projects/Users-anastasiyamakarova-nabey-bryushko/assets")
OUT = Path("/Users/anastasiyamakarova/Документы/скилы/nabey-bryushko/public/chars")

FROG_FRAMES = [
    "frog-idle-0.jpg",
    "frog-idle-1.jpg",
    "frog-blink.jpg",
    "frog-eat.jpg",
    "frog-oh.jpg",
]
SHEETS = {
    "frog": FROG_FRAMES,
    "fly": ["fly-wing-up.jpg", "fly-wing-down.jpg"],
    "mosquito": ["mosquito-wing-up.jpg", "mosquito-wing-down.jpg"],
    "fatfly": ["fatfly-wing-up.jpg", "fatfly-wing-down.jpg"],
    "goldfly": ["goldfly-wing-up.jpg", "goldfly-wing-down.jpg"],
}


def bg_color(arr: np.ndarray) -> np.ndarray:
    h, w = arr.shape[:2]
    patches = [
        arr[:16, :16],
        arr[:16, -16:],
        arr[-16:, :16],
        arr[-16:, -16:],
    ]
    return np.median(np.concatenate([p.reshape(-1, 3) for p in patches]), axis=0)


def flood_key(rgb: np.ndarray, thresh: float = 62) -> np.ndarray:
    """True where background, flooded from the edges."""
    h, w = rgb.shape[:2]
    bg = bg_color(rgb).astype(np.int32)
    diff = rgb.astype(np.int32) - bg
    dist2 = np.sum(diff * diff, axis=2)
    close = dist2 < int(thresh * thresh)

    bg_mask = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if close[y, x]:
                bg_mask[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if not bg_mask[y, x] and close[y, x]:
                bg_mask[y, x] = True
                q.append((y, x))

    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and not bg_mask[ny, nx] and close[ny, nx]:
                bg_mask[ny, nx] = True
                q.append((ny, nx))
    return bg_mask


def chroma(path: Path) -> Image.Image:
    img = Image.open(path).convert("RGB")
    arr = np.array(img)
    bg = flood_key(arr)
    rgba = np.dstack([arr, np.where(bg, 0, 255).astype(np.uint8)])
    im = Image.fromarray(rgba)
    alpha = im.getchannel("A").filter(ImageFilter.MinFilter(3))
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))
    im.putalpha(alpha)
    return im


def bbox(im: Image.Image, cut: int = 12) -> tuple[int, int, int, int]:
    a = np.array(im.split()[-1])
    ys, xs = np.where(a > cut)
    if xs.size == 0:
        return (0, 0, im.width, im.height)
    pad = 10
    x0 = max(0, int(xs.min()) - pad)
    y0 = max(0, int(ys.min()) - pad)
    x1 = min(im.width, int(xs.max()) + 1 + pad)
    y1 = min(im.height, int(ys.max()) + 1 + pad)
    return (x0, y0, x1, y1)


def _label_cc(mask: np.ndarray, min_area: int = 1500) -> list[list[tuple[int, int]]]:
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    comps: list[list[tuple[int, int]]] = []
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
                if len(pix) >= min_area:
                    comps.append(pix)
    return comps


def _fill_mask_holes(mask: np.ndarray) -> np.ndarray:
    h, w = mask.shape
    vis = np.zeros_like(mask, dtype=bool)
    inv = ~mask
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if inv[y, x] and not vis[y, x]:
                vis[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if inv[y, x] and not vis[y, x]:
                vis[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and not vis[ny, nx] and inv[ny, nx]:
                vis[ny, nx] = True
                q.append((ny, nx))
    return inv & ~vis


def wipe_frog_pupils(sheet: Image.Image, fw: int, fh: int) -> Image.Image:
    """Erase baked pupils inside cartoon eye-whites so live pupils can be drawn on top."""
    arr = np.array(sheet)
    n = sheet.width // fw
    for i in range(n):
        x0 = i * fw
        fr = arr[:, x0 : x0 + fw]
        r, g, b, a = (fr[:, :, c].astype(np.int16) for c in range(4))
        white = (a > 180) & (r > 225) & (g > 225) & (b > 225)
        comps = _label_cc(white)
        comps.sort(key=lambda pix: float(np.mean([p[1] for p in pix])))
        for pix in comps:
            ys = np.array([p[0] for p in pix])
            xs = np.array([p[1] for p in pix])
            med = np.median(fr[ys, xs, :3], axis=0)
            sub = np.zeros((fh, fw), dtype=bool)
            sub[ys, xs] = True
            y0, y1 = max(0, int(ys.min()) - 6), min(fh, int(ys.max()) + 7)
            xa, xb = max(0, int(xs.min()) - 6), min(fw, int(xs.max()) + 7)
            holes = _fill_mask_holes(sub[y0:y1, xa:xb])
            hol = holes.copy()
            dil = hol.copy()
            hh, ww = hol.shape
            for dy in range(-2, 3):
                for dx in range(-2, 3):
                    sy0, sy1 = max(0, dy), hh + min(0, dy)
                    sx0, sx1 = max(0, dx), ww + min(0, dx)
                    dy0, dy1 = max(0, -dy), hh - max(0, dy)
                    dx0, dx1 = max(0, -dx), ww - max(0, dx)
                    dil[dy0:dy1, dx0:dx1] |= hol[sy0:sy1, sx0:sx1]
            gy, gx = np.where(dil)
            arr[y0 + gy, x0 + xa + gx, 0] = med[0]
            arr[y0 + gy, x0 + xa + gx, 1] = med[1]
            arr[y0 + gy, x0 + xa + gx, 2] = med[2]
            arr[y0 + gy, x0 + xa + gx, 3] = 255

            # Pupils glued to the eyelid are not holes — fill a slightly larger
            # ellipse, but never paint frog-green so the lids stay intact.
            cx = (xs.min() + xs.max()) / 2
            cy = (ys.min() + ys.max()) / 2 - 3
            rx = (xs.max() - xs.min()) / 2 + 2
            ry = (ys.max() - ys.min()) / 2 + 8
            yy, xx = np.mgrid[y0:y1, xa:xb]
            d2 = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
            rr = arr[y0:y1, x0 + xa : x0 + xb, 0].astype(np.int16)
            gg = arr[y0:y1, x0 + xa : x0 + xb, 1].astype(np.int16)
            bb = arr[y0:y1, x0 + xa : x0 + xb, 2].astype(np.int16)
            aa = arr[y0:y1, x0 + xa : x0 + xb, 3]
            lum = 0.3 * rr + 0.59 * gg + 0.11 * bb
            frog_green = (gg > rr + 18) & (gg > 70)
            already = (rr > 225) & (gg > 225) & (bb > 225)
            fill = (d2 <= 0.92) & (aa > 40) & ~frog_green & ~already & (lum < 230)
            py, px = np.where(fill)
            arr[y0 + py, x0 + xa + px, 0] = med[0]
            arr[y0 + py, x0 + xa + px, 1] = med[1]
            arr[y0 + py, x0 + xa + px, 2] = med[2]
            arr[y0 + py, x0 + xa + px, 3] = 255

            # Flatten the whole eye interior to solid white (skip green lids/outline).
            rx2 = max(8.0, (xs.max() - xs.min()) / 2 - 1)
            ry2 = max(8.0, (ys.max() - ys.min()) / 2 - 1)
            cx2 = (xs.min() + xs.max()) / 2
            cy2 = (ys.min() + ys.max()) / 2
            d2b = ((xx - cx2) / rx2) ** 2 + ((yy - cy2) / ry2) ** 2
            gg2 = arr[y0:y1, x0 + xa : x0 + xb, 1].astype(np.int16)
            rr2 = arr[y0:y1, x0 + xa : x0 + xb, 0].astype(np.int16)
            green2 = (gg2 > rr2 + 12) & (gg2 > 90)
            flat = (d2b <= 1.0) & (aa > 40) & ~green2
            fy, fx = np.where(flat)
            arr[y0 + fy, x0 + xa + fx, 0] = 248
            arr[y0 + fy, x0 + xa + fx, 1] = 248
            arr[y0 + fy, x0 + xa + fx, 2] = 248
            arr[y0 + fy, x0 + xa + fx, 3] = 255
    return Image.fromarray(arr)


def place(frames: list[Image.Image], *, bottom: bool, target_h: int) -> tuple[Image.Image, int, int]:
    boxes = [bbox(im) for im in frames]
    widths = [b[2] - b[0] for b in boxes]
    heights = [b[3] - b[1] for b in boxes]
    cell_w = max(widths)
    cell_h = max(heights)
    packed: list[Image.Image] = []
    for im, b in zip(frames, boxes):
        crop = im.crop(b)
        cell = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
        x = (cell_w - crop.width) // 2
        y = cell_h - crop.height if bottom else (cell_h - crop.height) // 2
        cell.paste(crop, (x, y), crop)
        packed.append(cell)

    scale = target_h / cell_h
    fw = max(8, int(round(cell_w * scale / 2) * 2))
    fh = max(8, int(round(cell_h * scale / 2) * 2))
    resized = [p.resize((fw, fh), Image.Resampling.LANCZOS) for p in packed]
    sheet = Image.new("RGBA", (fw * len(resized), fh), (0, 0, 0, 0))
    for i, fr in enumerate(resized):
        sheet.paste(fr, (i * fw, 0), fr)
    return sheet, fw, fh


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    meta: list[str] = []
    for name, files in SHEETS.items():
        keyed = [chroma(SRC / f) for f in files]
        bottom = name == "frog"
        target = 520 if name == "frog" else 280
        sheet, fw, fh = place(keyed, bottom=bottom, target_h=target)
        if name == "frog":
            sheet = wipe_frog_pupils(sheet, fw, fh)
        dest = OUT / f"{name}.png"
        sheet.save(dest, optimize=True)
        meta.append(f"{name}: {fw}x{fh} x{len(files)} -> {dest} ({dest.stat().st_size} bytes)")
        print(meta[-1])
    (OUT / "meta.txt").write_text("\n".join(meta) + "\n")


if __name__ == "__main__":
    main()
