#!/usr/bin/env python3
"""Build two-frame insect sheets where only the wings move.

Frame 0 is the source art with wings raised. Frame 1 reuses the exact same body
and swings each wing down around its root, so the body never changes size.
Also writes src/art/insectSheets.ts with frame sizes and the body box per sheet.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).parent))
from process_chars import bg_color, chroma  # noqa: E402

SRC = Path("/Users/anastasiyamakarova/.cursor/projects/Users-anastasiyamakarova-nabey-bryushko/assets")
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "chars"
TS_OUT = ROOT / "src" / "art" / "insectSheets.ts"

TARGET_H = 280

# name -> source with wings up (facing right). Optional per-sheet tweaks.
SHEETS: dict[str, dict] = {
    "fly": {"src": "fly-wing-up.jpg"},
    "mosquito": {"src": "mosquito-wing-up.jpg"},
    "fatfly": {"src": "fatfly-wing-up.jpg"},
    "goldfly": {"src": "goldfly-wing-up.jpg"},
    "sleepyfly": {"src": "fly-wing-up.jpg", "sleepy": True},
    "wasp": {"src": "wasp-wing-up.jpg"},
    "squeaker": {"src": "squeaker-wing-up.jpg"},
    "thief": {"src": "thief-wing-up.jpg", "key_enclosed": True},
    "glutton": {"src": "glutton-wing-up.jpg"},
    "firefly": {"src": "firefly-wing-up.jpg"},
}

# Single images (no flap): candy on the back, the caller's bell.
PROPS = {"candy": "candy.jpg", "bell": "bell.jpg"}


def wing_fill(rgb: np.ndarray, a: np.ndarray) -> np.ndarray:
    r, g, b = (rgb[:, :, i].astype(np.int16) for i in range(3))
    pale = (r > 150) & (g > r + 8) & (b > r + 8) & (np.abs(g - b) < 30)
    return pale & (a > 128)


def split_wings(im: Image.Image):
    arr = np.array(im)
    rgb, a = arr[:, :, :3], arr[:, :, 3]
    fill = wing_fill(rgb, a)
    fill = ndimage.binary_opening(fill, iterations=1)
    # veins split a wing into pieces; bridge them before labelling
    joined = ndimage.binary_closing(fill, iterations=7)
    lab, n = ndimage.label(joined)
    sizes = ndimage.sum(fill, lab, range(1, n + 1))
    wings = [i + 1 for i, s in enumerate(sizes) if s > 2500]
    lum = 0.3 * rgb[:, :, 0] + 0.59 * rgb[:, :, 1] + 0.11 * rgb[:, :, 2]
    dark = lum < 70
    light = (lum > 200) & (a > 20)
    masks = []
    taken = np.zeros_like(fill)
    for wi in wings:
        core = lab == wi
        core = ndimage.binary_fill_holes(core)
        core |= ndimage.binary_dilation(core, iterations=4) & light
        grown = ndimage.binary_dilation(core, iterations=14)
        m = (core | (grown & dark & (a > 20))) & ~taken
        taken |= m
        masks.append(m)
    return arr, masks


def clean_specks(arr: np.ndarray) -> np.ndarray:
    """Drop motion strokes and specks that float apart from the body."""
    a = arr[:, :, 3] > 20
    lab, n = ndimage.label(a)
    if n <= 1:
        return arr
    sizes = ndimage.sum(a, lab, range(1, n + 1))
    keep = np.zeros(n + 1, dtype=bool)
    big = sizes.max()
    for i, s in enumerate(sizes):
        if s >= big * 0.04:
            keep[i + 1] = True
    out = arr.copy()
    out[~keep[lab], 3] = 0
    return out


def affine_wing(layer: Image.Image, pivot: tuple[float, float], rot_deg: float, along: float, across: float, axis_deg: float):
    """Rotate a wing layer around its root, squashing it along/across its own axis (perspective of the downstroke)."""
    px, py = pivot
    th = math.radians(axis_deg)
    ux, uy = math.cos(th), math.sin(th)
    vx, vy = -uy, ux
    # forward map: p' = pivot + R * S * (p - pivot), S scales along u by `along`, along v by `across`
    s = np.array([[ux, vx], [uy, vy]]) @ np.diag([along, across]) @ np.array([[ux, uy], [vx, vy]])
    phi = math.radians(rot_deg)
    # image y is down; a visual counter-clockwise turn by phi is this matrix
    rot = np.array([[math.cos(phi), math.sin(phi)], [-math.sin(phi), math.cos(phi)]])
    fwd = rot @ s
    inv = np.linalg.inv(fwd)
    c = np.array([px, py]) - inv @ np.array([px, py])
    data = (inv[0, 0], inv[0, 1], c[0], inv[1, 0], inv[1, 1], c[1])
    return layer.transform(layer.size, Image.Transform.AFFINE, data, resample=Image.Resampling.BICUBIC)


def close_eyes(arr: np.ndarray) -> np.ndarray:
    """Paint lids over the orange eyes: body-coloured lid with a sleepy curved lash line."""
    out = arr.copy()
    rgb = out[:, :, :3].astype(np.int16)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    orange = (r > 150) & (r > g + 40) & (b < 130) & (out[:, :, 3] > 128)
    orange = ndimage.binary_closing(orange, iterations=3)
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    orange |= ndimage.binary_dilation(orange, iterations=3) & (lum > 55) & (r > g)
    lab, n = ndimage.label(orange)
    sizes = ndimage.sum(orange, lab, range(1, n + 1))
    lid = np.array([70, 104, 108], dtype=np.uint8)
    lid_dark = np.array([48, 80, 84], dtype=np.uint8)
    img = Image.fromarray(out)
    from PIL import ImageDraw

    d = ImageDraw.Draw(img)
    for i, s in enumerate(sizes):
        if s < 1500:
            continue
        m = ndimage.binary_fill_holes(lab == i + 1)
        ys, xs = np.where(m)
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        cy = (y0 + y1) / 2
        # whole eye becomes lid, darker in the lower half
        sel = m
        upper = sel & (np.arange(out.shape[0])[:, None] < cy + (y1 - y0) * 0.1)
        arr_img = np.array(img)
        arr_img[sel, :3] = lid_dark
        arr_img[upper, :3] = lid
        img = Image.fromarray(arr_img)
        d = ImageDraw.Draw(img)
        w = x1 - x0
        h = y1 - y0
        box = (x0 + w * 0.14, cy - h * 0.18, x1 - w * 0.14, cy + h * 0.32)
        d.arc(box, start=15, end=165, fill=(20, 14, 12, 255), width=max(6, int(w * 0.07)))
        # tiny lashes
        for t in (0.3, 0.5, 0.7):
            ang = math.radians(15 + 150 * t)
            ex = (box[0] + box[2]) / 2 + math.cos(ang) * (box[2] - box[0]) / 2
            ey = (box[1] + box[3]) / 2 + math.sin(ang) * (box[3] - box[1]) / 2
            d.line([(ex, ey), (ex + math.cos(ang) * w * 0.09, ey + math.sin(ang) * w * 0.09)], fill=(20, 14, 12, 255), width=max(4, int(w * 0.04)))
    return np.array(img)


def build(name: str, spec: dict):
    src = SRC / spec["src"]
    im = chroma(src)
    if spec.get("key_enclosed"):
        raw = np.array(Image.open(src).convert("RGB"))
        bg = bg_color(raw).astype(np.int32)
        d = np.sqrt(np.sum((raw.astype(np.int32) - bg) ** 2, axis=2))
        keyed = np.array(im)
        hole = ndimage.binary_dilation(d < 60, iterations=2)
        keyed[hole, 3] = 0
        im = Image.fromarray(keyed)
    arr, wing_masks = split_wings(im)
    arr = clean_specks(arr)
    if spec.get("sleepy"):
        arr = close_eyes(arr)
    if not wing_masks:
        raise SystemExit(f"{name}: no wings found")

    body = arr.copy()
    all_wings = np.zeros(arr.shape[:2], dtype=bool)
    for m in wing_masks:
        all_wings |= m
    body[all_wings, 3] = 0
    body_mask = body[:, :, 3] > 20
    body_lab, _ = ndimage.label(body_mask)
    sizes = np.bincount(body_lab.ravel())
    sizes[0] = 0
    main = body_lab == sizes.argmax()
    body[~main, 3] = 0
    body_mask = main

    up = Image.fromarray(arr)
    down = Image.new("RGBA", up.size, (0, 0, 0, 0))
    body_img = Image.fromarray(body)

    wings = []
    near_body = ndimage.binary_dilation(body_mask, iterations=10)
    for m in wing_masks:
        contact = m & near_body
        ys, xs = np.where(contact if contact.sum() > 50 else m)
        pivot = (float(xs.mean()), float(ys.mean()))
        wy, wx = np.where(m)
        d2 = (wx - pivot[0]) ** 2 + (wy - pivot[1]) ** 2
        k = int(d2.argmax())
        tip = (float(wx[k]), float(wy[k]))
        ang = math.degrees(math.atan2(tip[1] - pivot[1], tip[0] - pivot[0])) % 360
        layer = np.zeros_like(arr)
        layer[m] = arr[m]
        wings.append({"pivot": pivot, "tip": tip, "ang": ang, "layer": Image.fromarray(layer)})

    # rear wing = tip further back (left); goes under the body
    wings.sort(key=lambda w: w["tip"][0])
    targets = [168.0, 150.0] if len(wings) > 1 else [158.0]
    for i, w in enumerate(wings):
        tgt = targets[min(i, len(targets) - 1)]
        rot = (w["ang"] - tgt + 540) % 360 - 180
        w["down"] = affine_wing(w["layer"], w["pivot"], rot, 0.86, 0.78, w["ang"])

    if len(wings) > 1:
        down.alpha_composite(wings[0]["down"])
        down.alpha_composite(body_img)
        for w in wings[1:]:
            down.alpha_composite(w["down"])
    else:
        down.alpha_composite(body_img)
        down.alpha_composite(wings[0]["down"])

    # union crop so both frames share one anchor
    def box_of(img: Image.Image):
        a = np.array(img)[:, :, 3]
        ys, xs = np.where(a > 12)
        return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1

    b0, b1 = box_of(up), box_of(down)
    pad = 10
    x0 = max(0, min(b0[0], b1[0]) - pad)
    y0 = max(0, min(b0[1], b1[1]) - pad)
    x1 = min(up.width, max(b0[2], b1[2]) + pad)
    y1 = min(up.height, max(b0[3], b1[3]) + pad)
    cw, ch = x1 - x0, y1 - y0
    scale = TARGET_H / ch
    fw = int(round(cw * scale / 2) * 2)
    fh = TARGET_H
    frames = [f.crop((x0, y0, x1, y1)).resize((fw, fh), Image.Resampling.LANCZOS) for f in (up, down)]
    sheet = Image.new("RGBA", (fw * 2, fh), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * fw, 0), f)
    sheet.save(OUT / f"{name}.png", optimize=True)

    ys, xs = np.where(body_mask)
    bx0 = (xs.min() - x0) * scale
    bx1 = (xs.max() + 1 - x0) * scale
    by0 = (ys.min() - y0) * scale
    by1 = (ys.max() + 1 - y0) * scale
    info = {
        "frameWidth": fw,
        "frameHeight": fh,
        "cx": round((bx0 + bx1) / 2 - fw / 2, 1),
        "cy": round((by0 + by1) / 2 - fh / 2, 1),
        "w": round(bx1 - bx0, 1),
        "h": round(by1 - by0, 1),
    }
    print(name, info)
    return info


def build_prop(name: str, file: str, target: int = 160):
    im = chroma(SRC / file)
    arr = clean_specks(np.array(im))
    a = arr[:, :, 3]
    ys, xs = np.where(a > 12)
    pad = 6
    crop = Image.fromarray(arr).crop((xs.min() - pad, ys.min() - pad, xs.max() + 1 + pad, ys.max() + 1 + pad))
    s = target / max(crop.size)
    crop = crop.resize((int(round(crop.width * s)), int(round(crop.height * s))), Image.Resampling.LANCZOS)
    crop.save(OUT / f"{name}.png", optimize=True)
    print(name, crop.size)
    return {"frameWidth": crop.width, "frameHeight": crop.height}


def main() -> None:
    only = set(sys.argv[1:])
    infos: dict[str, dict] = {}
    for name, spec in SHEETS.items():
        if not (SRC / spec["src"]).exists():
            print(f"skip {name}: no source {spec['src']}")
            continue
        if only and name not in only:
            continue
        infos[name] = build(name, spec)
    props: dict[str, dict] = {}
    for name, file in PROPS.items():
        if (SRC / file).exists() and (not only or name in only):
            props[name] = build_prop(name, file)
    if only:
        return
    lines = [
        "// Generated by scripts/build_insects.py. Body box is relative to the frame centre, in texture pixels.",
        "export interface InsectSheet {",
        "  file: string;",
        "  frameWidth: number;",
        "  frameHeight: number;",
        "  body: { cx: number; cy: number; w: number; h: number };",
        "}",
        "",
        "export const INSECT_SHEETS = {",
    ]
    for name, i in infos.items():
        lines.append(
            f"  {name}: {{ file: 'chars/{name}.png', frameWidth: {i['frameWidth']}, frameHeight: {i['frameHeight']}, "
            f"body: {{ cx: {i['cx']}, cy: {i['cy']}, w: {i['w']}, h: {i['h']} }} }},"
        )
    lines.append("} as const satisfies Record<string, InsectSheet>;")
    lines.append("")
    lines.append("export const PROP_SHEETS = {")
    for name, p in props.items():
        lines.append(f"  {name}: {{ file: 'chars/{name}.png', frameWidth: {p['frameWidth']}, frameHeight: {p['frameHeight']} }},")
    lines.append("} as const;")
    TS_OUT.write_text("\n".join(lines) + "\n")
    print("wrote", TS_OUT)


if __name__ == "__main__":
    main()
