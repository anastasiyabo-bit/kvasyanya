import Phaser from 'phaser';
import { FROG_SKINS, type FrogSkin } from '../data/cosmetics';
import { CHAR_SHEETS } from './chars';

export { DEFAULT_SKIN, FROG_SKINS, SKIN_COUNT, SKIN_NAMES, skinById } from '../data/cosmetics';

export function frogTextureKey(skin: number) {
  return skin > 0 ? `frog_char_${skin}` : 'frog_char';
}

export function frogIconKey(skin: number) {
  return `frog_icon_${skin}`;
}

export function frogIdleAnim(skin: number) {
  return skin > 0 ? `frog-idle-${skin}` : 'frog-idle';
}

export function frogBlinkAnim(skin: number) {
  return skin > 0 ? `frog-blink-${skin}` : 'frog-blink';
}

export function frogEatAnim(skin: number) {
  return skin > 0 ? `frog-eat-${skin}` : 'frog-eat';
}

export function frogOhAnim(skin: number) {
  return skin > 0 ? `frog-oh-${skin}` : 'frog-oh';
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mixRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  t = Phaser.Math.Clamp(t, 0, 1);
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function shadeOf(base: [number, number, number], l: number): [number, number, number] {
  const t = Phaser.Math.Clamp((0.66 - l) / 0.4, 0, 1);
  return mixRgb(base, [base[0] * 0.64, base[1] * 0.64, base[2] * 0.64], t * 0.68);
}

function smoot01(v: number) {
  const t = Phaser.Math.Clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
}

function ell2(x: number, y: number, cx: number, cy: number, rx: number, ry: number) {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy;
}

function insideW(d2: number, inner = 0.78, outer = 1.1) {
  if (d2 <= inner) return 1;
  if (d2 >= outer) return 0;
  return 1 - smoot01((d2 - inner) / (outer - inner));
}

/** Black ovals on the yellow flanks of Огонька — same relative pose on every frame. */
const FLANK_OVALS: readonly [number, number, number, number][] = [
  [76, 188, 14, 11],
  [98, 214, 17, 13],
  [70, 236, 13, 10],
  [108, 242, 15, 11],
  [84, 268, 16, 12],
  [118, 226, 11, 9],
  [92, 294, 13, 10],
  [128, 258, 12, 9],
  [64, 214, 11, 9],
  [110, 280, 10, 8],
  [88, 172, 12, 9],
  [120, 196, 10, 8],
  [548, 188, 14, 11],
  [526, 214, 17, 13],
  [554, 236, 13, 10],
  [516, 242, 15, 11],
  [540, 268, 16, 12],
  [506, 226, 11, 9],
  [532, 294, 13, 10],
  [496, 258, 12, 9],
  [560, 214, 11, 9],
  [514, 280, 10, 8],
  [536, 172, 12, 9],
  [504, 196, 10, 8],
];

type RegionMap = {
  fw: number;
  fh: number;
  belly: Float32Array;
  haunch: Float32Array;
  flank: Float32Array;
  oval: Uint8Array;
};

let regionCache: RegionMap | null = null;

function regionMap(fw: number, fh: number): RegionMap {
  if (regionCache && regionCache.fw === fw && regionCache.fh === fh) return regionCache;
  const n = fw * fh;
  const belly = new Float32Array(n);
  const haunch = new Float32Array(n);
  const flank = new Float32Array(n);
  const oval = new Uint8Array(n);
  for (let y = 0; y < fh; y++) {
    const ny = y / fh;
    for (let fx = 0; fx < fw; fx++) {
      const i = y * fw + fx;
      const nx = fx / fw;
      const wBelly = insideW(ell2(fx, y, 312, 400, 128, 108), 0.8, 1.14);
      const wHand = Math.max(
        insideW(ell2(fx, y, 216, 474, 84, 62), 0.78, 1.14),
        insideW(ell2(fx, y, 408, 474, 84, 62), 0.78, 1.14),
      );
      const wHaunch =
        Math.max(
          insideW(ell2(fx, y, 84, 416, 124, 128), 0.82, 1.08),
          insideW(ell2(fx, y, 540, 416, 124, 128), 0.82, 1.08),
        ) *
        (1 - wHand) *
        (1 - wBelly);
      const side = smoot01((Math.abs(nx - 0.5) - 0.17) / 0.15);
      const band = smoot01((ny - 0.16) / 0.08) * (1 - smoot01((ny - 0.58) / 0.08));
      belly[i] = wBelly;
      haunch[i] = wHaunch;
      flank[i] = side * band * (1 - wHaunch) * (1 - wBelly) * (1 - wHand);
      if (ny > 0.18 && ny < 0.62 && (nx < 0.32 || nx > 0.68)) {
        for (const [cx, cy, rx, ry] of FLANK_OVALS) {
          if (ell2(fx, y, cx, cy, rx, ry) <= 1) {
            oval[i] = 1;
            break;
          }
        }
      }
    }
  }
  regionCache = { fw, fh, belly, haunch, flank, oval };
  return regionCache;
}

function recolor(ctx: CanvasRenderingContext2D, skin: FrogSkin, fw: number, fh: number) {
  const { width, height } = ctx.canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const p = img.data;
  const map = regionMap(fw, fh);
  for (let i = 0; i < p.length; i += 4) {
    const a = p[i + 3];
    if (a < 10) continue;
    const r = p[i];
    const g = p[i + 1];
    const b = p[i + 2];
    if (Math.min(r, g, b) >= 218) continue;
    const [h, s, l] = rgbToHsl(r, g, b);
    if (l > 0.86) continue;
    if (l < 0.155) continue;
    if (s > 0.35 && l > 0.28 && l < 0.72 && (h < 18 || h > 345)) continue;
    if (s > 0.38 && h > 320 && h < 355) continue;

    const pix = i / 4;
    const x = pix % width;
    const y = Math.floor(pix / width);
    const fx = x % fw;
    const nx = fx / fw;
    const ny = y / fh;
    const mi = y * fw + fx;
    const wBelly = map.belly[mi];
    const wHaunch = map.haunch[mi];
    const wFlank = map.flank[mi];
    const isBellyCol = h > 45 && h < 82 && l > 0.5 && s > 0.28 && s < 0.9;
    const isGreen = h > 58 && h < 165 && s > 0.18 && g >= r - 14 && g >= b - 14;
    const nativeSpot = isGreen && l < 0.345 && h > 108 && ny > 0.26 && ny < 0.62 && (nx < 0.33 || nx > 0.67);
    const mouthish = s > 0.4 && (h < 18 || h > 330);

    let fill: [number, number, number];
    if (wBelly > 0.45 && l > 0.28 && !mouthish) {
      fill = shadeOf(skin.belly, Math.min(l, 0.72));
    } else if (isBellyCol && ny > 0.48 && nx > 0.32 && nx < 0.68) {
      fill = shadeOf(skin.belly, l);
    } else if (isGreen) {
      fill = skin.body;
      if (skin.flank && wFlank > 0) fill = mixRgb(fill, skin.flank, wFlank);
      if (skin.haunch && wHaunch > 0) fill = mixRgb(fill, skin.haunch, wHaunch);
      fill = shadeOf(fill, l);
      const wantSpot =
        (skin.spots === 'flank' && wFlank > 0.35 && nativeSpot) || (skin.spots === 'body' && nativeSpot);
      if (wantSpot) fill = mixRgb(fill, skin.spot, 0.9);
    } else {
      continue;
    }
    if (skin.spots === 'flank' && map.oval[mi] && l > 0.18 && !(h > 40 && h < 85 && l > 0.58)) {
      fill = skin.spot;
    }
    p[i] = Math.round(fill[0]);
    p[i + 1] = Math.round(fill[1]);
    p[i + 2] = Math.round(fill[2]);
  }
  ctx.putImageData(img, 0, 0);
}

function addIcon(scene: Phaser.Scene, srcKey: string, destKey: string, fw: number, fh: number) {
  if (scene.textures.exists(destKey)) scene.textures.remove(destKey);
  const src = scene.textures.get(srcKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const size = 200;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const cropX = 70;
  const cropY = 28;
  const srcW = fw - cropX * 2;
  const srcH = fh - 36;
  ctx.drawImage(src, cropX, cropY, srcW, srcH, 0, 0, size, size);
  const sx = size / srcW;
  const sy = size / srcH;
  const eyes: [number, number][] = [
    [fw / 2 - 96.5, fh - 420],
    [fw / 2 + 88.5, fh - 419.5],
  ];
  let pupil: CanvasImageSource | null = null;
  if (scene.textures.exists('frog_pupil')) {
    pupil = scene.textures.get('frog_pupil').getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  }
  for (const [tx, ty] of eyes) {
    const x = (tx - cropX) * sx;
    const y = (ty - cropY) * sy + 4;
    const d = 18;
    if (pupil) ctx.drawImage(pupil, x - d / 2, y - d / 2, d, d);
    else {
      ctx.fillStyle = '#2b1d16';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x - 2.4, y - 2.6, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  scene.textures.addCanvas(destKey, c);
}

function addSkinAnims(scene: Phaser.Scene, key: string, id: number) {
  const idle = frogIdleAnim(id);
  if (scene.anims.exists(idle)) return;
  scene.anims.create({
    key: idle,
    frames: [
      { key, frame: 0 },
      { key, frame: 1 },
    ],
    frameRate: 2.4,
    repeat: -1,
    yoyo: true,
  });
  scene.anims.create({
    key: frogBlinkAnim(id),
    frames: [{ key, frame: 2 }],
    duration: 140,
    repeat: 0,
  });
  scene.anims.create({
    key: frogEatAnim(id),
    frames: [{ key, frame: 3 }],
    duration: 280,
    repeat: 0,
  });
  scene.anims.create({
    key: frogOhAnim(id),
    frames: [{ key, frame: 4 }],
    duration: 520,
    repeat: 0,
  });
}

export function bakeFrogSkins(scene: Phaser.Scene) {
  const spec = CHAR_SHEETS.frog_char;
  const srcTex = scene.textures.get('frog_char');
  const src = srcTex.getSourceImage() as HTMLImageElement;
  addIcon(scene, 'frog_char', frogIconKey(0), spec.frameWidth, spec.frameHeight);
  for (const skin of FROG_SKINS) {
    const key = frogTextureKey(skin.id);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const canvas = document.createElement('canvas');
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(src, 0, 0);
    recolor(ctx, skin, spec.frameWidth, spec.frameHeight);
    scene.textures.addCanvas(key, canvas);
    const sheet = scene.textures.get(key);
    for (let f = 0; f < 5; f++) {
      sheet.add(String(f), 0, f * spec.frameWidth, 0, spec.frameWidth, spec.frameHeight);
    }
    addSkinAnims(scene, key, skin.id);
    addIcon(scene, key, frogIconKey(skin.id), spec.frameWidth, spec.frameHeight);
  }
}
