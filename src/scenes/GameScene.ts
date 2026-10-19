import Phaser from 'phaser';
import { C, FROG_X, INSECT_BOTTOM, INSECT_TOP, PERCH_Y, W } from '../config';
import { ensureBackground, themeNameForLevel } from '../art/backgrounds';
import {
  COMBO_WINDOW_MS,
  PAIR_BONUS,
  comboMultiplier,
  evaluateLevel,
  fatTier,
  getLevelConfig,
  superMultiplier,
  type LevelConfig,
} from '../data/levels';
import { DOUBLE_TONGUE_MS, pickSecondTongueTarget } from '../data/doubleTongue';
import { sparksForLevel } from '../data/rewards';
import { BUG_BLUSH, FROG_EAT, FROG_FAIL, FROG_FULL, FROG_LICK, FROG_MISS, FROG_POKE, FROG_WIN, MOSQUITO_BLUSH, pick, plural } from '../data/phrases';
import { Frog } from '../objects/Frog';
import { Insect, type InsectKind } from '../objects/Insect';
import { Sound } from '../systems/audio';
import { Save } from '../systems/save';
import { Ya } from '../systems/yandex';
import { Button, bubble, floatText, panel, popIn, sticker, txt } from '../ui/ui';
import { burst, confetti, hearts, shake, starBurst } from '../ui/fx';

type GState = 'intro' | 'tutorial' | 'playing' | 'paused' | 'ending' | 'result';

export interface ResultData {
  level: number;
  won: boolean;
  stars: number;
  score: number;
  caught: number;
  minCatch: number;
  reason: 'ok' | 'min' | 'threshold';
  isSuper: boolean;
  superThreshold: number;
  superMult: number;
  sparks: number;
  canExtend: boolean;
}

const PAIR_WINDOW_MS = 650;
const DEV = import.meta.env.DEV;

export class GameScene extends Phaser.Scene {
  private cfg!: LevelConfig;
  private level = 1;
  private frog!: Frog;
  private insects: Insect[] = [];
  private state: GState = 'intro';
  private prevState: GState = 'playing';
  private score = 0;
  private caught = 0;
  private eaten = 0;
  private licks = 0;
  private pairClears = 0;
  private combo = 0;
  private lastCatchAt = -99999;
  private playMs = 0;
  private timeLeft = 0;
  private spawnAcc = 0;
  private pairSeq = 0;
  private pairCaughtAt = new Map<number, number>();
  private extendUsed = false;
  private lastSecond = -1;
  private pairMissHints = 0;
  private normaShown = false;
  private tutorialStep: 'eat' | 'lick' | 'done' = 'done';
  private tutorialUi: Phaser.GameObjects.GameObject[] = [];
  private tutorialIns: Insect | null = null;
  private tutorialArrow: Phaser.GameObjects.Image | null = null;
  private tutorialRing: Phaser.GameObjects.Arc | null = null;

  // HUD
  private timerText!: Phaser.GameObjects.Text;
  private timerPill!: Phaser.GameObjects.Container;
  private catchText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private barFill!: Phaser.GameObjects.Graphics;
  private barMax = 1;
  private starMarks: Phaser.GameObjects.Image[] = [];
  private shownScore = 0;
  private systemFrozen = false;
  private doubleTongueGranted = false;
  private doubleTongueUntil = 0;
  private doubleHud!: Phaser.GameObjects.Container;
  private doubleHudText!: Phaser.GameObjects.Text;

  constructor() {
    super('Game');
  }

  init(data: { level?: number }) {
    this.level = Math.max(1, data?.level ?? Save.data.level);
    this.cfg = getLevelConfig(this.level);
    this.insects = [];
    this.state = 'intro';
    this.score = 0;
    this.shownScore = 0;
    this.caught = 0;
    this.eaten = 0;
    this.licks = 0;
    this.pairClears = 0;
    this.combo = 0;
    this.lastCatchAt = -99999;
    this.playMs = 0;
    this.timeLeft = this.cfg.duration * 1000;
    this.spawnAcc = this.cfg.spawnInterval * 0.75;
    this.pairSeq = 0;
    this.pairCaughtAt.clear();
    this.extendUsed = false;
    this.lastSecond = -1;
    this.pairMissHints = 0;
    this.normaShown = false;
    this.tutorialStep = 'done';
    this.tutorialUi = [];
    this.tutorialIns = null;
    this.tutorialArrow = null;
    this.tutorialRing = null;
    this.starMarks = [];
    this.systemFrozen = false;
    this.doubleTongueGranted = false;
    this.doubleTongueUntil = 0;
  }

  create() {
    this.add.image(0, 0, ensureBackground(this, this.level)).setOrigin(0);
    this.frog = new Frog(this, FROG_X, PERCH_Y - 8);
    this.frog.setHat(Save.data.hat);
    this.frog.setSkin(Save.data.skin);
    this.frog.lookAt(FROG_X, 500);
    this.buildHud();

    this.input.on('pointerdown', this.onTap, this);
    this.input.keyboard?.on('keydown-ESC', () => this.pauseGame());
    this.input.keyboard?.on('keydown-P', () => this.pauseGame());
    this.game.events.on('platform-pause', this.freezeForPlatform, this);
    this.game.events.on('platform-resume', this.unfreezeForPlatform, this);
    this.events.on('resume', this.onResumed, this);
    this.events.once('shutdown', () => {
      this.game.events.off('platform-pause', this.freezeForPlatform, this);
      this.game.events.off('platform-resume', this.unfreezeForPlatform, this);
      this.events.off('resume', this.onResumed, this);
      Ya.gameplayStop();
      Sound.tempo = 1;
    });

    this.cameras.main.fadeIn(250, 26, 16, 48);
    Sound.startMusic();
    this.showIntro();
    if (DEV) (window as unknown as { __game: GameScene }).__game = this;
  }

  // ---------------- HUD ----------------

  private pill(x: number, y: number, w: number, h: number, color: number = C.cream) {
    const g = this.add.graphics();
    g.fillStyle(C.outline, 1);
    g.fillRoundedRect(-w / 2 - 5, -h / 2 - 5, w + 10, h + 10, h / 2 + 5);
    g.fillStyle(color, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.fillStyle(0xffffff, 0.35);
    g.fillRoundedRect(-w / 2 + 14, -h / 2 + 6, w - 28, h * 0.22, h * 0.11);
    return this.add.container(x, y, [g]).setDepth(70);
  }

  private buildHud() {
    const pauseBtn = new Button(this, 74, 80, {
      round: true,
      color: 'orange',
      icon: 'ico_pause',
      onClick: () => this.pauseGame(),
    });
    pauseBtn.setBaseScale(0.85).setDepth(80);

    const sup = this.cfg.isSuper;
    const title = this.pill(360, 78, sup ? 330 : 250, 74, sup ? C.gold : C.cream);
    title.add(txt(this, 0, 0, sup ? `СУПЕР ${this.level}` : `Уровень ${this.level}`, 38, sup ? '#ffffff' : '#2b1d16', {
      stroke: sup ? '#2b1d16' : '#fff6dc',
      strokeW: sup ? 7 : 2,
    }));
    if (sup) {
      title.add(this.add.image(-150, -4, 'star_gold').setScale(0.42));
      title.add(this.add.image(150, -4, 'star_gold').setScale(0.42));
    }

    this.timerPill = this.pill(624, 80, 150, 74);
    this.timerText = txt(this, 0, 0, this.fmtTime(this.timeLeft), 42, '#2b1d16', { stroke: '#fff6dc', strokeW: 2 });
    this.timerPill.add(this.timerText);

    const cp = this.pill(196, 172, 290, 70);
    cp.add(this.add.image(-100, -2, 'fly', 0).setScale(0.32));
    this.catchText = txt(this, 30, 0, `0 / ${this.cfg.minCatch}`, 38, '#2b1d16', { stroke: '#fff6dc', strokeW: 2 });
    cp.add(this.catchText);

    const sp = this.pill(524, 172, 290, 70);
    sp.add(this.add.image(-100, -2, 'spark').setScale(1.1));
    this.scoreText = txt(this, 24, 0, '0', 38, '#2b1d16', { stroke: '#fff6dc', strokeW: 2 });
    sp.add(this.scoreText);

    // progress bar with star (or threshold) markers
    const bx = 70;
    const bw = 580;
    const by = 248;
    const bg = this.add.graphics().setDepth(70);
    bg.fillStyle(C.outline, 1);
    bg.fillRoundedRect(bx - 5, by - 18, bw + 10, 36, 18);
    bg.fillStyle(0x6b5a4a, 1);
    bg.fillRoundedRect(bx, by - 13, bw, 26, 13);
    this.barFill = this.add.graphics().setDepth(71);
    const starKeys = ['star_bronze', 'star_silver', 'star_gold'] as const;
    const starScales = [0.4, 0.46, 0.62];
    const marks: { v: number; key: (typeof starKeys)[number]; scale: number }[] = [];
    if (sup) {
      this.barMax = Math.round(this.cfg.superThreshold * 1.6);
      const vals = [this.cfg.superThreshold, Math.round(this.cfg.superThreshold * 1.3), this.barMax];
      vals.forEach((v, i) => marks.push({ v, key: starKeys[i], scale: starScales[i] }));
    } else {
      this.barMax = this.cfg.starScores[2];
      this.cfg.starScores.forEach((v, i) => marks.push({ v, key: starKeys[i], scale: starScales[i] }));
    }
    for (const m of marks) {
      const mx = bx + (bw * m.v) / this.barMax;
      const img = this.add
        .image(Math.min(mx, bx + bw - 6), by, m.key)
        .setScale(m.scale)
        .setAlpha(0.32)
        .setDepth(72);
      img.setData('v', m.v);
      img.setData('baseScale', m.scale);
      this.starMarks.push(img);
    }
    this.drawBar();

    this.doubleHud = this.pill(360, 292, 360, 52, 0xffe08a).setDepth(72).setVisible(false);
    this.doubleHudText = txt(this, 0, 0, 'Двойной язык  8', 28, '#2b1d16', { stroke: '#fff6dc', strokeW: 2 });
    this.doubleHud.add(this.doubleHudText);
  }

  private drawBar() {
    const bx = 70;
    const bw = 580;
    const by = 248;
    const k = Phaser.Math.Clamp(this.shownScore / this.barMax, 0, 1);
    const g = this.barFill;
    g.clear();
    if (k <= 0) return;
    const w = Math.max(26, bw * k);
    g.fillStyle(this.cfg.isSuper ? C.gold : C.btn, 1);
    g.fillRoundedRect(bx, by - 13, w, 26, 13);
    g.fillStyle(0xffffff, 0.35);
    g.fillRoundedRect(bx + 8, by - 9, Math.max(0, w - 16), 7, 3);
    for (const m of this.starMarks) {
      if (m.getData('lit') || this.shownScore < m.getData('v')) continue;
      m.setData('lit', true);
      const base = (m.getData('baseScale') as number) ?? m.scale;
      this.tweens.add({ targets: m, alpha: 1, duration: 120 });
      this.tweens.add({ targets: m, scale: base * 1.55, duration: 180, yoyo: true, ease: 'Back.Out' });
      Sound.star(Math.min(2, this.starMarks.indexOf(m)));
      starBurst(this, m.x, m.y, 14);
    }
  }

  private fmtTime(ms: number) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  private refreshHud() {
    this.catchText.setText(`${this.caught} / ${this.cfg.minCatch}`);
    this.catchText.setColor(this.caught >= this.cfg.minCatch ? '#3f9a2a' : '#2b1d16');
    this.tweens.add({ targets: this.catchText, scale: { from: 1.3, to: 1 }, duration: 180 });
    this.tweens.addCounter({
      from: this.shownScore,
      to: this.score,
      duration: 250,
      onUpdate: (tw) => {
        this.shownScore = Math.round(tw.getValue() ?? this.score);
        this.scoreText.setText(String(this.shownScore));
        this.drawBar();
      },
    });
  }

  // ---------------- flow ----------------

  private showIntro() {
    this.state = 'intro';
    const c = this.add.container(360, 600).setDepth(100);
    const sup = this.cfg.isSuper;
    const h = sup ? 760 : 440;
    c.add(panel(this, 0, 0, 620, h));
    let y = -h / 2 + 70;
    if (sup) {
      const ribbon = this.pill(0, -h / 2 + 10, 420, 80, C.gold);
      ribbon.setDepth(0);
      ribbon.add(txt(this, 0, -2, 'СУПЕР-УРОВЕНЬ!', 44, '#ffffff'));
      c.add(ribbon);
      y += 40;
    }
    c.add(txt(this, 0, y, `Уровень ${this.level}`, 56, '#ffffff'));
    y += 62;
    c.add(txt(this, 0, y, themeNameForLevel(this.level), 36, '#8a5a32', { stroke: '#fff1cf', strokeW: 2 }));
    y += 74;
    const goal = `Поймай ${this.cfg.minCatch} ${plural(this.cfg.minCatch, 'мошку', 'мошки', 'мошек')}\nза ${this.cfg.duration} сек`;
    c.add(txt(this, 0, y, goal, 40, '#2b1d16', { stroke: '#fff1cf', strokeW: 2 }));
    y += 120;
    if (sup) {
      c.add(
        txt(this, 0, y, `и набери ${this.cfg.superThreshold} очков.\nПара летит кучкой —\nтапни ДВАЖДЫ в одну точку!`, 32, '#c2410c', {
          stroke: '#fff1cf',
          strokeW: 2,
        }),
      );
      y += 120;
    }
    const begin = () => {
      if (sup)
        Save.update((d) => {
          d.superHintDone = true;
        });
      if (this.level === 1 && !Save.data.tutorialDone) this.startTutorial();
      else this.startPlay();
    };
    let adBusy = false;
    const go = new Button(this, 0, h / 2 - (sup ? 72 : 80), {
      w: 380,
      h: 116,
      label: 'Поехали!',
      onClick: () => {
        if (adBusy) return;
        Sound.unlock();
        c.destroy();
        begin();
      },
    });
    go.pulse();
    c.add(go);
    if (sup) {
      const ad = new Button(this, 0, h / 2 - 200, {
        w: 580,
        h: 110,
        color: 'orange',
        icon: 'ico_video',
        size: 26,
        label: 'Реклама: двойной язык\nна 8 секунд',
        onClick: () => {
          if (adBusy) return;
          adBusy = true;
          void this.watchDoubleTongue(c, ad).then((ok) => {
            adBusy = false;
            if (ok) begin();
          });
        },
      });
      c.add(ad);
    }
    popIn(this, c);
    this.frog.say(sup ? 'Двойной пир!' : 'Ква! Я голодная!', 1500);
    Sound.speak('frog', 3);
  }

  private async watchDoubleTongue(intro: Phaser.GameObjects.Container, btn: Button): Promise<boolean> {
    btn.setEnabled(false);
    const ok = await Ya.showRewarded();
    if (!this.scene.isActive() || !intro.active) return false;
    if (!ok) {
      this.toast('Видео сейчас недоступно');
      btn.setEnabled(true);
      return false;
    }
    this.doubleTongueGranted = true;
    intro.destroy();
    return true;
  }

  private startPlay() {
    this.state = 'playing';
    Ya.gameplayStart();
    if (this.doubleTongueGranted) {
      this.doubleTongueUntil = this.playMs + DOUBLE_TONGUE_MS;
      this.refreshDoubleHud();
      this.doubleHud.setVisible(true);
    }
    const t = txt(this, 360, 560, 'Ква-старт!', 80, '#ffc93c').setDepth(90);
    popIn(this, t);
    this.tweens.add({ targets: t, alpha: 0, delay: 600, duration: 300, onComplete: () => t.destroy() });
  }

  private startTutorial() {
    this.state = 'tutorial';
    Ya.gameplayStart();
    this.tutorialStep = 'eat';
    this.spawnTutorialFly();
  }

  private spawnTutorialFly() {
    const ins = new Insect(this, 'fly', -100, 520, 1, 0);
    ins.hover(360, 520);
    this.insects.push(ins);
    for (const o of this.tutorialUi) o.destroy();
    this.tutorialUi = [];
    const eat = this.tutorialStep === 'eat';
    const label = eat ? 'Тапни мухе по ГОЛОВЕ —\nКвася её съест!' : 'А теперь тапни по БРЮШКУ —\nКвася лизнёт, и мухе будет стыдно!';
    const tip = txt(this, 360, 360, label, 38, '#ffffff', { strokeW: 8 }).setDepth(85);
    const arrow = this.add.image(360 + (eat ? 26 : -16), 420, 'ico_arrow').setDepth(85).setScale(1.1);
    const ring = this.add.circle(360 + (eat ? 26 : -16), 518, 40).setStrokeStyle(6, 0xffffff, 0.9).setDepth(29);
    this.tweens.add({ targets: arrow, y: 440, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: ring, scale: 1.3, alpha: 0.2, duration: 600, repeat: -1 });
    this.tutorialUi = [tip, arrow, ring];
    this.tutorialIns = ins;
    this.tutorialArrow = arrow;
    this.tutorialRing = ring;
  }

  private updateTutorialPointer() {
    const ins = this.tutorialIns;
    if (!ins || !ins.active || !ins.hittable || !this.tutorialArrow?.active || !this.tutorialRing?.active) return;
    const fx = ins.x + (this.tutorialStep === 'eat' ? 26 : -16);
    this.tutorialArrow.x = fx;
    this.tutorialRing.setPosition(fx, ins.y - 2);
  }

  private tutorialTap(ins: Insect, zone: 'eat' | 'lick') {
    if (zone !== this.tutorialStep) {
      const tip = this.tutorialUi[0] as Phaser.GameObjects.Text | undefined;
      if (tip?.active) {
        tip.setText(zone === 'eat' ? 'Это голова!\nА нужно — по БРЮШКУ (хвостику)' : 'Это брюшко!\nА нужно — по ГОЛОВЕ (с глазками)');
        tip.setColor('#ffd166');
        this.tweens.add({ targets: tip, x: { from: 350, to: 360 }, duration: 60, yoyo: true, repeat: 3 });
      }
      Sound.poke();
      return;
    }
    for (const o of this.tutorialUi) o.destroy();
    this.tutorialUi = [];
    this.catchInsect(ins, zone);
    if (this.tutorialStep === 'eat') {
      this.tutorialStep = 'lick';
      this.time.delayedCall(900, () => this.spawnTutorialFly());
    } else {
      this.tutorialStep = 'done';
      Save.update((d) => {
        d.tutorialDone = true;
      });
      this.time.delayedCall(1100, () => {
        const t = txt(this, 360, 420, 'Супер! Теперь — на время.\nЛови и ешь всё, что летает!', 40, '#ffffff', { strokeW: 8 }).setDepth(85);
        popIn(this, t);
        this.time.delayedCall(1800, () => {
          t.destroy();
          if (this.state === 'tutorial') this.startPlay();
        });
      });
    }
  }

  pauseGame() {
    if (this.state !== 'playing' && this.state !== 'tutorial') return;
    if (!this.scene.isActive()) return;
    if (this.systemFrozen) this.unfreezeForPlatform();
    this.prevState = this.state;
    this.state = 'paused';
    Ya.gameplayStop();
    this.scene.launch('Pause', { level: this.level });
    this.scene.pause();
  }

  /** Ads, tab hide, window blur: freeze without the pause overlay (1.3 / 4.7 / 1.19.4). */
  private freezeForPlatform() {
    if (this.systemFrozen) return;
    if (this.state !== 'playing' && this.state !== 'tutorial') return;
    this.systemFrozen = true;
    Ya.gameplayStop();
    this.scene.pause();
  }

  private unfreezeForPlatform() {
    if (!this.systemFrozen) return;
    this.systemFrozen = false;
    this.scene.resume();
    if (this.state === 'playing' || this.state === 'tutorial') Ya.gameplayStart();
  }

  private onResumed() {
    if (this.state !== 'paused') return;
    this.state = this.prevState;
    Ya.gameplayStart();
  }

  /** Called from Result after a successful rewarded video. */
  extendTime(ms: number) {
    this.extendUsed = true;
    this.timeLeft = ms;
    this.lastSecond = -1;
    this.state = 'playing';
    Ya.gameplayStart();
    this.spawnAcc = this.cfg.spawnInterval;
    this.frog.say('Ещё 10 секунд!', 1200);
    Sound.speak('frog', 3);
    this.timerPill.setScale(1);
  }

  private endLevel() {
    this.state = 'ending';
    this.doubleHud.setVisible(false);
    Ya.gameplayStop();
    Sound.tempo = 1;
    for (const ins of this.insects) if (ins.active) ins.scare();
    const out = evaluateLevel(this.cfg, this.score, this.caught);
    const mult = superMultiplier(this.cfg, this.score);
    const sparks = sparksForLevel({ stars: out.stars, caught: this.caught });
    const t = txt(this, 360, 560, out.won ? 'Брюшко набито!' : 'Время вышло!', 76, out.won ? '#ffc93c' : '#ff8f9a').setDepth(90);
    popIn(this, t);
    if (out.won) {
      this.frog.hop();
      this.frog.say(pick(FROG_WIN), 1400);
      Sound.win();
      confetti(this, 36);
    } else {
      this.frog.ohMouth(1200);
      this.frog.say(pick(FROG_FAIL), 1400);
      Sound.fail();
    }
    Sound.speak('frog', 4);
    this.time.delayedCall(1300, () => {
      t.destroy();
      this.state = 'result';
      const data: ResultData = {
        level: this.level,
        won: out.won,
        stars: out.stars,
        score: this.score,
        caught: this.caught,
        minCatch: this.cfg.minCatch,
        reason: out.reason,
        isSuper: this.cfg.isSuper,
        superThreshold: this.cfg.superThreshold,
        superMult: mult,
        sparks,
        canExtend: !out.won && !this.extendUsed,
      };
      this.scene.launch('Result', data);
    });
  }

  // ---------------- spawning ----------------

  private rollKind(allowSpecial: boolean): InsectKind {
    const r = Math.random();
    const c = this.cfg;
    if (allowSpecial && r < c.goldChance) return 'gold';
    if (allowSpecial && r < c.goldChance + c.fatChance) return 'fat';
    if (r < c.goldChance + c.fatChance + c.mosquitoChance) return 'mosquito';
    return 'fly';
  }

  private aliveCount() {
    let n = 0;
    for (const i of this.insects) if (i.active && i.hittable) n++;
    return n;
  }

  private spawn() {
    const c = this.cfg;
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    const x = dir > 0 ? -90 : W + 90;
    const speed = Phaser.Math.Between(c.speedMin, c.speedMax);
    if (c.isSuper) {
      const kind = this.rollKind(false);
      const y = Phaser.Math.Between(INSECT_TOP + 50, INSECT_BOTTOM - 50);
      // Tight cluster: two bodies overlap enough that a double-tap hits the same spot.
      const gapX = 22;
      const gapY = 18;
      const a = new Insect(this, kind, x, y, dir, speed);
      const b = new Insect(this, kind, x - dir * gapX, y + (Math.random() < 0.5 ? gapY : -gapY), dir, speed);
      b.copyFlight(a);
      b.setDepth(31);
      const pid = ++this.pairSeq;
      a.pairId = pid;
      b.pairId = pid;
      a.pairPartner = b;
      b.pairPartner = a;
      this.insects.push(a, b);
    } else {
      const kind = this.rollKind(true);
      const y = Phaser.Math.Between(INSECT_TOP + 40, INSECT_BOTTOM - 40);
      this.insects.push(new Insect(this, kind, x, y, dir, speed));
    }
  }

  // ---------------- input ----------------

  private onTap(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) {
    if (over && over.length > 0) return;
    Sound.unlock();
    if (this.state !== 'playing' && this.state !== 'tutorial') return;
    const x = pointer.x;
    const y = pointer.y;
    let best: Insect | null = null;
    let bestD = Infinity;
    for (const ins of this.insects) {
      if (!ins.active || !ins.hittable) continue;
      const d = Math.hypot(ins.x - x, ins.y - y);
      if (d <= ins.spec.hitR * ins.spec.scale && d < bestD) {
        best = ins;
        bestD = d;
      }
    }
    if (!best) {
      if (this.frog.contains(x, y)) {
        this.frog.wiggle();
        this.frog.say(pick(FROG_POKE), 800);
        Sound.poke();
        Sound.speak('frog', 2);
        return;
      }
      if (this.state === 'playing') {
        this.combo = 0;
        this.frog.ohMouth(400);
        this.frog.lookAt(x, y);
        burst(this, x, y, 'puff', 5, { speed: 90, scale: 0.5, life: 380 });
        Sound.miss();
        if (Math.random() < 0.25) this.frog.say(pick(FROG_MISS), 700);
      }
      return;
    }
    const zone = best.zoneAt(x);
    if (this.state === 'tutorial') {
      this.tutorialTap(best, zone);
      return;
    }
    this.catchInsect(best, zone);
  }

  private doubleTongueActive() {
    return this.doubleTongueGranted && this.doubleTongueUntil > 0 && this.playMs < this.doubleTongueUntil;
  }

  private catchInsect(ins: Insect, zone: 'eat' | 'lick', fromBonus = false) {
    this.caught++;
    if (this.playMs - this.lastCatchAt <= COMBO_WINDOW_MS) this.combo++;
    else this.combo = 1;
    this.lastCatchAt = this.playMs;
    let points = Math.round(ins.spec.points * comboMultiplier(this.combo));

    if (ins.pairId) {
      const partner = ins.pairPartner;
      const partnerAt = this.pairCaughtAt.get(ins.pairId);
      if (partnerAt !== undefined && this.playMs - partnerAt <= PAIR_WINDOW_MS) {
        this.pairClears++;
        points += PAIR_BONUS;
        this.pairCaughtAt.delete(ins.pairId);
        const t = floatText(this, ins.x, ins.y - 80, `ПАРА! +${PAIR_BONUS}`, '#ffc93c', 50);
        t.setDepth(61);
        Sound.pair();
        shake(this, 0.004, 100);
      } else {
        this.pairCaughtAt.set(ins.pairId, this.playMs);
        if (partner && partner.active && partner.hittable) {
          this.time.delayedCall(PAIR_WINDOW_MS, () => {
            if (!partner.active || !partner.hittable || this.state !== 'playing') return;
            partner.scare();
            bubble(this, partner.x, partner.y - 30, 'Ой! Я улетаю!', { life: 800, size: 28 });
            Sound.speak(partner.kind === 'mosquito' ? 'mosquito' : 'fly', 2);
            if (this.pairMissHints < 2) {
              this.pairMissHints++;
              floatText(this, 360, 330, 'Тапни ещё раз в ту же точку!', '#ff8f9a', 40);
            }
          });
        }
      }
    }

    this.score += points;
    floatText(this, ins.x, ins.y - 40, `+${points}`, zone === 'eat' ? '#ffffff' : '#ffb3d1');
    if (this.combo >= 3) {
      floatText(this, ins.x, ins.y - 100, `Комбо ×${this.combo}!`, '#ffc93c', 38);
      Sound.combo(this.combo);
    }
    if (!this.normaShown && this.caught >= this.cfg.minCatch && this.state === 'playing') {
      this.normaShown = true;
      floatText(this, 360, 330, this.cfg.isSuper ? 'Норма! Теперь — очки!' : 'Норма есть! Жми дальше!', '#7fd34e', 44);
      Sound.fuse(1);
    }
    this.refreshHud();
    Sound.tongue();

    if (zone === 'eat') {
      this.eaten++;
      ins.grab();
      this.frog.strike(ins.x, ins.y, {
        carry: ins,
        onHit: () => burst(this, ins.x, ins.y, 'spark', 5, { speed: 140, scale: 0.4, life: 300 }),
        onBack: () => {
          ins.swallow();
          this.frog.gulp();
          Sound.gulp(this.frog.fat);
          if (this.cfg.isSuper) {
            const tier = fatTier(this.eaten, this.cfg.minCatch);
            if (tier > this.frog.fat) {
              this.frog.setFat(tier);
              Sound.puff();
              this.frog.say(tier >= 4 ? pick(FROG_FULL) : 'Пузико растёт!', 900);
              return;
            }
          }
          if (Math.random() < 0.3) {
            this.frog.say(pick(FROG_EAT), 700);
            Sound.speak('frog', 2);
          }
        },
      });
    } else {
      this.licks++;
      ins.freeze();
      this.frog.strike(ins.x, ins.y, {
        onHit: () => {
          if (!ins.active) return;
          Sound.lick();
          Sound.blush();
          hearts(this, ins.x, ins.y - 20);
          const line = ins.kind === 'mosquito' ? pick(MOSQUITO_BLUSH) : pick(BUG_BLUSH);
          const side = ins.x < W / 2 ? 1 : -1;
          sticker(this, Phaser.Math.Clamp(ins.x + side * 120, 130, W - 130), ins.y - 150, line, { size: 28, life: 880 });
          Sound.speak(ins.kind === 'mosquito' ? 'mosquito' : 'fly', 3);
          ins.blush();
          if (Math.random() < 0.3) this.frog.say(pick(FROG_LICK), 700);
        },
      });
    }

    if (!fromBonus && this.doubleTongueActive()) {
      const second = pickSecondTongueTarget(this.insects, ins);
      if (second) this.catchInsect(second, 'eat', true);
    }
  }

  // ---------------- loop ----------------

  update(time: number, delta: number) {
    const d = Math.min(delta, 50);
    this.frog.update(time, d);
    for (let i = this.insects.length - 1; i >= 0; i--) {
      const ins = this.insects[i];
      if (!ins.active) {
        this.insects.splice(i, 1);
        continue;
      }
      ins.update(time, d);
    }
    this.lookAtNearest();
    if (this.state === 'tutorial') this.updateTutorialPointer();

    if (this.state !== 'playing') return;
    this.playMs += d;
    this.tickDoubleTongue();
    this.timeLeft -= d;
    this.spawnAcc += d;
    if (this.spawnAcc >= this.cfg.spawnInterval && this.aliveCount() < this.cfg.maxAlive) {
      this.spawnAcc = 0;
      this.spawn();
    }
    const sec = Math.ceil(this.timeLeft / 1000);
    if (sec !== this.lastSecond) {
      this.lastSecond = sec;
      this.timerText.setText(this.fmtTime(this.timeLeft));
      if (sec <= 10 && sec > 0) {
        this.timerText.setColor('#e63946');
        this.tweens.add({ targets: this.timerPill, scale: { from: 1.2, to: 1 }, duration: 250 });
        Sound.tick(sec <= 5);
        Sound.tempo = 1.15;
      } else {
        this.timerText.setColor('#2b1d16');
      }
    }
    if (this.timeLeft <= 0) {
      this.timerText.setText('0:00');
      this.endLevel();
    }
  }

  private tickDoubleTongue() {
    if (!this.doubleTongueGranted || this.doubleTongueUntil <= 0) return;
    if (this.playMs < this.doubleTongueUntil) {
      this.refreshDoubleHud();
      return;
    }
    this.doubleTongueUntil = 0;
    this.doubleHud.setVisible(false);
    this.frog.say('Один язык!', 1000);
    Sound.speak('frog', 2);
  }

  private refreshDoubleHud() {
    const left = Math.max(0, Math.ceil((this.doubleTongueUntil - this.playMs) / 1000));
    this.doubleHudText.setText(`Двойной язык  ${left}`);
  }

  private toast(msg: string) {
    const t = txt(this, 360, 1180, msg, 36, '#ffffff').setDepth(120);
    this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 300, onComplete: () => t.destroy() });
  }

  private lookAtNearest() {
    let best: Insect | null = null;
    let bd = Infinity;
    for (const ins of this.insects) {
      if (!ins.active || !ins.hittable) continue;
      const dd = Math.abs(ins.x - FROG_X) + Math.abs(ins.y - 600) * 0.5;
      if (dd < bd) {
        bd = dd;
        best = ins;
      }
    }
    if (best && !this.frog.busy) this.frog.lookAt(best.x, best.y);
  }

  /** Test hook (dev only): fast-forward the timer. */
  debugSetTime(ms: number) {
    if (DEV) this.timeLeft = ms;
  }

  debugState() {
    return {
      state: this.state,
      score: this.score,
      caught: this.caught,
      eaten: this.eaten,
      licks: this.licks,
      pairs: this.pairClears,
      timeLeft: this.timeLeft,
      fat: this.frog.fat,
      doubleTongue: this.doubleTongueActive(),
      doubleTongueLeft: Math.max(0, this.doubleTongueUntil - this.playMs),
      insects: this.insects.filter((i) => i.active).map((i) => ({ x: i.x, y: i.y, kind: i.kind, state: i.state, dir: i.dir, pair: i.pairId })),
    };
  }
}
