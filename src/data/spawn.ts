/** Who appears next. Pure; the scene passes in counts and a random source. */

import type { BaseKind } from './guests';
import type { LevelConfig } from './levels';
import type { GuestKind } from './schedule';

export type Rand = () => number;

/** No new guest when this little time is left. One already flying finishes on its own. */
export const GUEST_CUTOFF_MS = 5000;
export const NAP_SLEEPY_SHARE = 0.5;

export function rollKind(cfg: Pick<LevelConfig, 'goldChance' | 'fatChance' | 'mosquitoChance'>, r: number, allowSpecial: boolean): BaseKind {
  if (allowSpecial && r < cfg.goldChance) return 'gold';
  if (allowSpecial && r < cfg.goldChance + cfg.fatChance) return 'fat';
  if (r < cfg.goldChance + cfg.fatChance + cfg.mosquitoChance) return 'mosquito';
  return 'fly';
}

/** Play-time window (ms since start) in which the guest is due. The thief comes around the middle. */
export function guestWindow(guest: GuestKind, durationMs: number): [number, number] {
  const latest = durationMs - GUEST_CUTOFF_MS - 2000;
  if (guest === 'thief') return [durationMs * 0.4, Math.min(latest, durationMs * 0.55)];
  return [Math.min(latest, 4000), Math.min(latest, durationMs * 0.55)];
}

export function pickGuestTime(guest: GuestKind, durationMs: number, rand: Rand): number {
  const [a, b] = guestWindow(guest, durationMs);
  return Math.round(a + (b - a) * rand());
}

export interface SpawnState {
  playMs: number;
  timeLeft: number;
  alive: number;
  guestDueAt: number;
  guestSpawned: boolean;
  /** A special visitor is on screen right now. */
  guestOnScreen: boolean;
}

export function guestMaySpawn(cfg: Pick<LevelConfig, 'guest' | 'maxAlive'>, s: SpawnState): boolean {
  return (
    cfg.guest !== null &&
    !s.guestSpawned &&
    !s.guestOnScreen &&
    s.playMs >= s.guestDueAt &&
    s.timeLeft > GUEST_CUTOFF_MS &&
    s.alive < cfg.maxAlive
  );
}

export type SpawnPick = { type: 'guest'; guest: GuestKind } | { type: 'normal'; kind: BaseKind; sleepy: boolean };

/** Called on a spawn tick that already has room under maxAlive. */
export function pickSpawn(cfg: LevelConfig, s: SpawnState, rand: Rand): SpawnPick {
  if (guestMaySpawn(cfg, s)) return { type: 'guest', guest: cfg.guest! };
  if (cfg.isNap && rand() < NAP_SLEEPY_SHARE) return { type: 'normal', kind: 'fly', sleepy: true };
  return { type: 'normal', kind: rollKind(cfg, rand(), !cfg.isSuper), sleepy: false };
}

/** Height farthest from everyone else, so the squeaker keeps to itself. */
export function quietLane(ys: readonly number[], top: number, bottom: number, step = 20): number {
  let best = (top + bottom) / 2;
  let bestD = -1;
  for (let y = top; y <= bottom; y += step) {
    let d = Infinity;
    for (const o of ys) d = Math.min(d, Math.abs(o - y));
    if (d > bestD) {
      bestD = d;
      best = y;
    }
  }
  return best;
}

/** A free spot for a dozing fly: far from the others, inside the reachable band. */
export function quietSpot(
  others: readonly { x: number; y: number }[],
  box: { left: number; right: number; top: number; bottom: number },
  rand: Rand,
  tries = 14,
): { x: number; y: number } {
  let best = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
  let bestD = -1;
  for (let i = 0; i < tries; i++) {
    const p = { x: box.left + (box.right - box.left) * rand(), y: box.top + (box.bottom - box.top) * rand() };
    let d = Infinity;
    for (const o of others) d = Math.min(d, Math.hypot(o.x - p.x, o.y - p.y));
    if (d > bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
