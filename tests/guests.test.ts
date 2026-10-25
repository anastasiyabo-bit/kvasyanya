import { describe, expect, it } from 'vitest';
import {
  CANDY_BONUS_MS,
  CANDY_MAX_FALL,
  CANDY_TAP_R,
  GLUTTON_CHEW_MS,
  RULE_LINES,
  WASP_NUMB_MS,
  candyGone,
  candyTapped,
  collectCandy,
  fireflyGlow,
  fireflyLit,
  stepCandy,
  thiefEscape,
  tossCandy,
  touchInsect,
} from '../src/data/guests';

describe('guest rules', () => {
  it('candy gives +4 seconds and no catch', () => {
    const before = { timeLeft: 12_000, caught: 7 };
    const after = collectCandy(before);
    expect(after.timeLeft).toBe(before.timeLeft + 4000);
    expect(CANDY_BONUS_MS).toBe(4000);
    expect(after.caught).toBe(7);
  });

  it('licking the candy fly is a normal catch that drops the candy; eating it is a normal catch', () => {
    const lick = touchInsect('candy', 'lick', 100, 1);
    expect(lick).toMatchObject({ caught: 1, points: 100, dropCandy: true });
    const eat = touchInsect('candy', 'eat', 100, 1);
    expect(eat).toMatchObject({ caught: 1, points: 100, dropCandy: false });
  });

  it('a wasp eaten whole gives no points, no catch, resets combo and numbs the tongue', () => {
    const r = touchInsect('wasp', 'eat', 100, 1.5);
    expect(r.points).toBe(0);
    expect(r.caught).toBe(0);
    expect(r.comboReset).toBe(true);
    expect(r.numbMs).toBe(WASP_NUMB_MS);
  });

  it('a licked wasp pays ordinary lick points', () => {
    expect(touchInsect('wasp', 'lick', 100, 1)).toMatchObject({ caught: 1, points: 100, numbMs: 0 });
  });

  it('the thief never takes the counter below zero', () => {
    expect(thiefEscape(5)).toBe(4);
    expect(thiefEscape(1)).toBe(0);
    expect(thiefEscape(0)).toBe(0);
  });

  it('the glutton counts as three catches with triple points, then the frog chews', () => {
    const r = touchInsect('glutton', 'eat', 200, 1.2);
    expect(r.caught).toBe(3);
    expect(r.points).toBe(Math.round(200 * 3 * 1.2));
    expect(r.chewMs).toBe(GLUTTON_CHEW_MS);
    expect(touchInsect('glutton', 'lick', 200, 1).caught).toBe(1);
  });

  it('the squeaker does the same on head and belly: scatter, quiet spawns, combo reset, no points', () => {
    for (const zone of ['eat', 'lick'] as const) {
      const r = touchInsect('squeaker', zone, 0, 2);
      expect(r).toMatchObject({ caught: 0, points: 0, comboReset: true, tongue: false, scatterMs: 2000 });
    }
  });

  it('a dropped candy tumbles away from the centre to the screen edge, spinning', () => {
    for (const x0 of [180, 540]) {
      let c = tossCandy(x0, 420, 720);
      expect(Math.sign(c.vx)).toBe(x0 < 360 ? -1 : 1);
      let t = 0;
      let maxVy = 0;
      while (!candyGone(c, 720, 1280) && t < 15_000) {
        c = stepCandy(c, 16);
        maxVy = Math.max(maxVy, c.vy);
        t += 16;
      }
      expect(candyGone(c, 720, 1280)).toBe(true);
      expect(Math.abs(c.angle)).toBeGreaterThan(360);
      expect(maxVy).toBeLessThanOrEqual(CANDY_MAX_FALL);
      // Slow enough to catch with a finger: at least a couple of seconds on screen.
      expect(t).toBeGreaterThan(2000);
    }
  });

  it('the falling candy has a finger-sized hitbox', () => {
    const c = tossCandy(300, 500, 720);
    expect(CANDY_TAP_R).toBeGreaterThanOrEqual(90);
    expect(candyTapped(c, 300 + 80, 500 + 30)).toBe(true);
    expect(candyTapped(c, 300 + 140, 500)).toBe(false);
  });

  it('candy lines are short and only about the candy', () => {
    expect(RULE_LINES.candy).toContain('+4');
    expect(RULE_LINES.candy.split('\n').length).toBeLessThanOrEqual(2);
    expect(RULE_LINES.candy).not.toMatch(/подруж/i);
  });

  it('a firefly is a normal catch when lit; in the dark it only flies off', () => {
    expect(touchInsect('firefly', 'eat', 150, 1, true)).toMatchObject({ caught: 1, points: 150 });
    expect(touchInsect('firefly', 'eat', 150, 1, false)).toMatchObject({ caught: 0, points: 0, spook: true, comboReset: false });
  });

  it('the firefly flashes about once a second and the glow only changes brightness', () => {
    let flashes = 0;
    let was = false;
    for (let t = 0; t < 5000; t += 10) {
      const lit = fireflyLit(t);
      if (lit && !was) flashes++;
      was = lit;
      const g = fireflyGlow(t);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
    }
    expect(flashes).toBe(5);
  });

  it('sleepy flies and thieves are caught like ordinary flies', () => {
    expect(touchInsect('sleepy', 'eat', 100, 1)).toMatchObject({ caught: 1, points: 100 });
    expect(touchInsect('thief', 'lick', 150, 1)).toMatchObject({ caught: 1, points: 150 });
  });
});
