/** Which regular insects fly on a level and how often. Pure; guests come from the calendar. */

import type { BaseKind } from './guests';
import type { LevelKind } from './schedule';

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

function weightOf(kind: FlyerKind, level: number): number {
  const age = level - KIND_UNLOCK[kind];
  switch (kind) {
    case 'fly':
      return 1;
    case 'gold':
      return Math.min(0.09, 0.06 + age * 0.002);
    case 'sleepy':
      return Math.min(0.24, 0.14 + age * 0.006);
    case 'mosquito':
      return Math.min(0.5, 0.22 + age * 0.012);
    case 'fat':
      return Math.min(0.26, 0.15 + age * 0.006);
  }
}

/** Cheap stable shuffle key, so neighbouring levels pick different company. */
function hash(level: number, kind: FlyerKind): number {
  const s = Math.sin(level * 12.9898 + ORDER.indexOf(kind) * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * The regular insects of a level. Ordinary flies always fly; freshly met kinds are
 * always in; a race always brings the gold and sleepy flies the player has met; the
 * rest of the company is picked per level so that, with the guest, there are 3–4
 * different insects (fewer only on the very first levels).
 */
export function levelMix(level: number, kind: LevelKind, hasGuest: boolean): MixSlot[] {
  const n = Math.max(1, Math.floor(level));
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
  const rest = open.filter((k) => !pick.includes(k)).sort((a, b) => hash(n, a) - hash(n, b));
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

/** Kinds that can fly as a super-level pair. The rest come alone. */
export const PAIR_KINDS: readonly FlyerKind[] = ['fly', 'mosquito', 'fat'];
