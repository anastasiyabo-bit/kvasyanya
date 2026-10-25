import {
  ART_COUNT,
  HAT_UNLOCK_COUNT,
  isArtUnlocked,
  isHatUnlocked,
  isSkinUnlocked,
  lastUnlockedArt,
  lastUnlockedHat,
  lastUnlockedSkin,
  SKIN_COUNT,
} from '../data/cosmetics';
import { migrateLegacy, type Inventory } from '../data/rewards';

export interface SaveData {
  version: 2;
  level: number;
  /** Remainder toward the next hat, belly drawing and skin: [sparks, glitters, chests]. */
  inventory: Inventory;
  hatsUnlocked: number;
  artsUnlocked: number;
  skinsUnlocked: number;
  hat: number;
  art: number;
  skin: number;
  music: boolean;
  sfx: boolean;
  tutorialDone: boolean;
  superHintDone: boolean;
  /** Guest and quiet-hour rules the player has already been shown. */
  seenRules: string[];
  bestScore: Record<string, number>;
}

const KEY = 'nabey-bryushko-v1';

export function defaultSave(): SaveData {
  return {
    version: 2,
    level: 1,
    inventory: [0, 0, 0],
    hatsUnlocked: 0,
    artsUnlocked: 0,
    skinsUnlocked: 0,
    hat: -1,
    art: -1,
    skin: 0,
    music: true,
    sfx: true,
    tutorialDone: false,
    superHintDone: false,
    seenRules: [],
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
    d.artsUnlocked = m.owned.arts;
    d.skinsUnlocked = m.owned.skins;
  } else if (modern) {
    d.inventory = modern as Inventory;
    if (isNum(r.hatsUnlocked)) d.hatsUnlocked = Math.max(0, Math.min(HAT_UNLOCK_COUNT, Math.floor(r.hatsUnlocked)));
    const arts = isNum(r.artsUnlocked) ? r.artsUnlocked : r.beadsUnlocked;
    if (isNum(arts)) d.artsUnlocked = Math.max(0, Math.min(ART_COUNT, Math.floor(arts)));
    if (isNum(r.skinsUnlocked)) d.skinsUnlocked = Math.max(0, Math.min(SKIN_COUNT, Math.floor(r.skinsUnlocked)));
  }

  if (isNum(r.hat)) d.hat = Math.floor(r.hat);
  if (d.hat >= 0 && !isHatUnlocked(d.hat, d.hatsUnlocked)) d.hat = lastUnlockedHat(d.hatsUnlocked);
  const art = isNum(r.art) ? r.art : r.bead;
  if (isNum(art)) d.art = Math.floor(art);
  if (d.art >= 0 && !isArtUnlocked(d.art, d.artsUnlocked)) d.art = lastUnlockedArt(d.artsUnlocked);
  if (isNum(r.skin)) d.skin = Math.max(0, Math.floor(r.skin));
  if (!isSkinUnlocked(d.skin, d.skinsUnlocked)) d.skin = lastUnlockedSkin(d.skinsUnlocked);

  if (typeof r.music === 'boolean') d.music = r.music;
  if (typeof r.sfx === 'boolean') d.sfx = r.sfx;
  if (typeof r.tutorialDone === 'boolean') d.tutorialDone = r.tutorialDone;
  if (typeof r.superHintDone === 'boolean') d.superHintDone = r.superHintDone;
  if (Array.isArray(r.seenRules)) d.seenRules = [...new Set(r.seenRules.filter((s): s is string => typeof s === 'string'))];
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
    s.level * 10000 + s.hatsUnlocked * 100 + s.skinsUnlocked * 30 + s.artsUnlocked * 10 + s.inventory[0] + s.inventory[1] + s.inventory[2];
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
