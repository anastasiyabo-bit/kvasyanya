import Phaser from 'phaser';
import { W } from '../config';

export type InsectKind = 'fly' | 'mosquito' | 'fat' | 'gold';
export type InsectState = 'flying' | 'hover' | 'caught' | 'blushing' | 'fleeing' | 'gone';

interface KindSpec {
  tex: string;
  anim: string;
  scale: number;
  points: number;
  hitR: number;
  /** Tap with local forward offset >= this (in display px) hits the head → eat. Otherwise abdomen → lick. */
  headSplit: number;
  speedMul: number;
  cheeks: [number, number][];
}

export const KINDS: Record<InsectKind, KindSpec> = {
  fly: {
    tex: 'fly',
    anim: 'fly-flap',
    scale: 0.52,
    points: 100,
    hitR: 135,
    headSplit: 8,
    speedMul: 1,
    cheeks: [[-36, 10]],
  },
  mosquito: {
    tex: 'mosquito',
    anim: 'mosquito-flap',
    scale: 0.5,
    points: 150,
    hitR: 150,
    headSplit: 18,
    speedMul: 1.1,
    cheeks: [[-52, 8]],
  },
  fat: {
    tex: 'fatfly',
    anim: 'fatfly-flap',
    scale: 0.72,
    points: 200,
    hitR: 140,
    headSplit: 10,
    speedMul: 0.7,
    cheeks: [[-48, 14]],
  },
  gold: {
    tex: 'goldfly',
    anim: 'goldfly-flap',
    scale: 0.52,
    points: 300,
    hitR: 135,
    headSplit: 8,
    speedMul: 1.35,
    cheeks: [[-36, 10]],
  },
};

let nextId = 1;

export class Insect extends Phaser.GameObjects.Container {
  readonly id = nextId++;
  readonly kind: InsectKind;
  readonly spec: KindSpec;
  state: InsectState = 'flying';
  dir: 1 | -1;
  vx: number;
  baseY: number;
  private t = Math.random() * 1000;
  private wobbleAmp: number;
  private wobbleFreq: number;
  private blushes: Phaser.GameObjects.Image[] = [];
  private flipper: Phaser.GameObjects.Container;
  private sprite: Phaser.GameObjects.Sprite;
  pairId = 0;
  pairPartner: Insect | null = null;

  /** Copy flight so a pair stays a tight cluster instead of drifting apart. */
  copyFlight(from: Insect) {
    this.t = from.t;
    this.wobbleAmp = from.wobbleAmp;
    this.wobbleFreq = from.wobbleFreq;
    this.vx = from.vx;
  }
  hoverX = 0;
  hoverY = 0;
  private fleeVx = 0;
  private fleeVy = 0;

  constructor(scene: Phaser.Scene, kind: InsectKind, x: number, y: number, dir: 1 | -1, speed: number) {
    super(scene, x, y);
    this.kind = kind;
    this.spec = KINDS[kind];
    this.dir = dir;
    this.vx = speed * this.spec.speedMul * dir;
    this.baseY = y;
    this.wobbleAmp = kind === 'mosquito' ? 46 : 22 + Math.random() * 18;
    this.wobbleFreq = kind === 'mosquito' ? 0.006 : 0.003 + Math.random() * 0.002;

    this.flipper = scene.add.container(0, 0);
    this.sprite = scene.add.sprite(0, 0, this.spec.tex, 0);
    this.sprite.play(this.spec.anim);
    this.flipper.add(this.sprite);
    for (const [cx, cy] of this.spec.cheeks) {
      const b = scene.add.image(cx, cy, 'blush').setVisible(false);
      this.blushes.push(b);
      this.flipper.add(b);
    }
    this.flipper.setScale(this.spec.scale * dir, this.spec.scale);
    this.add(this.flipper);
    this.setDepth(30);
    scene.add.existing(this);
  }

  get hittable() {
    return this.state === 'flying' || this.state === 'hover';
  }

  /** Returns 'eat' if the tap is on the head half, 'lick' if on the abdomen. */
  zoneAt(px: number): 'eat' | 'lick' {
    const forward = (px - this.x) * this.dir;
    return forward >= this.spec.headSplit ? 'eat' : 'lick';
  }

  hover(x: number, y: number) {
    this.state = 'hover';
    this.hoverX = x;
    this.hoverY = y;
  }

  /** Grabbed by the tongue: stop moving on our own, Frog will position us. */
  grab() {
    this.state = 'caught';
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
        this.flipper.setScale(this.spec.scale * this.dir, this.spec.scale);
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

  /** Startled (partner got eaten): dash away without blushing. */
  scare() {
    if (!this.hittable) return;
    this.state = 'fleeing';
    const away = this.dir;
    this.fleeVx = 640 * away;
    this.fleeVy = -260;
    this.scene.tweens.add({ targets: this.flipper, angle: -15 * this.dir, duration: 150 });
  }

  update(_time: number, delta: number) {
    if (!this.active) return;
    this.t += delta;
    const dt = delta / 1000;
    if (this.state === 'flying') {
      this.x += this.vx * dt;
      this.y = this.baseY + Math.sin(this.t * this.wobbleFreq) * this.wobbleAmp;
      this.flipper.angle = Math.cos(this.t * this.wobbleFreq) * 8 * this.dir;
      if ((this.vx > 0 && this.x > W + 120) || (this.vx < 0 && this.x < -120)) {
        this.state = 'gone';
        this.destroy();
      }
    } else if (this.state === 'hover') {
      this.x += (this.hoverX + Math.sin(this.t / 400) * 12 - this.x) * 0.08;
      this.y += (this.hoverY + Math.sin(this.t / 260) * 10 - this.y) * 0.08;
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
}
