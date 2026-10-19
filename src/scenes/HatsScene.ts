import Phaser from 'phaser';
import { frogIconKey, SKIN_COUNT, SKIN_NAMES } from '../art/skins';
import { HAT_COUNT, HAT_NAMES } from '../art/textures';
import { Sound } from '../systems/audio';
import { Save } from '../systems/save';
import { Button, dimmer, panel, popIn, txt } from '../ui/ui';

export class HatsScene extends Phaser.Scene {
  private frames: Phaser.GameObjects.Graphics[] = [];
  private skinFrames: Phaser.GameObjects.Graphics[] = [];

  constructor() {
    super('Hats');
  }

  create() {
    this.frames = [];
    this.skinFrames = [];
    dimmer(this, 0.6);
    const c = this.add.container(360, 640);
    c.add(panel(this, 0, 0, 640, 1080));
    c.add(txt(this, 0, -488, 'Наряды Кваси', 46, '#ffffff'));
    c.add(
      txt(this, 0, -438, 'Эпический сундук открывает\nшапку или новый окрас!', 24, '#8a5a32', { stroke: '#fff1cf', strokeW: 2 }),
    );

    c.add(txt(this, 0, -378, 'Окрасы', 28, '#ffffff'));
    const skinGap = 148;
    const skinY = -292;
    for (let i = 0; i <= SKIN_COUNT; i++) {
      const x = (i - 1.5) * skinGap;
      const unlocked = i === 0 || Save.data.hatsUnlocked >= HAT_COUNT + i;
      const frame = this.add.graphics();
      this.skinFrames.push(frame);
      const img = this.add.image(x, skinY - 8, frogIconKey(i)).setScale(0.52);
      const name = txt(this, x, skinY + 58, unlocked ? SKIN_NAMES[i] : '???', 20, unlocked ? '#2b1d16' : '#a08a6a', {
        stroke: '#fff1cf',
        strokeW: 2,
      });
      c.add([frame, img, name]);
      if (!unlocked) {
        img.setTintFill(0x9a8a72).setAlpha(0.55);
        c.add(this.add.image(x, skinY - 4, 'ico_lock').setScale(0.58));
      } else {
        const hit = this.add.zone(x, skinY, 132, 138).setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => this.equipSkin(i));
        c.add(hit);
      }
      frame.setData('x', x).setData('y', skinY);
    }

    c.add(txt(this, 0, -198, 'Шапки', 28, '#ffffff'));
    const gapX = 178;
    const gapY = 142;
    const startY = -92;
    for (let i = 0; i < HAT_COUNT; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = (col - 1) * gapX;
      const y = startY + row * gapY;
      const unlocked = i < Math.min(Save.data.hatsUnlocked, HAT_COUNT);
      const frame = this.add.graphics();
      this.frames.push(frame);
      const img = this.add.image(x, y - 10, `hatshop${i}`).setOrigin(0.5, 0.5).setScale(0.34);
      const name = txt(this, x, y + 52, unlocked ? HAT_NAMES[i] : '???', 20, unlocked ? '#2b1d16' : '#a08a6a', {
        stroke: '#fff1cf',
        strokeW: 2,
      });
      c.add([frame, img, name]);
      if (!unlocked) {
        img.setTintFill(0x9a8a72).setAlpha(0.55);
        c.add(this.add.image(x, y - 6, 'ico_lock').setScale(0.62));
      } else {
        const hit = this.add.zone(x, y, 164, 132).setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => this.equipHat(i));
        c.add(hit);
      }
      frame.setData('x', x).setData('y', y);
    }
    this.drawFrames();

    const none = new Button(this, -130, 456, {
      w: 280,
      h: 88,
      color: 'orange',
      label: 'Без шапки',
      size: 32,
      onClick: () => this.equipHat(-1),
    });
    const close = new Button(this, 150, 456, { w: 240, h: 88, label: 'Готово', size: 38, onClick: () => this.close() });
    c.add([none, close]);
    popIn(this, c);
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private drawFrames() {
    for (let i = 0; i < this.skinFrames.length; i++) {
      const f = this.skinFrames[i];
      const x = f.getData('x') as number;
      const y = f.getData('y') as number;
      const on = Save.data.skin === i;
      f.clear();
      f.fillStyle(0x2b1d16, 1);
      f.fillRoundedRect(x - 66, y - 68, 132, 138, 20);
      f.fillStyle(on ? 0xbff08f : 0xf7e2b0, 1);
      f.fillRoundedRect(x - 61, y - 63, 122, 128, 16);
    }
    for (let i = 0; i < this.frames.length; i++) {
      const f = this.frames[i];
      const x = f.getData('x') as number;
      const y = f.getData('y') as number;
      const on = Save.data.hat === i;
      f.clear();
      f.fillStyle(0x2b1d16, 1);
      f.fillRoundedRect(x - 82, y - 68, 164, 132, 20);
      f.fillStyle(on ? 0xbff08f : 0xf7e2b0, 1);
      f.fillRoundedRect(x - 77, y - 63, 154, 122, 16);
    }
  }

  private equipHat(i: number) {
    Sound.click();
    Save.update((d) => {
      d.hat = i;
    });
    this.drawFrames();
  }

  private equipSkin(i: number) {
    Sound.click();
    Save.update((d) => {
      d.skin = i;
    });
    this.drawFrames();
  }

  private close() {
    this.scene.resume('Menu');
    this.scene.stop();
  }
}
