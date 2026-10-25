/** Flight paths and the little wing-beat twitch. Pure, display pixels. */

import type { Rand } from './spawn';

export interface FlightPattern {
  /** Height of the arc either way, px. Near zero is an almost straight line. */
  amp: number;
  periodMs: number;
  /** Radians. */
  phase: number;
}

/** Bands keep neighbours visibly apart: from almost straight to a deep swoop. */
export const AMP_BANDS: readonly [number, number][] = [
  [3, 8],
  [16, 30],
  [38, 60],
  [70, 105],
];
export const PERIOD_BANDS: readonly [number, number][] = [
  [800, 1200],
  [1450, 2000],
  [2300, 3300],
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Hands out patterns so that the next insect never shares the arc size band or the
 * rhythm band of the previous one, nor the exact combination of the last few.
 */
export class FlightDeck {
  private recent: [number, number][] = [];

  constructor(private readonly memory = 3) {}

  next(rand: Rand): FlightPattern {
    const last = this.recent[this.recent.length - 1];
    const options: [number, number][] = [];
    for (let a = 0; a < AMP_BANDS.length; a++) {
      for (let p = 0; p < PERIOD_BANDS.length; p++) {
        if (last && (a === last[0] || p === last[1])) continue;
        if (this.recent.some(([ra, rp]) => ra === a && rp === p)) continue;
        options.push([a, p]);
      }
    }
    const [a, p] = options[Math.min(options.length - 1, Math.floor(rand() * options.length))];
    this.recent.push([a, p]);
    if (this.recent.length > this.memory) this.recent.shift();
    const [a0, a1] = AMP_BANDS[a];
    const [p0, p1] = PERIOD_BANDS[p];
    return { amp: lerp(a0, a1, rand()), periodMs: lerp(p0, p1, rand()), phase: rand() * Math.PI * 2 };
  }
}

/** Keeps the whole arc inside [top, bottom] so the tongue can always reach it. */
export function fitFlight(baseY: number, amp: number, top: number, bottom: number): { baseY: number; amp: number } {
  const a = Math.max(0, Math.min(amp, (bottom - top) / 2));
  return { baseY: Math.max(top + a, Math.min(bottom - a, baseY)), amp: a };
}

/**
 * Flight line that keeps the whole insect (it reaches `reach` px above its centre) under
 * `ceiling`, still inside the band. A banner on screen sets the ceiling.
 */
export function underCeiling(
  baseY: number,
  amp: number,
  reach: number,
  ceiling: number,
  bottom: number,
): { baseY: number; amp: number } {
  return fitFlight(baseY, amp, Math.min(bottom, ceiling + reach), bottom);
}

/** Moves `from` toward `to` by at most `maxStep`. */
export function approach(from: number, to: number, maxStep: number): number {
  if (Math.abs(to - from) <= maxStep) return to;
  return from + Math.sign(to - from) * maxStep;
}

export function flightOffset(p: FlightPattern, tMs: number): number {
  return Math.sin((tMs / p.periodMs) * Math.PI * 2 + p.phase) * p.amp;
}

/** Body tilt follows the climb or dive of the path, so a straight flyer stays level. */
export function flightTilt(p: FlightPattern, tMs: number, speed: number): number {
  const vy = Math.cos((tMs / p.periodMs) * Math.PI * 2 + p.phase) * p.amp * ((Math.PI * 2) / p.periodMs) * 1000;
  const deg = (Math.atan2(vy, Math.max(60, Math.abs(speed))) * 180) / Math.PI;
  return Math.max(-14, Math.min(14, deg * 0.6));
}

/** Biggest twitch on a wing beat, px. */
export const FLAP_JITTER_MAX = 4;
export const FLAP_JITTER_MS = 55;

/**
 * Shift on each wing frame change: the downstroke pops the body up a little,
 * the upstroke lets it sink back. Position only, never scale.
 */
export function flapJitter(frame: number, seed: number): { dx: number; dy: number } {
  const s = Math.sin(seed * 12.9898 + frame * 78.233) * 43758.5453;
  const r = s - Math.floor(s);
  const dx = (r - 0.5) * 2;
  const dy = frame === 1 ? -3 : 1.5;
  return { dx, dy };
}

/** Twitch weight `ms` after the frame change: full at once, gone after FLAP_JITTER_MS. */
export function jitterFade(ms: number): number {
  if (ms <= 0) return 1;
  if (ms >= FLAP_JITTER_MS) return 0;
  return 1 - ms / FLAP_JITTER_MS;
}
