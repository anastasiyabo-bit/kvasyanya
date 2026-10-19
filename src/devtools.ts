/* Dev-only QA hooks (never bundled into production). */
import type Phaser from 'phaser';

type Win = Window & {
  __phaser?: Phaser.Game;
  __errors: string[];
  __tap: (gx: number, gy: number, hold?: number) => void;
  __st: () => unknown;
  __game?: { debugState(): unknown; scene: Phaser.Scenes.ScenePlugin };
};

const w = window as unknown as Win;
w.__errors = [];
window.addEventListener('error', (e) => w.__errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => w.__errors.push('rejection: ' + String(e.reason)));
const origError = console.error.bind(console);
console.error = (...a: unknown[]) => {
  w.__errors.push('console: ' + a.map(String).join(' '));
  origError(...a);
};

/** Tap at game coordinates through Phaser's real mouse pipeline. */
w.__tap = (gx, gy, hold = 30) => {
  const g = w.__phaser!;
  const c = g.canvas;
  const r = c.getBoundingClientRect();
  const x = r.x + (gx * r.width) / 720;
  const y = r.y + (gy * r.height) / 1280;
  const mk = (type: string, buttons: number) =>
    ({
      type,
      clientX: x,
      clientY: y,
      pageX: x,
      pageY: y,
      button: 0,
      buttons,
      target: c,
      timeStamp: performance.now(),
      defaultPrevented: false,
      preventDefault() {},
      stopPropagation() {},
    }) as unknown as MouseEvent;
  const mouse = g.input.mouse as unknown as { onMouseDown(e: MouseEvent): void; onMouseUp(e: MouseEvent): void };
  mouse.onMouseDown(mk('mousedown', 1));
  setTimeout(() => mouse.onMouseUp(mk('mouseup', 0)), hold);
};

w.__st = () => {
  const g = w.__phaser!;
  return {
    scenes: g.scene.getScenes(true).map((s) => s.scene.key),
    errors: w.__errors,
    game: w.__game && g.scene.isActive('Game') ? w.__game.debugState() : null,
  };
};
