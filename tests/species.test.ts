import { describe, expect, it } from 'vitest';
import { getLevelConfig } from '../src/data/levels';
import { KIND_UNLOCK, NEW_KIND_CAP, PAIR_KINDS, kindShares, levelMix } from '../src/data/species';

const kinds = (n: number) => getLevelConfig(n).mix.map((m) => m.kind);
/** Different insects a level shows, its guest included. */
const variety = (n: number) => kinds(n).length + (getLevelConfig(n).guest ? 1 : 0);

describe('species curve', () => {
  it('level 1 is only ordinary flies', () => {
    expect(kinds(1)).toEqual(['fly']);
  });

  it('levels 2–3 add the gold fly, a couple of times at most', () => {
    for (const n of [2, 3]) {
      expect(kinds(n)).toEqual(['fly', 'gold']);
      expect(getLevelConfig(n).mix[1]).toMatchObject({ fresh: true, cap: NEW_KIND_CAP });
    }
  });

  it('levels 4–5 add the sleepy fly', () => {
    for (const n of [4, 5]) expect(kinds(n)).toContain('sleepy');
    for (const n of [1, 2, 3]) expect(kinds(n)).not.toContain('sleepy');
  });

  it('mosquito, fat and guests come in portions, in that order', () => {
    expect(KIND_UNLOCK.mosquito).toBeLessThan(KIND_UNLOCK.fat);
    const firstGuest = Array.from({ length: 40 }, (_, i) => i + 1).find((n) => getLevelConfig(n).guest);
    expect(firstGuest).toBeGreaterThan(KIND_UNLOCK.fat);
    for (let n = 1; n < KIND_UNLOCK.mosquito; n++) expect(kinds(n)).not.toContain('mosquito');
    for (let n = 1; n < KIND_UNLOCK.fat; n++) expect(kinds(n)).not.toContain('fat');
  });

  it('a new kind starts rare and gets more common later', () => {
    for (const k of ['gold', 'sleepy', 'mosquito', 'fat'] as const) {
      const at = KIND_UNLOCK[k];
      const first = levelMix(at).find((m) => m.kind === k)!;
      expect(first.cap).toBe(NEW_KIND_CAP);
      let grown = null;
      for (let n = at + 15; n < at + 60 && !grown; n++) grown = levelMix(n).find((m) => m.kind === k);
      expect(grown).toBeTruthy();
      expect(grown!.cap).toBeGreaterThan(NEW_KIND_CAP);
      expect(grown!.weight).toBeGreaterThanOrEqual(first.weight);
    }
  });

  it('from level 6 every level shows 3–4 different insects', () => {
    for (let n = 6; n <= 120; n++) {
      expect(variety(n)).toBeGreaterThanOrEqual(3);
      expect(variety(n)).toBeLessThanOrEqual(4);
    }
  });

  it('neighbouring levels do not repeat the same company', () => {
    let same = 0;
    let pairs = 0;
    for (let n = 12; n < 120; n++) {
      const a = [...kinds(n), getLevelConfig(n).guest].join();
      const b = [...kinds(n + 1), getLevelConfig(n + 1).guest].join();
      pairs++;
      if (a === b) same++;
    }
    expect(same / pairs).toBeLessThan(0.25);
  });

  it('a super level always has a special that flies in pairs once one is met', () => {
    for (let n = 10; n <= 120; n += 5) {
      const pairable = getLevelConfig(n).mix.filter((m) => PAIR_KINDS.includes(m.kind) && m.kind !== 'fly');
      expect(pairable.length).toBeGreaterThan(0);
    }
  });

  it('over the levels the sleepy and the fat fly are met about equally often, quiet hours included', () => {
    for (const upTo of [40, 80, 160]) {
      let sleepy = 0;
      let fat = 0;
      let sleepyLevels = 0;
      let fatLevels = 0;
      for (let n = KIND_UNLOCK.fat; n <= upTo; n++) {
        const cfg = getLevelConfig(n);
        const s = kindShares(cfg.mix, cfg.kind);
        sleepy += s.sleepy ?? 0;
        fat += s.fat ?? 0;
        if (s.sleepy) sleepyLevels++;
        if (s.fat) fatLevels++;
      }
      expect(sleepy / fat).toBeGreaterThan(0.85);
      expect(sleepy / fat).toBeLessThan(1.15);
      // Quiet hours are full of sleepy flies, so plain levels give the fat fly more room.
      expect(fatLevels).toBeGreaterThan(sleepyLevels);
    }
  });

  it('a race brings the gold and sleepy flies', () => {
    for (const n of [8, 16, 24, 32, 41]) expect(kinds(n)).toEqual(expect.arrayContaining(['gold', 'sleepy']));
  });
});
