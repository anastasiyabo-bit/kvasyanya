import Phaser from 'phaser';
import { frogIconKey, SKIN_COUNT, SKIN_NAMES } from '../art/skins';
import { ART_COUNT, ART_NAMES, isArtUnlocked, isHatUnlocked, isSkinUnlocked } from '../data/cosmetics';
import { HAT_COUNT, HAT_NAMES } from '../art/textures';
import { MenuScene } from './MenuScene';
import { Sound } from '../systems/audio';
import { Save } from '../systems/save';
import { Ya } from '../systems/yandex';
import { Button, dimmer, panel, popIn, txt } from '../ui/ui';
import { fitScale } from '../objects/Frog';

type Tab = 'hats' | 'arts' | 'skins';

const COLS = 3;
const ROWS = 3;
const PER_PAGE = COLS * ROWS;
const CELL_W = 180;
const CELL_H = 196;
const GAP_X = 196;
const GAP_Y = 206;
const GRID_Y = -186;

interface Lot {
  key: string;
  /** Fixed scale, or fit into the cell's picture box. */
  scale?: number;
  name: string;
  unlocked: boolean;
}

export class HatsScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private grid!: Phaser.GameObjects.Container;
  private tabs!: Phaser.GameObjects.Container;
  private frames: Phaser.GameObjects.Graphics[] = [];
  private tab: Tab = 'hats';
  private page = 0;
  private clearBtn!: Button;
  private prevBtn!: Button;
  private nextBtn!: Button;
  private pageText!: Phaser.GameObjects.Text;

  constructor() {
    super('Hats');
  }

  create() {
    this.frames = [];
    this.tab = 'hats';
    this.page = this.pageOfSelected();
    dimmer(this, 0.6);
    this.root = this.add.container(360, 640);
    this.root.add(panel(this, 0, 0, 640, 1080));
    this.root.add(txt(this, 0, -488, 'Наряды Кваси', 46, '#ffffff'));
    this.root.add(
      txt(this, 0, -430, '10 искорок — шапочка. 3 блестяшки — рисунок.\nСундучек за супер-уровень — новый окрас.', 22, '#8a5a32', {
        stroke: '#fff1cf',
        strokeW: 2,
      }),
    );
    this.grid = this.add.container(0, 0);
    this.root.add(this.grid);

    this.prevBtn = new Button(this, -170, 376, { w: 110, h: 72, color: 'orange', label: '‹', size: 52, onClick: () => this.flip(-1) });
    this.nextBtn = new Button(this, 170, 376, { w: 110, h: 72, color: 'orange', label: '›', size: 52, onClick: () => this.flip(1) });
    this.pageText = txt(this, 0, 372, '', 30, '#8a5a32', { stroke: '#fff1cf', strokeW: 2 });
    this.root.add([this.prevBtn, this.nextBtn, this.pageText]);

    this.clearBtn = new Button(this, -150, 470, {
      w: 250,
      h: 84,
      color: 'orange',
      label: 'Без шапочки',
      size: 28,
      onClick: () => this.clearEquip(),
    });
    const close = new Button(this, 150, 470, { w: 240, h: 88, label: 'Готово', size: 38, onClick: () => this.close() });
    this.root.add([this.clearBtn, close]);
    this.renderTabs();
    this.renderGrid();
    popIn(this, this.root);
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private renderTabs() {
    this.tabs?.destroy();
    this.tabs = this.add.container(0, -350);
    const tabs: { id: Tab; label: string }[] = [
      { id: 'hats', label: 'Шапочки' },
      { id: 'arts', label: 'Рисунки' },
      { id: 'skins', label: 'Окрасы' },
    ];
    tabs.forEach((t, i) => {
      const btn = new Button(this, (i - 1) * 200, 0, {
        w: 190,
        h: 72,
        color: this.tab === t.id ? 'green' : 'orange',
        label: t.label,
        size: 28,
        onClick: () => this.setTab(t.id),
      });
      this.tabs.add(btn);
    });
    this.root.add(this.tabs);
  }

  private setTab(tab: Tab) {
    if (this.tab === tab) return;
    this.tab = tab;
    this.page = this.pageOfSelected();
    this.renderTabs();
    this.renderGrid();
  }

  private flip(dir: number) {
    const next = Phaser.Math.Clamp(this.page + dir, 0, this.pageCount() - 1);
    if (next === this.page) return;
    this.page = next;
    this.renderGrid();
  }

  private lotCount(): number {
    if (this.tab === 'hats') return HAT_COUNT;
    if (this.tab === 'arts') return ART_COUNT;
    return SKIN_COUNT + 1;
  }

  private pageCount(): number {
    return Math.max(1, Math.ceil(this.lotCount() / PER_PAGE));
  }

  private selectedId(): number {
    if (this.tab === 'hats') return Save.data.hat;
    if (this.tab === 'arts') return Save.data.art;
    return Save.data.skin;
  }

  private pageOfSelected(): number {
    const id = this.selectedId();
    return id > 0 ? Math.floor(id / PER_PAGE) : 0;
  }

  private lot(id: number): Lot {
    if (this.tab === 'hats') {
      const unlocked = isHatUnlocked(id, Save.data.hatsUnlocked);
      return { key: `hatshop${id}`, scale: 0.5, name: unlocked ? HAT_NAMES[id] : '???', unlocked };
    }
    if (this.tab === 'arts') {
      const unlocked = isArtUnlocked(id, Save.data.artsUnlocked);
      return { key: `art${id}`, name: unlocked ? ART_NAMES[id] : '???', unlocked };
    }
    const unlocked = isSkinUnlocked(id, Save.data.skinsUnlocked);
    return { key: frogIconKey(id), scale: 0.66, name: unlocked ? SKIN_NAMES[id] : '???', unlocked };
  }

  private renderGrid() {
    this.grid.removeAll(true);
    this.frames = [];
    this.clearBtn.setVisible(this.tab !== 'skins');
    this.clearBtn.setLabel(this.tab === 'arts' ? 'Без рисунка' : 'Без шапочки');

    const pages = this.pageCount();
    this.page = Phaser.Math.Clamp(this.page, 0, pages - 1);
    const paged = pages > 1;
    this.prevBtn.setVisible(paged).setEnabled(this.page > 0);
    this.nextBtn.setVisible(paged).setEnabled(this.page < pages - 1);
    this.pageText.setVisible(paged).setText(`${this.page + 1} / ${pages}`);

    const first = this.page * PER_PAGE;
    const last = Math.min(this.lotCount(), first + PER_PAGE);
    for (let id = first; id < last; id++) {
      const slot = id - first;
      const x = ((slot % COLS) - 1) * GAP_X;
      const y = GRID_Y + Math.floor(slot / COLS) * GAP_Y;
      this.addCell(id, x, y, this.lot(id));
    }
    this.drawFrames();
  }

  private addCell(id: number, x: number, y: number, lot: Lot) {
    const frame = this.add.graphics();
    frame.setData('id', id);
    frame.setData('x', x);
    frame.setData('y', y);
    this.frames.push(frame);
    const img = this.add.image(x, y - 18, lot.key);
    img.setScale(lot.scale ?? fitScale(img, 128, 120));
    const label = txt(this, x, y + CELL_H / 2 - 24, lot.name, 22, lot.unlocked ? '#2b1d16' : '#a08a6a', {
      stroke: '#fff1cf',
      strokeW: 2,
    });
    this.grid.add([frame, img, label]);
    if (!lot.unlocked) {
      img.setTintFill(0x9a8a72).setAlpha(0.55);
      this.grid.add(this.add.image(x, y - 14, 'ico_lock').setScale(0.6));
      return;
    }
    const hit = this.add.zone(x, y, CELL_W, CELL_H).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => this.equip(id));
    this.grid.add(hit);
  }

  private drawFrames() {
    const selected = this.selectedId();
    for (const f of this.frames) {
      const x = f.getData('x') as number;
      const y = f.getData('y') as number;
      const on = (f.getData('id') as number) === selected;
      f.clear();
      f.fillStyle(0x2b1d16, 1);
      f.fillRoundedRect(x - CELL_W / 2, y - CELL_H / 2, CELL_W, CELL_H, 22);
      f.fillStyle(on ? 0xbff08f : 0xf7e2b0, 1);
      f.fillRoundedRect(x - CELL_W / 2 + 5, y - CELL_H / 2 + 5, CELL_W - 10, CELL_H - 10, 18);
    }
  }

  private equip(id: number) {
    Sound.click();
    Save.update((d) => {
      if (this.tab === 'hats') d.hat = id;
      else if (this.tab === 'arts') d.art = id;
      else d.skin = id;
    });
    this.drawFrames();
  }

  private clearEquip() {
    Save.update((d) => {
      if (this.tab === 'arts') d.art = -1;
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
