import Phaser from 'phaser';
import { frogIconKey, SKIN_COUNT, SKIN_NAMES } from '../art/skins';
import { BEAD_COUNT, BEAD_NAMES, isBeadUnlocked, isHatUnlocked, isSkinUnlocked } from '../data/cosmetics';
import { HAT_COUNT, HAT_NAMES } from '../art/textures';
import { MenuScene } from './MenuScene';
import { Sound } from '../systems/audio';
import { Save } from '../systems/save';
import { Ya } from '../systems/yandex';
import { Button, dimmer, panel, popIn, txt } from '../ui/ui';

type Page = 'hats' | 'beads' | 'skins';

export class HatsScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private grid!: Phaser.GameObjects.Container;
  private tabs!: Phaser.GameObjects.Container;
  private frames: Phaser.GameObjects.Graphics[] = [];
  private page: Page = 'hats';
  private clearBtn!: Button;

  constructor() {
    super('Hats');
  }

  create() {
    this.frames = [];
    this.page = 'hats';
    dimmer(this, 0.6);
    this.root = this.add.container(360, 640);
    this.root.add(panel(this, 0, 0, 640, 1080));
    this.root.add(txt(this, 0, -488, 'Наряды Кваси', 46, '#ffffff'));
    this.root.add(
      txt(this, 0, -430, '10 искорок — шапочка. 3 блестяшки — бусы.\nСундучек за супер-уровень — новый окрас.', 22, '#8a5a32', {
        stroke: '#fff1cf',
        strokeW: 2,
      }),
    );
    this.grid = this.add.container(0, 0);
    this.root.add(this.grid);

    this.clearBtn = new Button(this, -150, 456, {
      w: 250,
      h: 84,
      color: 'orange',
      label: 'Без шапки',
      size: 28,
      onClick: () => this.clearEquip(),
    });
    const close = new Button(this, 150, 456, { w: 240, h: 88, label: 'Готово', size: 38, onClick: () => this.close() });
    this.root.add([this.clearBtn, close]);
    this.renderTabs();
    this.renderGrid();
    popIn(this, this.root);
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private renderTabs() {
    this.tabs?.destroy();
    this.tabs = this.add.container(0, -360);
    const pages: { id: Page; label: string }[] = [
      { id: 'hats', label: 'Шапки' },
      { id: 'beads', label: 'Бусы' },
      { id: 'skins', label: 'Окрасы' },
    ];
    pages.forEach((p, i) => {
      const btn = new Button(this, (i - 1) * 200, 0, {
        w: 186,
        h: 72,
        color: this.page === p.id ? 'green' : 'orange',
        label: p.label,
        size: 28,
        onClick: () => this.setPage(p.id),
      });
      this.tabs.add(btn);
    });
    this.root.add(this.tabs);
  }

  private setPage(page: Page) {
    if (this.page === page) return;
    Sound.click();
    this.page = page;
    this.renderTabs();
    this.renderGrid();
  }

  private renderGrid() {
    this.grid.removeAll(true);
    this.frames = [];
    this.clearBtn.setVisible(this.page !== 'skins');
    this.clearBtn.setLabel(this.page === 'beads' ? 'Без бус' : 'Без шапки');
    if (this.page === 'hats') this.renderHats();
    else if (this.page === 'beads') this.renderBeads();
    else this.renderSkins();
    this.drawFrames();
  }

  private renderHats() {
    const gapX = 190;
    const gapY = 128;
    const startY = -250;
    for (let i = 0; i < HAT_COUNT; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = (col - 1) * gapX;
      const y = startY + row * gapY;
      const unlocked = isHatUnlocked(i, Save.data.hatsUnlocked);
      this.addCell(i, x, y, 164, 118, `hatshop${i}`, 0.32, unlocked ? HAT_NAMES[i] : '???', unlocked, () => this.equipHat(i));
    }
  }

  private renderBeads() {
    const gap = 118;
    const y = -20;
    for (let i = 0; i < BEAD_COUNT; i++) {
      const x = (i - 2) * gap;
      const unlocked = isBeadUnlocked(i, Save.data.beadsUnlocked);
      this.addCell(i, x, y, 108, 150, `bead${i}`, 0.42, unlocked ? BEAD_NAMES[i] : '???', unlocked, () => this.equipBead(i));
    }
  }

  private renderSkins() {
    const gap = 148;
    const y = -20;
    for (let i = 0; i <= SKIN_COUNT; i++) {
      const x = (i - 1.5) * gap;
      const unlocked = isSkinUnlocked(i, Save.data.skinsUnlocked);
      this.addCell(i, x, y, 132, 160, frogIconKey(i), 0.5, unlocked ? SKIN_NAMES[i] : '???', unlocked, () => this.equipSkin(i));
    }
  }

  private addCell(
    id: number,
    x: number,
    y: number,
    w: number,
    h: number,
    key: string,
    scale: number,
    name: string,
    unlocked: boolean,
    onPick: () => void,
  ) {
    const frame = this.add.graphics();
    frame.setData('id', id);
    frame.setData('x', x);
    frame.setData('y', y);
    frame.setData('w', w);
    frame.setData('h', h);
    this.frames.push(frame);
    const img = this.add.image(x, y - 16, key).setScale(scale);
    const label = txt(this, x, y + h / 2 - 18, name, 20, unlocked ? '#2b1d16' : '#a08a6a', {
      stroke: '#fff1cf',
      strokeW: 2,
    });
    this.grid.add([frame, img, label]);
    if (!unlocked) {
      img.setTintFill(0x9a8a72).setAlpha(0.55);
      this.grid.add(this.add.image(x, y - 8, 'ico_lock').setScale(0.55));
      return;
    }
    const hit = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerup', onPick);
    this.grid.add(hit);
  }

  private drawFrames() {
    for (const f of this.frames) {
      const x = f.getData('x') as number;
      const y = f.getData('y') as number;
      const w = f.getData('w') as number;
      const h = f.getData('h') as number;
      const on = this.isSelected(f.getData('id') as number);
      f.clear();
      f.fillStyle(0x2b1d16, 1);
      f.fillRoundedRect(x - w / 2, y - h / 2, w, h, 20);
      f.fillStyle(on ? 0xbff08f : 0xf7e2b0, 1);
      f.fillRoundedRect(x - w / 2 + 5, y - h / 2 + 5, w - 10, h - 10, 16);
    }
  }

  private isSelected(id: number): boolean {
    if (this.page === 'hats') return Save.data.hat === id;
    if (this.page === 'beads') return Save.data.bead === id;
    return Save.data.skin === id;
  }

  private equipHat(i: number) {
    Sound.click();
    Save.update((d) => {
      d.hat = i;
    });
    this.drawFrames();
  }

  private equipBead(i: number) {
    Sound.click();
    Save.update((d) => {
      d.bead = i;
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

  private clearEquip() {
    Sound.click();
    Save.update((d) => {
      if (this.page === 'beads') d.bead = -1;
      else d.hat = -1;
    });
    this.drawFrames();
  }

  close() {
    this.scene.stop();
    (this.scene.get('Menu') as MenuScene).releaseOverlay();
    if (!Ya.platformPaused && !document.hidden) this.scene.resume('Menu');
  }
}
