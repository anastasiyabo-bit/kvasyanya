import Phaser from 'phaser';
import { CHAR_SHEETS } from '../art/chars';
import { frogBlinkAnim, frogEatAnim, frogIdleAnim, frogOhAnim, frogTextureKey, skinById } from '../art/skins';
import { C } from '../config';
import { bubble } from '../ui/ui';

const FROG_SCALE = 0.64;
/** Opaque feet sit this many texture pixels above the frame bottom. */
const FEET_INSET = 16;
const MOUTH_Y = -310;
const HAT_FIT: { scale: number; y: number; originY?: number }[] = [
  { scale: 0.98, y: -470 },
  { scale: 0.9, y: -400 },
  { scale: 0.96, y: -478 },
  { scale: 1.18, y: -452 },
  { scale: 1.02, y: -436 },
  { scale: 1.0, y: -442 },
  { scale: 1.16, y: -458 },
  { scale: 1.14, y: -444 },
  { scale: 1.14, y: -448 },
  { scale: 1.22, y: -416 },
  { scale: 1.0, y: -472 },
];
/** Bow, chef, nurse, beanie, wreath sit behind the frog so they hug the head. */
const HAT_BEHIND = new Set([1, 4, 7, 8, 9]);
const TONGUE_OUT_MS = 85;
const TONGUE_BACK_MS = 130;
const DISPLAY_W = CHAR_SHEETS.frog_char.frameWidth * FROG_SCALE;
const DISPLAY_H = CHAR_SHEETS.frog_char.frameHeight * FROG_SCALE;
/** Eye centers per frog frame in texture space (origin = feet). Blink has none. */
const FRAME_EYES: ([number, number][] | null)[] = [
  [
    [-96.5, -420],
    [88.5, -419.5],
  ],
  [
    [-93.5, -430],
    [87, -429],
  ],
  null,
  [
    [-96, -434],
    [92, -434],
  ],
  [
    [-100.5, -414.5],
    [89, -414.5],
  ],
];
const PUPIL_RANGE = 18;

/** Place a shop hat on a static frog image (pause / result portraits). */
export function addHatOnFrogImage(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  frogImg: Phaser.GameObjects.Image,
  hatId: number,
) {
  if (hatId < 0) return null;
  const fit = HAT_FIT[hatId] ?? HAT_FIT[0];
  const fh = CHAR_SHEETS.frog_char.frameHeight;
  const hat = scene.add
    .image(frogImg.x, frogImg.y + (fh * (1 - frogImg.originY) + fit.y) * frogImg.scaleY, `hat${hatId}`)
    .setOrigin(0.5, fit.originY ?? 0.96)
    .setScale(fit.scale * frogImg.scaleY);
  const idx = parent.getIndex(frogImg);
  if (HAT_BEHIND.has(hatId) && idx >= 0) parent.addAt(hat, idx);
  else parent.add(hat);
  return hat;
}

interface Strike {
  tx: number;
  ty: number;
  t: number;
  phase: 'out' | 'back';
  onHit: () => void;
  onBack?: () => void;
  carry?: Phaser.GameObjects.Container;
  hit: boolean;
}

export class Frog extends Phaser.GameObjects.Container {
  private bodyWrap: Phaser.GameObjects.Container;
  private sprite: Phaser.GameObjects.Sprite;
  private sockets: Phaser.GameObjects.Container[] = [];
  private pupils: Phaser.GameObjects.Image[] = [];
  private hatImg: Phaser.GameObjects.Image;
  private tongue: Phaser.GameObjects.Graphics;
  private strikes: Strike[] = [];
  private lookX = 0;
  private lookY = 0;
  private sawPointer = false;
  private time = 0;
  private nextBlink = 2000;
  private fatScaleX = 1;
  private fatScaleY = 1;
  private squash = 0;
  private speech: Phaser.GameObjects.Container | null = null;
  private mouthTimer: Phaser.Time.TimerEvent | null = null;
  private pose: 'idle' | 'eat' | 'oh' = 'idle';
  private skin = 0;
  fat = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    const shadow = scene.add.ellipse(0, 2, 280, 34, 0x000000, 0.18);
    this.bodyWrap = scene.add.container(0, 0);
    this.hatImg = scene.add.image(0, HAT_FIT[0].y, 'hat0').setOrigin(0.5, 0.96).setScale(HAT_FIT[0].scale).setVisible(false);
    this.sprite = scene.add.sprite(0, 0, 'frog_char', 0).setOrigin(0.5, 1);
    this.sprite.play('frog-idle');
    this.bodyWrap.add(this.hatImg);
    this.bodyWrap.add(this.sprite);
    const rest = FRAME_EYES[0]!;
    for (const [ex, ey] of rest) {
      const socket = scene.add.container(ex, ey);
      const pupil = scene.add.image(0, 0, 'frog_pupil');
      socket.add(pupil);
      this.sockets.push(socket);
      this.pupils.push(pupil);
      this.bodyWrap.add(socket);
    }
    this.bodyWrap.setScale(FROG_SCALE);
    this.bodyWrap.setY(FEET_INSET * FROG_SCALE);
    this.add([shadow, this.bodyWrap]);
    this.tongue = scene.add.graphics();
    scene.add.existing(this);
    this.setDepth(20);
    this.tongue.setDepth(21);
    this.lookX = x;
    this.lookY = y - 420;
    this.sprite.on('animationcomplete', this.onAnimComplete, this);
    scene.input.on('pointermove', this.capturePointer, this);
    scene.input.on('pointerdown', this.capturePointer, this);
  }

  /** Mouth position in world coordinates. */
  mouthWorld() {
    return {
      x: this.x,
      y: this.y + MOUTH_Y * this.bodyWrap.scaleY,
    };
  }

  /** Approximate tappable rectangle of the frog itself (for the "poke" reaction). */
  contains(x: number, y: number) {
    const w = DISPLAY_W * this.fatScaleX;
    const h = DISPLAY_H * this.fatScaleY;
    return Math.abs(x - this.x) < w / 2 && y < this.y + 10 && y > this.y - h;
  }

  /** Equips the player's chosen colour and hat. */
  dress(hat: number, skin: number) {
    this.setSkin(skin);
    this.setHat(hat);
  }

  setSkin(id: number) {
    const next = Math.max(0, id);
    if (next === this.skin && this.sprite.texture.key === frogTextureKey(next)) return;
    this.skin = next;
    const playing = this.pose === 'oh' ? frogOhAnim(next) : this.pose === 'eat' ? frogEatAnim(next) : frogIdleAnim(next);
    this.sprite.setTexture(frogTextureKey(next));
    this.sprite.play(playing);
    const tint = skinById(next)?.pupil ?? 0xffffff;
    for (const p of this.pupils) {
      if (tint === 0xffffff) p.clearTint();
      else p.setTint(tint);
    }
  }

  setHat(i: number) {
    if (i < 0) {
      this.hatImg.setVisible(false);
      return;
    }
    const fit = HAT_FIT[i] ?? HAT_FIT[0];
    this.hatImg
      .setTexture(`hat${i}`)
      .setScale(fit.scale)
      .setY(fit.y)
      .setOrigin(0.5, fit.originY ?? 0.96)
      .setVisible(true);
    if (HAT_BEHIND.has(i)) this.bodyWrap.sendToBack(this.hatImg);
    else this.bodyWrap.bringToTop(this.hatImg);
  }

  lookAt(x: number, y: number) {
    this.lookX = x;
    this.lookY = y;
  }

  /** 0..4: body widens and the head sinks a bit, like a well-fed toy. */
  setFat(tier: number) {
    if (tier === this.fat) return;
    this.fat = tier;
    const sx = 1 + tier * 0.14;
    const sy = 1 + tier * 0.045;
    this.scene.tweens.add({
      targets: this,
      fatScaleX: sx,
      fatScaleY: sy,
      duration: 380,
      ease: 'Back.Out',
    });
    this.squash = 1;
  }

  get busy() {
    return this.strikes.length > 0;
  }

  /** Shoots the tongue at (tx, ty). `carry` is reeled into the mouth on the way back. */
  strike(tx: number, ty: number, o: { onHit: () => void; onBack?: () => void; carry?: Phaser.GameObjects.Container }) {
    this.strikes.push({ tx, ty, t: 0, phase: 'out', onHit: o.onHit, onBack: o.onBack, carry: o.carry, hit: false });
    this.openMouth(TONGUE_OUT_MS + TONGUE_BACK_MS + 40);
    this.lookAt(tx, ty);
  }

  openMouth(_ms: number) {
    this.squash = Math.max(this.squash, 0.55);
  }

  ohMouth(ms = 500) {
    this.pose = 'oh';
    this.sprite.play(frogOhAnim(this.skin));
    this.mouthTimer?.remove();
    this.mouthTimer = this.scene.time.delayedCall(ms, () => this.closeMouth());
  }

  closeMouth() {
    this.pose = 'idle';
    this.sprite.play(frogIdleAnim(this.skin));
  }

  gulp() {
    this.squash = 1;
    this.pose = 'eat';
    this.sprite.play(frogEatAnim(this.skin));
    this.mouthTimer?.remove();
    this.mouthTimer = this.scene.time.delayedCall(320, () => this.closeMouth());
  }

  wiggle() {
    this.scene.tweens.add({
      targets: this,
      angle: { from: -6, to: 0 },
      duration: 420,
      ease: 'Elastic.Out',
    });
    this.squash = 1;
  }

  hop() {
    this.scene.tweens.add({ targets: this.bodyWrap, y: -48, duration: 160, yoyo: true, ease: 'Quad.Out' });
  }

  say(text: string, life = 1000) {
    if (this.speech && this.speech.active) this.speech.destroy();
    const m = this.mouthWorld();
    this.speech = bubble(this.scene, m.x + 150, m.y - 170, text, { life, tail: 'left' });
  }

  blink() {
    if (this.pose !== 'idle') return;
    this.sprite.play(frogBlinkAnim(this.skin));
    this.setEyesVisible(false);
  }

  update(_time: number, delta: number) {
    this.time += delta;
    if (this.sawPointer && this.strikes.length === 0) {
      const p = this.scene.input.activePointer;
      this.lookX = p.worldX;
      this.lookY = p.worldY;
    } else if (this.strikes.length > 0) {
      const s = this.strikes[this.strikes.length - 1];
      this.lookX = s.tx;
      this.lookY = s.ty;
    }
    const breathe = Math.sin(this.time / 420) * 0.012;
    this.squash = Math.max(0, this.squash - delta / 260);
    const sq = Math.sin(this.squash * Math.PI) * 0.09;
    this.bodyWrap.setScale(FROG_SCALE * this.fatScaleX * (1 + sq), FROG_SCALE * this.fatScaleY * (1 + breathe - sq * 0.8));
    this.bodyWrap.setY(FEET_INSET * this.bodyWrap.scaleY);

    const lean = Phaser.Math.Clamp((this.lookX - this.x) / 42, -7, 7);
    this.bodyWrap.angle += (lean - this.bodyWrap.angle) * 0.12;

    this.updatePupils();

    this.nextBlink -= delta;
    if (this.nextBlink <= 0) {
      this.blink();
      this.nextBlink = 1800 + Math.random() * 2600;
    }

    this.updateTongue(delta);
  }

  private capturePointer(pointer: Phaser.Input.Pointer) {
    this.sawPointer = true;
    this.lookX = pointer.worldX;
    this.lookY = pointer.worldY;
  }

  private setEyesVisible(on: boolean) {
    for (const s of this.sockets) s.setVisible(on);
  }

  private currentEyes(): [number, number][] | null {
    const frame = Number(this.sprite.frame.name);
    if (!Number.isFinite(frame) || frame < 0 || frame >= FRAME_EYES.length) return FRAME_EYES[0];
    return FRAME_EYES[frame];
  }

  private updatePupils() {
    const sockets = this.currentEyes();
    const blinking = !sockets || this.sprite.anims.currentAnim?.key === frogBlinkAnim(this.skin);
    this.setEyesVisible(!blinking);
    if (blinking) return;
    for (let i = 0; i < 2; i++) {
      const [bx, by] = sockets[i];
      const socket = this.sockets[i];
      socket.x += (bx - socket.x) * 0.45;
      socket.y += (by - socket.y) * 0.45;
      const m = socket.getWorldTransformMatrix();
      const a = Math.atan2(this.lookY - m.ty, this.lookX - m.tx);
      const d = Math.min(PUPIL_RANGE, Math.hypot(this.lookX - m.tx, this.lookY - m.ty) / 16);
      const p = this.pupils[i];
      p.x += (Math.cos(a) * d - p.x) * 0.35;
      p.y += (Math.sin(a) * d - p.y) * 0.35;
    }
  }

  private onAnimComplete(anim: Phaser.Animations.Animation) {
    if (anim.key === frogBlinkAnim(this.skin) && this.pose === 'idle') {
      this.sprite.play(frogIdleAnim(this.skin));
      this.setEyesVisible(true);
    }
    if (anim.key === frogEatAnim(this.skin) && this.pose === 'eat' && this.strikes.length === 0) this.closeMouth();
  }

  private updateTongue(delta: number) {
    const g = this.tongue;
    g.clear();
    if (this.strikes.length === 0) return;
    const m = this.mouthWorld();
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      s.t += delta;
      let k: number;
      if (s.phase === 'out') {
        k = Math.min(1, s.t / TONGUE_OUT_MS);
        if (k >= 1) {
          s.phase = 'back';
          s.t = 0;
          if (!s.hit) {
            s.hit = true;
            s.onHit();
          }
        }
      } else {
        k = 1 - Math.min(1, s.t / TONGUE_BACK_MS);
        if (k <= 0) {
          this.strikes.splice(i, 1);
          s.onBack?.();
          continue;
        }
      }
      const ease = s.phase === 'out' ? 1 - Math.pow(1 - k, 2) : k * k;
      const tx = m.x + (s.tx - m.x) * ease;
      const ty = m.y + (s.ty - m.y) * ease;
      if (s.carry && s.phase === 'back' && s.carry.active) s.carry.setPosition(tx, ty);
      const len = Math.hypot(tx - m.x, ty - m.y);
      const wTongue = Math.max(12, 20 - len / 60);
      g.lineStyle(wTongue + 10, C.outline, 1);
      g.lineBetween(m.x, m.y, tx, ty);
      g.fillStyle(C.outline, 1);
      g.fillCircle(tx, ty, wTongue * 0.95 + 5);
      g.lineStyle(wTongue, C.tongue, 1);
      g.lineBetween(m.x, m.y, tx, ty);
      g.fillStyle(C.tongue, 1);
      g.fillCircle(tx, ty, wTongue * 0.95);
      g.fillStyle(0xffffff, 0.35);
      g.fillCircle(tx - 4, ty - 4, wTongue * 0.3);
    }
  }

  destroy(fromScene?: boolean) {
    this.tongue?.destroy();
    this.mouthTimer?.remove();
    this.sprite?.off('animationcomplete', this.onAnimComplete, this);
    this.scene.input.off('pointermove', this.capturePointer, this);
    this.scene.input.off('pointerdown', this.capturePointer, this);
    super.destroy(fromScene);
  }
}
