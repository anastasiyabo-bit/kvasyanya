import Phaser from 'phaser';
import { H, PERCH_Y, W } from '../config';
import {
  G,
  OL,
  bands,
  cloud,
  olCircle,
  olEllipse,
  olLine,
  olPolygon,
  olRoundRect,
  shade,
  shadedCircle,
  shadedEllipse,
  shadedRoundRect,
  starPoints,
} from './draw';

/** Visual frog feet. Perch TOP sits a bit above this so she plants into the seat. */
const P = PERCH_Y - 8;
const SEAT = P - 8;
const CX = W / 2;

function seatCenter(h: number) {
  return SEAT + h / 2;
}

export interface Theme {
  name: string;
  draw: (g: G) => void;
}

function sky(g: G, top: number, bottom: number, h = H) {
  bands(g, 0, 0, W, h, top, bottom, 24);
}

function hills(g: G, y: number, color: number, amp = 50, seed = 0) {
  g.fillStyle(OL, 1);
  const pts: Phaser.Types.Math.Vector2Like[] = [{ x: -10, y: H }];
  for (let x = -10; x <= W + 10; x += 20) {
    pts.push({ x, y: y - 5 + Math.sin(x / 110 + seed) * amp * 0.6 + Math.sin(x / 47 + seed * 2) * amp * 0.25 });
  }
  pts.push({ x: W + 10, y: H });
  g.fillPoints(pts as Phaser.Math.Vector2[], true);
  g.fillStyle(color, 1);
  g.fillPoints(pts.map((p) => ({ x: p.x, y: (p.y ?? 0) + 6 })) as Phaser.Math.Vector2[], true);
}

function water(g: G, y: number, top: number, bottom: number) {
  g.fillStyle(OL, 1);
  g.fillRect(0, y - 6, W, 6);
  bands(g, 0, y, W, H - y, top, bottom, 12);
  g.lineStyle(5, 0xffffff, 0.45);
  for (let i = 0; i < 9; i++) {
    const wx = (i * 173) % W;
    const wy = y + 40 + ((i * 67) % (H - y - 80));
    g.lineBetween(wx, wy, wx + 46, wy);
  }
}

function reed(g: G, x: number, y: number, h: number, lean = 0) {
  olLine(g, x, y, x + lean, y - h, 6, 0x5d9c3a, 4);
  olEllipse(g, x + lean, y - h + 10, 18, 46, 4);
  shadedEllipse(g, x + lean, y - h + 10, 18, 46, 0x8a5a32, undefined, false);
}

function grassTuft(g: G, x: number, y: number, s = 1, color = 0x5fae3a) {
  const pts = [
    { x: x - 26 * s, y },
    { x: x - 20 * s, y: y - 30 * s },
    { x: x - 8 * s, y: y - 10 * s },
    { x, y: y - 42 * s },
    { x: x + 8 * s, y: y - 10 * s },
    { x: x + 22 * s, y: y - 32 * s },
    { x: x + 26 * s, y },
  ];
  olPolygon(g, pts, color, 4);
}

function rock(g: G, x: number, y: number, w: number, h: number, color = 0x9aa1a8) {
  olEllipse(g, x, y, w, h);
  shadedEllipse(g, x, y, w, h, color);
  g.fillStyle(shade(color, -0.12), 1);
  g.fillCircle(x + w * 0.22, y - h * 0.05, h * 0.09);
  g.fillCircle(x - w * 0.3, y + h * 0.1, h * 0.06);
}

function sun(g: G, x: number, y: number, r: number, color = 0xffe066) {
  g.fillStyle(0xffffff, 0.22);
  g.fillCircle(x, y, r * 1.5);
  olCircle(g, x, y, r, 5);
  shadedCircle(g, x, y, r, color);
}

function tiles(g: G, y0: number, y1: number, size: number, a: number, b: number) {
  for (let ty = y0, row = 0; ty < y1; ty += size, row++) {
    for (let tx = 0, col = 0; tx < W; tx += size, col++) {
      g.fillStyle((row + col) % 2 ? a : b, 1);
      g.fillRect(tx, ty, size, size);
    }
  }
  g.lineStyle(3, shade(a, -0.15), 1);
  for (let ty = y0; ty <= y1; ty += size) g.lineBetween(0, ty, W, ty);
  for (let tx = 0; tx <= W; tx += size) g.lineBetween(tx, y0, tx, y1);
}

function floor(g: G, y: number, color: number) {
  g.fillStyle(OL, 1);
  g.fillRect(0, y - 6, W, 6);
  bands(g, 0, y, W, H - y, color, shade(color, -0.25), 8);
}

function windowFrame(g: G, x: number, y: number, w: number, h: number, skyTop: number, skyBottom: number, frame = 0xffffff) {
  olRoundRect(g, x, y, w, h, 14, 7);
  g.fillStyle(frame, 1);
  g.fillRoundedRect(x, y, w, h, 14);
  bands(g, x + 14, y + 14, w - 28, h - 28, skyTop, skyBottom, 10);
  g.fillStyle(frame, 1);
  g.fillRect(x + w / 2 - 6, y, 12, h);
  g.fillRect(x, y + h / 2 - 6, w, 12);
}

// ---------- themes ----------

const lake: Theme = {
  name: 'Тихое озеро',
  draw: (g) => {
    sky(g, 0x6ec6f0, 0xd4f1ff);
    sun(g, 590, 390, 60);
    cloud(g, 150, 360, 1.1);
    cloud(g, 520, 580, 0.8);
    hills(g, 760, 0x86c95a, 40, 1);
    water(g, 860, 0x5cc0e6, 0x2f86c4);
    reed(g, 60, 960, 190, -12);
    reed(g, 96, 970, 150, 8);
    reed(g, 650, 950, 170, 10);
    reed(g, 680, 990, 120, -6);
    rock(g, CX, seatCenter(170), 400, 170);
    grassTuft(g, CX - 150, SEAT + 26, 0.9);
    grassTuft(g, CX + 160, SEAT + 30, 0.8);
  },
};

const swamp: Theme = {
  name: 'Болото',
  draw: (g) => {
    sky(g, 0x9fc78a, 0xe6edb5);
    sun(g, 140, 220, 50, 0xfff2a0);
    for (const [x, h] of [
      [90, 380],
      [640, 440],
    ] as const) {
      olLine(g, x, 900, x + 10, 900 - h, 26, 0x6b5440, 5);
      olLine(g, x + 6, 900 - h * 0.6, x + 70, 900 - h * 0.8, 12, 0x6b5440, 5);
      olLine(g, x + 8, 900 - h * 0.75, x - 50, 900 - h * 0.95, 10, 0x6b5440, 5);
    }
    hills(g, 820, 0x7a9b4a, 30, 3);
    water(g, 900, 0x6f9a4c, 0x435f2b);
    for (let i = 0; i < 6; i++) {
      olCircle(g, 70 + i * 120, 1000 + (i % 2) * 140, 10, 3);
      g.fillStyle(0xa9c97a, 1);
      g.fillCircle(70 + i * 120, 1000 + (i % 2) * 140, 10);
    }
    reed(g, 40, 1000, 210, 6);
    reed(g, 680, 1010, 220, -10);
    // stump perch
    const stumpTop = 66;
    const stumpY = seatCenter(stumpTop);
    olEllipse(g, CX, stumpY + 142, 330, 300);
    shadedRoundRect(g, CX - 165, stumpY, 330, 300, 30, 0x8a6142);
    olEllipse(g, CX, stumpY, 330, stumpTop, 6);
    shadedEllipse(g, CX, stumpY, 330, stumpTop, 0xd9b27a, 0xb88a52, false);
    g.lineStyle(4, 0xa87a48, 1);
    g.strokeEllipse(CX, stumpY, 220, 40);
    g.strokeEllipse(CX, stumpY, 110, 20);
    g.lineStyle(6, 0x6b4a30, 1);
    g.lineBetween(CX - 100, stumpY + 62, CX - 100, stumpY + 192);
    g.lineBetween(CX + 80, stumpY + 52, CX + 80, stumpY + 212);
  },
};

const lilies: Theme = {
  name: 'Пруд с кувшинками',
  draw: (g) => {
    sky(g, 0xffa86b, 0xffe2a8);
    sun(g, CX, 560, 120, 0xffd25a);
    hills(g, 720, 0xc77a8a, 30, 5);
    water(g, 780, 0x7ab7e0, 0x4f78c0);
    const pads: [number, number, number][] = [
      [100, 860, 0.7],
      [610, 900, 0.8],
      [130, 1150, 0.9],
      [620, 1180, 1],
    ];
    for (const [x, y, s] of pads) lilyPad(g, x, y, s, true);
    lilyPad(g, CX, seatCenter(56 * 2.3), 2.3, false);
  },
};

function lilyPad(g: G, x: number, y: number, s: number, flower: boolean) {
  const w = 160 * s;
  const h = 56 * s;
  olEllipse(g, x, y, w, h, 5);
  shadedEllipse(g, x, y, w, h, 0x6fc24a, 0x4f9c36);
  g.fillStyle(0x4f78c0, 1);
  g.fillTriangle(x, y, x + w * 0.5, y - h * 0.12, x + w * 0.5, y + h * 0.18);
  if (flower) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      olEllipse(g, x - w * 0.15 + Math.cos(a) * 14 * s, y - 16 * s + Math.sin(a) * 8 * s, 24 * s, 22 * s, 3);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.fillStyle(0xffb3d1, 1);
      g.fillEllipse(x - w * 0.15 + Math.cos(a) * 14 * s, y - 16 * s + Math.sin(a) * 8 * s, 24 * s, 22 * s);
    }
    g.fillStyle(0xffd84d, 1);
    g.fillCircle(x - w * 0.15, y - 16 * s, 8 * s);
  }
}

const kitchen: Theme = {
  name: 'Бабушкина кухня',
  draw: (g) => {
    g.fillStyle(0xfff0c8, 1);
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 60) {
      g.fillStyle(0xffe1a0, 1);
      g.fillRect(x, 0, 30, 860);
    }
    windowFrame(g, 410, 330, 250, 300, 0x8fd3ff, 0xd9f3ff);
    // curtains
    olRoundRect(g, 390, 300, 70, 350, 30, 5);
    olRoundRect(g, 610, 300, 70, 350, 30, 5);
    shadedRoundRect(g, 390, 300, 70, 350, 30, 0xff7e7e);
    shadedRoundRect(g, 610, 300, 70, 350, 30, 0xff7e7e);
    // shelf with pots
    olRoundRect(g, 30, 560, 300, 20, 6, 5);
    shadedRoundRect(g, 30, 560, 300, 20, 6, 0xb8783f);
    for (const [x, col] of [
      [80, 0x5fb8ff],
      [170, 0xffc93c],
      [260, 0x7fd34e],
    ] as const) {
      olRoundRect(g, x - 34, 484, 68, 70, 14, 5);
      shadedRoundRect(g, x - 34, 484, 68, 70, 14, col);
      olRoundRect(g, x - 40, 474, 80, 16, 6, 4);
      shadedRoundRect(g, x - 40, 474, 80, 16, 6, shade(col, -0.1));
    }
    // counter
    g.fillStyle(OL, 1);
    g.fillRect(0, 854, W, H - 854);
    tiles(g, 920, H, 90, 0xffffff, 0xd6eefc);
    shadedRoundRect(g, 0, 860, W, 56, 0, 0xc98a52);
    // plate perch
    const plateY = seatCenter(80);
    olEllipse(g, CX, plateY, 400, 80);
    shadedEllipse(g, CX, plateY, 400, 80, 0xffffff, 0xd8e3ea);
    g.lineStyle(5, 0x7fb8e0, 1);
    g.strokeEllipse(CX, plateY - 4, 300, 50);
    // spoon
    olLine(g, 610, 1180, 690, 1100, 12, 0xc8d0d8, 4);
    olEllipse(g, 600, 1192, 44, 30, 4);
    shadedEllipse(g, 600, 1192, 44, 30, 0xc8d0d8);
  },
};

const picnic: Theme = {
  name: 'Пикник',
  draw: (g) => {
    sky(g, 0x6fd0ff, 0xe0f7ff);
    sun(g, 120, 200, 56);
    cloud(g, 520, 260, 1);
    cloud(g, 230, 520, 0.7);
    hills(g, 740, 0x9bd85f, 50, 2);
    // tree
    olLine(g, 610, 900, 600, 640, 40, 0x8a5a32, 6);
    for (const [x, y, r] of [
      [600, 560, 90],
      [530, 620, 66],
      [670, 630, 70],
    ] as const)
      olCircle(g, x, y, r, 6);
    for (const [x, y, r] of [
      [600, 560, 90],
      [530, 620, 66],
      [670, 630, 70],
    ] as const)
      shadedCircle(g, x, y, r, 0x5fbf3e, 0x3f9a2a);
    floor(g, 900, 0x8ed057);
    // checkered blanket in perspective
    const top = 960;
    const pts = [
      { x: 90, y: top },
      { x: 630, y: top },
      { x: 720, y: 1240 },
      { x: 0, y: 1240 },
    ];
    olPolygon(g, pts, 0xffffff, 6);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 6; c++) {
        if ((r + c) % 2) continue;
        const t0 = r / 4;
        const t1 = (r + 1) / 4;
        const lx0 = 90 - 90 * t0;
        const rx0 = 630 + 90 * t0;
        const lx1 = 90 - 90 * t1;
        const rx1 = 630 + 90 * t1;
        const y0 = top + 280 * t0;
        const y1 = top + 280 * t1;
        const q = [
          { x: lx0 + ((rx0 - lx0) * c) / 6, y: y0 },
          { x: lx0 + ((rx0 - lx0) * (c + 1)) / 6, y: y0 },
          { x: lx1 + ((rx1 - lx1) * (c + 1)) / 6, y: y1 },
          { x: lx1 + ((rx1 - lx1) * c) / 6, y: y1 },
        ];
        g.fillStyle(0xff6b6b, 1);
        g.fillPoints(q as Phaser.Math.Vector2[], true);
      }
    }
    // basket
    olRoundRect(g, 40, 900, 150, 110, 20, 6);
    shadedRoundRect(g, 40, 900, 150, 110, 20, 0xd9a05a);
    g.lineStyle(8, OL, 1);
    g.beginPath();
    g.arc(115, 910, 60, Math.PI, 0);
    g.strokePath();
    // sandwich perch
    olRoundRect(g, CX - 170, SEAT, 340, 120, 30);
    shadedRoundRect(g, CX - 170, SEAT, 340, 120, 30, 0xf2c27a);
    g.fillStyle(0x7fd34e, 1);
    g.fillRoundedRect(CX - 175, SEAT + 26, 350, 22, 10);
    g.fillStyle(0xff6b6b, 1);
    g.fillRoundedRect(CX - 160, SEAT + 48, 320, 18, 8);
    g.fillStyle(0xffd84d, 1);
    g.fillRoundedRect(CX - 165, SEAT + 66, 330, 14, 6);
  },
};

const bath: Theme = {
  name: 'Ванная',
  draw: (g) => {
    tiles(g, 0, H, 80, 0xd9f2ff, 0xbfe6fb);
    // mirror
    olRoundRect(g, 420, 300, 230, 280, 110, 7);
    shadedRoundRect(g, 420, 300, 230, 280, 110, 0xeaf8ff, 0xc6e4f3);
    g.lineStyle(8, 0xffffff, 0.8);
    g.lineBetween(470, 400, 520, 350);
    g.lineBetween(480, 450, 560, 370);
    // tub
    olRoundRect(g, -40, 820, 520, 260, 90, 7);
    shadedRoundRect(g, -40, 820, 520, 260, 90, 0xffffff, 0xd6e3ea);
    for (let i = 0; i < 9; i++) {
      const bx = 20 + i * 52;
      const by = 820 - ((i * 37) % 50);
      olCircle(g, bx, by, 26 + (i % 3) * 6, 4);
    }
    for (let i = 0; i < 9; i++) {
      const bx = 20 + i * 52;
      const by = 820 - ((i * 37) % 50);
      shadedCircle(g, bx, by, 26 + (i % 3) * 6, 0xffffff, 0xe0f2ff);
    }
    // duck
    olEllipse(g, 600, 900, 120, 80);
    olCircle(g, 620, 840, 36);
    shadedEllipse(g, 600, 900, 120, 80, 0xffd84d);
    shadedCircle(g, 620, 840, 36, 0xffd84d);
    olEllipse(g, 660, 850, 40, 18, 4);
    g.fillStyle(0xff9b3c, 1);
    g.fillEllipse(660, 850, 40, 18);
    g.fillStyle(OL, 1);
    g.fillCircle(630, 830, 6);
    floor(g, 1080, 0x9ec9e0);
    // soap perch
    olRoundRect(g, CX - 180, SEAT, 360, 110, 46);
    shadedRoundRect(g, CX - 180, SEAT, 360, 110, 46, 0xffa6c9, 0xf07aa8);
    for (const [x, y, r] of [
      [CX - 120, SEAT + 2, 22],
      [CX + 130, SEAT, 18],
      [CX + 100, SEAT - 22, 12],
    ] as const) {
      olCircle(g, x, y, r, 3);
      shadedCircle(g, x, y, r, 0xffffff, 0xe0f2ff);
    }
  },
};

const office: Theme = {
  name: 'Офис',
  draw: (g) => {
    g.fillStyle(0xe8e4f2, 1);
    g.fillRect(0, 0, W, H);
    windowFrame(g, 60, 260, 600, 420, 0x6cb8f0, 0xbfe3ff, 0xf5f5f5);
    // city
    for (let i = 0; i < 8; i++) {
      const bw = 60;
      const bh = 120 + ((i * 53) % 150);
      const bx = 80 + i * 70;
      g.fillStyle(0x8fa6c8, 1);
      g.fillRect(bx, 660 - bh, bw, bh);
      g.fillStyle(0xfff3a0, 1);
      for (let wy = 660 - bh + 14; wy < 650; wy += 30) g.fillRect(bx + 12, wy, 12, 12);
    }
    g.fillStyle(0xf5f5f5, 1);
    g.fillRect(354, 260, 12, 420);
    g.fillRect(60, 464, 600, 12);
    // desk
    g.fillStyle(OL, 1);
    g.fillRect(0, 900, W, H - 900);
    shadedRoundRect(g, 0, 906, W, 60, 0, 0xc48b55);
    bands(g, 0, 966, W, H - 966, 0xa36f40, 0x7a5030, 8);
    // monitor
    olRoundRect(g, 470, 700, 220, 150, 14, 6);
    shadedRoundRect(g, 470, 700, 220, 150, 14, 0x4a5263);
    g.fillStyle(0x7fd3ff, 1);
    g.fillRoundedRect(484, 712, 192, 120, 8);
    olRoundRect(g, 560, 850, 40, 56, 4, 5);
    g.fillStyle(0x4a5263, 1);
    g.fillRect(560, 850, 40, 56);
    // mug
    olRoundRect(g, 60, 820, 90, 90, 14, 6);
    shadedRoundRect(g, 60, 820, 90, 90, 14, 0xff6b6b);
    g.lineStyle(14, OL, 1);
    g.strokeCircle(160, 862, 22);
    g.lineStyle(6, 0xff6b6b, 1);
    g.strokeCircle(160, 862, 22);
    // paper stack perch
    for (let i = 0; i < 4; i++) {
      const y = SEAT + i * 26;
      olRoundRect(g, CX - 170 + (i % 2) * 8, y, 340, 26, 4, 4);
      g.fillStyle(i % 2 ? 0xf5f5f5 : 0xffffff, 1);
      g.fillRoundedRect(CX - 170 + (i % 2) * 8, y, 340, 26, 4);
    }
    olRoundRect(g, CX - 160, SEAT + 104, 320, 110, 10);
    shadedRoundRect(g, CX - 160, SEAT + 104, 320, 110, 10, 0x5fb8ff);
  },
};

const beach: Theme = {
  name: 'Пляж',
  draw: (g) => {
    sky(g, 0x4fc3f7, 0xc8f0ff);
    sun(g, 580, 220, 70, 0xffe066);
    cloud(g, 170, 300, 0.9);
    water(g, 760, 0x39c2d8, 0x1f8fb0);
    floor(g, 920, 0xffe0a0);
    for (let i = 0; i < 14; i++) {
      g.fillStyle(0xe8c27a, 1);
      g.fillCircle((i * 97) % W, 960 + ((i * 61) % 300), 5);
    }
    // umbrella
    olLine(g, 120, 1000, 170, 640, 12, 0xffffff, 5);
    const ux = 170;
    const uy = 640;
    olPolygon(
      g,
      [
        { x: ux - 150, y: uy + 40 },
        { x: ux, y: uy - 60 },
        { x: ux + 150, y: uy + 40 },
      ],
      0xff6b6b,
      6,
    );
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(ux - 50, uy + 40, ux, uy - 60, ux + 50, uy + 40);
    // starfish
    olPolygon(g, starPoints(620, 1160, 40, 18), 0xff9b5c, 5);
    // bucket perch
    olPolygon(
      g,
      [
        { x: CX - 150, y: SEAT },
        { x: CX + 150, y: SEAT },
        { x: CX + 185, y: SEAT + 186 },
        { x: CX - 185, y: SEAT + 186 },
      ],
      0x5fb8ff,
      6,
    );
    g.fillStyle(0x3d93d9, 1);
    g.fillRect(CX - 175, SEAT + 116, 350, 22);
    g.fillStyle(0xffd84d, 1);
    g.fillRect(CX - 160, SEAT + 36, 320, 18);
  },
};

const nightLamp: Theme = {
  name: 'Ночник',
  draw: (g) => {
    sky(g, 0x2b2f5e, 0x4b3f7a);
    windowFrame(g, 60, 240, 260, 320, 0x1b1f45, 0x3a3f7a, 0x8a7fc0);
    olCircle(g, 220, 330, 34, 4);
    shadedCircle(g, 220, 330, 34, 0xfff2b0, 0xe6d68a);
    for (const [x, y] of [
      [110, 300],
      [150, 470],
      [270, 480],
    ] as const) {
      g.fillStyle(0xffffff, 1);
      g.fillPoints(starPoints(x, y, 10, 4, 4) as Phaser.Math.Vector2[], true);
    }
    // lamp glow
    for (let i = 5; i >= 1; i--) {
      g.fillStyle(0xffe9a0, 0.06 * (6 - i));
      g.fillCircle(560, 560, 60 + i * 60);
    }
    olPolygon(
      g,
      [
        { x: 490, y: 620 },
        { x: 630, y: 620 },
        { x: 600, y: 500 },
        { x: 520, y: 500 },
      ],
      0xffd84d,
      6,
    );
    olLine(g, 560, 620, 560, 880, 12, 0xc8b8e8, 5);
    floor(g, 900, 0x6b5aa0);
    // nightstand
    olRoundRect(g, 470, 880, 190, 260, 12, 6);
    shadedRoundRect(g, 470, 880, 190, 260, 12, 0x9b7bd9);
    g.fillStyle(OL, 1);
    g.fillCircle(565, 1000, 8);
    // pillow perch
    olRoundRect(g, CX - 200, SEAT, 400, 150, 70);
    shadedRoundRect(g, CX - 200, SEAT, 400, 150, 70, 0xbfd7ff, 0x8fb3ec);
    g.fillStyle(0xffffff, 0.8);
    for (let i = 0; i < 5; i++) g.fillCircle(CX - 140 + i * 70, SEAT + 78, 7);
  },
};

const circus: Theme = {
  name: 'Арена цирка',
  draw: (g) => {
    g.fillStyle(0xd93f4c, 1);
    g.fillRect(0, 0, W, H);
    for (let i = -2; i < 12; i++) {
      g.fillStyle(0xfff1cf, 1);
      g.fillTriangle(CX, -80, i * 80, 900, i * 80 + 40, 900);
    }
    // spotlights
    g.fillStyle(0xffffff, 0.12);
    g.fillTriangle(60, 0, 160, 0, CX + 40, 1100);
    g.fillTriangle(560, 0, 660, 0, CX - 40, 1100);
    // bunting
    for (let i = 0; i < 10; i++) {
      const x = i * 80;
      olPolygon(
        g,
        [
          { x, y: 250 },
          { x: x + 80, y: 250 },
          { x: x + 40, y: 310 },
        ],
        i % 2 ? 0xffd84d : 0x5fb8ff,
        4,
      );
    }
    floor(g, 900, 0xe8b46a);
    olEllipse(g, CX, 1120, 760, 260);
    shadedEllipse(g, CX, 1120, 760, 260, 0xc23a46);
    g.fillStyle(0xe8b46a, 1);
    g.fillEllipse(CX, 1120, 700, 220);
    // drum pedestal
    const drumY = seatCenter(50);
    olRoundRect(g, CX - 160, drumY, 320, 170, 20);
    shadedRoundRect(g, CX - 160, drumY, 320, 170, 20, 0x5fb8ff);
    g.lineStyle(10, 0xffd84d, 1);
    for (let i = 0; i < 6; i++) g.lineBetween(CX - 150 + i * 60, drumY + 16, CX - 120 + i * 60, drumY + 154);
    olEllipse(g, CX, drumY, 330, 50, 5);
    shadedEllipse(g, CX, drumY, 330, 50, 0xffffff, 0xe0e0e0, false);
  },
};

const aquarium: Theme = {
  name: 'Аквариум',
  draw: (g) => {
    sky(g, 0x3fb8e0, 0x1a6fa8);
    for (let i = 0; i < 6; i++) {
      g.fillStyle(0xffffff, 0.08);
      g.fillTriangle(60 + i * 130, 0, 120 + i * 130, 0, 20 + i * 130, 1000);
    }
    for (let i = 0; i < 16; i++) {
      const bx = (i * 131) % W;
      const by = 300 + ((i * 197) % 700);
      g.lineStyle(4, 0xffffff, 0.6);
      g.strokeCircle(bx, by, 6 + (i % 3) * 4);
    }
    floor(g, 1000, 0xf2d48a);
    for (const x of [60, 150, 600, 670]) {
      for (let k = 0; k < 4; k++) {
        olEllipse(g, x + (k % 2 ? 14 : -14), 980 - k * 70, 34, 90, 4);
        shadedEllipse(g, x + (k % 2 ? 14 : -14), 980 - k * 70, 34, 90, 0x4fc36a);
      }
    }
    // castle
    olRoundRect(g, 470, 780, 160, 230, 8, 6);
    shadedRoundRect(g, 470, 780, 160, 230, 8, 0xc9a7e8);
    for (let k = 0; k < 4; k++) {
      olRoundRect(g, 470 + k * 44, 750, 28, 36, 4, 4);
      g.fillStyle(0xc9a7e8, 1);
      g.fillRect(470 + k * 44, 750, 28, 36);
    }
    g.fillStyle(OL, 1);
    g.fillRoundedRect(526, 920, 48, 90, { tl: 24, tr: 24, bl: 0, br: 0 });
    // treasure chest perch
    olRoundRect(g, CX - 170, SEAT, 340, 150, 16);
    shadedRoundRect(g, CX - 170, SEAT, 340, 150, 16, 0xb8743a);
    g.fillStyle(0xf2b84b, 1);
    g.fillRect(CX - 170, SEAT + 36, 340, 16);
    g.fillRect(CX - 14, SEAT, 28, 150);
    olCircle(g, CX, SEAT + 76, 16, 4);
    g.fillStyle(0xffd84d, 1);
    g.fillCircle(CX, SEAT + 76, 16);
  },
};

const trash: Theme = {
  name: 'Мусорка',
  draw: (g) => {
    g.fillStyle(0xc4775a, 1);
    g.fillRect(0, 0, W, 920);
    g.lineStyle(4, 0x9b5a42, 1);
    for (let y = 40, r = 0; y < 920; y += 50, r++) {
      g.lineBetween(0, y, W, y);
      for (let x = (r % 2) * 50; x < W; x += 100) g.lineBetween(x, y - 50, x, y);
    }
    // graffiti heart
    g.lineStyle(10, 0x7fd34e, 1);
    g.strokeCircle(170, 420, 70);
    floor(g, 920, 0x8a8f99);
    // cans
    for (const [x, col] of [
      [90, 0x6fa86a],
      [620, 0x6f8fc8],
    ] as const) {
      olRoundRect(g, x - 80, 720, 160, 260, 16, 6);
      shadedRoundRect(g, x - 80, 720, 160, 260, 16, col);
      olRoundRect(g, x - 90, 700, 180, 34, 10, 5);
      shadedRoundRect(g, x - 90, 700, 180, 34, 10, shade(col, -0.1));
      g.lineStyle(6, shade(col, -0.25), 1);
      for (let k = -1; k <= 1; k++) g.lineBetween(x + k * 40, 760, x + k * 40, 950);
    }
    // fish bone
    olLine(g, 520, 1180, 660, 1180, 6, 0xffffff, 4);
    for (let k = 0; k < 4; k++) olLine(g, 545 + k * 30, 1160, 555 + k * 30, 1200, 4, 0xffffff, 3);
    olPolygon(
      g,
      [
        { x: 660, y: 1180 },
        { x: 700, y: 1155 },
        { x: 700, y: 1205 },
      ],
      0xffffff,
      4,
    );
    // can-lid perch on a can
    const lidY = seatCenter(56);
    olRoundRect(g, CX - 150, lidY + 8, 300, 220, 16);
    shadedRoundRect(g, CX - 150, lidY + 8, 300, 220, 16, 0xb0b8c4);
    olEllipse(g, CX, lidY, 360, 56);
    shadedEllipse(g, CX, lidY, 360, 56, 0xd0d6de);
    olRoundRect(g, CX - 30, SEAT - 4, 60, 18, 8, 4);
    g.fillStyle(0xb0b8c4, 1);
    g.fillRoundedRect(CX - 30, SEAT - 4, 60, 18, 8);
  },
};

const fridge: Theme = {
  name: 'В холодильнике',
  draw: (g) => {
    bands(g, 0, 0, W, H, 0xeaf8ff, 0xc6e8f8, 10);
    g.fillStyle(0xffffff, 0.6);
    g.fillRect(0, 0, W, 60);
    for (const y of [560, 900]) {
      g.fillStyle(OL, 1);
      g.fillRect(0, y, W, 16);
      g.fillStyle(0xdff4ff, 1);
      g.fillRect(0, y + 4, W, 8);
    }
    // milk
    olRoundRect(g, 60, 360, 110, 200, 12, 6);
    shadedRoundRect(g, 60, 360, 110, 200, 12, 0xffffff, 0xdde8ef);
    g.fillStyle(0x5fb8ff, 1);
    g.fillRect(60, 430, 110, 50);
    // jelly
    olRoundRect(g, 540, 440, 130, 120, 30, 6);
    shadedRoundRect(g, 540, 440, 130, 120, 30, 0x7fe08a);
    // sausage + eggs on lower shelf
    olRoundRect(g, 50, 820, 220, 76, 38, 6);
    shadedRoundRect(g, 50, 820, 220, 76, 38, 0xe0736a);
    for (const x of [520, 600, 680]) {
      olEllipse(g, x, 860, 66, 80, 5);
      shadedEllipse(g, x, 860, 66, 80, 0xfff4e0);
    }
    // cheese perch
    olPolygon(
      g,
      [
        { x: CX - 190, y: SEAT },
        { x: CX + 190, y: SEAT },
        { x: CX + 190, y: SEAT + 176 },
        { x: CX - 190, y: SEAT + 176 },
      ],
      0xffd84d,
      6,
    );
    g.fillStyle(0xf2b84b, 1);
    g.fillRect(CX - 190, SEAT + 136, 380, 40);
    for (const [x, y, r] of [
      [CX - 120, SEAT + 56, 20],
      [CX + 40, SEAT + 86, 26],
      [CX + 140, SEAT + 46, 14],
      [CX - 30, SEAT + 36, 12],
    ] as const) {
      g.fillStyle(0xe8a92e, 1);
      g.fillCircle(x, y, r);
    }
  },
};

const space: Theme = {
  name: 'Космос',
  draw: (g) => {
    sky(g, 0x14123a, 0x3a1f66);
    for (let i = 0; i < 60; i++) {
      g.fillStyle(0xffffff, 0.4 + (i % 3) * 0.2);
      g.fillCircle((i * 157) % W, (i * 271) % 1050, 2 + (i % 3));
    }
    olCircle(g, 560, 360, 90, 6);
    shadedCircle(g, 560, 360, 90, 0xff9b5c);
    g.lineStyle(14, OL, 1);
    g.strokeEllipse(560, 370, 300, 60);
    g.lineStyle(7, 0xffd84d, 1);
    g.strokeEllipse(560, 370, 300, 60);
    olCircle(g, 130, 620, 44, 5);
    shadedCircle(g, 130, 620, 44, 0x7fd3ff);
    // Earth far below
    olEllipse(g, CX, 1400, 1300, 700, 8);
    shadedEllipse(g, CX, 1400, 1300, 700, 0x3f9ad9, 0x2a74b0);
    g.fillStyle(0x6cc04a, 1);
    g.fillEllipse(170, 1150, 220, 80);
    g.fillEllipse(560, 1200, 260, 90);
    // asteroid perch
    const astY = seatCenter(160);
    olEllipse(g, CX, astY, 380, 160);
    shadedEllipse(g, CX, astY, 380, 160, 0xa59bb8, 0x7a7090);
    for (const [x, y, r] of [
      [CX - 100, astY - 10, 22],
      [CX + 90, astY + 10, 28],
      [CX + 10, astY + 40, 14],
    ] as const) {
      g.fillStyle(0x7a7090, 1);
      g.fillCircle(x, y, r);
      g.fillStyle(0x8f86a6, 1);
      g.fillCircle(x + 3, y + 3, r * 0.7);
    }
  },
};

export const THEMES: Theme[] = [
  lake,
  swamp,
  lilies,
  kitchen,
  picnic,
  bath,
  office,
  beach,
  nightLamp,
  circus,
  aquarium,
  trash,
  fridge,
  space,
];

export function themeIndexForLevel(level: number) {
  return (Math.max(1, level) - 1) % THEMES.length;
}

export function themeNameForLevel(level: number) {
  return THEMES[themeIndexForLevel(level)].name;
}

export function ensureBackground(scene: Phaser.Scene, level: number): string {
  const idx = themeIndexForLevel(level);
  const key = `bg_${idx}`;
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    THEMES[idx].draw(g);
    g.generateTexture(key, W, H);
    g.destroy();
  }
  return key;
}
