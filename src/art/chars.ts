import Phaser from 'phaser';
import { HAT_COUNT } from './textures';

export const CHAR_SHEETS = {
  frog_char: { file: 'chars/frog.png', frameWidth: 624, frameHeight: 520 },
  fly: { file: 'chars/fly.png', frameWidth: 268, frameHeight: 280 },
  mosquito: { file: 'chars/mosquito.png', frameWidth: 336, frameHeight: 280 },
  fatfly: { file: 'chars/fatfly.png', frameWidth: 266, frameHeight: 280 },
  goldfly: { file: 'chars/goldfly.png', frameWidth: 268, frameHeight: 280 },
} as const;

export function preloadChars(scene: Phaser.Scene) {
  for (const [key, spec] of Object.entries(CHAR_SHEETS)) {
    scene.load.spritesheet(key, `${spec.file}?v=3`, { frameWidth: spec.frameWidth, frameHeight: spec.frameHeight });
  }
}

export function preloadHats(scene: Phaser.Scene) {
  for (let i = 0; i < HAT_COUNT; i++) {
    scene.load.image(`hat${i}`, `hats/hat${i}.png?v=3`);
    scene.load.image(`hatshop${i}`, `hats/hatshop${i}.png?v=3`);
  }
  scene.load.image('ico_hat', 'hats/ico_hat.png?v=1');
  scene.load.image('ico_gear', 'ui/ico_gear.png?v=1');
  scene.load.image('ico_lock', 'ui/ico_lock.png?v=2');
  scene.load.image('ico_music', 'ui/ico_music.png?v=1');
  scene.load.image('ico_sound', 'ui/ico_sound.png?v=1');
  scene.load.image('ico_play', 'ui/ico_play.png?v=1');
  scene.load.image('ico_pause', 'ui/ico_pause.png?v=1');
  scene.load.image('ico_retry', 'ui/ico_retry.png?v=1');
  scene.load.image('ico_home', 'ui/ico_home.png?v=1');
  scene.load.image('ico_video', 'ui/ico_video.png?v=1');
  scene.load.image('star_bronze', 'ui/star_bronze.png?v=1');
  scene.load.image('star_silver', 'ui/star_silver.png?v=1');
  scene.load.image('star_gold', 'ui/star_gold.png?v=1');
  for (let i = 0; i < 4; i++) {
    scene.load.image(`tier${i}`, `ui/tier${i}.png?v=1`);
  }
  scene.load.image('tier3_open', 'ui/tier3_open.png?v=1');
  scene.load.image('star_red', 'ui/star_red.png?v=1');
  scene.load.image('spark', 'ui/spark.png?v=1');
}

export function createCharAnims(scene: Phaser.Scene) {
  if (scene.anims.exists('frog-idle')) return;

  scene.anims.create({
    key: 'frog-idle',
    frames: [
      { key: 'frog_char', frame: 0 },
      { key: 'frog_char', frame: 1 },
    ],
    frameRate: 2.4,
    repeat: -1,
    yoyo: true,
  });
  scene.anims.create({
    key: 'frog-blink',
    frames: [{ key: 'frog_char', frame: 2 }],
    duration: 140,
    repeat: 0,
  });
  scene.anims.create({
    key: 'frog-eat',
    frames: [{ key: 'frog_char', frame: 3 }],
    duration: 280,
    repeat: 0,
  });
  scene.anims.create({
    key: 'frog-oh',
    frames: [{ key: 'frog_char', frame: 4 }],
    duration: 520,
    repeat: 0,
  });

  for (const key of ['fly', 'mosquito', 'fatfly', 'goldfly'] as const) {
    scene.anims.create({
      key: `${key}-flap`,
      frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 1 }),
      frameRate: key === 'mosquito' ? 18 : 14,
      repeat: -1,
    });
  }
}
