/** Who appears next. Pure; the scene passes in counts and a random source. */

import type { LevelConfig } from './levels';
import type { GuestKind } from './schedule';
import { PAIR_KINDS, type FlyerKind, type MixSlot } from './species';

export type Rand = () => number;

/** No new guest when this little time is left. One already flying finishes on its own. */
export const GUEST_CUTOFF_MS = 5000;
export const NAP_SLEEPY_SHARE = 0.5;
/** A freshly met kind not seen by this share of the level is sent in right away. */
export const FRESH_DUE_SHARE = 0.25;
/** Any kind of the level not seen by this share of the level is sent in right away. */
export const KIND_DUE_SHARE = 0.45;
/** Super levels: share of spawns that are a lone special instead of a pair. */
export const SUPER_SOLO_SHARE = 0.22;

export type KindCounts = Partial<Record<FlyerKind, number>>;

const countOf = (c: KindCounts, k: FlyerKind) => c[k] ?? 0;

/** Weighted roll over the slots that still have room under their cap. */
export function rollMix(slots: readonly MixSlot[], counts: KindCounts, r: number): FlyerKind | null {
  const open = slots.filter((s) => countOf(counts, s.kind) < s.cap);
  const total = open.reduce((a, s) => a + s.weight, 0);
  if (total <= 0) return null;
  let x = r * total;
  for (const s of open) {
    x -= s.weight;
    if (x < 0) return s.kind;
  }
  return open[open.length - 1].kind;
}

/** A kind of the level that has not flown yet and is overdue. Fresh kinds are due earlier. */
export function overdueKind(slots: readonly MixSlot[], counts: KindCounts, playMs: number, durationMs: number): FlyerKind | null {
  for (const s of slots) {
    if (countOf(counts, s.kind) > 0 || s.cap <= 0) continue;
    const due = durationMs * (s.fresh ? FRESH_DUE_SHARE : KIND_DUE_SHARE);
    if (playMs >= due) return s.kind;
  }
  return null;
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
  /** Regular insects already sent in this level, by kind (a pair counts as two). */
  counts: KindCounts;
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

export type SpawnPick =
  | { type: 'guest'; guest: GuestKind }
  | { type: 'normal'; kind: FlyerKind }
  | { type: 'pair'; kind: FlyerKind };

/** Called on a spawn tick that already has room under maxAlive. */
export function pickSpawn(cfg: LevelConfig, s: SpawnState, rand: Rand): SpawnPick {
  if (cfg.isSuper) return pickSuper(cfg, s, rand);
  if (guestMaySpawn(cfg, s)) return { type: 'guest', guest: cfg.guest! };
  const late = overdueKind(cfg.mix, s.counts, s.playMs, cfg.duration * 1000);
  if (late) return { type: 'normal', kind: late };
  if (cfg.isNap && rand() < NAP_SLEEPY_SHARE) return { type: 'normal', kind: 'sleepy' };
  return { type: 'normal', kind: rollMix(cfg.mix, s.counts, rand()) ?? 'fly' };
}

/** Super levels fly in pairs; gold and sleepy flies come alone now and then, so it is not all grey. */
function pickSuper(cfg: LevelConfig, s: SpawnState, rand: Rand): SpawnPick {
  const pairs = cfg.mix.filter((m) => PAIR_KINDS.includes(m.kind));
  const solos = cfg.mix.filter((m) => !PAIR_KINDS.includes(m.kind));
  const late = overdueKind(cfg.mix, s.counts, s.playMs, cfg.duration * 1000);
  if (late) return solos.some((m) => m.kind === late) ? { type: 'normal', kind: late } : { type: 'pair', kind: late };
  if (solos.length && rand() < SUPER_SOLO_SHARE) {
    const solo = rollMix(solos, s.counts, rand());
    if (solo) return { type: 'normal', kind: solo };
  }
  return { type: 'pair', kind: rollMix(pairs, s.counts, rand()) ?? 'fly' };
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
