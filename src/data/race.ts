/** Klesha, the rival frog. Pure brain; the scene moves her tongue. */

import { touchInsect, type InsectKind } from './guests';
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
  kind?: InsectKind;
  /** Firefly shines right now. */
  lit?: boolean;
}

/** Klesha is no fool: she leaves wasps and squeakers alone and waits for a firefly to shine. */
export function rivalWants(t: RivalTarget): boolean {
  if (t.kind === 'wasp' || t.kind === 'squeaker' || t.kind === 'thief') return false;
  if (t.kind === 'firefly' && t.lit === false) return false;
  return true;
}

/** What one of her catches adds to her counter, by the same rules as the player's. */
export function rivalCatchValue(kind: InsectKind | undefined): number {
  return kind ? touchInsect(kind, 'eat', 0, 1).caught : 1;
}

/** The line under the race counters: the rule, and who leads right now. */
export function raceStatus(me: number, rival: number): { text: string; mood: 'ahead' | 'tie' | 'behind' } {
  if (me > rival) return { text: `Ты впереди на ${me - rival}!`, mood: 'ahead' };
  if (me === rival) {
    return { text: me === 0 ? 'Поймай больше, чем Клеша!' : 'Ничья — это победа Клеши!', mood: 'tie' };
  }
  return { text: `Клеша впереди на ${rival - me} — догоняй!`, mood: 'behind' };
}

export function rivalPaceMs(cfg: Pick<LevelConfig, 'duration' | 'minCatch'>): number {
  return Math.round((cfg.duration * 1000) / Math.max(1, cfg.minCatch * RIVAL_PACE_SHARE));
}

/** Closest live fly to her, measured from her mouth. Flies over the far frog count for more distance. */
export function rivalPick<T extends RivalTarget>(insects: readonly T[], mx: number, my: number, maxX: number): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const ins of insects) {
    if (!ins.hittable || !rivalWants(ins) || ins.x < 20 || ins.x > maxX) continue;
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
    return { type: 'strike', target: t, hit: t.hittable && rivalWants(t) };
  }
}
