import Phaser from 'phaser';
import { C, FONT, TEXT_OUTLINE } from '../config';
import { makeButtonTexture, makePanelTexture } from '../art/textures';
import { Sound } from '../systems/audio';

export function txt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size: number,
  color = '#ffffff',
  opts: { stroke?: string; strokeW?: number; align?: string; wrap?: number; weight?: string } = {},
) {
  const t = scene.add.text(x, y, str, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    fontStyle: opts.weight ?? '800',
    color,
    stroke: opts.stroke ?? TEXT_OUTLINE,
    strokeThickness: opts.strokeW ?? Math.max(4, Math.round(size * 0.2)),
    align: opts.align ?? 'center',
    wordWrap: opts.wrap ? { width: opts.wrap, useAdvancedWrap: true } : undefined,
    padding: { x: 4, y: 4 },
  });
  t.setOrigin(0.5);
  return t;
}

export type BtnColor = 'green' | 'orange' | 'red';
const BTN_COLORS: Record<BtnColor, [number, number]> = {
  green: [C.btn, C.btnShade],
  orange: [C.btnAlt, C.btnAltShade],
  red: [C.btnRed, C.btnRedShade],
};

export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Image;
  label?: Phaser.GameObjects.Text;
  icon?: Phaser.GameObjects.Image;
  private enabledFlag = true;
  private baseScale = 1;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    opts: {
      w?: number;
      h?: number;
      color?: BtnColor;
      label?: string;
      size?: number;
      icon?: string;
      round?: boolean;
      onClick: () => void;
    },
  ) {
    super(scene, x, y);
    const color = opts.color ?? 'green';
    let key: string;
    let w: number;
    let h: number;
    if (opts.round) {
      key = `rbtn_${color}`;
      w = 112;
      h = 112;
    } else {
      w = opts.w ?? 420;
      h = opts.h ?? 120;
      key = `btn_${color}_${w}x${h}`;
      makeButtonTexture(scene, key, w, h, BTN_COLORS[color][0], BTN_COLORS[color][1]);
    }
    this.bg = scene.add.image(0, 0, key);
    this.add(this.bg);
    const lift = opts.round ? -4 : -7;
    if (opts.icon) {
      const iconX = opts.label ? -w / 2 + 62 : 0;
      this.icon = scene.add.image(iconX, lift, opts.icon);
      if (opts.round) this.icon.setScale(0.95);
      else if (opts.icon === 'ico_video') this.icon.setScale(0.78);
      this.add(this.icon);
    }
    if (opts.label) {
      const multiline = opts.label.includes('\n');
      const pad = opts.icon ? 140 : 36;
      this.label = txt(scene, opts.icon && multiline ? 0 : opts.icon ? 28 : 0, lift, opts.label, opts.size ?? 52, '#ffffff', {
        align: opts.icon && multiline ? 'left' : 'center',
        wrap: multiline ? w - pad : undefined,
      });
      if (opts.icon && multiline) {
        this.label.setOrigin(0, 0.5);
        this.label.setX(-w / 2 + 108);
      }
      this.add(this.label);
    }
    this.setSize(w, h);
    this.setInteractive({ useHandCursor: true });
    let pressed = false;
    this.on('pointerdown', () => {
      if (!this.enabledFlag) return;
      pressed = true;
      Sound.unlock();
      scene.tweens.add({ targets: this, scale: this.baseScale * 0.9, duration: 60 });
    });
    this.on('pointerout', () => {
      if (!pressed) return;
      pressed = false;
      scene.tweens.add({ targets: this, scale: this.baseScale, duration: 80 });
    });
    this.on('pointerup', () => {
      if (!pressed || !this.enabledFlag) return;
      pressed = false;
      Sound.click();
      scene.tweens.add({ targets: this, scale: this.baseScale, duration: 140, ease: 'Back.Out' });
      opts.onClick();
    });
    scene.add.existing(this);
  }

  setBaseScale(s: number) {
    this.baseScale = s;
    this.setScale(s);
    return this;
  }

  setEnabled(on: boolean) {
    this.enabledFlag = on;
    this.setAlpha(on ? 1 : 0.5);
    return this;
  }

  setLabel(s: string) {
    this.label?.setText(s);
    return this;
  }

  setIcon(key: string) {
    this.icon?.setTexture(key);
    return this;
  }

  /** Gentle "breathing" to draw the eye to the main action. */
  pulse() {
    this.scene.tweens.add({
      targets: this,
      scale: this.baseScale * 1.05,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    return this;
  }
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number) {
  const key = `panel_${w}x${h}`;
  makePanelTexture(scene, key, w, h);
  return scene.add.image(x, y, key);
}

/** Dark translucent layer that also swallows taps so nothing underneath reacts. */
export function dimmer(scene: Phaser.Scene, alpha = 0.55) {
  const r = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x1a1030, alpha).setOrigin(0);
  r.setInteractive();
  return r;
}

export function popIn(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, delay = 0, to = 1) {
  (target as unknown as Phaser.GameObjects.Components.Transform).setScale(0.3);
  scene.tweens.add({ targets: target, scale: to, duration: 380, delay, ease: 'Back.Out' });
}

/** Comic speech bubble with a tail. Returns the container; auto-destroys after `life` ms. */
export function bubble(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  opts: { life?: number; size?: number; tail?: 'down' | 'left' | 'right'; color?: number } = {},
) {
  const size = opts.size ?? 34;
  const t = scene.add.text(0, 0, text, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    fontStyle: '800',
    color: '#2b1d16',
    align: 'center',
    wordWrap: { width: 380, useAdvancedWrap: true },
    padding: { x: 2, y: 2 },
  });
  t.setOrigin(0.5);
  const w = Math.max(90, t.width + 40);
  const h = t.height + 26;
  const g = scene.add.graphics();
  const fill = opts.color ?? 0xffffff;
  const tail = opts.tail ?? 'down';
  const tailPts =
    tail === 'down'
      ? [-16, h / 2 - 4, 16, h / 2 - 4, -4, h / 2 + 26]
      : tail === 'left'
        ? [-w / 2 + 20, h / 2 - 6, -w / 2 + 50, h / 2 - 6, -w / 2 + 4, h / 2 + 22]
        : [w / 2 - 50, h / 2 - 6, w / 2 - 20, h / 2 - 6, w / 2 - 4, h / 2 + 22];
  g.fillStyle(C.outline, 1);
  g.fillRoundedRect(-w / 2 - 5, -h / 2 - 5, w + 10, h + 10, 26);
  g.fillTriangle(tailPts[0] - 6, tailPts[1], tailPts[2] + 6, tailPts[3], tailPts[4], tailPts[5] + 7);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 22);
  g.fillTriangle(tailPts[0], tailPts[1], tailPts[2], tailPts[3], tailPts[4], tailPts[5]);
  const c = scene.add.container(x, y - h / 2 - 26, [g, t]);
  c.setDepth(50);
  c.setScale(0.2);
  scene.tweens.add({ targets: c, scale: 1, duration: 220, ease: 'Back.Out' });
  const life = opts.life ?? 1100;
  if (life > 0) {
    scene.tweens.add({
      targets: c,
      alpha: 0,
      y: c.y - 20,
      delay: life,
      duration: 220,
      onComplete: () => c.destroy(),
    });
  }
  return c;
}

/** Candy-sticker shout, like “Ой! Кошмар!” — no bubble, so it won't cover score pops. */
export function sticker(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  opts: { life?: number; size?: number } = {},
) {
  const size = opts.size ?? 30;
  const letters = [...text];
  const c = scene.add.container(x, y).setDepth(62);
  const tmp = scene.add.text(0, 0, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: '900' });
  const total = tmp.width;
  tmp.destroy();
  let px = -total / 2;
  const mid = (letters.length - 1) / 2;
  for (let i = 0; i < letters.length; i++) {
    const ch = letters[i];
    const t = i - mid;
    const letter = scene.add.text(px, t * t * 0.55, ch, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: '900',
      color: '#ffb340',
      stroke: TEXT_OUTLINE,
      strokeThickness: Math.max(5, Math.round(size * 0.22)),
      padding: { x: 2, y: 2 },
    });
    letter.setOrigin(0, 0.5);
    letter.setAngle(t * 7);
    letter.setShadow(0, 3, '#2b1d16', 0, true, true);
    c.add(letter);
    const probe = scene.add.text(0, 0, ch, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: '900' });
    px += probe.width;
    probe.destroy();
  }
  const sparkles = [
    [-total / 2 - 10, -16],
    [total / 2 + 6, -10],
    [-8, 18],
    [14, -22],
  ];
  for (const [sx, sy] of sparkles) {
    const star = scene.add.image(sx, sy, 'spark').setScale(0.28).setAlpha(0.9);
    c.add(star);
    scene.tweens.add({
      targets: star,
      alpha: { from: 1, to: 0.15 },
      scale: { from: 0.34, to: 0.18 },
      duration: 420,
      yoyo: true,
      repeat: 1,
    });
  }
  c.setScale(0.3);
  scene.tweens.add({ targets: c, scale: 1, duration: 180, ease: 'Back.Out' });
  const life = opts.life ?? 900;
  scene.tweens.add({
    targets: c,
    y: y - 36,
    alpha: 0,
    delay: life,
    duration: 220,
    onComplete: () => c.destroy(),
  });
  return c;
}

/** Rising score text like "+120". */
export function floatText(scene: Phaser.Scene, x: number, y: number, str: string, color = '#ffffff', size = 44) {
  const t = txt(scene, x, y, str, size, color).setDepth(60);
  t.x = Phaser.Math.Clamp(x, t.width / 2 + 10, scene.scale.width - t.width / 2 - 10);
  t.setScale(0.4);
  scene.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.Out' });
  scene.tweens.add({
    targets: t,
    y: y - 90,
    alpha: 0,
    delay: 380,
    duration: 520,
    ease: 'Sine.In',
    onComplete: () => t.destroy(),
  });
  return t;
}

/** Toggle row used in pause and settings: icon button that shows a red slash when off. */
export function toggleButton(scene: Phaser.Scene, x: number, y: number, icon: string, isOn: () => boolean, onToggle: () => void) {
  const slash = scene.add.image(0, -4, 'ico_off');
  const b = new Button(scene, x, y, {
    round: true,
    color: 'orange',
    icon,
    onClick: () => {
      onToggle();
      slash.setVisible(!isOn());
    },
  });
  b.add(slash);
  slash.setVisible(!isOn());
  return b;
}

export function fadeIn(scene: Phaser.Scene, ms = 250) {
  scene.cameras.main.fadeIn(ms, 26, 16, 48);
}
