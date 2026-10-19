import Phaser from 'phaser';
import { createCharAnims, preloadChars, preloadHats } from '../art/chars';
import { bakeFrogSkins } from '../art/skins';
import { generateTextures } from '../art/textures';
import { ensureBackground } from '../art/backgrounds';
import { Save } from '../systems/save';

function setBootProgress(pct: number) {
  const el = document.getElementById('boot-pct');
  if (el) el.textContent = `${Math.max(0, Math.min(100, Math.round(pct)))}%`;
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.on('progress', (p: number) => setBootProgress(p * 70));
    preloadChars(this);
    preloadHats(this);
  }

  create() {
    void this.finishBoot();
  }

  private async finishBoot() {
    setBootProgress(72);
    generateTextures(this);
    await bakeFrogSkins(this, (t) => setBootProgress(72 + t * 22));
    createCharAnims(this);
    ensureBackground(this, 1);
    ensureBackground(this, Save.data.level);
    setBootProgress(100);
    window.setTimeout(() => {
      document.getElementById('boot')?.remove();
      if (this.scene.isActive()) this.scene.start('Menu');
    }, 0);
  }
}
