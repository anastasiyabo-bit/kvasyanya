import { describe, expect, it } from 'vitest';
import { sparksLabel } from '../src/data/phrases';
import { COSMETIC_COUNT, HAT_UNLOCK_COUNT } from '../src/data/cosmetics';
import { FUSE_COUNT, grantUnlocks, hatsEarned, runCascade, sparksForLevel, type Inventory } from '../src/data/rewards';

const value = (inv: Inventory) => inv[0] + inv[1] * 5 + inv[2] * 25 + inv[3] * 125;

describe('reward cascade', () => {
  it('fuses 5 sparks into 1 glitter', () => {
    const r = runCascade([0, 0, 0, 0], 5);
    expect(r.inv).toEqual([0, 1, 0, 0]);
    expect(r.events.filter((e) => e.type === 'fuse')).toHaveLength(1);
  });

  it('chain-fuses all the way to an epic chest', () => {
    const r = runCascade([4, 4, 4, 0], 1);
    expect(r.inv).toEqual([0, 0, 0, 1]);
    expect(r.epicsGained).toBe(1);
    expect(r.epicsOpened).toBe(0);
    expect(r.events.map((e) => e.type)).toEqual(['add', 'fuse', 'fuse', 'fuse']);
  });

  it('opens a hat set when the 5th epic chest is collected and resets the counter', () => {
    const r = runCascade([4, 4, 4, 4], 1);
    expect(r.inv).toEqual([0, 0, 0, 0]);
    expect(r.epicsGained).toBe(1);
    expect(r.epicsOpened).toBe(1);
    expect(hatsEarned(r.epicsGained, r.epicsOpened)).toBe(1);
    expect(r.events.filter((e) => e.type === 'openEpic')).toHaveLength(1);
  });

  it('opens stuck epic chests even with no new sparks', () => {
    const r = runCascade([0, 0, 0, 5], 0);
    expect(r.inv).toEqual([0, 0, 0, 0]);
    expect(r.epicsGained).toBe(0);
    expect(r.epicsOpened).toBe(1);
    expect(hatsEarned(r.epicsGained, r.epicsOpened)).toBe(1);
  });

  it('never loses value and keeps every tier below the fuse count', () => {
    for (let s = 0; s < 400; s += 7) {
      const start: Inventory = [s % 5, (s * 3) % 5, (s * 7) % 5, s % 3];
      const r = runCascade(start, s);
      expect(value(r.inv) + r.epicsOpened * 5 * 125).toBe(value(start) + s);
      for (let t = 0; t < 4; t++) expect(r.inv[t]).toBeLessThan(FUSE_COUNT);
    }
  });

  it('does not mutate the starting inventory', () => {
    const start: Inventory = [3, 2, 1, 0];
    runCascade(start, 50);
    expect(start).toEqual([3, 2, 1, 0]);
  });

  it('handles bad input', () => {
    expect(runCascade([0, 0, 0, 0], -5).inv).toEqual([0, 0, 0, 0]);
    expect(runCascade([0, 0, 0, 0], 2.7).inv).toEqual([2, 0, 0, 0]);
  });

  it('sparks equal caught insects on win, zero on fail', () => {
    expect(sparksForLevel({ stars: 0, caught: 45 })).toBe(0);
    expect(sparksForLevel({ stars: 1, caught: 45 })).toBe(45);
    expect(sparksForLevel({ stars: 3, caught: 12 })).toBe(12);
  });

  it('unlocks a colour skin after every hat is already owned', () => {
    const r = grantUnlocks(HAT_UNLOCK_COUNT, COSMETIC_COUNT, 1);
    expect(r.newHats).toEqual([]);
    expect(r.newSkins).toEqual([1]);
    expect(r.skin).toBe(1);
    expect(r.unlocked).toBe(HAT_UNLOCK_COUNT + 1);
  });

  it('spark word agrees with the number', () => {
    expect(sparksLabel(1)).toBe('1 искорка');
    expect(sparksLabel(2)).toBe('2 искорки');
    expect(sparksLabel(4)).toBe('4 искорки');
    expect(sparksLabel(5)).toBe('5 искорок');
    expect(sparksLabel(11)).toBe('11 искорок');
    expect(sparksLabel(21)).toBe('21 искорка');
    expect(sparksLabel(22)).toBe('22 искорки');
    expect(sparksLabel(44)).toBe('44 искорки');
  });
});
