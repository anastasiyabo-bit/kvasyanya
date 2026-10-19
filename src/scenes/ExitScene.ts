import Phaser from 'phaser';
import { Ya } from '../systems/yandex';
import { Button, dimmer, panel, popIn, txt } from '../ui/ui';
import { MenuScene } from './MenuScene';

/** TV / browser Back: confirm leaving the game (HISTORY_BACK → EXIT). */
export class ExitScene extends Phaser.Scene {
  constructor() {
    super('Exit');
  }

  create() {
    dimmer(this, 0.65);
    const c = this.add.container(360, 640);
    c.add(panel(this, 0, 0, 620, 520));
    c.add(txt(this, 0, -160, 'Выйти из игры?', 48, '#ffffff'));
    c.add(txt(this, 0, -70, 'Прогресс сохранён.', 32, '#8a5a32', { stroke: '#fff1cf', strokeW: 2 }));
    const stay = new Button(this, 0, 50, {
      w: 420,
      h: 110,
      label: 'Остаться',
      onClick: () => this.stay(),
    });
    stay.pulse();
    const leave = new Button(this, 0, 180, {
      w: 420,
      h: 110,
      color: 'orange',
      label: 'Выйти',
      onClick: () => Ya.exit(),
    });
    c.add([stay, leave]);
    popIn(this, c);
    this.input.keyboard?.on('keydown-ESC', () => this.stay());
  }

  private stay() {
    this.scene.stop();
    const menu = this.scene.get('Menu') as MenuScene;
    if (menu?.scene.isPaused()) {
      menu.releaseOverlay();
      if (!Ya.platformPaused && !document.hidden) this.scene.resume('Menu');
    }
  }
}
