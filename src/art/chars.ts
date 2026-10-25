import Phaser from 'phaser';
import { ART_COUNT } from '../data/cosmetics';
import { HAT_COUNT } from './textures';
import { INSECT_SHEETS, PROP_SHEETS } from './insectSheets';

export { INSECT_SHEETS, PROP_SHEETS };
export type InsectTexture = keyof typeof INSECT_SHEETS;

export const CHAR_SHEETS = {
  frog_char: { file: 'chars/frog.png', frameWidth: 624, frameHeight: 520 },
  ...INSECT_SHEETS,
  ...PROP_SHEETS,
} as const;

/** Wing beats per second; the mosquito buzzes faster, a dozing fly barely moves. */
export const FLAP_RATE: Partial<Record<InsectTexture, number>> = { mosquito: 18, thief: 18 };
export const DOZE_RATE = 2;

export function flapAnim(tex: InsectTexture) {
  return `${tex}-flap`;
}

export function dozeAnim(tex: InsectTexture) {
  return `${tex}-doze`;
}

export function preloadChars(scene: Phaser.Scene) {
  for (const [key, spec] of Object.entries(CHAR_SHEETS)) {
    scene.load.spritesheet(key, `${spec.file}?v=6`, { frameWidth: spec.frameWidth, frameHeight: spec.frameHeight });
  }
}

export function preloadHats(scene: Phaser.Scene) {
  for (let i = 0; i < HAT_COUNT; i++) {
    scene.load.image(`hat${i}`, `hats/hat${i}.png?v=3`);
    scene.load.image(`hatshop${i}`, `hats/hatshop${i}.png?v=3`);
  }
  for (let i = 0; i < ART_COUNT; i++) {
    scene.load.image(`art${i}`, `art/art${i}.png?v=1`);
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

  for (const key of Object.keys(INSECT_SHEETS) as InsectTexture[]) {
    const frames = scene.anims.generateFrameNumbers(key, { start: 0, end: 1 });
    scene.anims.create({ key: flapAnim(key), frames, frameRate: FLAP_RATE[key] ?? 14, repeat: -1 });
    scene.anims.create({ key: dozeAnim(key), frames, frameRate: DOZE_RATE, repeat: -1 });
  }
}
