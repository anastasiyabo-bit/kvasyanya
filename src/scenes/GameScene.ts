import Phaser from 'phaser';
import { C, FROG_X, H, INSECT_BOTTOM, INSECT_TOP, PERCH_Y, W } from '../config';
import { ensureBackground, themeNameForLevel } from '../art/backgrounds';
import { frogIconKey } from '../art/skins';
import {
  COMBO_WINDOW_MS,
  PAIR_BONUS,
  comboMultiplier,
  evaluateLevel,
  fatTier,
  getLevelConfig,
  starsFor,
  superMultiplier,
  type LevelConfig,
} from '../data/levels';
import { DOUBLE_TONGUE_MS, pickSecondTongueTarget } from '../data/doubleTongue';
import {
  GLUTTON_CHEW_MS,
  RULE_LINES,
  candyGone,
  candyTapped,
  collectCandy,
  stepCandy,
  thiefEscape,
  tossCandy,
  touchInsect,
  type CandyFall,
  type TapZone,
} from '../data/guests';
import { RivalBrain, raceStatus, rivalCatchValue, rivalPaceMs, rivalPick } from '../data/race';
import type { GuestKind, Novelty } from '../data/schedule';
import type { FlyerKind } from '../data/species';
import { pickGuestTime, pickSpawn, quietLane, quietSpot, type KindCounts, type SpawnState } from '../data/spawn';
import { sparksForLevel } from '../data/rewards';
import { BUG_BLUSH, FROG_EAT, FROG_FAIL, FROG_FULL, FROG_LICK, FROG_MISS, FROG_POKE, FROG_WIN, MOSQUITO_BLUSH, pick, plural } from '../data/phrases';
import { Frog } from '../objects/Frog';
import { Insect } from '../objects/Insect';
import { Sound } from '../systems/audio';
import { Save } from '../systems/save';
import { Ya } from '../systems/yandex';
import { Button, floatText, panel, popIn, sticker, txt } from '../ui/ui';
import { burst, confetti, hearts, shake, starBurst } from '../ui/fx';

type GState = 'intro' | 'tutorial' | 'playing' | 'paused' | 'ending' | 'result';

export interface ResultData {
  level: number;
  won: boolean;
  stars: number;
  score: number;
  caught: number;
  minCatch: number;
  reason: 'ok' | 'min' | 'threshold' | 'race';
  isSuper: boolean;
  isRace: boolean;
  rivalCaught: number;
  superThreshold: number;
  superMult: number;
  sparks: number;
  canExtend: boolean;
}

interface CandyDrop {
  img: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Arc;
  tag: Phaser.GameObjects.Text;
  fall: CandyFall;
}

const PAIR_WINDOW_MS = 650;
const TONGUE_TRIP_MS = 215;
const CANDY_SCALE = 0.78;
/** Rule banner: centre y and size. Insects keep under it while it is up. */
const RULE_Y = 330;
const RULE_W = 600;
const RULE_H = 104;
const RULE_MS = 2900;
/** Pop-up words stay below the HUD. */
const STICKER_MIN_Y = 330;
const RACE_SCALE = 0.8;
const KVASYA_RACE_X = 528;
const KLESHA_X = 192;
const KLESHA_SKINS = [3, 2, 6];
const RIVAL_TINT = 0xffc9b8;
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

  // events of the level
  private guestDueAt = Infinity;
  private guestSpawned = false;
  private guestsSeen: GuestKind[] = [];
  private spawnQuietUntil = 0;
  private numbUntil = 0;
  private chewUntil = 0;
  private busyHintAt = -9999;
  private quotaHinted = false;
  private candies: CandyDrop[] = [];
  private kindCounts: KindCounts = {};
  /** Bottom edge of a rule banner on screen; insects stay below it. */
  private ruleCeiling: number | null = null;
  private ruleBox: Phaser.GameObjects.Container | null = null;
  private rival: Frog | null = null;
  private rivalBrain: RivalBrain<Insect> | null = null;
  private rivalCaught = 0;
  private rivalSkin = 3;
  private rivalPill: Phaser.GameObjects.Container | null = null;
  private racePill: Phaser.GameObjects.Container | null = null;
  private raceLine: Phaser.GameObjects.Text | null = null;

  // HUD
  private timerText!: Phaser.GameObjects.Text;
  private timerPill!: Phaser.GameObjects.Container;
  private catchText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private rivalText: Phaser.GameObjects.Text | null = null;
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
    this.guestDueAt = this.cfg.guest ? pickGuestTime(this.cfg.guest, this.cfg.duration * 1000, Math.random) : Infinity;
    this.guestSpawned = false;
    this.guestsSeen = [];
    this.spawnQuietUntil = 0;
    this.numbUntil = 0;
    this.chewUntil = 0;
    this.busyHintAt = -9999;
    this.quotaHinted = false;
    this.candies = [];
    this.kindCounts = {};
    this.ruleCeiling = null;
    this.ruleBox = null;
    this.rival = null;
    this.rivalBrain = null;
    this.rivalCaught = 0;
    this.rivalText = null;
    this.rivalPill = null;
    this.racePill = null;
    this.raceLine = null;
  }

  create() {
    this.add.image(0, 0, ensureBackground(this, this.level)).setOrigin(0);
    if (this.cfg.isRace) {
      this.rivalSkin = KLESHA_SKINS.find((s) => s !== Save.data.skin) ?? 3;
      this.rival = new Frog(this, KLESHA_X, PERCH_Y - 8, { scaleMul: RACE_SCALE, followPointer: false });
      this.rival.dress(-1, this.rivalSkin, -1);
      this.rival.lookAt(KLESHA_X + 160, 500);
      this.rivalBrain = new RivalBrain<Insect>(rivalPaceMs(this.cfg));
      this.frog = new Frog(this, KVASYA_RACE_X, PERCH_Y - 8, { scaleMul: RACE_SCALE, bubbleSide: -1 });
    } else {
      this.frog = new Frog(this, FROG_X, PERCH_Y - 8);
    }
    this.frog.dress(Save.data.hat, Save.data.skin, Save.data.art);
    this.frog.lookAt(this.frog.x, 500);
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
    if (!Ya.platformPaused && !document.hidden) Sound.startMusic();
    this.showIntro();
    if (Ya.platformPaused || document.hidden) this.freezeForPlatform();
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
    const race = this.cfg.isRace;
    const label = sup ? `СУПЕР ${this.level}` : race ? 'Обгони Клешу!' : `Уровень ${this.level}`;
    const title = this.pill(360, 78, sup ? 330 : race ? 340 : 250, 74, sup ? C.gold : race ? RIVAL_TINT : C.cream);
    title.add(txt(this, 0, 0, label, race ? 34 : 38, sup ? '#ffffff' : race ? '#8a2a0c' : '#2b1d16', {
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

    if (race) {
      // Klesha on the left, Kvasya on the right, same as the frogs below.
      this.rivalPill = this.pill(190, 176, 300, 84, RIVAL_TINT);
      this.rivalPill.add(this.add.image(-108, -6, frogIconKey(this.rivalSkin)).setScale(0.4));
      this.rivalText = txt(this, 30, 0, 'Клеша  0', 36, '#8a2a0c', { stroke: '#fff6dc', strokeW: 2 });
      this.rivalPill.add(this.rivalText);
      this.racePill = this.pill(530, 176, 300, 84, 0xe3f6cf);
      this.racePill.add(this.add.image(-108, -6, frogIconKey(Save.data.skin)).setScale(0.4));
      this.catchText = txt(this, 30, 0, 'Квася  0', 36, '#2b1d16', { stroke: '#fff6dc', strokeW: 2 });
      this.racePill.add(this.catchText);
      const line = this.pill(360, 258, 560, 56, 0xfff1a8);
      this.raceLine = txt(this, 0, 0, raceStatus(0, 0).text, 30, '#2b1d16', { stroke: '#fff6dc', strokeW: 2 });
      line.add(this.raceLine);
      this.nameplate(KLESHA_X, 'Клеша', RIVAL_TINT, '#8a2a0c');
      this.nameplate(KVASYA_RACE_X, 'Квася', 0xe3f6cf, '#2b1d16');
      this.scoreText = txt(this, -1000, -1000, '0', 10).setVisible(false);
      this.barFill = this.add.graphics();
      this.barMax = 1;
    } else {
      const cp = this.pill(196, 172, 290, 70);
      cp.add(this.add.image(-100, -2, 'fly', 0).setScale(0.32));
      this.catchText = txt(this, 30, 0, `0 / ${this.cfg.minCatch}`, 38, '#2b1d16', { stroke: '#fff6dc', strokeW: 2 });
      cp.add(this.catchText);

      const sp = this.pill(524, 172, 290, 70);
      sp.add(this.add.image(-100, -2, 'spark').setScale(1.1));
      this.scoreText = txt(this, 24, 0, '0', 38, '#2b1d16', { stroke: '#fff6dc', strokeW: 2 });
      sp.add(this.scoreText);
      this.buildBar();
    }

    this.doubleHud = this.pill(360, 292, 360, 52, 0xffe08a).setDepth(72).setVisible(false);
    this.doubleHudText = txt(this, 0, 0, 'Двойной язык  8', 28, '#2b1d16', { stroke: '#fff6dc', strokeW: 2 });
    this.doubleHud.add(this.doubleHudText);
  }

  /** Name tag on the stage under a race frog. */
  private nameplate(x: number, name: string, color: number, ink: string) {
    const p = this.pill(x, 1226, 190, 56, color).setDepth(45);
    p.add(txt(this, 0, -1, name, 32, ink, { stroke: '#fff6dc', strokeW: 2 }));
  }

  /** Progress bar with star (or threshold) markers. */
  private buildBar() {
    const sup = this.cfg.isSuper;
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
    this.barMax = this.cfg.starScores[2];
    const vals = [sup ? this.cfg.superThreshold : this.cfg.starScores[0], this.cfg.starScores[1], this.cfg.starScores[2]];
    vals.forEach((v, i) => marks.push({ v, key: starKeys[i], scale: starScales[i] }));
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
  }

  private drawBar() {
    if (this.cfg.isRace) return;
    const bx = 70;
    const bw = 580;
    const by = 248;
    // Until the quota is met the bar waits just short of the bronze star.
    const quota = this.caught >= this.cfg.minCatch;
    const first = this.starMarks[0]?.getData('v') as number | undefined;
    const shown = quota || first === undefined ? this.shownScore : Math.min(this.shownScore, first * 0.94);
    const k = Phaser.Math.Clamp(shown / this.barMax, 0, 1);
    const g = this.barFill;
    g.clear();
    if (k <= 0) return;
    const w = Math.max(26, bw * k);
    g.fillStyle(this.cfg.isSuper ? C.gold : C.btn, 1);
    g.fillRoundedRect(bx, by - 13, w, 26, 13);
    g.fillStyle(0xffffff, 0.35);
    g.fillRoundedRect(bx + 8, by - 9, Math.max(0, w - 16), 7, 3);
    if (!quota && first !== undefined && this.shownScore >= first) this.quotaHint();
    const lit = starsFor(this.cfg, this.shownScore, this.caught);
    for (const m of this.starMarks) {
      if (m.getData('lit') || this.starMarks.indexOf(m) >= lit) continue;
      m.setData('lit', true);
      const base = (m.getData('baseScale') as number) ?? m.scale;
      this.tweens.add({ targets: m, alpha: 1, duration: 120 });
      this.tweens.add({ targets: m, scale: base * 1.55, duration: 180, yoyo: true, ease: 'Back.Out' });
      Sound.star(Math.min(2, this.starMarks.indexOf(m)));
      starBurst(this, m.x, m.y, 14);
    }
  }

  /** Points are there, catches are not: say once what the star still needs. */
  private quotaHint() {
    if (this.quotaHinted || this.state !== 'playing') return;
    this.quotaHinted = true;
    const left = this.cfg.minCatch - this.caught;
    const tip = this.pill(360, 300, 470, 56, 0xfff1a8).setDepth(73);
    tip.add(txt(this, 0, 0, `Для звезды поймай ещё ${left}!`, 30, '#2b1d16', { stroke: '#fff6dc', strokeW: 2 }));
    popIn(this, tip);
    this.tweens.add({ targets: tip, alpha: 0, delay: 1700, duration: 300, onComplete: () => tip.destroy() });
    this.tweens.add({ targets: this.catchText, scale: { from: 1.5, to: 1 }, duration: 320, ease: 'Back.Out' });
  }

  private fmtTime(ms: number) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  private refreshHud() {
    if (this.cfg.isRace) {
      this.catchText.setText(`Квася  ${this.caught}`);
      this.rivalText?.setText(`Клеша  ${this.rivalCaught}`);
      const status = raceStatus(this.caught, this.rivalCaught);
      this.catchText.setColor(status.mood === 'ahead' ? '#3f9a2a' : '#2b1d16');
      this.raceLine?.setText(status.text);
      this.raceLine?.setColor(status.mood === 'ahead' ? '#2f7d1f' : status.mood === 'tie' && this.caught > 0 ? '#c2410c' : '#2b1d16');
    } else {
      this.catchText.setText(`${this.caught} / ${this.cfg.minCatch}`);
      this.catchText.setColor(this.caught >= this.cfg.minCatch ? '#3f9a2a' : '#2b1d16');
    }
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
    const race = this.cfg.isRace;
    const nap = this.cfg.isNap;
    const ribbonText = sup ? 'СУПЕР-УРОВЕНЬ!' : race ? 'ОБГОНИ КЛЕШУ!' : nap ? 'ТИХИЙ ЧАС' : '';
    const h = sup ? 760 : race ? 720 : nap ? 520 : 440;
    c.add(panel(this, 0, 0, 620, h));
    let y = -h / 2 + 70;
    if (ribbonText) {
      const ribbon = this.pill(0, -h / 2 + 10, race ? 480 : 420, 80, sup ? C.gold : race ? 0xff9f43 : 0x8fa8ff);
      ribbon.setDepth(0);
      ribbon.add(txt(this, 0, -2, ribbonText, 44, '#ffffff'));
      c.add(ribbon);
      y += 40;
    }
    c.add(txt(this, 0, y, `Уровень ${this.level}`, 56, '#ffffff'));
    y += 62;
    c.add(txt(this, 0, y, themeNameForLevel(this.level), 36, '#8a5a32', { stroke: '#fff1cf', strokeW: 2 }));
    y += 74;
    if (race) {
      // Kvasya > Klesha: the rule as a picture, then in words.
      y += 20;
      c.add(this.add.image(-150, y, frogIconKey(Save.data.skin)).setScale(0.62));
      c.add(txt(this, 0, y - 6, '>', 96, '#ffc93c'));
      c.add(this.add.image(150, y, frogIconKey(this.rivalSkin)).setScale(0.62));
      c.add(txt(this, -150, y + 78, 'Квася', 30, '#2b1d16', { stroke: '#fff1cf', strokeW: 2 }));
      c.add(txt(this, 150, y + 78, 'Клеша', 30, '#8a2a0c', { stroke: '#fff1cf', strokeW: 2 }));
      y += 160;
      c.add(
        txt(this, 0, y, `Поймай БОЛЬШЕ мошек,\nчем Клеша, за ${this.cfg.duration} сек.`, 36, '#2b1d16', {
          stroke: '#fff1cf',
          strokeW: 2,
        }),
      );
      y += 84;
      c.add(txt(this, 0, y, 'Ничья — победа Клеши!', 34, '#c2410c', { stroke: '#fff1cf', strokeW: 2 }));
      y += 60;
    } else {
      const goal = `Поймай ${this.cfg.minCatch} ${plural(this.cfg.minCatch, 'мошку', 'мошки', 'мошек')}\nза ${this.cfg.duration} сек`;
      c.add(txt(this, 0, y, goal, 40, '#2b1d16', { stroke: '#fff1cf', strokeW: 2 }));
      y += 120;
    }
    if (nap) {
      c.add(txt(this, 0, y - 20, 'Мошки дремлют — лови, пока спят!', 30, '#4a5fc1', { stroke: '#fff1cf', strokeW: 2 }));
    }
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
    this.frog.say(sup ? 'Двойной пир!' : race ? 'Клеша, не отставай!' : 'Ква! Я голодная!', 1500);
    if (race) this.time.delayedCall(700, () => this.rival?.say('Ещё посмотрим!', 1300));
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
    this.frog.dress(Save.data.hat, Save.data.skin, Save.data.art);
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
    if (this.cfg.isNap) this.time.delayedCall(900, () => this.showRuleOnce('nap'));
  }

  private startTutorial() {
    this.frog.dress(Save.data.hat, Save.data.skin, Save.data.art);
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

  private tutorialTap(ins: Insect, zone: TapZone) {
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
    if (this.state === 'paused' || this.state === 'result' || this.state === 'ending') return;
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
    if (this.state === 'paused' || this.state === 'result') return;
    this.systemFrozen = true;
    Ya.gameplayStop();
    this.scene.pause();
  }

  private unfreezeForPlatform() {
    if (!this.systemFrozen) return;
    if (document.hidden || Ya.platformPaused) return;
    this.systemFrozen = false;
    this.scene.resume();
    if (this.state === 'playing' || this.state === 'tutorial') Ya.gameplayStart();
    Sound.startMusic();
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
    for (const c of this.candies) this.removeCandy(c);
    this.candies = [];
    this.clearRule();
    const out = evaluateLevel(this.cfg, this.score, this.caught, this.rivalCaught);
    const mult = superMultiplier(this.cfg, this.score);
    const sparks = sparksForLevel({ stars: out.stars, caught: this.caught });
    const raceTitle = out.won ? 'Клеша обогнана!' : this.caught === this.rivalCaught ? 'Ничья — победа Клеши!' : 'Клеша успела!';
    const title = this.cfg.isRace ? raceTitle : out.won ? 'Брюшко набито!' : 'Время вышло!';
    const t = txt(this, 360, 560, title, this.cfg.isRace ? 56 : 76, out.won ? '#ffc93c' : '#ff8f9a').setDepth(90);
    popIn(this, t);
    if (out.won) {
      this.frog.hop();
      this.frog.say(pick(FROG_WIN), 1400);
      this.rival?.ohMouth(1200);
      Sound.win();
      confetti(this, 36);
    } else {
      this.frog.ohMouth(1200);
      this.frog.say(pick(FROG_FAIL), 1400);
      if (this.rival) {
        this.rival.hop();
        this.rival.say('Моя взяла!', 1300);
      }
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
        isRace: this.cfg.isRace,
        rivalCaught: this.rivalCaught,
        superThreshold: this.cfg.superThreshold,
        superMult: mult,
        sparks,
        canExtend: !out.won && !this.extendUsed,
      };
      this.scene.pause();
      this.scene.launch('Result', data);
    });
  }

  // ---------------- spawning ----------------

  private aliveCount() {
    let n = 0;
    for (const i of this.insects) if (i.active && i.hittable) n++;
    return n;
  }

  private guestOnScreen() {
    return this.insects.some((i) => i.active && i.guest && i.state !== 'gone');
  }

  private spawnState(): SpawnState {
    return {
      playMs: this.playMs,
      timeLeft: this.timeLeft,
      alive: this.aliveCount(),
      guestDueAt: this.guestDueAt,
      guestSpawned: this.guestSpawned,
      guestOnScreen: this.guestOnScreen(),
      counts: this.kindCounts,
    };
  }

  private entry() {
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    return { dir, x: dir > 0 ? -90 : W + 90, speed: Phaser.Math.Between(this.cfg.speedMin, this.cfg.speedMax) };
  }

  /** Highest centre line a new insect may take: under the rule banner while it is up. */
  private flightTop(pad: number) {
    return this.ruleCeiling === null ? INSECT_TOP + pad : Math.min(INSECT_BOTTOM - pad, this.ruleCeiling + 100);
  }

  private countKind(kind: FlyerKind, n = 1) {
    this.kindCounts[kind] = (this.kindCounts[kind] ?? 0) + n;
  }

  private spawn() {
    const { dir, x, speed } = this.entry();
    const p = pickSpawn(this.cfg, this.spawnState(), Math.random);
    if (p.type === 'guest') {
      this.spawnGuest(p.guest);
      return;
    }
    if (p.type === 'pair') {
      this.countKind(p.kind, 2);
      this.spawnPair(p.kind as Exclude<FlyerKind, 'sleepy'>, x, dir, speed);
      return;
    }
    this.countKind(p.kind);
    if (p.kind === 'sleepy') {
      this.spawnSleepy(speed);
      return;
    }
    const y = Phaser.Math.Between(this.flightTop(40), INSECT_BOTTOM - 40);
    this.insects.push(new Insect(this, p.kind, x, y, dir, speed));
  }

  /** Super level: two of a kind in a tight cluster, so a double-tap hits the same spot. */
  private spawnPair(kind: Exclude<FlyerKind, 'sleepy'>, x: number, dir: 1 | -1, speed: number) {
    const y = Phaser.Math.Between(this.flightTop(50), INSECT_BOTTOM - 50);
    const gapX = 22;
    const gapY = 18;
    const off = Math.random() < 0.5 ? gapY : -gapY;
    const a = new Insect(this, kind, x, y, dir, speed);
    const b = new Insect(this, kind, x - dir * gapX, y + off, dir, speed);
    b.copyFlight(a);
    b.baseY = a.baseY + off;
    b.setDepth(31);
    const pid = ++this.pairSeq;
    a.pairId = pid;
    b.pairId = pid;
    a.pairPartner = b;
    b.pairPartner = a;
    this.insects.push(a, b);
  }

  private spawnGuest(guest: GuestKind) {
    this.guestSpawned = true;
    const { dir, x, speed } = this.entry();
    const others = this.insects.filter((i) => i.active && i.hittable).map((i) => i.y);
    const top = this.flightTop(50);
    const y = guest === 'squeaker' ? quietLane(others, top, INSECT_BOTTOM - 50) : Phaser.Math.Between(top, INSECT_BOTTOM - 50);
    const ins = new Insect(this, guest, x, y, dir, speed);
    if (guest === 'thief') ins.onEscape = (i) => this.onThiefEscape(i);
    ins.ceiling = this.ruleCeiling;
    this.insects.push(ins);
    this.guestsSeen.push(guest);
    this.showRuleOnce(guest);
  }

  private spawnSleepy(speed: number) {
    const others = this.insects.filter((i) => i.active && i.hittable).map((i) => ({ x: i.x, y: i.y }));
    const box = { left: 110, right: W - 110, top: this.flightTop(50), bottom: INSECT_BOTTOM - 50 };
    const p = quietSpot(others, box, Math.random);
    const ins = new Insect(this, 'sleepy', p.x, p.y, Math.random() < 0.5 ? 1 : -1, 0);
    ins.setPosition(p.x, p.y);
    ins.sleep(speed);
    ins.setAlpha(0);
    this.tweens.add({ targets: ins, alpha: 1, duration: 260 });
    this.insects.push(ins);
  }

  /** One-time rule banner. While it is up, every insect keeps below it. */
  private showRuleOnce(what: Novelty) {
    if (Save.data.seenRules.includes(what)) return;
    Save.update((d) => {
      if (!d.seenRules.includes(what)) d.seenRules.push(what);
    });
    this.clearRule();
    const box = this.pill(360, RULE_Y, RULE_W, RULE_H, 0xfff1a8).setDepth(88);
    box.add(txt(this, 0, 0, RULE_LINES[what], 34, '#2b1d16', { stroke: '#fff6dc', strokeW: 2 }));
    popIn(this, box);
    Sound.fuse(0);
    this.ruleBox = box;
    this.ruleCeiling = RULE_Y + RULE_H / 2 + 12;
    this.tweens.add({ targets: box, alpha: 0, delay: RULE_MS - 300, duration: 300, onComplete: () => this.clearRule() });
  }

  private clearRule() {
    if (this.ruleBox) {
      this.tweens.killTweensOf(this.ruleBox);
      this.ruleBox.destroy();
    }
    this.ruleBox = null;
    this.ruleCeiling = null;
  }

  // ---------------- input ----------------

  private onTap(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) {
    if (over && over.length > 0) return;
    Sound.unlock();
    if (this.state !== 'playing' && this.state !== 'tutorial') return;
    const x = pointer.x;
    const y = pointer.y;
    if (this.state === 'playing' && this.tapCandy(x, y)) return;
    // The basket is the thing to lick, even where it overlaps the fly's body.
    const basket = this.insects.find((i) => i.active && i.hittable && i.hasCandy && i.basketHit(x, y));
    if (basket) {
      if (this.state === 'tutorial') this.tutorialTap(basket, 'lick');
      else this.touch(basket, 'lick');
      return;
    }
    let best: Insect | null = null;
    let bestD = Infinity;
    for (const ins of this.insects) {
      if (!ins.active || !ins.hittable) continue;
      const d = Math.hypot(ins.x - x, ins.y - y);
      if (d <= ins.hitR && d < bestD) {
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
    this.touch(best, zone);
  }

  /** The tongue is stung or the mouth is full: say so instead of striking. */
  private tongueBusy(): boolean {
    const numb = this.playMs < this.numbUntil;
    const chew = this.playMs < this.chewUntil;
    if (!numb && !chew) return false;
    if (this.playMs - this.busyHintAt > 700) {
      this.busyHintAt = this.playMs;
      this.frog.say(numb ? 'Язык онемел!' : 'Жую-жую…', 600);
      this.frog.wiggle();
    }
    return true;
  }

  private touch(ins: Insect, zone: TapZone) {
    const preview = touchInsect(ins.kind, zone, ins.spec.points, 1, ins.lit);
    if (preview.scatterMs > 0) {
      this.squeakerPop(ins, preview.scatterMs);
      return;
    }
    if (preview.spook) {
      this.spookFirefly(ins);
      return;
    }
    if (this.tongueBusy()) return;
    if (preview.numbMs > 0) {
      this.waspSting(ins, preview.numbMs);
      return;
    }
    this.catchInsect(ins, zone);
  }

  private squeakerPop(ins: Insect, quietMs: number) {
    burst(this, ins.x, ins.y, 'puff', 12, { speed: 260, scale: 1.3, life: 520, depth: 56 });
    burst(this, ins.x, ins.y, 'puff', 6, { speed: 90, scale: 1.8, life: 420, depth: 56 });
    sticker(this, Phaser.Math.Clamp(ins.x, 150, W - 150), Math.max(STICKER_MIN_Y, ins.y - 110), 'ПИ-И-И!', { size: 40, life: 700 });
    Sound.pop();
    shake(this, 0.005, 140);
    this.combo = 0;
    this.spawnQuietUntil = this.playMs + quietMs;
    for (const other of this.insects) if (other.active) other.scare();
    this.rivalBrain?.hold(quietMs);
    this.frog.coverEars(1000);
    this.frog.say('Ой, мои ушки!', 900);
    Sound.speak('frog', 2);
  }

  private spookFirefly(ins: Insect) {
    ins.scare();
    floatText(this, ins.x, ins.y - 60, 'В темноте не видно!', '#c8d0ff', 32);
    Sound.poke();
  }

  private waspSting(ins: Insect, numbMs: number) {
    this.combo = 0;
    this.numbUntil = this.playMs + TONGUE_TRIP_MS + numbMs;
    Sound.tongue();
    this.frog.strike(ins.x, ins.y, {
      onHit: () => {
        Sound.sting();
        burst(this, ins.x, ins.y, 'spark_white', 6, { speed: 160, scale: 0.4, life: 300 });
        sticker(this, Phaser.Math.Clamp(ins.x, 150, W - 150), Math.max(STICKER_MIN_Y, ins.y - 110), 'Ж-Ж-Ж!', { size: 34, life: 700 });
        shake(this, 0.004, 100);
      },
      onBack: () => {
        this.frog.numb(numbMs);
        this.frog.say('Ай!', 900);
        Sound.speak('frog', 1);
      },
    });
  }

  private tapCandy(x: number, y: number): boolean {
    for (let i = this.candies.length - 1; i >= 0; i--) {
      const c = this.candies[i];
      if (!candyTapped(c.fall, x, y)) continue;
      this.candies.splice(i, 1);
      const got = collectCandy({ timeLeft: this.timeLeft, caught: this.caught });
      this.timeLeft = got.timeLeft;
      this.caught = got.caught;
      this.lastSecond = -1;
      Sound.candy();
      starBurst(this, c.img.x, c.img.y, 10);
      c.ring.destroy();
      c.tag.destroy();
      this.tweens.add({
        targets: c.img,
        x: this.timerPill.x,
        y: this.timerPill.y,
        scale: 0.3,
        angle: c.img.angle + 360,
        duration: 420,
        ease: 'Cubic.In',
        onComplete: () => {
          c.img.destroy();
          floatText(this, this.timerPill.x - 20, this.timerPill.y + 70, '+4 сек', '#7fd34e', 40);
          this.tweens.add({ targets: this.timerPill, scale: { from: 1.25, to: 1 }, duration: 260, ease: 'Back.Out' });
        },
      });
      return true;
    }
    return false;
  }

  /** The candy leaves the basket and tumbles to the screen edge; a ring and «+4» say «tap me». */
  private dropCandy(ins: Insect) {
    if (!ins.hasCandy) return;
    const p = ins.candyWorld();
    ins.dropCandy();
    const fall = tossCandy(p.x, p.y, W);
    const ring = this.add.circle(p.x, p.y, 62, 0xfff1a8, 0.35).setStrokeStyle(5, 0xffc93c).setDepth(65);
    this.tweens.add({ targets: ring, scale: { from: 0.85, to: 1.15 }, duration: 380, yoyo: true, repeat: -1 });
    const img = this.add.image(p.x, p.y, 'candy').setScale(CANDY_SCALE).setDepth(66);
    const tag = txt(this, p.x, p.y - 66, '+4', 34, '#3f9a2a', { stroke: '#ffffff', strokeW: 4 }).setDepth(66);
    this.candies.push({ img, ring, tag, fall });
  }

  private removeCandy(c: CandyDrop) {
    this.tweens.killTweensOf(c.ring);
    c.img.destroy();
    c.ring.destroy();
    c.tag.destroy();
  }

  private onThiefEscape(ins: Insect) {
    if (this.state !== 'playing') return;
    this.caught = thiefEscape(this.caught);
    const x = Phaser.Math.Clamp(ins.x, 140, W - 140);
    floatText(this, x, ins.y, 'Утащила!', '#ff8f9a', 46);
    Sound.steal();
    this.frog.say('Эй, верни!', 900);
    this.refreshHud();
  }

  private doubleTongueActive() {
    return this.doubleTongueGranted && this.doubleTongueUntil > 0 && this.playMs < this.doubleTongueUntil;
  }

  private catchInsect(ins: Insect, zone: TapZone, fromBonus = false) {
    if (this.playMs - this.lastCatchAt <= COMBO_WINDOW_MS) this.combo++;
    else this.combo = 1;
    this.lastCatchAt = this.playMs;
    const res = touchInsect(ins.kind, zone, ins.spec.points, comboMultiplier(this.combo), ins.lit);
    this.caught += res.caught;
    let points = res.points;

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
            const side = partner.x < W / 2 ? 1 : -1;
            sticker(
              this,
              Phaser.Math.Clamp(partner.x + side * 120, 130, W - 130),
              partner.y - 150,
              'Ой! Я улетаю!',
              { size: 28, life: 800 },
            );
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
    if (res.caught > 1) floatText(this, ins.x, Math.max(STICKER_MIN_Y, ins.y - 110), `×${res.caught}!`, '#ffc93c', 56);
    else if (this.combo >= 3) {
      floatText(this, ins.x, ins.y - 100, `Комбо ×${this.combo}!`, '#ffc93c', 38);
      Sound.combo(this.combo);
    }
    if (!this.cfg.isRace && !this.normaShown && this.caught >= this.cfg.minCatch && this.state === 'playing') {
      this.normaShown = true;
      floatText(this, 360, 330, this.cfg.isSuper ? 'Норма! Теперь — очки!' : 'Норма есть! Жми дальше!', '#7fd34e', 44);
      Sound.fuse(1);
    }
    this.refreshHud();
    Sound.tongue();
    if (res.chewMs > 0) this.chewUntil = this.playMs + TONGUE_TRIP_MS + res.chewMs;

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
          if (res.chewMs > 0) {
            this.frog.chew(res.chewMs);
            this.frog.say('Хрум-хрум-хрум!', 1200);
            Sound.speak('frog', 3);
            return;
          }
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
          const mosq = ins.kind === 'mosquito';
          let line = mosq ? pick(MOSQUITO_BLUSH) : pick(BUG_BLUSH);
          if (res.dropCandy) line = 'Ой, конфетка!';
          if (ins.kind === 'wasp') line = 'Ж-ж… стыдно!';
          const side = ins.x < W / 2 ? 1 : -1;
          sticker(this, Phaser.Math.Clamp(ins.x + side * 120, 130, W - 130), Math.max(STICKER_MIN_Y, ins.y - 150), line, {
            size: 28,
            life: 880,
          });
          Sound.speak(mosq ? 'mosquito' : 'fly', 3);
          if (res.dropCandy) this.dropCandy(ins);
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

  // ---------------- race ----------------

  private tickRival(d: number) {
    const rival = this.rival;
    const brain = this.rivalBrain;
    if (!rival || !brain) return;
    const m = rival.mouthWorld();
    const ev = brain.update(d, () => rivalPick(this.insects, m.x, m.y, W - 60));
    if (!ev) {
      if (brain.phase === 'look' && brain.target?.active) rival.lookAt(brain.target.x, brain.target.y);
      return;
    }
    const t = ev.target;
    if (ev.type === 'look') {
      rival.lookAt(t.x, t.y);
      return;
    }
    if (ev.hit && t.active) {
      t.grab();
      Sound.tongue();
      rival.strike(t.x, t.y, {
        carry: t,
        onHit: () => burst(this, t.x, t.y, 'spark', 4, { speed: 120, scale: 0.35, life: 260 }),
        onBack: () => {
          t.swallow();
          rival.gulp();
          const got = rivalCatchValue(t.kind);
          this.rivalCaught += got;
          if (t.kind === 'glutton') brain.hold(GLUTTON_CHEW_MS);
          if (got > 1) floatText(this, rival.x, rival.y - 260, `+${got}`, '#c2410c', 40);
          if (this.rivalPill) this.tweens.add({ targets: this.rivalPill, scale: { from: 1.15, to: 1 }, duration: 240, ease: 'Back.Out' });
          this.refreshHud();
          if (Math.random() < 0.25) rival.say(pick(['Ням!', 'Моя!', 'Хе-хе!']), 600);
        },
      });
    } else {
      rival.strike(t.x, t.y, { onHit: () => {} });
      rival.say('Эй!', 800);
      Sound.miss();
    }
  }

  // ---------------- loop ----------------

  update(time: number, delta: number) {
    const d = Math.min(delta, 50);
    this.frog.update(time, d);
    this.rival?.update(time, d);
    for (let i = this.insects.length - 1; i >= 0; i--) {
      const ins = this.insects[i];
      if (!ins.active) {
        this.insects.splice(i, 1);
        continue;
      }
      ins.ceiling = this.ruleCeiling;
      ins.update(time, d);
    }
    this.updateCandies(d);
    this.lookAtNearest();
    if (this.state === 'tutorial') this.updateTutorialPointer();

    if (this.state !== 'playing') return;
    this.playMs += d;
    this.tickDoubleTongue();
    this.tickRival(d);
    this.timeLeft -= d;
    if (this.playMs >= this.spawnQuietUntil) {
      this.spawnAcc += d;
      if (this.spawnAcc >= this.cfg.spawnInterval && this.aliveCount() < this.cfg.maxAlive) {
        this.spawnAcc = 0;
        this.spawn();
      }
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

  /** Missed candy simply leaves the screen: no penalty. */
  private updateCandies(d: number) {
    if (this.state !== 'playing') return;
    for (let i = this.candies.length - 1; i >= 0; i--) {
      const c = this.candies[i];
      c.fall = stepCandy(c.fall, d);
      const { x, y, angle } = c.fall;
      c.img.setPosition(x, y).setAngle(angle);
      c.ring.setPosition(x, y);
      c.tag.setPosition(x, y - 66);
      if (candyGone(c.fall, W, H)) {
        this.removeCandy(c);
        this.candies.splice(i, 1);
      }
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
    const fx = this.frog.x;
    for (const ins of this.insects) {
      if (!ins.active || !ins.hittable) continue;
      const dd = Math.abs(ins.x - fx) + Math.abs(ins.y - 600) * 0.5;
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

  /** Test hook (dev only): bring the level's guest in right now. */
  debugGuestNow() {
    if (DEV) this.guestDueAt = 0;
  }

  debugState() {
    return {
      state: this.state,
      level: this.level,
      kind: this.cfg.kind,
      guest: this.cfg.guest,
      guestSpawned: this.guestSpawned,
      guestsSeen: this.guestsSeen,
      score: this.score,
      caught: this.caught,
      rivalCaught: this.rivalCaught,
      eaten: this.eaten,
      licks: this.licks,
      pairs: this.pairClears,
      timeLeft: this.timeLeft,
      maxAlive: this.cfg.maxAlive,
      alive: this.aliveCount(),
      candies: this.candies.map((c) => ({ x: c.img.x, y: c.img.y })),
      fat: this.frog.fat,
      doubleTongue: this.doubleTongueActive(),
      doubleTongueLeft: Math.max(0, this.doubleTongueUntil - this.playMs),
      insects: this.insects
        .filter((i) => i.active)
        .map((i) => ({
          id: i.id,
          x: i.x,
          y: i.y,
          kind: i.kind,
          state: i.state,
          dir: i.dir,
          pair: i.pairId,
          guest: i.guest,
          lit: i.lit,
          amp: Math.round(i.flight.amp),
          period: Math.round(i.flight.periodMs),
        })),
    };
  }
}
