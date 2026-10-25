import { describe, expect, it } from 'vitest';
import { defaultSave, mergeSaves, sanitize } from '../src/systems/save';

describe('save', () => {
  it('sanitizes garbage to defaults', () => {
    expect(sanitize(null)).toEqual(defaultSave());
    expect(sanitize('x')).toEqual(defaultSave());
    expect(sanitize({ level: -3, inventory: [1, 2], hat: 99, music: 'yes' })).toEqual(defaultSave());
  });

  it('keeps a modern save and clamps a locked hat', () => {
    const s = sanitize({
      level: 7.8,
      inventory: [4, 1, 0],
      hatsUnlocked: 2,
      artsUnlocked: 1,
      skinsUnlocked: 1,
      hat: 5,
      art: 0,
      skin: 1,
      music: false,
      bestScore: { '3': 1200, x: 'no' },
    });
    expect(s.level).toBe(7);
    expect(s.inventory).toEqual([4, 1, 0]);
    expect(s.hatsUnlocked).toBe(2);
    expect(s.hat).toBe(1);
    expect(s.art).toBe(0);
    expect(s.skin).toBe(1);
    expect(s.music).toBe(false);
    expect(s.bestScore).toEqual({ '3': 1200 });
  });

  it('converts an old four-slot fuse save and keeps the prizes already opened', () => {
    const s = sanitize({ inventory: [1, 2, 3, 4], hatsUnlocked: 2, hat: 5 });
    expect(s.hatsUnlocked).toBe(2);
    expect(s.skinsUnlocked).toBe(0);
    expect(s.artsUnlocked).toBe(1);
    expect(s.hat).toBe(1);
    expect(s.art).toBe(-1);
    expect(s.inventory[2]).toBe(0);
  });

  it('reads the necklace fields of the previous version as drawings', () => {
    const s = sanitize({ inventory: [0, 2, 0], hatsUnlocked: 3, beadsUnlocked: 2, bead: 1 });
    expect(s.artsUnlocked).toBe(2);
    expect(s.art).toBe(1);
  });

  it('remembers which rule lines were already shown', () => {
    expect(defaultSave().seenRules).toEqual([]);
    expect(sanitize({ seenRules: ['wasp', 3, 'wasp', 'nap'] }).seenRules).toEqual(['wasp', 'nap']);
    expect(sanitize({ seenRules: 'wasp' }).seenRules).toEqual([]);
  });

  it('merge prefers more progress', () => {
    const a = { ...defaultSave(), level: 3 };
    const b = { ...defaultSave(), level: 5 };
    expect(mergeSaves(a, b)).toBe(b);
    expect(mergeSaves(b, a)).toBe(b);
    const c = { ...defaultSave(), level: 5, inventory: [0, 0, 1] as [number, number, number] };
    expect(mergeSaves(b, c)).toBe(c);
  });
});
