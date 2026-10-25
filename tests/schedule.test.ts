import { describe, expect, it } from 'vitest';
import { getLevelConfig } from '../src/data/levels';
import {
  GUEST_ROTATION,
  INTRO_LEVELS,
  isNapLevel,
  isRaceLevel,
  isSuperLevel,
  levelPlan,
  type GuestKind,
} from '../src/data/schedule';

const N = 400;
const levels = Array.from({ length: N }, (_, i) => i + 1);

describe('level calendar', () => {
  it('super stays every 5th level', () => {
    for (const n of [5, 10, 15, 20, 25, 30, 35, 40, 80, 120]) {
      expect(levelPlan(n).kind).toBe('super');
    }
  });

  it('race is every 8th level unless that number is super', () => {
    expect(levels.filter(isRaceLevel).slice(0, 6)).toEqual([8, 16, 24, 32, 41, 48]);
    for (const n of levels) expect(isSuperLevel(n) && isRaceLevel(n)).toBe(false);
  });

  it('40, 80 and 120 stay super and their race moves to the next number', () => {
    for (const n of [40, 80, 120, 160]) {
      expect(levelPlan(n).kind).toBe('super');
      expect(isRaceLevel(n)).toBe(false);
      expect(levelPlan(n + 1).kind).toBe('race');
    }
  });

  it('every block of eight numbers has exactly one race', () => {
    for (let k = 1; k * 8 + 1 <= N; k++) {
      const block = [k * 8, k * 8 + 1].filter(isRaceLevel);
      expect(block).toHaveLength(1);
    }
  });

  it('quiet hour starts on 19, then roughly every 6–8 levels, never on super or race', () => {
    const naps = levels.filter(isNapLevel);
    expect(naps[0]).toBe(19);
    for (let i = 1; i < naps.length; i++) {
      const gap = naps[i] - naps[i - 1];
      expect(gap).toBeGreaterThanOrEqual(6);
      expect(gap).toBeLessThanOrEqual(9);
    }
    for (const n of naps) {
      expect(isSuperLevel(n)).toBe(false);
      expect(isRaceLevel(n)).toBe(false);
      expect(levelPlan(n).kind).toBe('nap');
      expect(levelPlan(n).guest).toBeNull();
    }
  });

  it('kinds never mix: guests only on free levels, none on super, race or quiet hour', () => {
    for (const n of levels) {
      const p = levelPlan(n);
      const flags = [isSuperLevel(n), isRaceLevel(n), isNapLevel(n), p.guest !== null].filter(Boolean);
      expect(flags.length).toBeLessThanOrEqual(1);
      if (p.kind === 'guest') expect(p.guest).not.toBeNull();
      else expect(p.guest).toBeNull();
    }
  });

  it('introduces each rule on its own level in the agreed order', () => {
    expect(INTRO_LEVELS.map((i) => [i.level, i.what])).toEqual([
      [4, 'candy'],
      [7, 'wasp'],
      [9, 'squeaker'],
      [11, 'thief'],
      [13, 'glutton'],
      [17, 'firefly'],
      [18, 'caller'],
      [19, 'nap'],
    ]);
    for (const { level, what } of INTRO_LEVELS) {
      const p = levelPlan(level);
      expect(p.intro).toBe(what);
      if (what === 'nap') expect(p.kind).toBe('nap');
      else expect(p.guest).toBe(what);
    }
  });

  it('no guest before level 4, and level 1 stays a plain tutorial level', () => {
    for (const n of [1, 2, 3]) expect(levelPlan(n).kind).toBe('normal');
  });

  it('after the intros guests take about every second free level, never two free levels in a row', () => {
    const free = levels.filter((n) => n > 19 && !isSuperLevel(n) && !isRaceLevel(n) && !isNapLevel(n));
    let prevGuest = false;
    let guests = 0;
    for (const n of free) {
      const g = levelPlan(n).kind === 'guest';
      expect(g && prevGuest).toBe(false);
      prevGuest = g;
      if (g) guests++;
    }
    expect(guests / free.length).toBeGreaterThan(0.45);
    expect(guests / free.length).toBeLessThan(0.55);
  });

  it('all seven guests keep rotating after the intros', () => {
    const seen = new Set<GuestKind>();
    for (let n = 20; n <= 120; n++) {
      const g = levelPlan(n).guest;
      if (g) seen.add(g);
    }
    expect([...seen].sort()).toEqual([...GUEST_ROTATION].sort());
  });

  it('level config carries the plan', () => {
    expect(getLevelConfig(8).isRace).toBe(true);
    expect(getLevelConfig(19).isNap).toBe(true);
    expect(getLevelConfig(7).guest).toBe('wasp');
    expect(getLevelConfig(10).isSuper).toBe(true);
    expect(getLevelConfig(10).guest).toBeNull();
  });
});
