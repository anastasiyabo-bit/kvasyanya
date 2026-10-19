import { describe, expect, it } from 'vitest';
import { comboMultiplier, evaluateLevel, fatTier, getLevelConfig, isSuperLevel, superMultiplier } from '../src/data/levels';

const fatTierMaxEaten = (minCatch: number) => Math.max(3, Math.round(minCatch * 0.45)) * 4;

describe('levels', () => {
  it('every 5th level is super', () => {
    expect([1, 2, 3, 4, 5, 10, 11, 15].map(isSuperLevel)).toEqual([false, false, false, false, true, true, false, true]);
  });

  it('super levels need an even catch count (pairs) and have a score threshold', () => {
    for (let l = 5; l <= 100; l += 5) {
      const c = getLevelConfig(l);
      expect(c.isSuper).toBe(true);
      expect(c.minCatch % 2).toBe(0);
      expect(c.superThreshold).toBeGreaterThan(c.minCatch * 100);
    }
  });

  it('difficulty grows monotonically and stays within sane bounds', () => {
    let prev = getLevelConfig(1);
    for (let l = 2; l <= 200; l++) {
      const c = getLevelConfig(l);
      if (!c.isSuper && !prev.isSuper) {
        expect(c.minCatch).toBeGreaterThanOrEqual(prev.minCatch);
        expect(c.spawnInterval).toBeLessThanOrEqual(prev.spawnInterval);
        expect(c.speedMin).toBeGreaterThanOrEqual(prev.speedMin);
      }
      expect(c.duration).toBe(30);
      expect(c.minCatch).toBeLessThanOrEqual(32);
      expect(c.speedMax).toBeGreaterThan(c.speedMin);
      expect(c.mosquitoChance + c.fatChance + c.goldChance).toBeLessThan(1);
      prev = c;
    }
  });

  it('enough insects spawn to make every level winnable with margin', () => {
    for (let l = 1; l <= 200; l++) {
      const c = getLevelConfig(l);
      const spawns = Math.floor((c.duration * 1000) / c.spawnInterval) * (c.isSuper ? 2 : 1);
      expect(spawns).toBeGreaterThanOrEqual(c.minCatch * 2);
    }
  });

  it('stars thresholds ascend', () => {
    const c = getLevelConfig(7);
    expect(c.starScores[0]).toBeLessThan(c.starScores[1]);
    expect(c.starScores[1]).toBeLessThan(c.starScores[2]);
  });

  it('evaluates normal level: min catch gate then stars by score', () => {
    const c = getLevelConfig(2);
    expect(evaluateLevel(c, 99999, c.minCatch - 1)).toEqual({ won: false, stars: 0, reason: 'min' });
    expect(evaluateLevel(c, c.starScores[0], c.minCatch).stars).toBe(1);
    expect(evaluateLevel(c, c.starScores[1], c.minCatch).stars).toBe(2);
    expect(evaluateLevel(c, c.starScores[2], c.minCatch).stars).toBe(3);
  });

  it('evaluates super level threshold', () => {
    const c = getLevelConfig(5);
    expect(evaluateLevel(c, c.superThreshold - 1, c.minCatch + 4).reason).toBe('threshold');
    expect(evaluateLevel(c, c.superThreshold, c.minCatch).won).toBe(true);
  });

  it('super multiplier rewards going over the threshold', () => {
    const c = getLevelConfig(10);
    expect(superMultiplier(c, c.superThreshold)).toBe(1);
    expect(superMultiplier(c, Math.ceil(c.superThreshold * 1.1))).toBe(1.25);
    expect(superMultiplier(c, Math.ceil(c.superThreshold * 1.3))).toBe(1.5);
    expect(superMultiplier(c, c.superThreshold * 2)).toBe(2);
    expect(superMultiplier(getLevelConfig(3), 99999)).toBe(1);
  });

  it('combo multiplier caps and fat tier caps', () => {
    expect(comboMultiplier(1)).toBe(1);
    expect(comboMultiplier(3)).toBeCloseTo(1.2);
    expect(comboMultiplier(100)).toBeCloseTo(2);
    expect(fatTier(0, 12)).toBe(0);
    expect(fatTier(4, 12)).toBe(0);
    expect(fatTier(5, 12)).toBe(1);
    expect(fatTier(19, 12)).toBe(3);
    expect(fatTier(20, 12)).toBe(4);
    expect(fatTier(1000, 12)).toBe(4);
    expect(fatTier(fatTierMaxEaten(32), 32)).toBe(4);
  });
});
