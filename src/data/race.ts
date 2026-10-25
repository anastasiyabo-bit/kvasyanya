/** Klesha, the rival frog. Pure brain; the scene moves her tongue. */

import type { LevelConfig } from './levels';

/** She stares this long before the tongue goes. The player can steal the fly meanwhile. */
export const RIVAL_LOOK_MS = 340;
/** Her expected haul is a bit under the level quota. */
export const RIVAL_PACE_SHARE = 0.85;
export const RIVAL_FIRST_DELAY_MS = 1400;

export interface RivalTarget {
  x: number;
  y: number;
  hittable: boolean;
}

export function rivalPaceMs(cfg: Pick<LevelConfig, 'duration' | 'minCatch'>): number {
  return Math.round((cfg.duration * 1000) / Math.max(1, cfg.minCatch * RIVAL_PACE_SHARE));
}

/** Closest live fly to her, measured from her mouth. Flies over the far frog count for more distance. */
export function rivalPick<T extends RivalTarget>(insects: readonly T[], mx: number, my: number, maxX: number): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const ins of insects) {
    if (!ins.hittable || ins.x < 20 || ins.x > maxX) continue;
    const d = Math.hypot(ins.x - mx, (ins.y - my) * 0.8);
    if (d < bestD) {
      bestD = d;
      best = ins;
    }
  }
  return best;
}

export type RivalEvent<T> = { type: 'look'; target: T } | { type: 'strike'; target: T; hit: boolean } | null;

export class RivalBrain<T extends RivalTarget> {
  phase: 'rest' | 'look' = 'rest';
  target: T | null = null;
  private wait: number;

  constructor(
    private readonly paceMs: number,
    private readonly lookMs = RIVAL_LOOK_MS,
    firstDelay = RIVAL_FIRST_DELAY_MS,
  ) {
    this.wait = firstDelay;
  }

  /** Blocks her for a while (e.g. squeaker pop). */
  hold(ms: number) {
    this.phase = 'rest';
    this.target = null;
    this.wait = Math.max(this.wait, ms);
  }

  update(dt: number, pick: () => T | null): RivalEvent<T> {
    this.wait -= dt;
    if (this.wait > 0) return null;
    if (this.phase === 'rest') {
      const t = pick();
      if (!t) {
        this.wait = 120;
        return null;
      }
      this.phase = 'look';
      this.target = t;
      this.wait = this.lookMs;
      return { type: 'look', target: t };
    }
    const t = this.target!;
    this.phase = 'rest';
    this.target = null;
    this.wait = Math.max(200, this.paceMs - this.lookMs);
    return { type: 'strike', target: t, hit: t.hittable };
  }
}
