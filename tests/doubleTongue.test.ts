import { describe, expect, it } from 'vitest';
import { pickSecondTongueTarget, type TongueTarget } from '../src/data/doubleTongue';

function fly(partial: Partial<TongueTarget> & { x: number; y: number }): TongueTarget {
  return { hittable: true, ...partial };
}

describe('pickSecondTongueTarget', () => {
  it('returns null when there is no other fly', () => {
    const a = fly({ x: 10, y: 10 });
    expect(pickSecondTongueTarget([a], a)).toBeNull();
  });

  it('picks the nearest other hittable fly', () => {
    const a = fly({ x: 0, y: 0 });
    const near = fly({ x: 10, y: 0 });
    const far = fly({ x: 80, y: 0 });
    expect(pickSecondTongueTarget([a, far, near], a)).toBe(near);
  });

  it('prefers a live pair partner over a nearer stranger', () => {
    const partner = fly({ x: 90, y: 0 });
    const a = fly({ x: 0, y: 0, pairPartner: partner });
    partner.pairPartner = a;
    const nearer = fly({ x: 8, y: 0 });
    expect(pickSecondTongueTarget([a, nearer, partner], a)).toBe(partner);
  });

  it('skips the already caught fly and non-hittable ones', () => {
    const a = fly({ x: 0, y: 0, hittable: false });
    const caughtPartner = fly({ x: 12, y: 0, hittable: false });
    a.pairPartner = caughtPartner;
    const other = fly({ x: 40, y: 0 });
    expect(pickSecondTongueTarget([a, caughtPartner, other], a)).toBe(other);
  });
});
