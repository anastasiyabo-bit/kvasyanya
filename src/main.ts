import Phaser from 'phaser';
import '@fontsource/rubik/cyrillic-800.css';
import '@fontsource/rubik/latin-800.css';
import '@fontsource/rubik/cyrillic-900.css';
import '@fontsource/rubik/latin-900.css';
import { H, W } from './config';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { PauseScene } from './scenes/PauseScene';
import { ResultScene } from './scenes/ResultScene';
import { HatsScene } from './scenes/HatsScene';
import { SettingsScene } from './scenes/SettingsScene';
import { Sound } from './systems/audio';
import { Save } from './systems/save';
import { Ya } from './systems/yandex';

async function loadFonts() {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('800 40px Rubik', 'Квася'), document.fonts.load('900 40px Rubik', 'ням')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* fall back to system font */
  }
}

function throttledRemoteSave() {
  let timer: number | null = null;
  return () => {
    if (timer !== null) return;
    timer = window.setTimeout(() => {
      timer = null;
      Ya.saveRemote(Save.data);
    }, 400);
  };
}

async function start() {
  if (import.meta.env.DEV) await import('./devtools');
  Save.loadLocal();
  await Promise.all([loadFonts(), Ya.init()]);
  const remote = await Ya.loadPlayerData();
  if (remote) Save.adoptRemote(remote);
  if (Ya.player) Save.setRemoteWriter(throttledRemoteSave());
  Sound.setMusic(Save.data.music);
  Sound.setSfx(Save.data.sfx);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: '#7cc6e8',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 3 },
    render: { antialias: true, powerPreference: 'high-performance' },
    loader: { maxParallelDownloads: 100 },
    disableContextMenu: true,
    scene: [BootScene, MenuScene, GameScene, PauseScene, ResultScene, HatsScene, SettingsScene],
  });

  if (import.meta.env.DEV) (window as unknown as { __phaser: Phaser.Game }).__phaser = game;

  const unlock = () => Sound.unlock();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);

  const platformPause = (reason: string) => {
    Sound.suspend(reason);
    game.events.emit('platform-pause');
  };
  const platformResume = (reason: string) => {
    Sound.resume(reason);
    game.events.emit('platform-resume');
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) platformPause('hidden');
    else platformResume('hidden');
  });
  window.addEventListener('blur', () => platformPause('blur'));
  window.addEventListener('focus', () => platformResume('blur'));
  Ya.onPause(() => platformPause('platform'));
  Ya.onResume(() => platformResume('platform'));

  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false },
  );
}

start();
