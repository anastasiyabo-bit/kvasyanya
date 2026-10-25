import { isSuperLevel, levelPlan, type GuestKind, type LevelKind, type Novelty } from './schedule';

export { isSuperLevel, isRaceLevel, isNapLevel, levelPlan } from './schedule';
export type { GuestKind, LevelKind, Novelty } from './schedule';

export interface LevelConfig {
  level: number;
  kind: LevelKind;
  isSuper: boolean;
  isRace: boolean;
  isNap: boolean;
  /** The one special visitor of a guest level. */
  guest: GuestKind | null;
  intro: Novelty | null;
  duration: number;
  minCatch: number;
  spawnInterval: number;
  maxAlive: number;
  speedMin: number;
  speedMax: number;
  mosquitoChance: number;
  fatChance: number;
  goldChance: number;
  starScores: [number, number, number];
  superThreshold: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function getLevelConfig(level: number): LevelConfig {
  const n = Math.max(1, Math.floor(level));
  const plan = levelPlan(n);
  const isSuper = isSuperLevel(n);

  const duration = 30;

  let minCatch = clamp(Math.round(8 + (n - 1) * 0.9), 8, 32);
  if (isSuper && minCatch % 2 === 1) minCatch += 1;

  const spawnInterval = clamp(Math.round(1300 - n * 45), 440, 1300) * (isSuper ? 1.7 : 1);
  const maxAlive = clamp(3 + Math.floor(n / 3), 3, 8) + (isSuper ? 2 : 0);
  const speedMin = clamp(110 + n * 7, 110, 290);
  const speedMax = speedMin + clamp(40 + n * 4, 40, 120);

  const s1 = minCatch * 100;
  const starScores: [number, number, number] = [s1, Math.round(s1 * 1.6), Math.round(s1 * 2.2)];

  return {
    level: n,
    kind: plan.kind,
    isSuper,
    isRace: plan.kind === 'race',
    isNap: plan.kind === 'nap',
    guest: plan.guest,
    intro: plan.intro,
    duration,
    minCatch,
    spawnInterval: Math.round(spawnInterval),
    maxAlive,
    speedMin,
    speedMax,
    mosquitoChance: clamp(0.05 + n * 0.03, 0.05, 0.5),
    fatChance: n < 2 ? 0 : 0.12,
    goldChance: n < 3 ? 0 : 0.05,
    starScores,
    superThreshold: Math.round(s1 * 1.15),
  };
}

export interface LevelOutcome {
  won: boolean;
  stars: 0 | 1 | 2 | 3;
  reason: 'ok' | 'min' | 'threshold' | 'race';
}

/** Race lead needed for 1, 2 and 3 stars. */
export const RACE_STAR_LEADS = [1, 3, 5] as const;

export function raceStars(lead: number): 0 | 1 | 2 | 3 {
  if (lead >= RACE_STAR_LEADS[2]) return 3;
  if (lead >= RACE_STAR_LEADS[1]) return 2;
  if (lead >= RACE_STAR_LEADS[0]) return 1;
  return 0;
}

/** Strictly more catches than Klesha wins; a tie is hers. */
export function evaluateRace(caught: number, rivalCaught: number): LevelOutcome {
  const stars = raceStars(caught - rivalCaught);
  if (stars === 0) return { won: false, stars: 0, reason: 'race' };
  return { won: true, stars, reason: 'ok' };
}

export function evaluateLevel(cfg: LevelConfig, score: number, caught: number, rivalCaught = 0): LevelOutcome {
  if (cfg.isRace) return evaluateRace(caught, rivalCaught);
  if (caught < cfg.minCatch) return { won: false, stars: 0, reason: 'min' };
  if (cfg.isSuper && score < cfg.superThreshold) return { won: false, stars: 0, reason: 'threshold' };
  let stars: 1 | 2 | 3 = 1;
  if (score >= cfg.starScores[1]) stars = 2;
  if (score >= cfg.starScores[2]) stars = 3;
  return { won: true, stars, reason: 'ok' };
}

export function superMultiplier(cfg: LevelConfig, score: number): number {
  if (!cfg.isSuper || cfg.superThreshold <= 0) return 1;
  const over = score / cfg.superThreshold - 1;
  if (over >= 0.6) return 2;
  if (over >= 0.3) return 1.5;
  if (over >= 0.1) return 1.25;
  return 1;
}

export const EAT_POINTS = 100;
export const LICK_POINTS = 100;
export const PAIR_BONUS = 150;
export const COMBO_WINDOW_MS = 1500;

export function comboMultiplier(combo: number): number {
  return 1 + 0.1 * clamp(combo - 1, 0, 10);
}

/** 0..4. Scaled to the level's quota so the frog gets really round only near the end of a good run. */
export function fatTier(eaten: number, minCatch = 10): number {
  const step = Math.max(3, Math.round(minCatch * 0.45));
  return clamp(Math.floor(eaten / step), 0, 4);
}
