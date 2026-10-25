import {
  BEAD_COUNT,
  HAT_UNLOCK_COUNT,
  isBeadUnlocked,
  isHatUnlocked,
  isSkinUnlocked,
  lastUnlockedBead,
  lastUnlockedHat,
  lastUnlockedSkin,
  SKIN_COUNT,
} from '../data/cosmetics';
import { migrateLegacy, type Inventory } from '../data/rewards';

export interface SaveData {
  version: 2;
  level: number;
  /** Remainder toward the next hat, necklace and skin: [sparks, glitters, chests]. */
  inventory: Inventory;
  hatsUnlocked: number;
  beadsUnlocked: number;
  skinsUnlocked: number;
  hat: number;
  bead: number;
  skin: number;
  music: boolean;
  sfx: boolean;
  tutorialDone: boolean;
  superHintDone: boolean;
  bestScore: Record<string, number>;
}

const KEY = 'nabey-bryushko-v1';

export function defaultSave(): SaveData {
  return {
    version: 2,
    level: 1,
    inventory: [0, 0, 0],
    hatsUnlocked: 0,
    beadsUnlocked: 0,
    skinsUnlocked: 0,
    hat: -1,
    bead: -1,
    skin: 0,
    music: true,
    sfx: true,
    tutorialDone: false,
    superHintDone: false,
    bestScore: {},
  };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function nums(v: unknown, len: number): number[] | null {
  if (!Array.isArray(v) || v.length !== len || !v.every((x) => isNum(x) && x >= 0)) return null;
  return v.map((x) => Math.floor(x as number));
}

export function sanitize(raw: unknown): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  if (isNum(r.level) && r.level >= 1) d.level = Math.floor(r.level);

  const legacy = nums(r.inventory, 4);
  const modern = nums(r.inventory, 3);
  if (legacy) {
    const prizes = isNum(r.hatsUnlocked) ? Math.floor(r.hatsUnlocked) : 0;
    const m = migrateLegacy(legacy as [number, number, number, number], prizes);
    d.inventory = m.inv;
    d.hatsUnlocked = m.owned.hats;
    d.beadsUnlocked = m.owned.beads;
    d.skinsUnlocked = m.owned.skins;
  } else if (modern) {
    d.inventory = modern as Inventory;
    if (isNum(r.hatsUnlocked)) d.hatsUnlocked = Math.max(0, Math.min(HAT_UNLOCK_COUNT, Math.floor(r.hatsUnlocked)));
    if (isNum(r.beadsUnlocked)) d.beadsUnlocked = Math.max(0, Math.min(BEAD_COUNT, Math.floor(r.beadsUnlocked)));
    if (isNum(r.skinsUnlocked)) d.skinsUnlocked = Math.max(0, Math.min(SKIN_COUNT, Math.floor(r.skinsUnlocked)));
  }

  if (isNum(r.hat)) d.hat = Math.floor(r.hat);
  if (d.hat >= 0 && !isHatUnlocked(d.hat, d.hatsUnlocked)) d.hat = lastUnlockedHat(d.hatsUnlocked);
  if (isNum(r.bead)) d.bead = Math.floor(r.bead);
  if (d.bead >= 0 && !isBeadUnlocked(d.bead, d.beadsUnlocked)) d.bead = lastUnlockedBead(d.beadsUnlocked);
  if (isNum(r.skin)) d.skin = Math.max(0, Math.floor(r.skin));
  if (!isSkinUnlocked(d.skin, d.skinsUnlocked)) d.skin = lastUnlockedSkin(d.skinsUnlocked);

  if (typeof r.music === 'boolean') d.music = r.music;
  if (typeof r.sfx === 'boolean') d.sfx = r.sfx;
  if (typeof r.tutorialDone === 'boolean') d.tutorialDone = r.tutorialDone;
  if (typeof r.superHintDone === 'boolean') d.superHintDone = r.superHintDone;
  if (r.bestScore && typeof r.bestScore === 'object') {
    for (const [k, v] of Object.entries(r.bestScore as Record<string, unknown>)) {
      if (isNum(v)) d.bestScore[k] = v;
    }
  }
  return d;
}

/** Prefers the save with more progress so a stale cloud copy never wipes local progress (or vice versa). */
export function mergeSaves(a: SaveData, b: SaveData): SaveData {
  const progress = (s: SaveData) =>
    s.level * 10000 + s.hatsUnlocked * 100 + s.skinsUnlocked * 30 + s.beadsUnlocked * 10 + s.inventory[0] + s.inventory[1] + s.inventory[2];
  return progress(b) > progress(a) ? b : a;
}

let current: SaveData = defaultSave();
let remoteWriter: ((d: SaveData) => void) | null = null;

export const Save = {
  get data(): SaveData {
    return current;
  },
  loadLocal(): SaveData {
    try {
      const txt = window.localStorage.getItem(KEY);
      current = txt ? sanitize(JSON.parse(txt)) : defaultSave();
    } catch {
      current = defaultSave();
    }
    return current;
  },
  adoptRemote(raw: unknown) {
    if (!raw || typeof raw !== 'object' || Object.keys(raw as object).length === 0) return;
    const remote = sanitize(raw);
    const merged = mergeSaves(current, remote);
    if (merged === remote) {
      merged.music = current.music;
      merged.sfx = current.sfx;
      current = merged;
      this.write();
    }
  },
  setRemoteWriter(fn: (d: SaveData) => void) {
    remoteWriter = fn;
  },
  write() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(current));
    } catch {
      /* storage may be blocked inside some iframes */
    }
    remoteWriter?.(current);
  },
  update(fn: (d: SaveData) => void) {
    fn(current);
    this.write();
  },
};
