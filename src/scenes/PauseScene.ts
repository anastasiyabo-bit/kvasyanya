import Phaser from 'phaser';
import { Sound } from '../systems/audio';
import { Save } from '../systems/save';
import { Button, dimmer, panel, popIn, toggleButton, txt } from '../ui/ui';

export class PauseScene extends Phaser.Scene {
  private level = 1;

  constructor() {
    super('Pause');
  }

  init(data: { level: number }) {
    this.level = data.level;
  }

  create() {
    Sound.suspend('pause');
    this.events.once('shutdown', () => Sound.resume('pause'));
    dimmer(this, 0.6);
    const c = this.add.container(360, 640);
    c.add(panel(this, 0, 0, 580, 760));
    c.add(txt(this, 0, -300, 'Пауза', 76, '#ffffff'));
    const nap = this.add.image(0, -150, 'frog_char', 2).setOrigin(0.5, 0.55).setScale(0.32);
    const z = txt(this, 120, -215, 'z-z-z', 34, '#5fb8ff', { stroke: '#2b1d16', strokeW: 6 });
    this.tweens.add({ targets: z, y: -235, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 });
    c.add([nap, z]);

    const resume = new Button(this, 0, -50, { w: 460, h: 116, label: 'Продолжить', size: 46, icon: 'ico_play', onClick: () => this.resumeGame() });
    resume.pulse();
    const retry = new Button(this, 0, 85, {
      w: 440,
      h: 106,
      color: 'orange',
      label: 'Заново',
      icon: 'ico_retry',
      size: 46,
      onClick: () => {
        this.scene.stop();
        this.scene.get('Game').scene.restart({ level: this.level });
      },
    });
    const menu = new Button(this, 0, 210, {
      w: 440,
      h: 106,
      color: 'orange',
      label: 'В меню',
      icon: 'ico_home',
      size: 46,
      onClick: () => {
        this.scene.stop('Game');
        this.scene.start('Menu');
      },
    });
    const music = toggleButton(
      this,
      -80,
      320,
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
      80,
      320,
      'ico_sound',
      () => Save.data.sfx,
      () => {
        Save.update((d) => {
          d.sfx = !d.sfx;
        });
        Sound.setSfx(Save.data.sfx);
      },
    );
    music.setBaseScale(0.9);
    sfx.setBaseScale(0.9);
    c.add([resume, retry, menu, music, sfx]);
    popIn(this, c);

    this.input.keyboard?.on('keydown-ESC', () => this.resumeGame());
    this.input.keyboard?.on('keydown-P', () => this.resumeGame());
  }

  private resumeGame() {
    Sound.resume('pause');
    this.scene.resume('Game');
    this.scene.stop();
  }
}
