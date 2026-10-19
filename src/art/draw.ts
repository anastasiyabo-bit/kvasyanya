import Phaser from 'phaser';
import { C } from '../config';

export type G = Phaser.GameObjects.Graphics;
export const OL = C.outline;

export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const gg = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (gg << 8) | bl;
}

export function shade(color: number, amount: number): number {
  return lerpColor(color, amount < 0 ? 0x000000 : 0xffffff, Math.abs(amount));
}

/** Outline pass: a bigger dark ellipse drawn beneath the fill so overlapping parts merge into one silhouette. */
export function olEllipse(g: G, x: number, y: number, w: number, h: number, lw = 6) {
  g.fillStyle(OL, 1);
  g.fillEllipse(x, y, w + lw * 2, h + lw * 2, 40);
}

export function olCircle(g: G, x: number, y: number, r: number, lw = 6) {
  g.fillStyle(OL, 1);
  g.fillCircle(x, y, r + lw);
}

/** Flat fill with a soft crescent shade bottom-right and a small highlight top-left (CTR/AB-like toon look). */
export function shadedEllipse(g: G, x: number, y: number, w: number, h: number, base: number, dark?: number, light?: boolean) {
  const sh = dark ?? shade(base, -0.22);
  g.fillStyle(sh, 1);
  g.fillEllipse(x, y, w, h, 40);
  g.fillStyle(base, 1);
  g.fillEllipse(x - w * 0.025, y - h * 0.03, w * 0.9, h * 0.9, 40);
  if (light !== false) {
    g.fillStyle(0xffffff, 0.3);
    g.fillEllipse(x - w * 0.2, y - h * 0.24, w * 0.3, h * 0.16, 24);
  }
}

export function shadedCircle(g: G, x: number, y: number, r: number, base: number, dark?: number, light?: boolean) {
  shadedEllipse(g, x, y, r * 2, r * 2, base, dark, light);
}

export function olRoundRect(g: G, x: number, y: number, w: number, h: number, r: number, lw = 6) {
  g.fillStyle(OL, 1);
  g.fillRoundedRect(x - lw, y - lw, w + lw * 2, h + lw * 2, r + lw);
}

export function shadedRoundRect(g: G, x: number, y: number, w: number, h: number, r: number, base: number, dark?: number) {
  const sh = dark ?? shade(base, -0.22);
  g.fillStyle(sh, 1);
  g.fillRoundedRect(x, y, w, h, r);
  g.fillStyle(base, 1);
  g.fillRoundedRect(x, y, w, h - Math.min(12, h * 0.18), r);
  g.fillStyle(0xffffff, 0.25);
  g.fillRoundedRect(x + w * 0.08, y + h * 0.1, w * 0.84, Math.max(4, h * 0.18), Math.min(r, h * 0.09));
}

export function starPoints(cx: number, cy: number, outer: number, inner: number, n = 5, rot = -Math.PI / 2) {
  const pts: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / n;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

export function olPolygon(g: G, pts: Phaser.Types.Math.Vector2Like[], fill: number, lw = 6) {
  g.lineStyle(lw * 2, OL, 1);
  g.beginPath();
  g.moveTo(pts[0].x!, pts[0].y!);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x!, pts[i].y!);
  g.closePath();
  g.strokePath();
  g.fillStyle(fill, 1);
  g.fillPoints(pts as Phaser.Math.Vector2[], true);
}

/** Vertical gradient made of flat bands — works identically in WebGL and Canvas texture generation. */
export function bands(g: G, x: number, y: number, w: number, h: number, top: number, bottom: number, steps = 18) {
  const bh = h / steps;
  for (let i = 0; i < steps; i++) {
    g.fillStyle(lerpColor(top, bottom, i / (steps - 1)), 1);
    g.fillRect(x, y + i * bh - 0.5, w, bh + 1);
  }
}

export function olLine(g: G, x1: number, y1: number, x2: number, y2: number, w: number, color: number, lw = 5) {
  g.lineStyle(w + lw * 2, OL, 1);
  g.lineBetween(x1, y1, x2, y2);
  g.fillStyle(OL, 1);
  g.fillCircle(x1, y1, w / 2 + lw);
  g.fillCircle(x2, y2, w / 2 + lw);
  g.lineStyle(w, color, 1);
  g.lineBetween(x1, y1, x2, y2);
  g.fillStyle(color, 1);
  g.fillCircle(x1, y1, w / 2);
  g.fillCircle(x2, y2, w / 2);
}

export function cloud(g: G, x: number, y: number, s: number, color = 0xffffff, lw = 5) {
  const parts: [number, number, number][] = [
    [-50, 8, 32],
    [-15, -12, 42],
    [28, -4, 36],
    [58, 12, 26],
    [5, 16, 34],
  ];
  for (const [dx, dy, r] of parts) olCircle(g, x + dx * s, y + dy * s, r * s, lw);
  for (const [dx, dy, r] of parts) {
    g.fillStyle(color, 1);
    g.fillCircle(x + dx * s, y + dy * s, r * s);
  }
}
