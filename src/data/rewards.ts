import { ART_COUNT, HAT_UNLOCK_COUNT, legacyPrizeSplit, SKIN_COUNT } from './cosmetics';
import { sparksLabel } from './phrases';

export const TIER_NAMES = ['Искорки', 'Блестяшки', 'Сундучек'] as const;
export const TIER_FOR = ['шапочки', 'рисунки', 'окрасы'] as const;

/** Caught flies fill this bar. A full bar opens the next hat. */
export const HAT_COST = 10;
/** Three-star clears drop one glitter. A full bar opens the next belly drawing. */
export const ART_COST = 3;

/** Progress still waiting to open the next item: [sparks, glitters, chests]. */
export type Inventory = [number, number, number];

export interface RewardGain {
  sparks: number;
  glitters: number;
  chests: number;
}

export interface Owned {
  hats: number;
  arts: number;
  skins: number;
}

export type UnlockDrop = { kind: 'hat' | 'art' | 'skin'; id: number };

export interface RewardInput {
  stars: number;
  caught: number;
  isSuper: boolean;
}

/**
 * A win pays sparks for every catch.
 * Three stars also pay one glitter. A cleared super level pays one chest.
 */
export function rewardsForLevel(r: RewardInput): RewardGain {
  if (r.stars <= 0) return { sparks: 0, glitters: 0, chests: 0 };
  return {
    sparks: Math.max(0, Math.floor(r.caught)),
    glitters: r.stars >= 3 ? 1 : 0,
    chests: r.isSuper ? 1 : 0,
  };
}

export function sparksForLevel(r: { stars: number; caught: number }): number {
  return rewardsForLevel({ stars: r.stars, caught: r.caught, isSuper: false }).sparks;
}

export function trackLabel(have: number, cost: number, done: boolean): string {
  return done ? 'все' : `${Math.max(0, have)}/${cost}`;
}

export function rewardHeadline(g: RewardGain, chestOpens: boolean): string {
  const bits: string[] = [];
  if (g.sparks > 0) bits.push(`+${sparksLabel(g.sparks)}`);
  if (g.glitters === 1) bits.push('+ блестяшка');
  else if (g.glitters > 1) bits.push(`+ ${g.glitters} блестяшки`);
  if (chestOpens) bits.push('+ сундучек');
  return bits.join('   ');
}

function take(n: number): number {
  return Math.max(0, Math.floor(n));
}

/**
 * Adds a level's payout to the three bars. Nothing converts into another currency.
 * A finished collection stops accepting that currency.
 */
export function applyRewards(
  start: Inventory,
  gain: RewardGain,
  owned: Owned,
): { inv: Inventory; owned: Owned; drops: UnlockDrop[] } {
  const next: Owned = {
    hats: take(owned.hats),
    arts: take(owned.arts),
    skins: take(owned.skins),
  };
  const drops: UnlockDrop[] = [];

  let sparks = take(start[0]) + take(gain.sparks);
  if (next.hats >= HAT_UNLOCK_COUNT) sparks = 0;
  else {
    while (sparks >= HAT_COST && next.hats < HAT_UNLOCK_COUNT) {
      sparks -= HAT_COST;
      drops.push({ kind: 'hat', id: next.hats });
      next.hats += 1;
    }
    if (next.hats >= HAT_UNLOCK_COUNT) sparks = 0;
  }

  let glitters = take(start[1]) + take(gain.glitters);
  if (next.arts >= ART_COUNT) glitters = 0;
  else {
    while (glitters >= ART_COST && next.arts < ART_COUNT) {
      glitters -= ART_COST;
      drops.push({ kind: 'art', id: next.arts });
      next.arts += 1;
    }
    if (next.arts >= ART_COUNT) glitters = 0;
  }

  let chests = take(start[2]) + take(gain.chests);
  if (next.skins >= SKIN_COUNT) chests = 0;
  else {
    while (chests > 0 && next.skins < SKIN_COUNT) {
      chests -= 1;
      next.skins += 1;
      drops.push({ kind: 'skin', id: next.skins });
    }
    if (next.skins >= SKIN_COUNT) chests = 0;
  }

  return { inv: [sparks, glitters, chests], owned: next, drops };
}

/** Old pouch and epic-chest progress becomes glitters and sparks. Already opened prizes stay owned. */
export function migrateLegacy(
  inv: [number, number, number, number],
  prizes: number,
): { inv: Inventory; owned: Owned; drops: UnlockDrop[] } {
  const split = legacyPrizeSplit(prizes);
  const sparks = take(inv[0]) + take(inv[3]) * Math.floor(HAT_COST / 5);
  const glitters = take(inv[1]) + take(inv[2]);
  return applyRewards([0, 0, 0], { sparks, glitters, chests: 0 }, { hats: split.hats, arts: 0, skins: split.skins });
}
