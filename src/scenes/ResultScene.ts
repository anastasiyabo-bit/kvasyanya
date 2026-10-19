import Phaser from 'phaser';
import { CHAR_SHEETS } from '../art/chars';
import { frogIconKey, frogTextureKey, SKIN_NAMES } from '../art/skins';
import { HAT_NAMES } from '../art/textures';
import { sparksLabel } from '../data/phrases';
import { COSMETIC_COUNT, TIER_NAMES, grantUnlocks, hatsEarned, runCascade, type CascadeEvent, type Inventory } from '../data/rewards';
import { Sound } from '../systems/audio';
import { Save } from '../systems/save';
import { Ya } from '../systems/yandex';
import { Button, dimmer, panel, popIn, txt } from '../ui/ui';
import { burst, confetti, starBurst } from '../ui/fx';
import type { GameScene, ResultData } from './GameScene';

type CosmeticDrop = { kind: 'hat' | 'skin'; id: number };

const SLOT_Y = 70;
const SLOT_X = [-225, -75, 75, 225];
const SLOT_SCALE = 0.95;

export class ResultScene extends Phaser.Scene {
  private d!: ResultData;
  private root!: Phaser.GameObjects.Container;
  private counts: Phaser.GameObjects.Text[] = [];
  private slots: Phaser.GameObjects.Image[] = [];
  private shown: Inventory = [0, 0, 0, 0];
  private finalInv: Inventory = [0, 0, 0, 0];
  private cascadeTimers: Phaser.Time.TimerEvent[] = [];
  private cascading = false;
  private buttons: Button[] = [];
  private busy = false;
  private doubled = false;
  private sparkText?: Phaser.GameObjects.Text;
  private chestFx: Phaser.GameObjects.GameObject[] = [];
  private ceremonyTimers: Phaser.Time.TimerEvent[] = [];
  private ceremonyRunning = false;
  private epicOpens = 0;

  constructor() {
    super('Result');
  }

  init(data: ResultData) {
    this.d = data;
    this.counts = [];
    this.slots = [];
    this.buttons = [];
    this.busy = false;
    this.doubled = false;
    this.cascadeTimers = [];
    this.cascading = false;
    this.pendingUnlocks = [];
    this.chestFx = [];
    this.ceremonyTimers = [];
    this.ceremonyRunning = false;
    this.epicOpens = 0;
  }

  create() {
    dimmer(this, 0.5);
    this.root = this.add.container(360, 640);
    if (this.d.won) this.buildWin();
    else this.buildFail();
    popIn(this, this.root);
    this.events.once('shutdown', () => {
      this.clearCascadeTimers();
      this.clearChestFx();
    });
  }

  // ---------------- win ----------------

  private buildWin() {
    const d = this.d;
    const r = this.root;
    r.add(panel(this, 0, 0, 650, 1060));
    r.add(txt(this, 0, -455, d.isSuper ? 'Супер-уровень пройден!' : `Уровень ${d.level} пройден!`, d.isSuper ? 46 : 54, '#ffffff'));

    const starKeys = ['star_bronze', 'star_silver', 'star_gold'] as const;
    const starScales = [0.92, 1.02, 1.28];
    for (let i = 0; i < 3; i++) {
      const sx = (i - 1) * 150;
      const sy = -305;
      const empty = this.add.image(sx, sy, starKeys[i]).setScale(starScales[i]).setAlpha(0.28);
      r.add(empty);
      if (i < d.stars) {
        const s = this.add.image(sx, sy, starKeys[i]).setScale(0);
        r.add(s);
        this.time.delayedCall(300 + i * 320, () => {
          this.tweens.add({ targets: s, scale: starScales[i], duration: 360, ease: 'Back.Out' });
          Sound.star(i);
          starBurst(this, 360 + sx, 640 + sy, 16);
        });
      }
    }

    let info = `Очки: ${d.score}    Поймано: ${d.caught}`;
    if (d.isSuper && d.superMult > 1) info += `\nБонус супер-уровня ×${d.superMult}`;
    r.add(txt(this, 0, -175, info, 36, '#2b1d16', { stroke: '#fff1cf', strokeW: 2 }));

    this.sparkText = txt(this, 0, -85, `+${sparksLabel(d.sparks)}`, 44, '#ffc93c');
    r.add(this.sparkText);

    const start = [...Save.data.inventory] as Inventory;
    this.buildSlots(start);
    const res = runCascade(start, d.sparks);
    this.applyReward(res.inv, res.epicsGained, res.epicsOpened, true);
    this.time.delayedCall(160, () => this.playCascade(res.events, res.inv));

    const zone = this.add.zone(0, SLOT_Y - 40, 640, 260).setInteractive();
    zone.on('pointerdown', () => this.skipCascade());
    r.add(zone);

    if (d.sparks > 0) {
      const x2 = new Button(this, 0, 300, {
        w: 500,
        h: 108,
        color: 'orange',
        label: '×2 за рекламу',
        icon: 'ico_video',
        size: 40,
        onClick: () => this.doubleReward(x2),
      });
      this.buttons.push(x2);
      r.add(x2);
    }
    const next = new Button(this, 60, 430, { w: 400, h: 118, label: 'Дальше', icon: 'ico_play', onClick: () => this.next() });
    next.pulse();
    const home = new Button(this, -225, 430, { round: true, color: 'orange', icon: 'ico_home', onClick: () => this.toMenu() });
    this.buttons.push(next, home);
    r.add([next, home]);
  }

  private buildSlots(inv: Inventory) {
    this.shown = [...inv] as Inventory;
    const g = this.add.graphics();
    g.fillStyle(0xf0d79c, 1);
    g.fillRoundedRect(-300, SLOT_Y - 85, 600, 210, 30);
    this.root.add(g);
    for (let t = 0; t < 4; t++) {
      const img = this.add.image(SLOT_X[t], SLOT_Y - 15, `tier${t}`).setScale(SLOT_SCALE);
      const cnt = txt(this, SLOT_X[t], SLOT_Y + 45, String(inv[t]), 40, '#ffffff');
      const name = txt(this, SLOT_X[t], SLOT_Y + 92, TIER_NAMES[t].replace('Эпический ', 'Эпик-\n'), 22, '#8a5a32', {
        stroke: '#fff1cf',
        strokeW: 2,
      });
      if (t === 3) name.setY(SLOT_Y + 100);
      this.slots.push(img);
      this.counts.push(cnt);
      this.root.add([img, cnt, name]);
    }
    for (let t = 0; t < 3; t++) {
      const arrow = txt(this, (SLOT_X[t] + SLOT_X[t + 1]) / 2, SLOT_Y - 15, '›', 50, '#c9a46a', { stroke: '#fff1cf', strokeW: 2 });
      this.root.add(arrow);
    }
  }

  private applyReward(inv: Inventory, epics: number, opened: number, first: boolean) {
    const d = this.d;
    const grants = hatsEarned(epics, opened);
    Save.update((s) => {
      if (first) {
        s.level = Math.max(s.level, d.level + 1);
        s.bestScore[String(d.level)] = Math.max(s.bestScore[String(d.level)] ?? 0, d.score);
      }
      s.inventory = [...inv] as Inventory;
      const g = grantUnlocks(s.hatsUnlocked, COSMETIC_COUNT, grants);
      s.hatsUnlocked = g.unlocked;
      if (g.newHats.length) s.hat = g.hat;
      if (g.newSkins.length) s.skin = g.skin;
      for (const id of g.newHats) this.pendingUnlocks.push({ kind: 'hat', id });
      for (const id of g.newSkins) this.pendingUnlocks.push({ kind: 'skin', id });
    });
  }

  private pendingUnlocks: CosmeticDrop[] = [];

  private scheduleCascade(ms: number, fn: () => void) {
    const t = this.time.delayedCall(ms, fn);
    this.cascadeTimers.push(t);
    return t;
  }

  private clearCascadeTimers() {
    for (const t of this.cascadeTimers) t.remove(false);
    this.cascadeTimers = [];
  }

  private playCascade(events: CascadeEvent[], finalInv: Inventory) {
    this.clearCascadeTimers();
    this.cascading = true;
    this.finalInv = finalInv;
    this.epicOpens = events.filter((e) => e.type === 'openEpic').length;
    const TOTAL = 2000;
    let cursor = 0;
    const stamps: { ev: Exclude<CascadeEvent, { type: 'openEpic' }>; t: number }[] = [];
    for (const ev of events) {
      if (ev.type === 'openEpic') continue;
      stamps.push({ ev, t: cursor });
      if (ev.type === 'add') cursor += 42;
      else cursor += ev.from === 0 ? 55 : 70;
    }
    const scale = cursor > TOTAL ? TOTAL / cursor : 1;
    let addI = 0;
    for (const { ev, t } of stamps) {
      this.scheduleCascade(t * scale, () => {
        if (!this.scene.isActive()) return;
        if (ev.type === 'add') {
          this.flySpark(addI++);
          this.shown[0]++;
          this.bump(0);
        } else this.fuseFx(ev.from);
      });
    }
    this.scheduleCascade(Math.max(TOTAL, cursor * scale) + 30, () => {
      this.finishCascade();
    });
  }

  private finishCascade() {
    if (!this.cascading) return;
    this.cascading = false;
    this.clearCascadeTimers();
    this.shown = [...this.finalInv] as Inventory;
    if (this.epicOpens > 0) this.shown[3] += this.epicOpens * 5;
    for (let t = 0; t < 4; t++) {
      this.counts[t].setText(String(Math.max(0, this.shown[t])));
      this.tweens.killTweensOf(this.slots[t]);
      this.slots[t].setScale(SLOT_SCALE);
    }
    this.playEpicCeremonies();
  }

  private skipCascade() {
    if (!this.cascading) return;
    this.finishCascade();
  }

  private flySpark(i: number) {
    const s = this.add.image(360, 640 - 85, 'spark').setScale(0.95).setDepth(5);
    const tx = 360 + SLOT_X[0] + Phaser.Math.Between(-8, 8);
    const ty = 640 + SLOT_Y - 15;
    this.tweens.add({
      targets: s,
      x: { from: 360 + Phaser.Math.Between(-40, 40), to: tx },
      y: ty,
      scale: 0.48,
      angle: 200,
      duration: 260,
      ease: 'Cubic.In',
      onComplete: () => s.destroy(),
    });
    Sound.spark(i);
  }

  private bump(t: number) {
    this.counts[t].setText(String(Math.max(0, this.shown[t])));
    this.tweens.add({ targets: this.slots[t], scale: { from: SLOT_SCALE * 1.2, to: SLOT_SCALE }, duration: 160 });
  }

  private fuseFx(from: 0 | 1 | 2) {
    const to = from + 1;
    this.shown[from] = Math.max(0, this.shown[from] - 5);
    this.shown[to] += 1;
    this.bump(from);
    this.bump(to);
    for (let k = 0; k < 5; k++) {
      const m = this.add
        .image(360 + SLOT_X[from] + (k - 2) * 14, 640 + SLOT_Y - 15 - Math.abs(k - 2) * 10, `tier${from}`)
        .setScale(0.45)
        .setDepth(5);
      this.tweens.add({
        targets: m,
        x: 360 + SLOT_X[to],
        y: 640 + SLOT_Y - 15,
        duration: 150,
        delay: k * 8,
        ease: 'Cubic.In',
        onComplete: () => m.destroy(),
      });
    }
    this.time.delayedCall(160, () => {
      burst(this, 360 + SLOT_X[to], 640 + SLOT_Y - 15, 'spark_white', 10, { speed: 200, depth: 6 });
      Sound.fuse(to);
    });
  }

  private playEpicCeremonies() {
    const items = this.pendingUnlocks.splice(0);
    const opens = this.epicOpens;
    this.epicOpens = 0;
    if (!items.length) return;
    this.ceremonyRunning = true;
    const run = (i: number) => {
      if (i >= items.length || !this.scene.isActive()) {
        this.ceremonyRunning = false;
        return;
      }
      const after = () => this.showUnlock(items[i], () => run(i + 1));
      if (i < opens) this.playChestCeremony(items[i], after);
      else after();
    };
    run(0);
  }

  private clearChestFx() {
    this.tweens.killTweensOf(this.chestFx);
    for (const t of this.ceremonyTimers) t.remove(false);
    this.ceremonyTimers = [];
    for (const o of this.chestFx) o.destroy();
    this.chestFx = [];
  }

  /** Closed chest flies to the screen center, opens, and the prize pops out. */
  private playChestCeremony(item: CosmeticDrop, onDone: () => void) {
    this.clearChestFx();
    this.tweens.killTweensOf(this.slots[3]);
    this.slots[3].setScale(SLOT_SCALE);
    this.shown[3] = Math.max(0, this.shown[3] - 5);
    this.counts[3].setText(String(this.shown[3]));

    const fromX = 360 + SLOT_X[3];
    const fromY = 640 + SLOT_Y - 15;
    const cx = 360;
    const cy = 560;
    const veil = this.add.rectangle(360, 640, 720, 1280, 0x1a1030, 0.45).setDepth(24);
    const flyer = this.add.image(fromX, fromY, 'tier3').setScale(SLOT_SCALE).setDepth(26);
    this.chestFx.push(veil, flyer);
    Sound.epic();
    this.tweens.add({
      targets: flyer,
      x: cx,
      y: cy,
      scale: 1.55,
      duration: 420,
      ease: 'Back.Out',
      onComplete: () => {
        if (!this.scene.isActive()) return;
        flyer.destroy();
        const open = this.add.image(cx, cy, 'tier3_open').setScale(0.45).setDepth(40);
        this.chestFx.push(open);
        this.tweens.add({ targets: open, scale: 1.7, duration: 280, ease: 'Back.Out' });
        const hello = txt(this, cx, 220, 'Поздравляем!', 58, '#ffc93c').setDepth(41);
        this.chestFx.push(hello);
        popIn(this, hello);
        confetti(this, 42);
        this.cameras.main.flash(220, 255, 240, 200);
        const prizeAt = this.time.delayedCall(300, () => {
          if (!this.scene.isActive()) return;
          const key = item.kind === 'skin' ? frogIconKey(item.id) : `hatshop${item.id}`;
          const prize = this.add.image(cx, cy - 10, key).setScale(0.08).setDepth(42);
          this.chestFx.push(prize);
          this.tweens.add({
            targets: prize,
            y: cy - 168,
            scale: item.kind === 'skin' ? 1.05 : 0.86,
            angle: { from: -18, to: 12 },
            duration: 520,
            ease: 'Back.Out',
          });
          burst(this, cx, cy - 40, 'star_red', 10, { speed: 180, scale: 0.18, life: 560, depth: 41, spin: true });
          Sound.win();
        });
        const doneAt = this.time.delayedCall(1700, () => {
          if (!this.scene.isActive()) return;
          this.clearChestFx();
          onDone();
        });
        this.ceremonyTimers.push(prizeAt, doneAt);
      },
    });
  }

  private showUnlock(item: CosmeticDrop, onDone?: () => void) {
    const block = this.add.rectangle(360, 640, 720, 1280, 0x1a1030, 0.45).setInteractive().setDepth(29);
    const c = this.add.container(360, 600).setDepth(30);
    c.add(panel(this, 0, 0, 520, 450));
    const isSkin = item.kind === 'skin';
    c.add(txt(this, 0, -155, isSkin ? 'Новый окрас!' : 'Новая шапочка!', 50, '#ffffff'));
    const h = this.add.image(0, -40, isSkin ? frogIconKey(item.id) : `hatshop${item.id}`).setScale(isSkin ? 0.9 : 0.72);
    this.tweens.add({ targets: h, angle: { from: -8, to: 8 }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    c.add(h);
    const name = isSkin ? SKIN_NAMES[item.id] : HAT_NAMES[item.id];
    c.add(txt(this, 0, 55, name, 40, '#8a5a32', { stroke: '#fff1cf', strokeW: 2 }));
    const close = () => {
      block.destroy();
      c.destroy();
      onDone?.();
    };
    const ok = new Button(this, 0, 140, {
      w: 300,
      h: 96,
      label: 'Ура!',
      size: 44,
      onClick: close,
    });
    c.add(ok);
    popIn(this, c);
    Sound.win();
  }

  private async doubleReward(btn: Button) {
    if (this.busy || this.doubled) return;
    if (this.cascading) this.finishCascade();
    this.busy = true;
    btn.setEnabled(false);
    const ok = await Ya.showRewarded();
    this.busy = false;
    if (!this.scene.isActive()) return;
    if (!ok) {
      this.toast('Видео сейчас недоступно');
      btn.setEnabled(true);
      return;
    }
    this.doubled = true;
    btn.setLabel('Получено!');
    const start = [...Save.data.inventory] as Inventory;
    const res = runCascade(start, this.d.sparks);
    this.applyReward(res.inv, res.epicsGained, res.epicsOpened, false);
    this.sparkText?.setText(`+${sparksLabel(this.d.sparks * 2)}`);
    const play = () => {
      if (!this.scene.isActive()) return;
      this.playCascade(res.events, res.inv);
    };
    const wait = () => {
      if (!this.scene.isActive()) return;
      if (this.ceremonyRunning) this.time.delayedCall(400, wait);
      else play();
    };
    if (this.ceremonyRunning) this.time.delayedCall(400, wait);
    else play();
  }

  private async next() {
    if (this.busy || this.ceremonyRunning) return;
    if (this.cascading) {
      this.finishCascade();
      if (this.ceremonyRunning) return;
    }
    this.busy = true;
    for (const b of this.buttons) b.setEnabled(false);
    this.skipCascade();
    if (Ya.canShowInterstitial()) {
      await Ya.showInterstitial();
    }
    this.scene.stop();
    this.scene.resume('Game');
    this.scene.get('Game').scene.restart({ level: this.d.level + 1 });
  }

  private toMenu() {
    if (this.busy) return;
    this.ceremonyRunning = false;
    this.clearChestFx();
    this.skipCascade();
    this.scene.stop('Game');
    this.scene.start('Menu');
  }

  // ---------------- fail ----------------

  private buildFail() {
    const d = this.d;
    const r = this.root;
    r.add(panel(this, 0, d.canExtend ? 0 : -60, 640, d.canExtend ? 900 : 780));
    r.add(txt(this, 0, -370, 'Квася не наелась…', 52, '#ffffff'));
    const sad = this.add.image(0, -175, frogTextureKey(Save.data.skin), 4).setOrigin(0.5, 0.55).setScale(0.38);
    r.add(sad);
    const fh = CHAR_SHEETS.frog_char.frameHeight;
    const eyes: [number, number][] = [
      [-100.5, -414.5],
      [89, -414.5],
    ];
    for (let i = 0; i < 2; i++) {
      const [ex, ey] = eyes[i];
      const lx = ex * sad.scaleX;
      const ly = (fh + ey - fh * 0.55) * sad.scaleY;
      r.add(
        this.add
          .image(sad.x + lx + (i === 0 ? 4 : -4), sad.y + ly + 7, 'frog_pupil')
          .setScale(0.48),
      );
    }
    const line =
      d.reason === 'min'
        ? `Поймано ${d.caught} из ${d.minCatch}`
        : `Очки ${d.score} из ${d.superThreshold}`;
    r.add(txt(this, 0, -60, line, 44, '#2b1d16', { stroke: '#fff1cf', strokeW: 2 }));
    const close = d.reason === 'min' ? d.caught >= d.minCatch * 0.7 : d.score >= d.superThreshold * 0.8;
    const hint = close
      ? 'Не хватило совсем чуть-чуть!'
      : d.reason === 'min'
        ? 'Тапай быстрее — мошки не ждут!'
        : 'Тапай пару дважды в одну точку!';
    r.add(txt(this, 0, 5, hint, 32, '#8a5a32', { stroke: '#fff1cf', strokeW: 2 }));

    let y = 130;
    if (d.canExtend) {
      const ext = new Button(this, 0, y, {
        w: 520,
        h: 112,
        color: 'orange',
        label: '+10 сек за рекламу',
        icon: 'ico_video',
        size: 36,
        onClick: () => this.extend(ext),
      });
      ext.pulse();
      this.buttons.push(ext);
      r.add(ext);
      y += 135;
    }
    const again = new Button(this, 0, y, {
      w: 480,
      h: 112,
      label: 'Ещё раз',
      icon: 'ico_retry',
      onClick: () => {
        if (this.busy) return;
        this.scene.stop();
        this.scene.resume('Game');
        this.scene.get('Game').scene.restart({ level: d.level });
      },
    });
    if (!d.canExtend) again.pulse();
    const home = new Button(this, 0, y + 135, { w: 480, h: 100, color: 'orange', label: 'В меню', icon: 'ico_home', size: 44, onClick: () => this.toMenu() });
    this.buttons.push(again, home);
    r.add([again, home]);
  }

  private async extend(btn: Button) {
    if (this.busy) return;
    this.busy = true;
    btn.setEnabled(false);
    const ok = await Ya.showRewarded();
    this.busy = false;
    if (!this.scene.isActive()) return;
    if (!ok) {
      this.toast('Видео сейчас недоступно');
      btn.setEnabled(true);
      return;
    }
    const game = this.scene.get('Game') as GameScene;
    this.scene.stop();
    this.scene.resume('Game');
    game.extendTime(10_000);
  }

  private toast(msg: string) {
    const t = txt(this, 360, 1180, msg, 36, '#ffffff').setDepth(40);
    this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 300, onComplete: () => t.destroy() });
  }
}
