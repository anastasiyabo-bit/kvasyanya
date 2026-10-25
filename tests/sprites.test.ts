import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { INSECT_SHEETS } from '../src/art/insectSheets';

interface Rgba {
  w: number;
  h: number;
  px: Uint8Array;
}

function readPng(path: URL): Rgba {
  const buf = readFileSync(path);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let off = 8;
  let w = 0;
  let h = 0;
  const idat: Uint8Array[] = [];
  while (off < buf.length) {
    const len = dv.getUint32(off);
    const type = String.fromCharCode(...buf.subarray(off + 4, off + 8));
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = dv.getUint32(off + 8);
      h = dv.getUint32(off + 12);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error(`${path}: expected 8-bit RGBA, no interlace`);
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const all = new Uint8Array(idat.reduce((s, d) => s + d.length, 0));
  let p = 0;
  for (const d of idat) {
    all.set(d, p);
    p += d.length;
  }
  const raw = inflateSync(all);
  const stride = w * 4;
  const px = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? px[y * stride + x - 4] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y > 0 ? px[(y - 1) * stride + x - 4] : 0;
      let v = src[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = v & 255;
    }
  }
  return { w, h, px };
}

/** Pale-blue wing fill, the same test the asset script uses, grown to swallow the wing outline. */
function wingZone(img: Rgba, x0: number, fw: number, grow: number): Uint8Array {
  const fill = new Uint8Array(fw * img.h);
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < fw; x++) {
      const i = (y * img.w + x0 + x) * 4;
      const [r, g, b, a] = [img.px[i], img.px[i + 1], img.px[i + 2], img.px[i + 3]];
      if (a > 128 && r > 150 && g > r + 8 && b > r + 8 && Math.abs(g - b) < 30) fill[y * fw + x] = 1;
    }
  }
  const zone = new Uint8Array(fill.length);
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < fw; x++) {
      if (!fill[y * fw + x]) continue;
      for (let dy = -grow; dy <= grow; dy++) {
        for (let dx = -grow; dx <= grow; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy >= 0 && yy < img.h && xx >= 0 && xx < fw) zone[yy * fw + xx] = 1;
        }
      }
    }
  }
  return zone;
}

const sheets = Object.entries(INSECT_SHEETS);

describe('insect sprite sheets', () => {
  it.each(sheets)('%s keeps the same body on both wing frames', (_name, sheet) => {
    const img = readPng(new URL(`../public/${sheet.file}`, import.meta.url));
    const fw = sheet.frameWidth;
    expect(img.w).toBe(fw * 2);
    expect(img.h).toBe(sheet.frameHeight);

    const z0 = wingZone(img, 0, fw, 8);
    const z1 = wingZone(img, fw, fw, 8);
    let body0 = 0;
    let common = 0;
    let same = 0;
    for (let y = 0; y < img.h; y++) {
      for (let x = 0; x < fw; x++) {
        const k = y * fw + x;
        const i0 = (y * img.w + x) * 4;
        const i1 = (y * img.w + fw + x) * 4;
        const op0 = img.px[i0 + 3] > 128;
        const op1 = img.px[i1 + 3] > 128;
        if (op0 && !z0[k]) body0++;
        if (!op0 || !op1 || z0[k] || z1[k]) continue;
        common++;
        let d = 0;
        for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(img.px[i0 + c] - img.px[i1 + c]));
        if (d <= 24) same++;
      }
    }
    // Most of the body is visible on both frames and pixel-for-pixel the same: same size, same place.
    expect(common / body0).toBeGreaterThan(0.6);
    expect(same / common).toBeGreaterThan(0.97);
  });

  it.each(sheets)('%s has one body box for both frames, inside the frame', (_name, sheet) => {
    const { cx, cy, w, h } = sheet.body;
    expect(Math.abs(cx) + w / 2).toBeLessThanOrEqual(sheet.frameWidth / 2 + 1);
    expect(Math.abs(cy) + h / 2).toBeLessThanOrEqual(sheet.frameHeight / 2 + 1);
  });
});
