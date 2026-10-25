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

/** Necklaces. A блестяшка is a bead; three of them string the next necklace. */
export const BEAD_NAMES = ['Жемчуг', 'Ягодки', 'Звёздочки', 'Сердечки', 'Искорки'] as const;
export const BEAD_COUNT = BEAD_NAMES.length;
export const BEAD_STYLES = ['pearl', 'berry', 'star', 'heart', 'spark'] as const;
export type BeadStyle = (typeof BEAD_STYLES)[number];

export type CosmeticUnlock = { kind: 'hat'; id: number } | { kind: 'skin'; id: number };

/**
 * Old saves unlocked one mixed list (every 5th prize a skin).
 * Kept only so those prizes stay owned after the split into three tracks.
 */
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

const UNLOCK_ORDER: readonly CosmeticUnlock[] = buildUnlockOrder();

/** How many hats and skins a legacy prize counter had already granted. */
export function legacyPrizeSplit(prizes: number): { hats: number; skins: number } {
  let hats = 0;
  let skins = 0;
  const n = Math.max(0, Math.min(UNLOCK_ORDER.length, Math.floor(prizes)));
  for (let i = 0; i < n; i++) {
    if (UNLOCK_ORDER[i].kind === 'hat') hats += 1;
    else skins += 1;
  }
  return { hats, skins };
}

export function isHatUnlocked(hatId: number, hatsUnlocked: number): boolean {
  return hatId >= 0 && hatId < hatsUnlocked && hatId < HAT_UNLOCK_COUNT;
}

export function isBeadUnlocked(beadId: number, beadsUnlocked: number): boolean {
  return beadId >= 0 && beadId < beadsUnlocked && beadId < BEAD_COUNT;
}

/** Skin 0 is the free green Kvasi. Skins 1..skinsUnlocked are the opened colourways. */
export function isSkinUnlocked(skinId: number, skinsUnlocked: number): boolean {
  if (skinId <= 0) return true;
  return skinId <= skinsUnlocked && skinId <= SKIN_COUNT;
}

export function lastUnlockedHat(hatsUnlocked: number): number {
  const n = Math.max(0, Math.min(HAT_UNLOCK_COUNT, Math.floor(hatsUnlocked)));
  return n <= 0 ? -1 : n - 1;
}

export function lastUnlockedBead(beadsUnlocked: number): number {
  const n = Math.max(0, Math.min(BEAD_COUNT, Math.floor(beadsUnlocked)));
  return n <= 0 ? -1 : n - 1;
}

export function lastUnlockedSkin(skinsUnlocked: number): number {
  return Math.max(0, Math.min(SKIN_COUNT, Math.floor(skinsUnlocked)));
}

export function skinById(id: number): FrogSkin | null {
  return FROG_SKINS.find((s) => s.id === id) ?? null;
}
