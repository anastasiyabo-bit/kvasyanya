import { HAT_UNLOCK_COUNT } from '../data/cosmetics';
import type { Inventory } from '../data/rewards';

export interface SaveData {
  version: 1;
  level: number;
  inventory: Inventory;
  hatsUnlocked: number;
  hat: number;
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
    version: 1,
    level: 1,
    inventory: [0, 0, 0, 0],
    hatsUnlocked: 0,
    hat: -1,
    skin: 0,
    music: true,
    sfx: true,
    tutorialDone: false,
    superHintDone: false,
    bestScore: {},
  };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function sanitize(raw: unknown): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  if (isNum(r.level) && r.level >= 1) d.level = Math.floor(r.level);
  if (Array.isArray(r.inventory) && r.inventory.length === 4 && r.inventory.every((x) => isNum(x) && x >= 0)) {
    d.inventory = r.inventory.map((x) => Math.floor(x as number)) as Inventory;
  }
  if (isNum(r.hatsUnlocked)) d.hatsUnlocked = Math.max(0, Math.floor(r.hatsUnlocked));
  if (isNum(r.hat)) d.hat = Math.floor(r.hat);
  const hatsOn = Math.min(d.hatsUnlocked, HAT_UNLOCK_COUNT);
  if (d.hat >= hatsOn) d.hat = hatsOn - 1;
  if (isNum(r.skin)) d.skin = Math.max(0, Math.floor(r.skin));
  const skinsOn = Math.max(0, d.hatsUnlocked - HAT_UNLOCK_COUNT);
  if (d.skin > skinsOn) d.skin = skinsOn;
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
  const progress = (s: SaveData) => s.level * 1000 + s.inventory[3] * 100 + s.inventory[2] * 10 + s.inventory[1];
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
