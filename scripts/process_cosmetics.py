#!/usr/bin/env python3
"""Cut generated 3x3 sheets into hat and belly-drawing sprites.

Each sheet is one magenta-ish background with nine outlined items. The
background is flooded from the edges (outlines stop the flood), then any
enclosed patch that is still exactly the background colour is keyed too.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = Path("/Users/anastasiyamakarova/.cursor/projects/Users-anastasiyamakarova-nabey-bryushko/assets")
HATS = ROOT / "public" / "hats"
ART = ROOT / "public" / "art"
PREVIEW = Path("/tmp/cosmetics-preview")

# (sheet, row, col) per output id, in unlock order.
NEW_HATS = [
    ("hats-sheet-1.jpg", 0, 0),  # 11 pirate
    ("hats-sheet-1.jpg", 0, 1),  # 12 wizard
    ("hats-sheet-1.jpg", 0, 2),  # 13 cap
    ("hats-sheet-1.jpg", 1, 0),  # 14 beret
    ("hats-sheet-1.jpg", 1, 1),  # 15 bucket hat
    ("hats-sheet-1.jpg", 1, 2),  # 16 bunny ears
    ("hats-sheet-1.jpg", 2, 0),  # 17 unicorn
    ("hats-sheet-1.jpg", 2, 1),  # 18 viking
    ("hats-sheet-1.jpg", 2, 2),  # 19 sombrero
    ("hats-sheet-2.jpg", 0, 0),  # 20 bowler
    ("hats-sheet-2.jpg", 0, 1),  # 21 tiara
    ("hats-sheet-2.jpg", 0, 2),  # 22 santa
    ("hats-sheet-2.jpg", 1, 0),  # 23 propeller
    ("hats-sheet-2.jpg", 1, 1),  # 24 mushroom
    ("hats-sheet-2.jpg", 1, 2),  # 25 graduation
    ("hats-sheet-2.jpg", 2, 0),  # 26 deerstalker
    ("hats-sheet-2.jpg", 2, 1),  # 27 straw hat
    ("hats-sheet-2.jpg", 2, 2),  # 28 jester
    ("hats-sheet-3.jpg", 1, 2),  # 29 cupcake
]

DRAWINGS = [
    ("belly-sheet-1.jpg", 0, 2),  # 0 heart
    ("belly-sheet-1.jpg", 0, 1),  # 1 flower
    ("belly-sheet-1.jpg", 0, 0),  # 2 butterfly
    ("belly-sheet-1.jpg", 1, 0),  # 3 star
    ("belly-sheet-1.jpg", 1, 1),  # 4 sun
    ("belly-sheet-1.jpg", 2, 2),  # 5 ladybug
    ("belly-sheet-1.jpg", 2, 1),  # 6 mushroom
    ("belly-sheet-2.jpg", 0, 1),  # 7 clover
    ("belly-sheet-2.jpg", 0, 2),  # 8 cherries
    ("belly-sheet-2.jpg", 0, 0),  # 9 moon
    ("belly-sheet-2.jpg", 1, 1),  # 10 goldfish
    ("belly-sheet-2.jpg", 1, 0),  # 11 snail
    ("belly-sheet-2.jpg", 1, 2),  # 12 music note
    ("belly-sheet-2.jpg", 2, 1),  # 13 ice cream
    ("belly-sheet-1.jpg", 1, 2),  # 14 rainbow
]


def bg_color(rgb: np.ndarray) -> np.ndarray:
    edge = np.concatenate([rgb[:24].reshape(-1, 3), rgb[-24:].reshape(-1, 3), rgb[:, :24].reshape(-1, 3), rgb[:, -24:].reshape(-1, 3)])
    return np.median(edge, axis=0)


def key_sheet(path: Path) -> np.ndarray:
    rgb = np.array(Image.open(path).convert("RGB")).astype(np.int32)
    bg = bg_color(rgb)
    dist = np.sqrt(np.sum((rgb - bg) ** 2, axis=2))
    loose = dist < 70
    lab, _ = ndimage.label(loose)
    edge_ids = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    flooded = np.isin(lab, edge_ids[edge_ids > 0])
    enclosed = dist < 34
    background = flooded | enclosed
    alpha = np.where(background, 0, 255).astype(np.uint8)
    rgba = np.dstack([rgb.astype(np.uint8), alpha])
    return rgba


def cell_items(rgba: np.ndarray, row: int, col: int) -> Image.Image:
    h, w = rgba.shape[:2]
    fg = rgba[:, :, 3] > 0
    lab, n = ndimage.label(fg)
    keep = np.zeros_like(fg)
    cw, ch = w / 3, h / 3
    for k, sl in enumerate(ndimage.find_objects(lab), start=1):
        if sl is None:
            continue
        comp = lab[sl] == k
        area = int(comp.sum())
        if area < 80:
            continue
        ys, xs = np.nonzero(comp)
        cy = ys.mean() + sl[0].start
        cx = xs.mean() + sl[1].start
        if int(cx // cw) == col and int(cy // ch) == row:
            keep[sl] |= comp
    ys, xs = np.nonzero(keep)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    out = rgba[y0:y1, x0:x1].copy()
    out[:, :, 3] = np.where(keep[y0:y1, x0:x1], out[:, :, 3], 0)
    im = Image.fromarray(out)
    a = im.getchannel("A").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    im.putalpha(a)
    return im


def pack(im: Image.Image, size: int, pad: int, bottom: bool, tight: bool = False) -> Image.Image:
    """Fit into a size x size square; `tight` trims the canvas to the scaled item so the game can fit it to a box."""
    a = np.array(im.getchannel("A"))
    ys, xs = np.nonzero(a > 10)
    im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    scale = min((size - pad * 2) / im.width, (size - pad * 2) / im.height)
    nw, nh = max(1, round(im.width * scale)), max(1, round(im.height * scale))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    if tight:
        canvas = Image.new("RGBA", (nw + pad * 2, nh + pad * 2), (0, 0, 0, 0))
        canvas.alpha_composite(im, (pad, pad))
        return canvas
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - nw) // 2
    y = size - pad - nh if bottom else (size - nh) // 2
    canvas.alpha_composite(im, (x, y))
    return canvas


def preview(items: list[Image.Image], dest: Path, cell: int) -> None:
    cols = 6
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cell, rows * cell), (250, 240, 200, 255))
    for i, im in enumerate(items):
        k = cell / max(im.width, im.height)
        fit = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))))
        sheet.alpha_composite(fit, ((i % cols) * cell + (cell - fit.width) // 2, (i // cols) * cell + (cell - fit.height) // 2))
    sheet.save(dest)


def main() -> None:
    HATS.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    keyed: dict[str, np.ndarray] = {}

    def get(name: str) -> np.ndarray:
        if name not in keyed:
            keyed[name] = key_sheet(SRC / name)
        return keyed[name]

    worn: list[Image.Image] = []
    for i, (sheet, r, c) in enumerate(NEW_HATS, start=11):
        item = cell_items(get(sheet), r, c)
        hat = pack(item, 240, 4, bottom=True)
        shop = pack(item, 256, 10, bottom=False)
        hat.save(HATS / f"hat{i}.png", optimize=True)
        shop.save(HATS / f"hatshop{i}.png", optimize=True)
        worn.append(hat)
    preview(worn, PREVIEW / "hats.png", 160)

    arts: list[Image.Image] = []
    for i, (sheet, r, c) in enumerate(DRAWINGS):
        art = pack(cell_items(get(sheet), r, c), 200, 6, bottom=False, tight=True)
        art.save(ART / f"art{i}.png", optimize=True)
        arts.append(art)
    preview(arts, PREVIEW / "art.png", 160)
    print(f"hats {len(worn)}, drawings {len(arts)}")


if __name__ == "__main__":
    main()
