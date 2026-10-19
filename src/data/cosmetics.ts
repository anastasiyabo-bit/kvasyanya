export const HAT_UNLOCK_COUNT = 11;
export const DEFAULT_SKIN = 0;

export interface FrogSkin {
  id: number;
  name: string;
  body: [number, number, number];
  belly: [number, number, number];
  flank?: [number, number, number];
  haunch?: [number, number, number];
  spot: [number, number, number];
  spots: 'none' | 'flank' | 'body';
  pupil: number;
}

/** Unlockable colourways painted onto the same Kvasi outline. */
export const FROG_SKINS: readonly FrogSkin[] = [
  {
    id: 1,
    name: 'Огонька',
    body: [255, 126, 32],
    belly: [255, 236, 188],
    flank: [244, 186, 38],
    haunch: [48, 104, 226],
    spot: [22, 14, 10],
    spots: 'flank',
    pupil: 0x2b1d16,
  },
  {
    id: 2,
    name: 'Ягодка',
    body: [186, 74, 228],
    belly: [198, 122, 218],
    spot: [92, 36, 132],
    spots: 'body',
    pupil: 0x2b1d16,
  },
  {
    id: 3,
    name: 'Лазурка',
    body: [62, 196, 196],
    belly: [236, 252, 246],
    haunch: [255, 138, 48],
    spot: [22, 88, 96],
    spots: 'body',
    pupil: 0xc81e1e,
  },
] as const;

export const SKIN_COUNT = FROG_SKINS.length;
export const SKIN_NAMES = ['Квася', ...FROG_SKINS.map((s) => s.name)] as const;

export type CosmeticUnlock = { kind: 'hat'; id: number } | { kind: 'skin'; id: number };

/** Every 5th prize is a skin; the rest are hats. Default green Kvasi is free. */
function buildUnlockOrder(): CosmeticUnlock[] {
  const order: CosmeticUnlock[] = [];
  let hat = 0;
  let skin = 1;
  while (hat < HAT_UNLOCK_COUNT || skin <= SKIN_COUNT) {
    const n = order.length + 1;
    if (n % 5 === 0 && skin <= SKIN_COUNT) {
      order.push({ kind: 'skin', id: skin });
      skin += 1;
    } else if (hat < HAT_UNLOCK_COUNT) {
      order.push({ kind: 'hat', id: hat });
      hat += 1;
    } else if (skin <= SKIN_COUNT) {
      order.push({ kind: 'skin', id: skin });
      skin += 1;
    } else {
      break;
    }
  }
  return order;
}

export const UNLOCK_ORDER: readonly CosmeticUnlock[] = buildUnlockOrder();
export const COSMETIC_COUNT = UNLOCK_ORDER.length;

export function isHatUnlocked(hatId: number, unlocked: number): boolean {
  if (hatId < 0) return true;
  return UNLOCK_ORDER.slice(0, Math.max(0, unlocked)).some((x) => x.kind === 'hat' && x.id === hatId);
}

export function isSkinUnlocked(skinId: number, unlocked: number): boolean {
  if (skinId <= 0) return true;
  return UNLOCK_ORDER.slice(0, Math.max(0, unlocked)).some((x) => x.kind === 'skin' && x.id === skinId);
}

export function lastUnlockedHat(unlocked: number): number {
  let hat = -1;
  for (const x of UNLOCK_ORDER.slice(0, Math.max(0, unlocked))) {
    if (x.kind === 'hat') hat = x.id;
  }
  return hat;
}

export function lastUnlockedSkin(unlocked: number): number {
  let skin = 0;
  for (const x of UNLOCK_ORDER.slice(0, Math.max(0, unlocked))) {
    if (x.kind === 'skin') skin = x.id;
  }
  return skin;
}

export function skinById(id: number): FrogSkin | null {
  return FROG_SKINS.find((s) => s.id === id) ?? null;
}
