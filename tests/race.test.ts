import { describe, expect, it } from 'vitest';
import { evaluateLevel, evaluateRace, getLevelConfig, raceStars } from '../src/data/levels';
import { RIVAL_LOOK_MS, RivalBrain, rivalPaceMs, rivalPick } from '../src/data/race';

describe('race with Klesha', () => {
  it('a tie is her win, so the level is lost', () => {
    expect(evaluateRace(7, 7)).toEqual({ won: false, stars: 0, reason: 'race' });
    expect(evaluateRace(3, 9).won).toBe(false);
    expect(evaluateLevel(getLevelConfig(8), 99999, 10, 10).won).toBe(false);
  });

  it('leads of 1, 3 and 5 give 1, 2 and 3 stars', () => {
    expect(raceStars(1)).toBe(1);
    expect(raceStars(2)).toBe(1);
    expect(raceStars(3)).toBe(2);
    expect(raceStars(4)).toBe(2);
    expect(raceStars(5)).toBe(3);
    expect(raceStars(12)).toBe(3);
    expect(evaluateRace(11, 10)).toEqual({ won: true, stars: 1, reason: 'ok' });
    expect(evaluateRace(13, 10).stars).toBe(2);
    expect(evaluateRace(15, 10).stars).toBe(3);
  });

  it('race ignores the quota: only the lead matters', () => {
    const cfg = getLevelConfig(8);
    expect(evaluateLevel(cfg, 0, 2, 1).won).toBe(true);
  });

  it('her pace is a bit under the level quota', () => {
    const cfg = getLevelConfig(16);
    const haul = (cfg.duration * 1000) / rivalPaceMs(cfg);
    expect(haul).toBeLessThan(cfg.minCatch);
    expect(haul).toBeGreaterThan(cfg.minCatch * 0.7);
  });

  it('she looks at the fly nearest to her', () => {
    const flies = [
      { x: 600, y: 500, hittable: true },
      { x: 220, y: 520, hittable: true },
      { x: 200, y: 450, hittable: false },
    ];
    expect(rivalPick(flies, 190, 840, 700)).toBe(flies[1]);
  });

  it('she stares about a third of a second before the tongue goes; a stolen fly makes her miss', () => {
    const fly = { x: 200, y: 500, hittable: true };
    const brain = new RivalBrain(2000, RIVAL_LOOK_MS, 0);
    const look = brain.update(16, () => fly);
    expect(look).toEqual({ type: 'look', target: fly });
    expect(RIVAL_LOOK_MS).toBeGreaterThanOrEqual(300);
    expect(RIVAL_LOOK_MS).toBeLessThanOrEqual(400);
    let ev = null;
    let waited = 0;
    fly.hittable = false; // the player grabbed it during her stare
    while (!ev) {
      waited += 16;
      ev = brain.update(16, () => fly);
    }
    expect(waited).toBeGreaterThanOrEqual(RIVAL_LOOK_MS - 16);
    expect(ev).toEqual({ type: 'strike', target: fly, hit: false });
  });

  it('if nobody steals it, her strike lands', () => {
    const fly = { x: 200, y: 500, hittable: true };
    const brain = new RivalBrain(2000, RIVAL_LOOK_MS, 0);
    brain.update(16, () => fly);
    let ev = null;
    while (!ev) ev = brain.update(16, () => fly);
    expect(ev).toMatchObject({ type: 'strike', hit: true });
  });
});
