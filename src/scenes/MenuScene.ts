import Phaser from 'phaser';
import { FONT, FROG_X, PERCH_Y, TEXT_OUTLINE, W } from '../config';
import { COSMETIC_COUNT, grantUnlocks, hatsEarned, runCascade } from '../data/rewards';
import { ensureBackground } from '../art/backgrounds';
import { BUG_BLUSH, FROG_EAT, FROG_POKE, pick } from '../data/phrases';
import { Frog } from '../objects/Frog';
import { Insect } from '../objects/Insect';
import { Sound } from '../systems/audio';
import { Save } from '../systems/save';
import { Ya } from '../systems/yandex';
import { Button, sticker, txt } from '../ui/ui';
import { burst, hearts } from '../ui/fx';

let readySent = false;

/** 5 epic chests should already have opened a hat; catch up if a previous save got stuck at 5. */
function redeemEpicSets() {
  const r = runCascade(Save.data.inventory, 0);
  if (r.epicsOpened <= 0 && r.epicsGained <= 0) return;
  Save.update((s) => {
    s.inventory = r.inv;
    const g = grantUnlocks(s.hatsUnlocked, COSMETIC_COUNT, hatsEarned(r.epicsGained, r.epicsOpened));
    s.hatsUnlocked = g.unlocked;
    if (g.newHats.length) s.hat = g.hat;
    if (g.newSkins.length) s.skin = g.skin;
  });
}

export class MenuScene extends Phaser.Scene {
  private frog!: Frog;
  private insects: Insect[] = [];
  private letters: Phaser.GameObjects.Text[] = [];
  private spawnAcc = 0;
  private autoAcc = 0;
  private t = 0;
  private counts: Phaser.GameObjects.Text[] = [];
  private overlayOpen = false;

  constructor() {
    super('Menu');
  }

  create() {
    redeemEpicSets();
    this.insects = [];
    this.letters = [];
    this.counts = [];
    this.overlayOpen = false;
    this.spawnAcc = 900;
    this.autoAcc = 0;
    this.add.image(0, 0, ensureBackground(this, 1)).setOrigin(0);
    this.buildTitle();
    this.buildCollection();

    this.frog = new Frog(this, FROG_X, PERCH_Y - 8);
    this.frog.dress(Save.data.hat, Save.data.skin);
    this.time.delayedCall(700, () => {
      this.frog.say('Привет! Я Квася!', 1600);
      Sound.speak('frog', 4);
    });

    const play = new Button(this, 360, 1155, {
      w: 360,
      h: 140,
      label: Save.data.level > 1 ? 'Дальше' : 'Играть',
      size: 56,
      onClick: () => this.startGame(Save.data.level),
    });
    play.label?.setY(-22);
    play.add(txt(this, 0, 30, `уровень ${Save.data.level}`, 28, '#fff6dc', { strokeW: 5 }));
    play.pulse();

    const hatsBtn = new Button(this, 92, 1155, { round: true, color: 'orange', icon: 'ico_hat', onClick: () => this.openOverlay('Hats') });
    hatsBtn.icon?.setScale(1.18);
    const gearBtn = new Button(this, 628, 1155, { round: true, color: 'orange', icon: 'ico_gear', onClick: () => this.openOverlay('Settings') });
    gearBtn.icon?.setScale(1.12);

    this.input.on('pointerdown', this.onTap, this);
    this.input.keyboard?.on('keydown-ENTER', () => this.startGame(Save.data.level));
    this.input.keyboard?.on('keydown-SPACE', () => this.startGame(Save.data.level));
    this.events.on('resume', this.onOverlayClosed, this);
    this.events.once('shutdown', () => this.events.off('resume', this.onOverlayClosed, this));

    this.cameras.main.fadeIn(300, 26, 16, 48);
    Sound.startMusic();
    if (!readySent) {
      readySent = true;
      Ya.ready();
    }
  }

  private buildTitle() {
    const lines: { s: string; y: number; size: number; color: string }[] = [
      { s: 'Квася,', y: 170, size: 118, color: '#8ee05a' },
      { s: 'ням!', y: 300, size: 128, color: '#ffc93c' },
    ];
    for (const line of lines) {
      const tmp = this.add.text(0, 0, line.s, { fontFamily: FONT, fontSize: `${line.size}px`, fontStyle: '900' });
      const total = tmp.width;
      tmp.destroy();
      let x = W / 2 - total / 2;
      for (const ch of line.s) {
        const l = this.add.text(x, line.y, ch, {
          fontFamily: FONT,
          fontSize: `${line.size}px`,
          fontStyle: '900',
          color: line.color,
          stroke: TEXT_OUTLINE,
          strokeThickness: 18,
          padding: { x: 6, y: 6 },
        });
        l.setOrigin(0, 0.5);
        l.setShadow(0, 8, '#2b1d16', 0, true, true);
        l.setData('baseY', line.y);
        l.setData('i', this.letters.length);
        this.letters.push(l);
        const probe = this.add.text(0, 0, ch, { fontFamily: FONT, fontSize: `${line.size}px`, fontStyle: '900' });
        x += probe.width;
        probe.destroy();
      }
    }
  }

  private buildCollection() {
    const inv = Save.data.inventory;
    const g = this.add.graphics();
    g.fillStyle(0x2b1d16, 1);
    g.fillRoundedRect(95, 395, 530, 92, 46);
    g.fillStyle(0xfff6dc, 0.95);
    g.fillRoundedRect(100, 400, 520, 82, 41);
    for (let t = 0; t < 4; t++) {
      const x = 160 + t * 130;
      this.add.image(x, 441, `tier${t}`).setScale(0.55);
      const c = txt(this, x + 48, 441, String(inv[t]), 34, '#2b1d16', { stroke: '#fff6dc', strokeW: 2 });
      this.counts.push(c);
    }
  }

  private openOverlay(key: 'Hats' | 'Settings') {
    if (this.overlayOpen) return;
    this.overlayOpen = true;
    this.scene.launch(key);
    this.scene.pause();
  }

  private onOverlayClosed() {
    this.overlayOpen = false;
    this.frog.dress(Save.data.hat, Save.data.skin);
    Sound.setMusic(Save.data.music);
    Sound.setSfx(Save.data.sfx);
  }

  private startGame(level: number) {
    if (this.overlayOpen) return;
    Sound.unlock();
    this.overlayOpen = true;
    this.cameras.main.fadeOut(220, 26, 16, 48);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', { level }));
  }

  private onTap(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) {
    Sound.unlock();
    if (over.length > 0 || this.overlayOpen) return;
    let best: Insect | null = null;
    let bd = Infinity;
    for (const ins of this.insects) {
      if (!ins.active || !ins.hittable) continue;
      const d = Math.hypot(ins.x - p.x, ins.y - p.y);
      if (d < ins.spec.hitR && d < bd) {
        bd = d;
        best = ins;
      }
    }
    if (best) {
      this.catch(best, best.zoneAt(p.x));
      return;
    }
    if (this.frog.contains(p.x, p.y)) {
      this.frog.wiggle();
      this.frog.say(pick(FROG_POKE), 800);
      Sound.poke();
      Sound.speak('frog', 2);
    }
  }

  private catch(ins: Insect, zone: 'eat' | 'lick') {
    Sound.tongue();
    if (zone === 'eat') {
      ins.grab();
      this.frog.strike(ins.x, ins.y, {
        carry: ins,
        onHit: () => burst(this, ins.x, ins.y, 'spark', 5, { speed: 140, scale: 0.4, life: 300 }),
        onBack: () => {
          ins.swallow();
          this.frog.gulp();
          Sound.gulp();
          if (Math.random() < 0.5) this.frog.say(pick(FROG_EAT), 700);
        },
      });
    } else {
      ins.freeze();
      this.frog.strike(ins.x, ins.y, {
        onHit: () => {
          if (!ins.active) return;
          Sound.lick();
          Sound.blush();
          hearts(this, ins.x, ins.y - 20);
          const side = ins.x < W / 2 ? 1 : -1;
          sticker(this, Phaser.Math.Clamp(ins.x + side * 120, 130, W - 130), ins.y - 150, pick(BUG_BLUSH), { size: 28, life: 880 });
          Sound.speak('fly', 3);
          ins.blush();
        },
      });
    }
  }

  update(time: number, delta: number) {
    const d = Math.min(delta, 50);
    this.t += d;
    for (const l of this.letters) {
      const i = l.getData('i') as number;
      l.y = (l.getData('baseY') as number) + Math.sin(this.t / 260 + i * 0.6) * 7;
      l.angle = Math.sin(this.t / 400 + i) * 3;
    }
    this.frog.update(time, d);
    for (let i = this.insects.length - 1; i >= 0; i--) {
      const ins = this.insects[i];
      if (!ins.active) {
        this.insects.splice(i, 1);
        continue;
      }
      ins.update(time, d);
    }
    this.spawnAcc += d;
    const alive = this.insects.filter((i) => i.hittable).length;
    if (this.spawnAcc > 1700 && alive < 4) {
      this.spawnAcc = 0;
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      const kind = Math.random() < 0.25 ? 'mosquito' : 'fly';
      this.insects.push(new Insect(this, kind, dir > 0 ? -80 : W + 80, Phaser.Math.Between(560, 720), dir, 110));
    }
    let target: Insect | null = null;
    for (const ins of this.insects) if (ins.hittable && ins.x > 140 && ins.x < 580) target = ins;
    if (target) this.frog.lookAt(target.x, target.y);
    this.autoAcc += d;
    if (this.autoAcc > 3200 && target && !this.frog.busy) {
      this.autoAcc = 0;
      this.catch(target, Math.random() < 0.7 ? 'eat' : 'lick');
    }
  }
}
