import Phaser from 'phaser';
import { Sound } from '../systems/audio';
import { Save } from '../systems/save';
import { Ya } from '../systems/yandex';
import { Button, dimmer, panel, popIn, toggleButton, txt } from '../ui/ui';
import { MenuScene } from './MenuScene';

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings');
  }

  create() {
    dimmer(this, 0.6);
    const c = this.add.container(360, 640);
    c.add(panel(this, 0, 0, 620, 900));
    c.add(txt(this, 0, -380, 'Настройки', 60, '#ffffff'));

    const music = toggleButton(
      this,
      -110,
      -250,
      'ico_music',
      () => Save.data.music,
      () => {
        Save.update((d) => {
          d.music = !d.music;
        });
        Sound.setMusic(Save.data.music);
      },
    );
    const sfx = toggleButton(
      this,
      110,
      -250,
      'ico_sound',
      () => Save.data.sfx,
      () => {
        Save.update((d) => {
          d.sfx = !d.sfx;
        });
        Sound.setSfx(Save.data.sfx);
      },
    );
    c.add([music, sfx]);
    c.add(txt(this, -110, -170, 'Музыка', 28, '#8a5a32', { stroke: '#fff1cf', strokeW: 2 }));
    c.add(txt(this, 110, -170, 'Звуки', 28, '#8a5a32', { stroke: '#fff1cf', strokeW: 2 }));

    c.add(txt(this, 0, -110, 'Как играть', 40, '#ffffff'));
    const rules = [
      'Тап по голове мошки — Квася её съест.',
      'Тап по брюшку — лизнёт, и мошка',
      'улетит, краснея от смущения.',
      'Поймай норму до конца таймера!',
      'Каждый 5-й — супер: тапай пару дважды.',
      '5 наград сливаются в 1 побольше.',
    ];
    c.add(txt(this, 0, 60, rules.join('\n'), 26, '#2b1d16', { stroke: '#fff1cf', strokeW: 2 }).setLineSpacing(4));

    if (Save.data.level > 1) {
      const fromStart = new Button(this, 0, 250, {
        w: 500,
        h: 96,
        color: 'orange',
        label: 'С 1-го уровня',
        size: 40,
        onClick: () => {
          this.scene.stop();
          this.scene.stop('Menu');
          this.scene.start('Game', { level: 1 });
        },
      });
      c.add(fromStart);
    }
    const close = new Button(this, 0, 365, { w: 320, h: 110, label: 'Готово', onClick: () => this.close() });
    c.add(close);
    popIn(this, c);
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  close() {
    this.scene.stop();
    (this.scene.get('Menu') as MenuScene).releaseOverlay();
    if (!Ya.platformPaused && !document.hidden) this.scene.resume('Menu');
  }
}
