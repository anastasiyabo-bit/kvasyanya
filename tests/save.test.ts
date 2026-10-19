import { describe, expect, it } from 'vitest';
import { defaultSave, mergeSaves, sanitize } from '../src/systems/save';

describe('save', () => {
  it('sanitizes garbage to defaults', () => {
    expect(sanitize(null)).toEqual(defaultSave());
    expect(sanitize('x')).toEqual(defaultSave());
    expect(sanitize({ level: -3, inventory: [1, 2], hat: 99, music: 'yes' })).toEqual(defaultSave());
  });

  it('keeps valid fields and clamps hat to unlocked', () => {
    const s = sanitize({ level: 7.8, inventory: [1, 2, 3, 4], hatsUnlocked: 2, hat: 5, music: false, bestScore: { '3': 1200, x: 'no' } });
    expect(s.level).toBe(7);
    expect(s.inventory).toEqual([1, 2, 3, 4]);
    expect(s.hat).toBe(1);
    expect(s.music).toBe(false);
    expect(s.bestScore).toEqual({ '3': 1200 });
  });

  it('merge prefers more progress', () => {
    const a = { ...defaultSave(), level: 3 };
    const b = { ...defaultSave(), level: 5 };
    expect(mergeSaves(a, b)).toBe(b);
    expect(mergeSaves(b, a)).toBe(b);
    const c = { ...defaultSave(), level: 5, inventory: [0, 0, 1, 0] as [number, number, number, number] };
    expect(mergeSaves(b, c)).toBe(c);
  });
});
