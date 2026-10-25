import { describe, expect, it } from 'vitest';
import { sparksLabel } from '../src/data/phrases';
import { ART_COUNT, HAT_UNLOCK_COUNT, SKIN_COUNT, legacyPrizeSplit } from '../src/data/cosmetics';
import {
  ART_COST,
  HAT_COST,
  applyRewards,
  migrateLegacy,
  rewardHeadline,
  rewardsForLevel,
  type Inventory,
} from '../src/data/rewards';

const empty = { hats: 0, arts: 0, skins: 0 };

describe('reward tracks', () => {
  it('pays sparks by stars, a glitter for 3 stars, and a chest on a super level', () => {
    expect(rewardsForLevel({ stars: 0, caught: 12, isSuper: true })).toEqual({ sparks: 0, glitters: 0, chests: 0 });
    expect(rewardsForLevel({ stars: 1, caught: 30, isSuper: false })).toEqual({ sparks: 2, glitters: 0, chests: 0 });
    expect(rewardsForLevel({ stars: 2, caught: 9, isSuper: true })).toEqual({ sparks: 3, glitters: 0, chests: 1 });
    expect(rewardsForLevel({ stars: 3, caught: 12, isSuper: false })).toEqual({ sparks: 4, glitters: 1, chests: 0 });
  });

  it('a hat is a few wins of work: never two in one level, even with the ×2 ad', () => {
    for (const stars of [1, 2, 3]) {
      const s = rewardsForLevel({ stars, caught: 40, isSuper: false }).sparks;
      const r = applyRewards([HAT_COST - 1, 0, 0], { sparks: s * 2, glitters: 0, chests: 0 }, empty);
      expect(r.drops.filter((d) => d.kind === 'hat').length).toBeLessThanOrEqual(1);
    }
  });

  it('on average a win opens less than one hat, and most wins open none', () => {
    const stars = [1, 2, 3, 3, 2, 3, 1, 2, 3, 3, 2, 3, 3, 2, 3, 3, 2, 1, 3, 3];
    let inv: Inventory = [0, 0, 0];
    let hats = 0;
    let empties = 0;
    for (const s of stars) {
      const r = applyRewards(inv, rewardsForLevel({ stars: s, caught: 20, isSuper: false }), { ...empty, hats });
      const got = r.drops.filter((d) => d.kind === 'hat').length;
      hats += got;
      if (got === 0) empties++;
      inv = r.inv;
    }
    expect(hats / stars.length).toBeLessThan(0.5);
    expect(empties / stars.length).toBeGreaterThan(0.6);
  });

  it('opens a hat every 10 sparks and keeps the remainder', () => {
    const r = applyRewards([8, 0, 0], { sparks: 14, glitters: 0, chests: 0 }, empty);
    expect(r.owned.hats).toBe(2);
    expect(r.inv).toEqual([2, 0, 0]);
    expect(r.drops.map((d) => d.id)).toEqual([0, 1]);
  });

  it('opens a belly drawing for 3 glitters and never turns sparks into glitters', () => {
    const r = applyRewards([9, 2, 0], { sparks: 0, glitters: 1, chests: 0 }, empty);
    expect(r.inv).toEqual([9, 0, 0]);
    expect(r.owned.arts).toBe(1);
    expect(r.drops).toEqual([{ kind: 'art', id: 0 }]);
  });

  it('opens one skin per chest and stops when the colours run out', () => {
    const first = applyRewards([0, 0, 0], { sparks: 0, glitters: 0, chests: 1 }, empty);
    expect(first.drops).toEqual([{ kind: 'skin', id: 1 }]);
    expect(first.owned.skins).toBe(1);
    const done = applyRewards([0, 0, 0], { sparks: 0, glitters: 0, chests: 5 }, { hats: 0, arts: 0, skins: SKIN_COUNT });
    expect(done.drops).toEqual([]);
    expect(done.inv[2]).toBe(0);
  });

  it('drops a finished track instead of banking a useless remainder', () => {
    const r = applyRewards([0, 0, 0], { sparks: 50, glitters: 20, chests: 0 }, { hats: HAT_UNLOCK_COUNT, arts: ART_COUNT, skins: 0 });
    expect(r.inv).toEqual([0, 0, 0]);
    expect(r.drops).toEqual([]);
  });

  it('does not mutate the starting inventory', () => {
    const start: Inventory = [3, 2, 1];
    applyRewards(start, { sparks: 40, glitters: 3, chests: 1 }, empty);
    expect(start).toEqual([3, 2, 1]);
  });

  it('migrates the old pouch and epic chest without dropping owned prizes', () => {
    expect(legacyPrizeSplit(5)).toEqual({ hats: 4, skins: 1 });
    expect(legacyPrizeSplit(99)).toEqual({ hats: 11, skins: 3 });
    const m = migrateLegacy([1, 2, 3, 4], 2);
    expect(m.owned.hats).toBe(2);
    expect(m.owned.skins).toBe(0);
    expect(m.owned.arts).toBe(1);
    expect(m.inv[0]).toBe(1 + 4 * Math.floor(HAT_COST / 5));
    expect(m.inv[1]).toBe((2 + 3) % ART_COST);
  });

  it('has 30 hats, 15 drawings and 9 colours including the green one', () => {
    expect(HAT_UNLOCK_COUNT).toBe(30);
    expect(ART_COUNT).toBe(15);
    expect(SKIN_COUNT + 1).toBe(9);
  });

  it('names the payout in one line', () => {
    expect(rewardHeadline({ sparks: 12, glitters: 1, chests: 1 }, true)).toBe('+12 искорок   + блестяшка   + сундучек');
    expect(rewardHeadline({ sparks: 4, glitters: 0, chests: 1 }, false)).toBe('+4 искорки');
    expect(sparksLabel(11)).toBe('11 искорок');
  });
});
