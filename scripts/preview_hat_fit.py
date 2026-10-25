#!/usr/bin/env python3
"""Composite every hat on Kvasi the way Frog.setHat() does, for fit tuning."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FW, FH = 624, 520


def main() -> None:
    fits = json.loads(Path(sys.argv[1]).read_text())
    behind = set(json.loads(sys.argv[2]))
    out = Path(sys.argv[3])
    sheet = Image.open(ROOT / "public" / "chars" / "frog.png").convert("RGBA")
    frog = sheet.crop((0, 0, FW, FH))
    cell_w, cell_h = 360, 400
    cols = 6
    rows = (len(fits) + cols - 1) // cols
    grid = Image.new("RGBA", (cols * cell_w, rows * cell_h), (124, 198, 232, 255))
    for i, fit in enumerate(fits):
        canvas = Image.new("RGBA", (FW, FH + 260), (0, 0, 0, 0))
        top = 260
        hat = Image.open(ROOT / "public" / "hats" / f"hat{i}.png").convert("RGBA")
        s = fit["scale"]
        hw, hh = round(hat.width * s), round(hat.height * s)
        hat = hat.resize((hw, hh), Image.Resampling.LANCZOS)
        ox = FW / 2 - hw * 0.5
        oy = top + FH + fit["y"] - hh * fit.get("originY", 0.96)
        if i in behind:
            canvas.alpha_composite(hat, (round(ox), round(oy)))
            canvas.alpha_composite(frog, (0, top))
        else:
            canvas.alpha_composite(frog, (0, top))
            canvas.alpha_composite(hat, (round(ox), round(oy)))
        thumb = canvas.resize((cell_w, round(canvas.height * cell_w / FW)), Image.Resampling.LANCZOS)
        thumb = thumb.crop((0, 0, cell_w, cell_h))
        grid.alpha_composite(thumb, ((i % cols) * cell_w, (i // cols) * cell_h))
    grid.save(out)


if __name__ == "__main__":
    main()
