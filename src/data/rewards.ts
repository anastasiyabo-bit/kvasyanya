import { HAT_UNLOCK_COUNT } from './cosmetics';

export { COSMETIC_COUNT } from './cosmetics';
export const TIER_NAMES = ['Искорка', 'Блестяшка', 'Мешочек', 'Эпический сундук'] as const;
export const FUSE_COUNT = 5;

/** Inventory counts per tier: [sparks, glitters, pouches, epics]. */
export type Inventory = [number, number, number, number];

export type CascadeEvent =
  | { type: 'add'; tier: 0 }
  | { type: 'fuse'; from: 0 | 1 | 2 }
  | { type: 'openEpic' };

function drain(inv: Inventory, events: CascadeEvent[]): { epicsGained: number; epicsOpened: number } {
  let epicsGained = 0;
  let epicsOpened = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (let t = 0 as 0 | 1 | 2; t < 3; t = (t + 1) as 0 | 1 | 2) {
      if (inv[t] >= FUSE_COUNT) {
        inv[t] -= FUSE_COUNT;
        inv[t + 1] += 1;
        events.push({ type: 'fuse', from: t });
        if (t === 2) epicsGained += 1;
        changed = true;
      }
    }
    while (inv[3] >= FUSE_COUNT) {
      inv[3] -= FUSE_COUNT;
      events.push({ type: 'openEpic' });
      epicsOpened += 1;
      changed = true;
    }
  }
  return { epicsGained, epicsOpened };
}

/** Adds sparks one by one, fusing 5 of a tier into 1 of the next. 5 epic chests open (counter resets) and count toward a hat. */
export function runCascade(
  start: Inventory,
  sparks: number,
): { inv: Inventory; events: CascadeEvent[]; epicsGained: number; epicsOpened: number } {
  const inv: Inventory = [...start] as Inventory;
  const events: CascadeEvent[] = [];
  let { epicsGained, epicsOpened } = drain(inv, events);
  const n = Math.max(0, Math.floor(sparks));
  for (let i = 0; i < n; i++) {
    inv[0] += 1;
    events.push({ type: 'add', tier: 0 });
    const d = drain(inv, events);
    epicsGained += d.epicsGained;
    epicsOpened += d.epicsOpened;
  }
  return { inv, events, epicsGained, epicsOpened };
}

export interface RewardInput {
  stars: number;
  caught: number;
}

/** One spark per caught insect; nothing if the level is failed. */
export function sparksForLevel(r: RewardInput): number {
  if (r.stars <= 0) return 0;
  return Math.max(0, Math.floor(r.caught));
}

/** Hats to unlock this cascade: one per new epic, and at least one per completed set of 5. */
export function hatsEarned(epicsGained: number, epicsOpened: number): number {
  return Math.max(0, Math.floor(epicsGained), Math.floor(epicsOpened));
}

export function grantUnlocks(
  unlocked: number,
  cap: number,
  grants: number,
): { unlocked: number; hat: number; skin: number; newHats: number[]; newSkins: number[] } {
  const newHats: number[] = [];
  const newSkins: number[] = [];
  let n = Math.max(0, unlocked);
  let hat = Math.min(n, HAT_UNLOCK_COUNT) - 1;
  let skin = Math.max(0, n - HAT_UNLOCK_COUNT);
  for (let i = 0; i < grants && n < cap; i++) {
    n += 1;
    if (n <= HAT_UNLOCK_COUNT) {
      hat = n - 1;
      newHats.push(hat);
    } else {
      skin = n - HAT_UNLOCK_COUNT;
      newSkins.push(skin);
    }
  }
  return { unlocked: n, hat, skin, newHats, newSkins };
}

/** Hats first, then colour skins. `hatCap` is the total cosmetic cap when used from the game. */
export function grantHats(
  hatsUnlocked: number,
  hatCap: number,
  grants: number,
): { hatsUnlocked: number; hat: number; newHats: number[] } {
  const r = grantUnlocks(hatsUnlocked, hatCap, grants);
  return { hatsUnlocked: r.unlocked, hat: r.hat, newHats: r.newHats };
}
