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
export const FIREFLY_PERIOD_MS = 1000;
export const FIREFLY_LIT_MS = 420;
/** A lick still counts as a catch, but pays this share of a swallow. */
export const LICK_POINT_SHARE = 0.25;

export interface TouchResult {
  /** Insect counted toward the quota and the caught counter. */
  caught: number;
  points: number;
  comboReset: boolean;
  /** Tongue goes out and grabs or licks it. */
  tongue: boolean;
  numbMs: number;
  chewMs: number;
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
  const share = zone === 'lick' ? LICK_POINT_SHARE : 1;
  const normal: TouchResult = { ...NOTHING, caught: 1, points: Math.round(base * share * mult), tongue: true };
  switch (kind) {
    case 'wasp':
      if (zone === 'eat') return { ...NOTHING, comboReset: true, tongue: true, numbMs: WASP_NUMB_MS };
      return normal;
    case 'glutton':
      if (zone === 'eat') {
        return { ...normal, caught: GLUTTON_MULT, points: Math.round(base * GLUTTON_MULT * mult), chewMs: GLUTTON_CHEW_MS };
      }
      return normal;
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

/** A dropped candy: tossed up and away from the middle, then falls spinning until it leaves the screen. */
export interface CandyFall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Degrees. */
  angle: number;
  /** Degrees per second. */
  spin: number;
}

export const CANDY_TOSS_VY = -170;
export const CANDY_DRIFT_VX = 70;
export const CANDY_GRAVITY = 300;
/** Slow enough to tap on a phone, fast enough to keep the level moving. */
export const CANDY_MAX_FALL = 200;
export const CANDY_SPIN = 320;
/** Finger-sized: a little more than the drawn candy. */
export const CANDY_TAP_R = 100;
const CANDY_OFF = 90;

export function tossCandy(x: number, y: number, screenW: number): CandyFall {
  const away = x < screenW / 2 ? -1 : 1;
  return { x, y, vx: CANDY_DRIFT_VX * away, vy: CANDY_TOSS_VY, angle: 0, spin: CANDY_SPIN * away };
}

export function stepCandy(c: CandyFall, dtMs: number): CandyFall {
  const dt = dtMs / 1000;
  const vy = Math.min(CANDY_MAX_FALL, c.vy + CANDY_GRAVITY * dt);
  return { ...c, x: c.x + c.vx * dt, y: c.y + vy * dt, vy, angle: c.angle + c.spin * dt };
}

/** Out past an edge: it is simply gone, no penalty. */
export function candyGone(c: CandyFall, screenW: number, screenH: number): boolean {
  return c.y > screenH + CANDY_OFF || c.x < -CANDY_OFF || c.x > screenW + CANDY_OFF;
}

export function candyTapped(c: CandyFall, px: number, py: number): boolean {
  return Math.hypot(c.x - px, c.y - py) <= CANDY_TAP_R;
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
  candy: 'Лизни — конфета выпадет.\nТапни её: +4 сек!',
  wasp: 'Осу — только липни',
  squeaker: 'Этого не трогай!',
  thief: 'Воришка! Не дай ей улететь',
  glutton: 'Обжорка: съешь — сразу ×3!',
  firefly: 'Лови, когда светится!',
  nap: 'Тихий час! Лови сонь,\nпока не проснулись',
};
