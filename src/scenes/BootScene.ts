import Phaser from 'phaser';
import { createCharAnims, preloadChars, preloadHats } from '../art/chars';
import { bakeFrogSkins } from '../art/skins';
import { generateTextures } from '../art/textures';
import { ensureBackground } from '../art/backgrounds';
import { Save } from '../systems/save';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    preloadChars(this);
    preloadHats(this);
  }

  create() {
    generateTextures(this);
    bakeFrogSkins(this);
    createCharAnims(this);
    ensureBackground(this, 1);
    ensureBackground(this, Save.data.level);
    document.getElementById('boot')?.remove();
    // Start on the next tick: a long skin bake inside create() can swallow a same-call scene.start.
    this.time.delayedCall(0, () => this.scene.start('Menu'));
  }
}
