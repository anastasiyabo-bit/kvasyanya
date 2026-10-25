import { describe, expect, it } from 'vitest';
import { sparksLabel } from '../src/data/phrases';
import { BEAD_COUNT, HAT_UNLOCK_COUNT, SKIN_COUNT, legacyPrizeSplit } from '../src/data/cosmetics';
import {
  BEAD_COST,
  HAT_COST,
  applyRewards,
  migrateLegacy,
  rewardHeadline,
  rewardsForLevel,
  type Inventory,
} from '../src/data/rewards';

const empty = { hats: 0, beads: 0, skins: 0 };

describe('reward tracks', () => {
  it('pays sparks for a win, a glitter for 3 stars, and a chest on a super level', () => {
    expect(rewardsForLevel({ stars: 0, caught: 12, isSuper: true })).toEqual({ sparks: 0, glitters: 0, chests: 0 });
    expect(rewardsForLevel({ stars: 1, caught: 12, isSuper: false })).toEqual({ sparks: 12, glitters: 0, chests: 0 });
    expect(rewardsForLevel({ stars: 3, caught: 12, isSuper: false })).toEqual({ sparks: 12, glitters: 1, chests: 0 });
    expect(rewardsForLevel({ stars: 2, caught: 9, isSuper: true })).toEqual({ sparks: 9, glitters: 0, chests: 1 });
  });

  it('opens a hat every 10 sparks and keeps the remainder', () => {
    const r = applyRewards([8, 0, 0], { sparks: 14, glitters: 0, chests: 0 }, empty);
    expect(r.owned.hats).toBe(2);
    expect(r.inv).toEqual([2, 0, 0]);
    expect(r.drops.map((d) => d.id)).toEqual([0, 1]);
  });

  it('strings a necklace from 3 glitters and never turns sparks into glitters', () => {
    const r = applyRewards([9, 2, 0], { sparks: 0, glitters: 1, chests: 0 }, empty);
    expect(r.inv).toEqual([9, 0, 0]);
    expect(r.owned.beads).toBe(1);
    expect(r.drops).toEqual([{ kind: 'bead', id: 0 }]);
  });

  it('opens one skin per chest and stops when the colours run out', () => {
    const first = applyRewards([0, 0, 0], { sparks: 0, glitters: 0, chests: 1 }, empty);
    expect(first.drops).toEqual([{ kind: 'skin', id: 1 }]);
    expect(first.owned.skins).toBe(1);
    const done = applyRewards([0, 0, 0], { sparks: 0, glitters: 0, chests: 5 }, { hats: 0, beads: 0, skins: SKIN_COUNT });
    expect(done.drops).toEqual([]);
    expect(done.inv[2]).toBe(0);
  });

  it('drops a finished track instead of banking a useless remainder', () => {
    const r = applyRewards([0, 0, 0], { sparks: 50, glitters: 20, chests: 0 }, { hats: HAT_UNLOCK_COUNT, beads: BEAD_COUNT, skins: 0 });
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
    const m = migrateLegacy([1, 2, 3, 4], 2);
    expect(m.owned.hats).toBe(2);
    expect(m.owned.skins).toBe(0);
    expect(m.owned.beads).toBe(1);
    expect(m.inv[0]).toBe(1 + 4 * Math.floor(HAT_COST / 5));
    expect(m.inv[1]).toBe((2 + 3) % BEAD_COST);
  });

  it('names the payout in one line', () => {
    expect(rewardHeadline({ sparks: 12, glitters: 1, chests: 1 }, true)).toBe('+12 искорок   + блестяшка   + сундучек');
    expect(rewardHeadline({ sparks: 4, glitters: 0, chests: 1 }, false)).toBe('+4 искорки');
    expect(sparksLabel(11)).toBe('11 искорок');
  });
});
