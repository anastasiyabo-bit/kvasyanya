/** Which regular insects fly on a level and how often. Pure; guests come from the calendar. */

import type { BaseKind } from './guests';
import { levelPlan, type LevelKind } from './schedule';

export type FlyerKind = BaseKind | 'sleepy';

/** First level each regular insect flies on. The zoo opens a little at a time. */
export const KIND_UNLOCK: Record<FlyerKind, number> = {
  fly: 1,
  gold: 2,
  sleepy: 4,
  mosquito: 6,
  fat: 7,
};

/** On its first levels a new kind shows up once or twice, never more. */
export const NEW_KIND_LEVELS = 2;
export const NEW_KIND_CAP = 2;
/** Gold stays a treat even later on. */
export const GOLD_CAP = 3;
/** Quiet hour: share of spawns that are sleepy flies. */
export const NAP_SLEEPY_SHARE = 0.5;

export interface MixSlot {
  kind: FlyerKind;
  /** Relative chance on a spawn tick. */
  weight: number;
  /** Most of this kind per level. */
  cap: number;
  /** Met only a level or two ago. */
  fresh: boolean;
}

const ORDER: readonly FlyerKind[] = ['fly', 'gold', 'sleepy', 'mosquito', 'fat'];
const SPECIALS: readonly FlyerKind[] = ['gold', 'sleepy', 'mosquito', 'fat'];

export function unlockedKinds(level: number): FlyerKind[] {
  return ORDER.filter((k) => KIND_UNLOCK[k] <= level);
}

export function isFreshKind(kind: FlyerKind, level: number): boolean {
  const u = KIND_UNLOCK[kind];
  return level >= u && level - u < NEW_KIND_LEVELS;
}

/** How many different insects the level shows, guest included. */
export function varietyTarget(level: number): number {
  if (level < 6) return unlockedKinds(level).length;
  return level < 12 ? 3 : 4;
}

/** Full-grown chance of each kind. The sleepy and the fat fly are met equally often. */
export const MATURE_WEIGHT: Record<FlyerKind, number> = { fly: 1, gold: 0.09, sleepy: 0.24, mosquito: 0.5, fat: 0.24 };

function weightOf(kind: FlyerKind, level: number): number {
  const age = level - KIND_UNLOCK[kind];
  switch (kind) {
    case 'fly':
      return 1;
    case 'gold':
      return Math.min(MATURE_WEIGHT.gold, 0.06 + age * 0.002);
    case 'sleepy':
    case 'fat':
      return Math.min(MATURE_WEIGHT[kind], 0.14 + age * 0.006);
    case 'mosquito':
      return Math.min(MATURE_WEIGHT.mosquito, 0.22 + age * 0.012);
  }
}

/** Cheap stable key, only to break ties between equally due kinds. */
function hash(level: number, kind: FlyerKind): number {
  const s = Math.sin(level * 12.9898 + ORDER.indexOf(kind) * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** Share of a level's spawns each kind gets, quiet hour included. */
export function kindShares(mix: readonly MixSlot[], kind: LevelKind): Partial<Record<FlyerKind, number>> {
  const total = mix.reduce((a, s) => a + s.weight, 0);
  const nap = kind === 'nap';
  const out: Partial<Record<FlyerKind, number>> = {};
  for (const s of mix) {
    let share = s.weight / total;
    if (nap) share = share * (1 - NAP_SLEEPY_SHARE) + (s.kind === 'sleepy' ? NAP_SLEEPY_SHARE : 0);
    // A fresh kind flies once or twice whatever its odds.
    if (s.fresh) share = Math.min(share, s.cap / 25);
    out[s.kind] = share;
  }
  return out;
}

/**
 * Meetings so far, per kind, measured against the kind's full-grown share, over levels
 * 1..n-1. The kind that is most behind gets the next free place in the company, so over
 * the levels every special is met about as often as its odds say (quiet hours included).
 */
const met: Record<FlyerKind, number>[] = [{ fly: 0, gold: 0, sleepy: 0, mosquito: 0, fat: 0 }];
const mixCache: MixSlot[][] = [[]];

function metBefore(level: number): Record<FlyerKind, number> {
  while (met.length < level) {
    const n = met.length;
    const plan = levelPlan(n);
    const mix = buildMix(n, plan.kind, plan.guest !== null, met[n - 1]);
    mixCache[n] = mix;
    const shares = kindShares(mix, plan.kind);
    const next = { ...met[n - 1] };
    for (const k of SPECIALS) next[k] += (shares[k] ?? 0) / (MATURE_WEIGHT[k] / (1 + MATURE_WEIGHT[k]));
    met.push(next);
  }
  return met[level - 1];
}

function buildMix(n: number, kind: LevelKind, hasGuest: boolean, seen: Record<FlyerKind, number>): MixSlot[] {
  const open = unlockedKinds(n);
  const want = Math.max(1, Math.min(open.length, varietyTarget(n) - (hasGuest ? 1 : 0)));
  const pick: FlyerKind[] = ['fly'];
  const must = open.filter(
    (k) =>
      k !== 'fly' &&
      (isFreshKind(k, n) ||
        (kind === 'nap' && k === 'sleepy') ||
        (kind === 'super' && k === 'mosquito') ||
        (kind === 'race' && (k === 'gold' || k === 'sleepy'))),
  );
  for (const k of must) if (!pick.includes(k)) pick.push(k);
  const rest = open
    .filter((k) => !pick.includes(k))
    .sort((a, b) => seen[a] - seen[b] || hash(n, a) - hash(n, b));
  for (const k of rest) {
    if (pick.length >= Math.max(want, 2)) break;
    pick.push(k);
  }
  return ORDER.filter((k) => pick.includes(k)).map((k) => {
    const fresh = isFreshKind(k, n) && k !== 'fly';
    const cap = fresh ? NEW_KIND_CAP : k === 'gold' ? GOLD_CAP : Infinity;
    return { kind: k, weight: fresh ? Math.min(weightOf(k, n), 0.12) : weightOf(k, n), cap, fresh };
  });
}

/**
 * The regular insects of a level. Ordinary flies always fly; freshly met kinds are
 * always in; a race always brings the gold and sleepy flies the player has met; the
 * rest of the company goes to the kinds met least so far, so that with the guest
 * there are 3–4 different insects (fewer only on the very first levels).
 */
export function levelMix(level: number): MixSlot[] {
  const n = Math.max(1, Math.floor(level));
  metBefore(n + 1);
  return mixCache[n].map((s) => ({ ...s }));
}

/** Kinds that can fly as a super-level pair. The rest come alone. */
export const PAIR_KINDS: readonly FlyerKind[] = ['fly', 'mosquito', 'fat'];
