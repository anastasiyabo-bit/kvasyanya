import Phaser from 'phaser';
import { INSECT_BOTTOM, INSECT_TOP, W } from '../config';
import { INSECT_SHEETS, dozeAnim, flapAnim, type InsectTexture } from '../art/chars';
import {
  FlightDeck,
  approach,
  fitFlight,
  flapJitter,
  flightOffset,
  flightTilt,
  jitterFade,
  underCeiling,
  type FlightPattern,
} from '../data/flight';
import { SLEEP_MS, WAKE_SPEED_MUL, fireflyGlow, fireflyLit, type InsectKind } from '../data/guests';
import { bodyHitRadius, zoneAt, type BodyBox } from '../data/hit';
import type { GuestKind } from '../data/schedule';

export type { InsectKind };
export type InsectState = 'flying' | 'hover' | 'sleeping' | 'caught' | 'blushing' | 'fleeing' | 'gone';

interface KindSpec {
  tex: InsectTexture;
  scale: number;
  points: number;
  /** Forward of the body centre by this many display px is the head (eat). Behind it is the abdomen (lick). */
  headSplit: number;
  speedMul: number;
  /** Blush spots in frame texture coordinates. */
  cheeks: [number, number][];
  guest: boolean;
}

const base = (tex: InsectTexture, o: Partial<KindSpec> = {}): KindSpec => ({
  tex,
  scale: 0.52,
  points: 100,
  headSplit: 0,
  speedMul: 1,
  cheeks: [[-36, 10]],
  guest: false,
  ...o,
});

export const KINDS: Record<InsectKind, KindSpec> = {
  fly: base('fly'),
  mosquito: base('mosquito', { scale: 0.5, points: 150, headSplit: 9, speedMul: 1.1, cheeks: [[-52, 8]] }),
  fat: base('fatfly', { scale: 0.72, points: 200, headSplit: 2, speedMul: 0.7, cheeks: [[-48, 14]] }),
  gold: base('goldfly', { points: 300, speedMul: 1.35 }),
  sleepy: base('sleepyfly'),
  candy: base('fly', { speedMul: 0.85, guest: true }),
  wasp: base('wasp', { scale: 0.5, points: 100, headSplit: 12, speedMul: 0.85, cheeks: [[62, 52]], guest: true }),
  squeaker: base('squeaker', { scale: 0.56, points: 0, speedMul: 0.5, cheeks: [], guest: true }),
  thief: base('thief', { scale: 0.5, points: 150, headSplit: 10, speedMul: 1.55, cheeks: [[70, 26]], guest: true }),
  glutton: base('glutton', { scale: 0.74, points: 200, headSplit: 4, speedMul: 0.55, cheeks: [[56, 6]], guest: true }),
  firefly: base('firefly', { scale: 0.5, points: 150, speedMul: 0.9, cheeks: [[78, 46]], guest: true }),
};

/** Where the candy fly holds its basket: under the body, in frame texture coordinates. */
const BASKET_AT = { x: 22, y: 118 };
const BASKET_SCALE = 0.95;
/** Tap this close to the basket (display px) and it counts as a lick. */
const BASKET_TAP_R = 64;
/** Insects slide under a banner this fast, px/s. */
const DUCK_SPEED = 700;

export function isGuestKind(k: InsectKind): k is GuestKind {
  return KINDS[k].guest;
}

export function bodyOf(kind: InsectKind): BodyBox {
  return INSECT_SHEETS[KINDS[kind].tex].body;
}

export function hitRadius(kind: InsectKind): number {
  return bodyHitRadius(bodyOf(kind), KINDS[kind].scale);
}

/** One deck for the whole game, so insects created one after another never share a flight. */
const deck = new FlightDeck();
const STRAIGHT: FlightPattern = { amp: 0, periodMs: 1000, phase: 0 };

let nextId = 1;

export interface InsectOpts {
  /** Vertical band the arc must stay inside. */
  band?: [number, number];
}

export class Insect extends Phaser.GameObjects.Container {
  readonly id = nextId++;
  readonly kind: InsectKind;
  readonly spec: KindSpec;
  readonly hitR: number;
  state: InsectState = 'flying';
  dir: 1 | -1;
  vx: number;
  baseY: number;
  flight: FlightPattern;
  private t = 0;
  private band: [number, number];
  private blushes: Phaser.GameObjects.Image[] = [];
  private flipper: Phaser.GameObjects.Container;
  private rig: Phaser.GameObjects.Container;
  private rigX: number;
  private rigY: number;
  private sprite: Phaser.GameObjects.Sprite;
  private jit = { dx: 0, dy: 0 };
  private jitMs = 999;
  /** Children that must read the same way whichever way the insect faces. */
  private upright: { obj: Phaser.GameObjects.Components.Transform; s: number }[] = [];
  pairId = 0;
  pairPartner: Insect | null = null;
  hoverX = 0;
  hoverY = 0;
  private fleeVx = 0;
  private fleeVy = 0;
  private sleepLeft = 0;
  private wakeSpeed = 0;
  private flashPhase = Math.random() * 1000;
  private candyImg: Phaser.GameObjects.Image | null = null;
  private carry: Phaser.GameObjects.Container | null = null;
  private hint: Phaser.GameObjects.Text | null = null;
  /** Px above the body centre the insect reaches (raised wings included). */
  readonly reach: number;
  /** While a banner is up, stay entirely below this y. */
  ceiling: number | null = null;
  private glow: Phaser.GameObjects.Image | null = null;
  private brows: Phaser.GameObjects.Graphics | null = null;
  private shout: Phaser.GameObjects.Graphics | null = null;
  private zzz: Phaser.GameObjects.Text | null = null;
  /** Reached the edge while still free. */
  onEscape: ((ins: Insect) => void) | null = null;

  /** Copy flight so a pair stays a tight cluster instead of drifting apart. */
  copyFlight(from: Insect) {
    this.t = from.t;
    this.flight = from.flight;
    this.vx = from.vx;
  }

  constructor(scene: Phaser.Scene, kind: InsectKind, x: number, y: number, dir: 1 | -1, speed: number, opts: InsectOpts = {}) {
    super(scene, x, y);
    this.kind = kind;
    this.spec = KINDS[kind];
    this.hitR = hitRadius(kind);
    this.dir = dir;
    this.vx = speed * this.spec.speedMul * dir;
    this.band = opts.band ?? [INSECT_TOP, INSECT_BOTTOM];
    const pattern = kind === 'squeaker' ? STRAIGHT : deck.next(Math.random);
    const fit = fitFlight(y, pattern.amp, this.band[0], this.band[1]);
    this.flight = { ...pattern, amp: fit.amp };
    this.baseY = fit.baseY;
    this.y = this.baseY + flightOffset(this.flight, 0);

    const sheet = INSECT_SHEETS[this.spec.tex];
    const body = sheet.body;
    this.reach = (sheet.frameHeight / 2 + body.cy) * this.spec.scale;
    this.flipper = scene.add.container(0, 0);
    this.rigX = -body.cx;
    this.rigY = -body.cy;
    this.rig = scene.add.container(this.rigX, this.rigY);
    this.sprite = scene.add.sprite(0, 0, this.spec.tex, 0);
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.onFlapFrame, this);
    this.sprite.play({ key: flapAnim(this.spec.tex), startFrame: Math.random() < 0.5 ? 0 : 1 });
    this.rig.add(this.sprite);
    for (const [cx, cy] of this.spec.cheeks) {
      const b = scene.add.image(cx, cy, 'blush').setVisible(false);
      this.blushes.push(b);
      this.rig.add(b);
    }
    this.flipper.add(this.rig);
    this.add(this.flipper);
    this.dress(scene);
    this.applyFacing();
    this.setDepth(30);
    scene.add.existing(this);
  }

  private dress(scene: Phaser.Scene) {
    switch (this.kind) {
      case 'candy': {
        // Candy sits behind the basket so only its top peeks over the rim.
        this.carry = scene.add.container(BASKET_AT.x, BASKET_AT.y);
        const basket = scene.add.image(0, 0, 'basket').setOrigin(0.5, 0.04).setScale(BASKET_SCALE);
        // On top of the rim, so the candy reads at a glance.
        this.candyImg = scene.add.image(2, 62, 'candy').setScale(0.82).setAngle(-12);
        this.carry.add([basket, this.candyImg]);
        this.rig.add(this.carry);
        scene.tweens.add({ targets: this.carry, angle: { from: -9, to: 9 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        this.hint = scene.add
          .text(0, -this.reach - 8, 'Лизни!', {
            fontFamily: 'Rubik, Arial, sans-serif',
            fontSize: '30px',
            fontStyle: '900',
            color: '#ffffff',
            stroke: '#c2410c',
            strokeThickness: 8,
          })
          .setOrigin(0.5, 1);
        this.add(this.hint);
        scene.tweens.add({ targets: this.hint, y: this.hint.y - 8, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        break;
      }
      case 'glutton': {
        const badge = scene.add
          .text(-16, 92, '×3', {
            fontFamily: 'Rubik, Arial, sans-serif',
            fontSize: '70px',
            fontStyle: '900',
            color: '#ffc93c',
            stroke: '#2b1d16',
            strokeThickness: 14,
            padding: { x: 4, y: 4 },
          })
          .setOrigin(0.5);
        this.rig.add(badge);
        this.upright.push({ obj: badge, s: 1 });
        break;
      }
      case 'firefly':
        this.glow = scene.add.image(-88, 64, 'glow').setScale(1.7).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
        this.rig.addAt(this.glow, 0);
        break;
      case 'squeaker':
        this.brows = scene.add.graphics();
        this.shout = scene.add.graphics();
        this.rig.add([this.brows, this.shout]);
        this.drawFace(false);
        break;
      default:
        break;
    }
  }

  /** Squeaker expression: worried brows, or brows up with shout lines. Body stays the same size. */
  private drawFace(loud: boolean) {
    const g = this.brows;
    const s = this.shout;
    if (!g || !s) return;
    g.clear();
    s.clear();
    g.lineStyle(9, 0x2b1d16, 1);
    if (loud) {
      g.lineBetween(18, -24, 52, -34);
      g.lineBetween(82, -30, 108, -22);
      s.lineStyle(8, 0x2b1d16, 1);
      for (const [x0, y0, x1, y1] of [
        [118, 40, 142, 30],
        [122, 62, 150, 62],
        [118, 84, 142, 94],
      ]) {
        s.lineBetween(x0, y0, x1, y1);
      }
    } else {
      g.lineBetween(20, -30, 50, -18);
      g.lineBetween(84, -18, 106, -30);
    }
  }

  private applyFacing() {
    this.flipper.setScale(this.spec.scale * this.dir, this.spec.scale);
    for (const u of this.upright) u.obj.setScale(u.s * this.dir, u.s);
  }

  private onFlapFrame(_anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) {
    if (this.state === 'sleeping') return;
    this.jit = flapJitter(Number(frame.textureFrame), this.id);
    this.jitMs = 0;
  }

  get hittable() {
    return this.state === 'flying' || this.state === 'hover' || this.state === 'sleeping';
  }

  get guest() {
    return this.spec.guest;
  }

  /** Firefly can only be caught while it shines. Everyone else always can. */
  get lit() {
    return this.kind !== 'firefly' || fireflyLit(this.t, this.flashPhase);
  }

  get hasCandy() {
    return !!this.candyImg?.visible;
  }

  /** World position of the candy in the basket, for the drop. */
  candyWorld() {
    if (!this.candyImg) return { x: this.x, y: this.y };
    const m = this.candyImg.getWorldTransformMatrix();
    return { x: m.tx, y: m.ty };
  }

  dropCandy() {
    this.candyImg?.setVisible(false);
    if (this.hint) this.scene.tweens.killTweensOf(this.hint);
    this.hint?.destroy();
    this.hint = null;
  }

  /** A tap on the full basket under the candy fly. */
  basketHit(px: number, py: number): boolean {
    if (!this.carry || !this.hasCandy) return false;
    const m = this.carry.getWorldTransformMatrix();
    const k = this.spec.scale;
    return Math.hypot(px - m.tx, py - (m.ty + 70 * k)) <= BASKET_TAP_R;
  }

  /** Returns 'eat' if the tap is on the head half, 'lick' if on the abdomen. */
  zoneAt(px: number): 'eat' | 'lick' {
    return zoneAt(px, this.x, this.dir, this.spec.headSplit);
  }

  hover(x: number, y: number) {
    this.state = 'hover';
    this.hoverX = x;
    this.hoverY = y;
  }

  /** Hangs in place with closed eyes; wakes after SLEEP_MS and dashes off fast. */
  sleep(speed: number) {
    this.state = 'sleeping';
    this.hoverX = this.x;
    this.hoverY = this.y;
    this.sleepLeft = SLEEP_MS;
    this.wakeSpeed = speed;
    this.sprite.play(dozeAnim(this.spec.tex));
    this.flipper.angle = 0;
    this.zzz = this.scene.add
      .text(46, -58, 'z', {
        fontFamily: 'Rubik, Arial, sans-serif',
        fontSize: '34px',
        fontStyle: '900',
        color: '#ffffff',
        stroke: '#2b1d16',
        strokeThickness: 7,
      })
      .setOrigin(0.5);
    this.add(this.zzz);
    this.scene.tweens.add({
      targets: this.zzz,
      y: -86,
      alpha: { from: 1, to: 0.2 },
      duration: 600,
      repeat: -1,
      onRepeat: () => this.zzz?.setText(this.zzz.text.length >= 3 ? 'z' : this.zzz.text + 'z'),
    });
  }

  private wake() {
    if (this.zzz) this.scene.tweens.killTweensOf(this.zzz);
    this.zzz?.destroy();
    this.zzz = null;
    this.sprite.setTexture('fly', 0);
    this.sprite.play(flapAnim('fly'));
    const away: 1 | -1 = this.x < W / 2 ? -1 : 1;
    this.dir = away;
    this.applyFacing();
    this.vx = this.wakeSpeed * WAKE_SPEED_MUL * away;
    const pattern = deck.next(Math.random);
    const fit = fitFlight(this.y, pattern.amp, this.band[0], this.band[1]);
    this.flight = { ...pattern, amp: fit.amp };
    this.baseY = this.y - flightOffset(this.flight, 0);
    this.t = 0;
    this.state = 'flying';
    const bang = this.scene.add
      .text(this.x, this.y - 70, '!', {
        fontFamily: 'Rubik, Arial, sans-serif',
        fontSize: '56px',
        fontStyle: '900',
        color: '#ffc93c',
        stroke: '#2b1d16',
        strokeThickness: 9,
      })
      .setOrigin(0.5)
      .setDepth(61);
    this.scene.tweens.add({ targets: bang, y: bang.y - 40, alpha: 0, duration: 520, onComplete: () => bang.destroy() });
  }

  /** Grabbed by the tongue: stop moving on our own, Frog will position us. */
  grab() {
    this.state = 'caught';
    this.zzz?.setVisible(false);
    this.scene.tweens.add({ targets: this.flipper, angle: 90 * this.dir, duration: 120 });
  }

  /** Stops in place (about to be licked). */
  freeze() {
    this.state = 'blushing';
  }

  swallow() {
    this.state = 'gone';
    this.destroy();
  }

  /** Lick reaction: blush, freeze in embarrassment, then fly away off screen. */
  blush(onGone?: () => void) {
    this.state = 'blushing';
    this.zzz?.setVisible(false);
    for (const b of this.blushes) {
      b.setVisible(true).setScale(0.2);
      this.scene.tweens.add({ targets: b, scale: 1.25, duration: 220, ease: 'Back.Out' });
    }
    this.scene.tweens.add({
      targets: this.flipper,
      x: { from: -5, to: 5 },
      duration: 50,
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        this.flipper.x = 0;
        this.state = 'fleeing';
        const away = this.x < W / 2 ? -1 : 1;
        this.dir = away as 1 | -1;
        this.applyFacing();
        this.fleeVx = 520 * away;
        this.fleeVy = -380;
        this.scene.tweens.add({ targets: this.flipper, angle: -20 * this.dir, duration: 200 });
        this.scene.time.delayedCall(1600, () => {
          if (this.active) this.destroy();
          onGone?.();
        });
      },
    });
  }

  /** Startled (partner got eaten, squeaker popped, dark firefly poked): dash away without blushing. */
  scare() {
    if (!this.hittable) return;
    if (this.state === 'sleeping') this.wake();
    this.state = 'fleeing';
    const away = this.vx !== 0 ? (Math.sign(this.vx) as 1 | -1) : this.dir;
    this.dir = away;
    this.applyFacing();
    this.fleeVx = 640 * away;
    this.fleeVy = -260;
    this.scene.tweens.add({ targets: this.flipper, angle: -15 * this.dir, duration: 150 });
  }

  update(_time: number, delta: number) {
    if (!this.active) return;
    this.t += delta;
    const dt = delta / 1000;
    const k = jitterFade(this.jitMs);
    this.jitMs += delta;
    this.rig.setPosition(this.rigX + (this.jit.dx * k) / this.spec.scale, this.rigY + (this.jit.dy * k) / this.spec.scale);

    if (this.glow) {
      const g = fireflyGlow(this.t, this.flashPhase);
      this.glow.setAlpha(g);
      const v = Math.round(0x58 + (0xff - 0x58) * g);
      this.sprite.setTint(Phaser.Display.Color.GetColor(v, v, Math.min(255, v + 20)));
    }
    if (this.kind === 'squeaker' && this.state === 'flying') {
      this.flipper.angle = Math.sin(this.t / 150) * 10;
      const loud = Math.floor(this.t / 300) % 2 === 0;
      if (loud !== this.shout?.visible) {
        this.drawFace(loud);
        this.shout?.setVisible(loud);
      }
    }

    if (this.ceiling !== null) this.duck(this.ceiling, DUCK_SPEED * dt);

    if (this.state === 'flying') {
      this.x += this.vx * dt;
      this.y = this.baseY + flightOffset(this.flight, this.t);
      if (this.kind !== 'squeaker') this.flipper.angle = flightTilt(this.flight, this.t, this.vx) * this.dir;
      if ((this.vx > 0 && this.x > W + 120) || (this.vx < 0 && this.x < -120)) {
        this.state = 'gone';
        this.onEscape?.(this);
        this.destroy();
      }
    } else if (this.state === 'hover') {
      this.x += (this.hoverX + Math.sin(this.t / 400) * 12 - this.x) * 0.08;
      this.y += (this.hoverY + Math.sin(this.t / 260) * 10 - this.y) * 0.08;
    } else if (this.state === 'sleeping') {
      this.y = this.hoverY + Math.sin(this.t / 700) * 3;
      this.sleepLeft -= delta;
      if (this.sleepLeft <= 0) this.wake();
    } else if (this.state === 'fleeing') {
      this.x += this.fleeVx * dt;
      this.y += this.fleeVy * dt;
      this.fleeVy -= 200 * dt;
      if (this.x < -160 || this.x > W + 160 || this.y < -160) {
        this.state = 'gone';
        this.destroy();
      }
    }
  }

  /** Slide the flight line (or the hover spot) down so the whole insect stays under `ceiling`. */
  private duck(ceiling: number, step: number) {
    if (this.state === 'flying') {
      const fit = underCeiling(this.baseY, this.flight.amp, this.reach, ceiling, this.band[1]);
      if (fit.amp < this.flight.amp) this.flight = { ...this.flight, amp: approach(this.flight.amp, fit.amp, step) };
      if (fit.baseY > this.baseY) this.baseY = approach(this.baseY, fit.baseY, step);
    } else if (this.state === 'hover' || this.state === 'sleeping') {
      const low = Math.min(this.band[1], ceiling + this.reach + 6);
      if (this.hoverY < low) this.hoverY = approach(this.hoverY, low, step);
    }
  }

  destroy(fromScene?: boolean) {
    this.sprite?.off(Phaser.Animations.Events.ANIMATION_UPDATE, this.onFlapFrame, this);
    if (this.scene) this.scene.tweens.killTweensOf([this.carry, this.hint, this.zzz].filter(Boolean) as object[]);
    super.destroy(fromScene);
  }
}
