/** Which event a level number gets. Pure, so the whole calendar is covered by tests. */

export type GuestKind = 'candy' | 'wasp' | 'squeaker' | 'thief' | 'glutton' | 'firefly' | 'caller';
export type LevelKind = 'super' | 'race' | 'nap' | 'guest' | 'normal';
/** Something with a one-time rule line for the player. */
export type Novelty = GuestKind | 'nap';

export interface LevelPlan {
  level: number;
  kind: LevelKind;
  guest: GuestKind | null;
  /** Set on the level where this rule is met for the first time. */
  intro: Novelty | null;
}

export const RACE_EVERY = 8;
export const NAP_FIRST = 19;
/** Gaps between quiet-hour levels before they dodge super and race numbers. */
const NAP_STEPS = [7, 6, 8, 7] as const;

/** First meetings, skipping super and race numbers. */
export const INTRO_LEVELS: readonly { level: number; what: Novelty }[] = [
  { level: 4, what: 'candy' },
  { level: 7, what: 'wasp' },
  { level: 9, what: 'squeaker' },
  { level: 11, what: 'thief' },
  { level: 13, what: 'glutton' },
  { level: 17, what: 'firefly' },
  { level: 18, what: 'caller' },
  { level: 19, what: 'nap' },
];
const LAST_INTRO = INTRO_LEVELS[INTRO_LEVELS.length - 1].level;

export const GUEST_ROTATION: readonly GuestKind[] = ['candy', 'wasp', 'squeaker', 'thief', 'glutton', 'firefly', 'caller'];

export function isSuperLevel(level: number): boolean {
  return level > 0 && level % 5 === 0;
}

/** Race k lands on 8k, or on the next number when 8k is a super level. */
export function raceSlot(k: number): number {
  let n = k * RACE_EVERY;
  while (isSuperLevel(n)) n++;
  return n;
}

export function isRaceLevel(level: number): boolean {
  if (level < RACE_EVERY || isSuperLevel(level)) return false;
  return raceSlot(Math.floor(level / RACE_EVERY)) === level;
}

const taken = (n: number) => isSuperLevel(n) || isRaceLevel(n);

function nextFree(n: number): number {
  while (taken(n)) n++;
  return n;
}

const napCache: number[] = [NAP_FIRST];

export function isNapLevel(level: number): boolean {
  if (level < NAP_FIRST) return false;
  while (napCache[napCache.length - 1] < level) {
    const prev = napCache[napCache.length - 1];
    napCache.push(nextFree(prev + NAP_STEPS[(napCache.length - 1) % NAP_STEPS.length]));
  }
  return napCache.includes(level);
}

/** Free = no super, race or quiet hour. Guests live only on free levels. */
export function isFreeLevel(level: number): boolean {
  return level >= 1 && !taken(level) && !isNapLevel(level);
}

/** Ordinal of a free level after the intro run, or -1. */
const freeOrdinals = new Map<number, number>();
let ordinalScan = LAST_INTRO;
let ordinalNext = 0;

function freeOrdinal(level: number): number {
  while (ordinalScan < level) {
    ordinalScan++;
    if (isFreeLevel(ordinalScan)) freeOrdinals.set(ordinalScan, ordinalNext++);
  }
  return freeOrdinals.get(level) ?? -1;
}

export function levelPlan(level: number): LevelPlan {
  const n = Math.max(1, Math.floor(level));
  const intro = INTRO_LEVELS.find((i) => i.level === n)?.what ?? null;
  if (isSuperLevel(n)) return { level: n, kind: 'super', guest: null, intro: null };
  if (isRaceLevel(n)) return { level: n, kind: 'race', guest: null, intro: null };
  if (isNapLevel(n)) return { level: n, kind: 'nap', guest: null, intro };
  if (n <= LAST_INTRO) {
    if (intro && intro !== 'nap') return { level: n, kind: 'guest', guest: intro, intro };
    return { level: n, kind: 'normal', guest: null, intro: null };
  }
  const ord = freeOrdinal(n);
  // Every second free level hosts a guest, so plain levels sit between them.
  if (ord >= 0 && ord % 2 === 0) {
    return { level: n, kind: 'guest', guest: GUEST_ROTATION[(ord / 2) % GUEST_ROTATION.length], intro: null };
  }
  return { level: n, kind: 'normal', guest: null, intro: null };
}
