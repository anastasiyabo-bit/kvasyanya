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
export const COSMETIC_COUNT = HAT_UNLOCK_COUNT + SKIN_COUNT;

export function skinById(id: number): FrogSkin | null {
  return FROG_SKINS.find((s) => s.id === id) ?? null;
}
