import Phaser from 'phaser';
import { C } from '../config';
import {
  G,
  OL,
  olCircle,
  olLine,
  olPolygon,
  olRoundRect,
  shade,
  starPoints,
} from './draw';

export const HAT_NAMES = [
  'Корона',
  'Бантик',
  'Колпачок',
  'Ковбойка',
  'Поварёнок',
  'Кувшинка',
  'Каска',
  'Медка',
  'Помпон',
  'Венок',
  'Цилиндр',
] as const;
export const HAT_COUNT = HAT_NAMES.length;

function bake(g: G, key: string, w: number, h: number, draw: (g: G) => void) {
  g.clear();
  draw(g);
  g.generateTexture(key, w, h);
}

function blush(g: G) {
  g.fillStyle(C.blush, 0.85);
  g.fillEllipse(16, 9, 28, 14);
  g.fillStyle(0xffffff, 0.5);
  g.fillEllipse(11, 6, 8, 4);
}

function frogPupil(g: G) {
  g.fillStyle(C.pupil, 1);
  g.fillCircle(22, 22, 18);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(16, 15, 6);
  g.fillCircle(27, 27, 2.6);
}

function frogPupilSad(g: G) {
  g.fillStyle(C.pupil, 1);
  g.fillEllipse(36, 44, 58, 52);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(24, 28, 11);
  g.fillCircle(46, 52, 4);
}

function spark(g: G, s = 1, color: number = C.gold) {
  const c = 18 * s + 6;
  olPolygon(g, starPoints(c, c, 18 * s, 6 * s, 4), color, 3);
  g.fillStyle(0xffffff, 0.6);
  g.fillCircle(c - 3 * s, c - 3 * s, 3 * s);
}

function heart(g: G) {
  const pts: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push({ x: 20 + x * 1, y: 18 + y * 1 });
  }
  olPolygon(g, pts, C.tongue, 3);
  g.fillStyle(0xffffff, 0.5);
  g.fillCircle(13, 11, 4);
}

function bigStar(g: G, filled: boolean) {
  olPolygon(g, starPoints(55, 57, 48, 22), filled ? C.gold : 0xcfc3a8, 6);
  if (filled) {
    g.fillStyle(shade(C.gold, 0.25), 1);
    g.fillPoints(starPoints(55, 57, 30, 14) as Phaser.Math.Vector2[], true);
    g.fillStyle(0xffffff, 0.6);
    g.fillEllipse(42, 40, 14, 8);
  }
}

function puff(g: G) {
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(22, 22, 20);
}

function button(g: G, w: number, h: number, base: number, dark: number) {
  const r = Math.min(h * 0.42, 50);
  g.fillStyle(OL, 1);
  g.fillRoundedRect(0, 0, w, h, r);
  g.fillStyle(dark, 1);
  g.fillRoundedRect(6, 6, w - 12, h - 12, r - 6);
  g.fillStyle(base, 1);
  g.fillRoundedRect(6, 6, w - 12, h - 24, r - 6);
  g.fillStyle(0xffffff, 0.28);
  g.fillRoundedRect(22, 14, w - 44, (h - 24) * 0.32, Math.min(r - 8, (h - 24) * 0.16));
}

function roundButton(g: G, base: number, dark: number) {
  g.fillStyle(OL, 1);
  g.fillCircle(56, 56, 56);
  g.fillStyle(dark, 1);
  g.fillCircle(56, 56, 50);
  g.fillStyle(base, 1);
  g.fillCircle(56, 50, 47);
  g.fillStyle(0xffffff, 0.28);
  g.fillEllipse(44, 30, 44, 18);
}

function panel(g: G, w: number, h: number) {
  g.fillStyle(OL, 1);
  g.fillRoundedRect(0, 0, w, h, 44);
  g.fillStyle(C.panelShade, 1);
  g.fillRoundedRect(7, 7, w - 14, h - 14, 38);
  g.fillStyle(C.panel, 1);
  g.fillRoundedRect(7, 7, w - 14, h - 26, 38);
  g.fillStyle(0xffffff, 0.35);
  g.fillRoundedRect(30, 18, w - 60, 16, 8);
}

type IconFn = (g: G) => void;
const ICON: Record<string, IconFn> = {
  pause: (g) => {
    olRoundRect(g, 14, 12, 13, 40, 4, 5);
    olRoundRect(g, 37, 12, 13, 40, 4, 5);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(14, 12, 13, 40, 4);
    g.fillRoundedRect(37, 12, 13, 40, 4);
  },
  play: (g) => olPolygon(g, [{ x: 18, y: 10 }, { x: 52, y: 32 }, { x: 18, y: 54 }], 0xffffff, 5),
  music: (g) => {
    olLine(g, 26, 14, 26, 44, 7, 0xffffff, 4);
    olLine(g, 26, 14, 48, 10, 7, 0xffffff, 4);
    olLine(g, 48, 10, 48, 38, 7, 0xffffff, 4);
    olCircle(g, 20, 46, 9, 4);
    olCircle(g, 42, 40, 9, 4);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(20, 46, 9);
    g.fillCircle(42, 40, 9);
  },
  sound: (g) => {
    olPolygon(g, [{ x: 10, y: 24 }, { x: 22, y: 24 }, { x: 36, y: 12 }, { x: 36, y: 52 }, { x: 22, y: 40 }, { x: 10, y: 40 }], 0xffffff, 5);
    g.lineStyle(10, OL, 1);
    g.beginPath();
    g.arc(36, 32, 16, -0.9, 0.9);
    g.strokePath();
    g.lineStyle(4, 0xffffff, 1);
    g.beginPath();
    g.arc(36, 32, 16, -0.9, 0.9);
    g.strokePath();
  },
  home: (g) => {
    olPolygon(g, [{ x: 32, y: 8 }, { x: 56, y: 30 }, { x: 50, y: 30 }, { x: 50, y: 54 }, { x: 14, y: 54 }, { x: 14, y: 30 }, { x: 8, y: 30 }], 0xffffff, 5);
    g.fillStyle(0xc9b896, 1);
    g.fillRoundedRect(26, 38, 12, 16, 3);
  },
  retry: (g) => {
    const cx = 32;
    const cy = 32;
    const r = 18;
    const hw = 5;
    const a0 = -Math.PI / 2 + 1.25;
    const sweep = Math.PI * 2 - 1.7;
    const n = 40;
    const a1 = a0 + sweep;
    const tx = -Math.sin(a1);
    const ty = Math.cos(a1);
    const ox = Math.cos(a1);
    const oy = Math.sin(a1);
    const pts: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i <= n; i++) {
      const t = a0 + (sweep * i) / n;
      pts.push({ x: cx + Math.cos(t) * (r + hw), y: cy + Math.sin(t) * (r + hw) });
    }
    pts.push({ x: cx + ox * (r + hw + 7) - tx * 1, y: cy + oy * (r + hw + 7) - ty * 1 });
    pts.push({ x: cx + ox * r + tx * 13, y: cy + oy * r + ty * 13 });
    pts.push({ x: cx + ox * (r - hw - 7) - tx * 1, y: cy + oy * (r - hw - 7) - ty * 1 });
    for (let i = n; i >= 0; i--) {
      const t = a0 + (sweep * i) / n;
      pts.push({ x: cx + Math.cos(t) * (r - hw), y: cy + Math.sin(t) * (r - hw) });
    }
    olPolygon(g, pts, 0xffffff, 5);
  },
  video: (g) => {
    olRoundRect(g, 8, 14, 48, 36, 8, 5);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(8, 14, 48, 36, 8);
    g.fillStyle(C.btnAltShade, 1);
    g.fillTriangle(26, 22, 26, 42, 42, 32);
  },
  off: (g) => {
    g.lineStyle(16, OL, 1);
    g.lineBetween(12, 12, 52, 52);
    g.lineStyle(8, C.btnRed, 1);
    g.lineBetween(12, 12, 52, 52);
  },
  lock: (g) => {
    g.lineStyle(16, OL, 1);
    g.beginPath();
    g.arc(32, 28, 12, Math.PI, 0);
    g.strokePath();
    g.lineStyle(7, 0xffffff, 1);
    g.beginPath();
    g.arc(32, 28, 12, Math.PI, 0);
    g.strokePath();
    olRoundRect(g, 14, 28, 36, 26, 6, 5);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(14, 28, 36, 26, 6);
  },
  arrow: (g) => {
    olPolygon(g, [{ x: 22, y: 6 }, { x: 42, y: 6 }, { x: 42, y: 32 }, { x: 56, y: 32 }, { x: 32, y: 58 }, { x: 8, y: 32 }, { x: 22, y: 32 }], C.tongue, 5);
  },
};

export function makeButtonTexture(scene: Phaser.Scene, key: string, w: number, h: number, base: number, dark: number) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  bake(g, key, w, h, (gg) => button(gg, w, h, base, dark));
  g.destroy();
}

export function makePanelTexture(scene: Phaser.Scene, key: string, w: number, h: number) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  bake(g, key, w, h, (gg) => panel(gg, w, h));
  g.destroy();
}

export function generateTextures(scene: Phaser.Scene) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  bake(g, 'blush', 32, 18, blush);
  bake(g, 'frog_pupil', 44, 44, frogPupil);
  bake(g, 'frog_pupil_sad', 72, 72, frogPupilSad);

  bake(g, 'spark_white', 48, 48, (gg) => spark(gg, 1, 0xffffff));
  bake(g, 'heart', 40, 38, heart);
  bake(g, 'star', 112, 112, (gg) => bigStar(gg, true));
  bake(g, 'star_empty', 112, 112, (gg) => bigStar(gg, false));
  bake(g, 'puff', 44, 44, puff);
  bake(g, 'dot', 16, 16, (gg) => {
    gg.fillStyle(0xffffff, 1);
    gg.fillCircle(8, 8, 8);
  });

  const skipIcon = new Set(['lock', 'music', 'sound', 'play', 'pause', 'retry', 'home', 'video']);
  for (const [name, fn] of Object.entries(ICON)) {
    if (skipIcon.has(name)) continue;
    bake(g, `ico_${name}`, 64, 64, fn);
  }

  bake(g, 'rbtn_green', 112, 112, (gg) => roundButton(gg, C.btn, C.btnShade));
  bake(g, 'rbtn_orange', 112, 112, (gg) => roundButton(gg, C.btnAlt, C.btnAltShade));
  bake(g, 'rbtn_red', 112, 112, (gg) => roundButton(gg, C.btnRed, C.btnRedShade));
  g.destroy();
}
