import Phaser from 'phaser';
import { CHAR_SHEETS } from '../art/chars';
import { frogIconKey, frogTextureKey, SKIN_NAMES, skinById } from '../art/skins';
import { addArtOnFrogImage, addHatOnFrogImage, fitScale } from '../objects/Frog';
import { HAT_NAMES } from '../art/textures';
import { ART_COUNT, ART_NAMES, HAT_UNLOCK_COUNT, SKIN_COUNT } from '../data/cosmetics';
import {
  ART_COST,
  HAT_COST,
  TIER_FOR,
  TIER_NAMES,
  applyRewards,
  rewardHeadline,
  rewardsForLevel,
  trackLabel,
  type Inventory,
  type Owned,
  type RewardGain,
  type UnlockDrop,
} from '../data/rewards';
import { Sound } from '../systems/audio';
import { Save } from '../systems/save';
import { Ya } from '../systems/yandex';
import { Button, dimmer, panel, popIn, txt } from '../ui/ui';
import { confetti, starBurst } from '../ui/fx';
import type { GameScene, ResultData } from './GameScene';

const SLOT_Y = 55;
const SLOT_X = [-210, 0, 210];
const SLOT_SCALE = 0.82;
const SLOT_KEYS = ['tier0', 'tier1', 'tier3'] as const;

export class ResultScene extends Phaser.Scene {
  private d!: ResultData;
  private root!: Phaser.GameObjects.Container;
  private counts: Phaser.GameObjects.Text[] = [];
  private slots: Phaser.GameObjects.Image[] = [];
  private finalInv: Inventory = [0, 0, 0];
  private finalOwned: Owned = { hats: 0, arts: 0, skins: 0 };
  private cascadeTimers: Phaser.Time.TimerEvent[] = [];
  private cascading = false;
  private buttons: Button[] = [];
  private busy = false;
  private doubled = false;
  private sparkText?: Phaser.GameObjects.Text;
  private chestFx: Phaser.GameObjects.GameObject[] = [];
  private ceremonyTimers: Phaser.Time.TimerEvent[] = [];
  private ceremonyRunning = false;
  private pendingUnlocks: UnlockDrop[] = [];
  private openedSkin = false;

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
    this.openedSkin = false;
    this.chestFx = [];
    this.ceremonyTimers = [];
    this.ceremonyRunning = false;
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
    const head = d.isSuper ? 'Супер-уровень пройден!' : d.isRace ? 'Клеша обогнана!' : `Уровень ${d.level} пройден!`;
    r.add(txt(this, 0, -455, head, d.isSuper || d.isRace ? 46 : 54, '#ffffff'));

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

    let info = d.isRace ? `Квася ${d.caught} : ${d.rivalCaught} Клеша` : `Очки: ${d.score}    Поймано: ${d.caught}`;
    if (d.isRace) info += `\nТы обогнала Клешу на ${d.caught - d.rivalCaught}!`;
    if (d.isSuper && d.superMult > 1) info += `\nБонус супер-уровня ×${d.superMult}`;
    r.add(txt(this, 0, -175, info, 36, '#2b1d16', { stroke: '#fff1cf', strokeW: 2 }));

    const owned = this.ownedNow();
    this.buildSlots(Save.data.inventory, owned);
    const gain = rewardsForLevel({ stars: d.stars, caught: d.caught, isSuper: d.isSuper });
    const res = this.grant(gain, true);
    this.sparkText = txt(this, 0, -95, rewardHeadline(gain, res.drops.some((x) => x.kind === 'skin')), 34, '#ffc93c');
    r.add(this.sparkText);
    this.time.delayedCall(160, () => this.playGain(gain));

    const zone = this.add.zone(0, SLOT_Y, 640, 280).setInteractive();
    zone.on('pointerdown', () => this.skipCascade());
    r.add(zone);

    if (this.anotherGainMatters(gain)) {
      const x2 = new Button(this, 0, 318, {
        w: 500,
        h: 100,
        color: 'orange',
        label: '×2 за рекламу',
        icon: 'ico_video',
        size: 40,
        onClick: () => this.doubleReward(x2),
      });
      this.buttons.push(x2);
      r.add(x2);
    }
    const next = new Button(this, 60, 448, { w: 400, h: 112, label: 'Дальше', icon: 'ico_play', onClick: () => this.next() });
    next.pulse();
    const home = new Button(this, -225, 448, { round: true, color: 'orange', icon: 'ico_home', onClick: () => this.toMenu() });
    this.buttons.push(next, home);
    r.add([next, home]);
  }

  private ownedNow(): Owned {
    return {
      hats: Save.data.hatsUnlocked,
      arts: Save.data.artsUnlocked,
      skins: Save.data.skinsUnlocked,
    };
  }

  private progressLine(i: number, inv: Inventory, owned: Owned): string {
    if (i === 0) return trackLabel(inv[0], HAT_COST, owned.hats >= HAT_UNLOCK_COUNT);
    if (i === 1) return trackLabel(inv[1], ART_COST, owned.arts >= ART_COUNT);
    return owned.skins >= SKIN_COUNT ? 'все' : `${owned.skins}/${SKIN_COUNT}`;
  }

  private buildSlots(inv: Inventory, owned: Owned) {
    const g = this.add.graphics();
    g.fillStyle(0xf0d79c, 1);
    g.fillRoundedRect(-310, SLOT_Y - 78, 620, 268, 30);
    this.root.add(g);
    for (let t = 0; t < 3; t++) {
      const img = this.add.image(SLOT_X[t], SLOT_Y - 28, SLOT_KEYS[t]).setScale(SLOT_SCALE);
      const name = txt(this, SLOT_X[t], SLOT_Y + 26, TIER_NAMES[t], 22, '#8a5a32', { stroke: '#fff1cf', strokeW: 2 });
      const cnt = txt(this, SLOT_X[t], SLOT_Y + 64, this.progressLine(t, inv, owned), 36, '#ffffff');
      const purpose = txt(this, SLOT_X[t], SLOT_Y + 106, TIER_FOR[t], 24, '#2b1d16', { stroke: '#fff1cf', strokeW: 2 });
      this.slots.push(img);
      this.counts.push(cnt);
      this.root.add([img, name, cnt, purpose]);
    }
    this.root.add(
      txt(this, 0, SLOT_Y + 162, 'Звёзды — искорки. 3 звезды — блестяшка.\nСупер-уровень — сундучек.', 22, '#8a5a32', {
        stroke: '#fff1cf',
        strokeW: 2,
      }),
    );
  }

  private grant(gain: RewardGain, advance: boolean) {
    const res = applyRewards(Save.data.inventory, gain, this.ownedNow());
    Save.update((s) => {
      if (advance) {
        s.level = Math.max(s.level, this.d.level + 1);
        s.bestScore[String(this.d.level)] = Math.max(s.bestScore[String(this.d.level)] ?? 0, this.d.score);
      }
      s.inventory = res.inv;
      s.hatsUnlocked = res.owned.hats;
      s.artsUnlocked = res.owned.arts;
      s.skinsUnlocked = res.owned.skins;
      for (const drop of res.drops) {
        if (drop.kind === 'hat') s.hat = drop.id;
        else if (drop.kind === 'art') s.art = drop.id;
        else s.skin = drop.id;
        this.pendingUnlocks.push(drop);
      }
    });
    if (res.drops.some((d) => d.kind === 'skin')) this.openedSkin = true;
    this.finalInv = res.inv;
    this.finalOwned = res.owned;
    return res;
  }

  private anotherGainMatters(gain: RewardGain): boolean {
    const again = applyRewards(Save.data.inventory, gain, this.ownedNow());
    return again.drops.length > 0 || again.inv.some((n, i) => n !== Save.data.inventory[i]);
  }

  private playGain(gain: RewardGain) {
    this.clearCascadeTimers();
    this.cascading = true;
    const jobs: { key: string; slot: number }[] = [];
    for (let i = 0; i < Math.min(8, gain.sparks); i++) jobs.push({ key: 'spark', slot: 0 });
    if (gain.glitters > 0) jobs.push({ key: 'tier1', slot: 1 });
    if (this.pendingUnlocks.some((d) => d.kind === 'skin')) jobs.push({ key: 'tier3', slot: 2 });
    jobs.forEach((job, i) => this.scheduleCascade(40 + i * 80, () => this.flyIcon(job.key, job.slot, i)));
    this.scheduleCascade(40 + jobs.length * 80 + 180, () => this.finishCascade());
  }

  private flyIcon(key: string, slot: number, i: number) {
    if (!this.scene.isActive()) return;
    const s = this.add.image(360, 545, key).setScale(0.85).setDepth(5);
    this.tweens.add({
      targets: s,
      x: 360 + SLOT_X[slot] + Phaser.Math.Between(-6, 6),
      y: 640 + SLOT_Y - 28,
      scale: 0.4,
      duration: 260,
      ease: 'Cubic.In',
      onComplete: () => s.destroy(),
    });
    if (key === 'spark') Sound.spark(i);
    else Sound.fuse(slot);
    this.tweens.add({ targets: this.slots[slot], scale: { from: SLOT_SCALE * 1.16, to: SLOT_SCALE }, duration: 140 });
  }

  private finishCascade() {
    if (!this.cascading) return;
    this.cascading = false;
    this.clearCascadeTimers();
    for (let t = 0; t < 3; t++) {
      this.counts[t].setText(this.progressLine(t, this.finalInv, this.finalOwned));
      this.tweens.killTweensOf(this.slots[t]);
      this.slots[t].setScale(SLOT_SCALE);
    }
    this.playCeremonies();
  }

  private skipCascade() {
    if (!this.cascading) return;
    this.finishCascade();
  }

  private scheduleCascade(ms: number, fn: () => void) {
    const t = this.time.delayedCall(ms, fn);
    this.cascadeTimers.push(t);
    return t;
  }

  private clearCascadeTimers() {
    for (const t of this.cascadeTimers) t.remove(false);
    this.cascadeTimers = [];
  }

  private playCeremonies() {
    const items = this.pendingUnlocks.splice(0);
    if (!items.length) return;
    this.ceremonyRunning = true;
    const run = (i: number) => {
      if (i >= items.length || !this.scene.isActive()) {
        this.ceremonyRunning = false;
        return;
      }
      const after = () => this.showUnlock(items[i], () => run(i + 1));
      if (items[i].kind === 'skin') this.playChestCeremony(after);
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

  /** The chest flies to the middle and opens into the new colour. */
  private playChestCeremony(onDone: () => void) {
    this.clearChestFx();
    const fromX = 360 + SLOT_X[2];
    const fromY = 640 + SLOT_Y - 28;
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
        const doneAt = this.time.delayedCall(900, () => {
          if (!this.scene.isActive()) return;
          this.clearChestFx();
          onDone();
        });
        this.ceremonyTimers.push(doneAt);
      },
    });
  }

  private showUnlock(item: UnlockDrop, onDone?: () => void) {
    const block = this.add.rectangle(360, 640, 720, 1280, 0x1a1030, 0.45).setInteractive().setDepth(29);
    const c = this.add.container(360, 600).setDepth(30);
    c.add(panel(this, 0, 0, 520, 450));
    const title = item.kind === 'skin' ? 'Новый окрас!' : item.kind === 'art' ? 'Новый рисунок!' : 'Новая шапочка!';
    c.add(txt(this, 0, -155, title, 50, '#ffffff'));
    const key = item.kind === 'skin' ? frogIconKey(item.id) : item.kind === 'art' ? `art${item.id}` : `hatshop${item.id}`;
    const h = this.add.image(0, -40, key);
    h.setScale(item.kind === 'hat' ? 0.72 : item.kind === 'art' ? fitScale(h, 170, 160) : 0.9);
    this.tweens.add({ targets: h, angle: { from: -8, to: 8 }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    c.add(h);
    const name = item.kind === 'skin' ? SKIN_NAMES[item.id] : item.kind === 'art' ? ART_NAMES[item.id] : HAT_NAMES[item.id];
    c.add(txt(this, 0, 70, name, 40, '#8a5a32', { stroke: '#fff1cf', strokeW: 2 }));
    const close = () => {
      block.destroy();
      c.destroy();
      onDone?.();
    };
    c.add(new Button(this, 0, 155, { w: 300, h: 96, label: 'Ура!', size: 44, onClick: close }));
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
    const gain = rewardsForLevel({ stars: this.d.stars, caught: this.d.caught, isSuper: this.d.isSuper });
    this.grant(gain, false);
    const shown: RewardGain = { sparks: gain.sparks * 2, glitters: gain.glitters * 2, chests: gain.chests * 2 };
    this.sparkText?.setText(rewardHeadline(shown, this.openedSkin));
    const play = () => {
      if (!this.scene.isActive()) return;
      this.playGain(gain);
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

  goBack() {
    this.toMenu();
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
    const raceHead = d.caught === d.rivalCaught ? 'Ничья — Клеша победила' : 'Клеша победила…';
    r.add(txt(this, 0, -370, d.isRace ? raceHead : 'Квася не наелась…', d.isRace ? 42 : 52, '#ffffff'));
    const sad = this.add.image(0, -175, frogTextureKey(Save.data.skin), 4).setOrigin(0.5, 0.55).setScale(0.38);
    r.add(sad);
    addHatOnFrogImage(this, r, sad, Save.data.hat);
    addArtOnFrogImage(this, r, sad, Save.data.art);
    const fh = CHAR_SHEETS.frog_char.frameHeight;
    const eyes: [number, number][] = [
      [-100.5, -414.5],
      [89, -414.5],
    ];
    const pupilTint = skinById(Save.data.skin)?.pupil ?? 0xffffff;
    for (let i = 0; i < 2; i++) {
      const [ex, ey] = eyes[i];
      const lx = ex * sad.scaleX;
      const ly = (fh + ey - fh * 0.55) * sad.scaleY;
      const pupil = this.add
        .image(sad.x + lx + (i === 0 ? 4 : -4), sad.y + ly + 7, 'frog_pupil')
        .setScale(0.48);
      if (pupilTint !== 0xffffff) pupil.setTint(pupilTint);
      r.add(pupil);
    }
    const line =
      d.reason === 'race'
        ? `Квася ${d.caught} : ${d.rivalCaught} Клеша`
        : d.reason === 'min'
          ? `Поймано ${d.caught} из ${d.minCatch}`
          : `Очки ${d.score} из ${d.superThreshold}`;
    r.add(txt(this, 0, -60, line, 44, '#2b1d16', { stroke: '#fff1cf', strokeW: 2 }));
    const close =
      d.reason === 'race'
        ? d.caught >= d.rivalCaught - 1
        : d.reason === 'min'
          ? d.caught >= d.minCatch * 0.7
          : d.score >= d.superThreshold * 0.8;
    const hint =
      d.reason === 'race'
        ? d.caught === d.rivalCaught
          ? 'Ничья — победа за Клешей.\nПоймай хоть на одну больше!'
          : 'Нужно поймать БОЛЬШЕ, чем Клеша.\nПерехватывай её мошек!'
        : close
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
