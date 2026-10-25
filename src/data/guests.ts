/** What touching each visitor does. Pure rules; the scene only plays them out. */

import type { GuestKind, Novelty } from './schedule';

export type BaseKind = 'fly' | 'mosquito' | 'fat' | 'gold';
export type InsectKind = BaseKind | 'sleepy' | GuestKind;
export type TapZone = 'eat' | 'lick';

export const CANDY_BONUS_MS = 4000;
export const WASP_NUMB_MS = 1000;
export const GLUTTON_CHEW_MS = 1500;
export const GLUTTON_MULT = 3;
export const SQUEAK_QUIET_MS = 2000;
export const SLEEP_MS = 2000;
export const WAKE_SPEED_MUL = 2.4;
export const CALLER_FRIENDS = 2;
export const CALLER_FRIEND_DELAYS = [900, 1500] as const;
export const CALLER_FRIEND_SPEED = 0.55;
export const FIREFLY_PERIOD_MS = 1000;
export const FIREFLY_LIT_MS = 420;

export interface TouchResult {
  /** Insect counted toward the quota and the caught counter. */
  caught: number;
  points: number;
  comboReset: boolean;
  /** Tongue goes out and grabs or licks it. */
  tongue: boolean;
  numbMs: number;
  chewMs: number;
  friends: number;
  dropCandy: boolean;
  /** Squeaker: everyone on screen flees, nothing spawns for a while. */
  scatterMs: number;
  /** Only this insect flies off, nothing else happens. */
  spook: boolean;
}

const NOTHING: TouchResult = {
  caught: 0,
  points: 0,
  comboReset: false,
  tongue: false,
  numbMs: 0,
  chewMs: 0,
  friends: 0,
  dropCandy: false,
  scatterMs: 0,
  spook: false,
};

/**
 * Resolves a tap on an insect.
 * `base` is the kind's points, `mult` the combo multiplier the catch would get.
 * `lit` matters for the firefly only.
 */
export function touchInsect(kind: InsectKind, zone: TapZone, base: number, mult: number, lit = true): TouchResult {
  const normal: TouchResult = { ...NOTHING, caught: 1, points: Math.round(base * mult), tongue: true };
  switch (kind) {
    case 'wasp':
      if (zone === 'eat') return { ...NOTHING, comboReset: true, tongue: true, numbMs: WASP_NUMB_MS };
      return normal;
    case 'glutton':
      if (zone === 'eat') {
        return { ...normal, caught: GLUTTON_MULT, points: Math.round(base * GLUTTON_MULT * mult), chewMs: GLUTTON_CHEW_MS };
      }
      return normal;
    case 'caller':
      return zone === 'lick' ? { ...normal, friends: CALLER_FRIENDS } : normal;
    case 'candy':
      return zone === 'lick' ? { ...normal, dropCandy: true } : normal;
    case 'squeaker':
      return { ...NOTHING, comboReset: true, scatterMs: SQUEAK_QUIET_MS };
    case 'firefly':
      return lit ? normal : { ...NOTHING, spook: true };
    default:
      return normal;
  }
}

/** The falling candy buys time and nothing else. */
export function collectCandy(s: { timeLeft: number; caught: number }): { timeLeft: number; caught: number } {
  return { timeLeft: s.timeLeft + CANDY_BONUS_MS, caught: s.caught };
}

/** The thief got away with one catch. Points already earned stay. */
export function thiefEscape(caught: number): number {
  return Math.max(0, caught - 1);
}

export function fireflyLit(tMs: number, phaseMs = 0): boolean {
  const t = (((tMs + phaseMs) % FIREFLY_PERIOD_MS) + FIREFLY_PERIOD_MS) % FIREFLY_PERIOD_MS;
  return t < FIREFLY_LIT_MS;
}

/** 0..1 glow for drawing; quick rise, short hold, softer fade. Brightness only. */
export function fireflyGlow(tMs: number, phaseMs = 0): number {
  const t = (((tMs + phaseMs) % FIREFLY_PERIOD_MS) + FIREFLY_PERIOD_MS) % FIREFLY_PERIOD_MS;
  if (t < 80) return t / 80;
  if (t < FIREFLY_LIT_MS - 60) return 1;
  if (t < FIREFLY_LIT_MS + 120) return Math.max(0, 1 - (t - (FIREFLY_LIT_MS - 60)) / 180);
  return 0;
}

/** One-line rule shown the first time the player meets it. */
export const RULE_LINES: Record<Novelty, string> = {
  candy: 'Лизни — уронит конфетку!\nТапни конфетку: +4 сек',
  wasp: 'Осу — только липни',
  squeaker: 'Этого не трогай!',
  thief: 'Воришка! Не дай ей улететь',
  glutton: 'Обжорка: съешь — сразу ×3!',
  firefly: 'Лови, когда светится!',
  caller: 'Лизни зазывалу —\nпозовёт подружек!',
  nap: 'Тихий час! Лови сонь,\nпока не проснулись',
};
