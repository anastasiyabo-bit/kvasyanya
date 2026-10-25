import { describe, expect, it } from 'vitest';
import { INSECT_BOTTOM, INSECT_TOP } from '../src/config';
import {
  AMP_BANDS,
  FLAP_JITTER_MAX,
  FlightDeck,
  fitFlight,
  flapJitter,
  flightOffset,
  jitterFade,
} from '../src/data/flight';

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('flight patterns', () => {
  it('two insects created one after another differ in arc size and rhythm', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const deck = new FlightDeck();
      const rand = seeded(seed);
      let prev = deck.next(rand);
      for (let i = 0; i < 30; i++) {
        const next = deck.next(rand);
        expect(Math.abs(next.amp - prev.amp)).toBeGreaterThan(5);
        expect(Math.abs(next.periodMs - prev.periodMs)).toBeGreaterThan(200);
        prev = next;
      }
    }
  });

  it('covers everything from an almost straight line to a deep arc', () => {
    const deck = new FlightDeck();
    const rand = seeded(7);
    const amps = Array.from({ length: 200 }, () => deck.next(rand).amp);
    expect(Math.min(...amps)).toBeLessThan(AMP_BANDS[0][1]);
    expect(Math.max(...amps)).toBeGreaterThan(AMP_BANDS[3][0]);
  });

  it('phases are spread, so neighbours do not swing in step', () => {
    const deck = new FlightDeck();
    const rand = seeded(11);
    const phases = Array.from({ length: 20 }, () => deck.next(rand).phase);
    expect(new Set(phases.map((p) => Math.round(p * 10))).size).toBeGreaterThan(12);
  });

  it('the whole arc stays inside the reachable band', () => {
    const deck = new FlightDeck();
    const rand = seeded(3);
    for (let i = 0; i < 300; i++) {
      const p = deck.next(rand);
      const y = INSECT_TOP + 40 + (INSECT_BOTTOM - INSECT_TOP - 80) * rand();
      const fit = fitFlight(y, p.amp, INSECT_TOP, INSECT_BOTTOM);
      const f = { ...p, amp: fit.amp };
      for (let t = 0; t < 4000; t += 50) {
        const yy = fit.baseY + flightOffset(f, t);
        expect(yy).toBeGreaterThanOrEqual(INSECT_TOP - 1e-6);
        expect(yy).toBeLessThanOrEqual(INSECT_BOTTOM + 1e-6);
      }
    }
  });

  it('the wing-beat twitch is a small shift that differs between wings up and down, and dies out fast', () => {
    for (let seed = 1; seed < 50; seed++) {
      const up = flapJitter(0, seed);
      const down = flapJitter(1, seed);
      for (const j of [up, down]) {
        expect(Math.abs(j.dx)).toBeLessThanOrEqual(FLAP_JITTER_MAX);
        expect(Math.abs(j.dy)).toBeLessThanOrEqual(FLAP_JITTER_MAX);
        expect(Object.keys(j).sort()).toEqual(['dx', 'dy']);
      }
      expect(down.dy).not.toBe(up.dy);
    }
    expect(jitterFade(0)).toBe(1);
    expect(jitterFade(200)).toBe(0);
  });
});
