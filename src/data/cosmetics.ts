export const HAT_NAMES = [
  'Корона',
  'Бантик',
  'Колпачок',
  'Ковбойка',
  'Поварёнок',
  'Кувшинка',
  'Каска',
  'Медка',
  'Помпон',
  'Венок',
  'Цилиндр',
  'Пират',
  'Волшебник',
  'Кепка',
  'Берет',
  'Панамка',
  'Зайка',
  'Единорог',
  'Викинг',
  'Сомбреро',
  'Котелок',
  'Диадема',
  'Новогодняя',
  'Пропеллер',
  'Мухомор',
  'Выпускник',
  'Сыщик',
  'Соломка',
  'Шут',
  'Кексик',
] as const;
export const HAT_UNLOCK_COUNT = HAT_NAMES.length;
export const DEFAULT_SKIN = 0;

export interface FrogSkin {
  id: number;
  name: string;
  body: [number, number, number];
  /** Kept light on every skin so the belly drawing stays readable. */
  belly: [number, number, number];
  /** Body shade colour; defaults to a darker body colour. */
  shadow?: [number, number, number];
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
    belly: [244, 226, 250],
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
  {
    id: 4,
    name: 'Лимонка',
    body: [255, 214, 44],
    belly: [255, 251, 222],
    shadow: [232, 128, 24],
    spot: [206, 150, 18],
    spots: 'body',
    pupil: 0x2b1d16,
  },
  {
    id: 5,
    name: 'Малинка',
    body: [255, 112, 164],
    belly: [255, 234, 242],
    spot: [210, 58, 118],
    spots: 'body',
    pupil: 0x2b1d16,
  },
  {
    id: 6,
    name: 'Шоколадка',
    body: [150, 96, 60],
    belly: [248, 230, 202],
    spot: [92, 54, 30],
    spots: 'body',
    pupil: 0x2b1d16,
  },
  {
    id: 7,
    name: 'Ночка',
    body: [70, 86, 180],
    belly: [228, 234, 255],
    haunch: [128, 96, 220],
    spot: [34, 40, 112],
    spots: 'body',
    pupil: 0x2b1d16,
  },
  {
    id: 8,
    name: 'Тучка',
    body: [150, 162, 180],
    belly: [246, 248, 252],
    spot: [96, 106, 126],
    spots: 'body',
    pupil: 0x2b1d16,
  },
] as const;

export const SKIN_COUNT = FROG_SKINS.length;
export const SKIN_NAMES = ['Квася', ...FROG_SKINS.map((s) => s.name)] as const;

/** Belly drawings. Three блестяшки open the next one. */
export const ART_NAMES = [
  'Сердечко',
  'Цветочек',
  'Бабочка',
  'Звёздочка',
  'Солнышко',
  'Коровка',
  'Грибочек',
  'Клевер',
  'Вишенки',
  'Месяц',
  'Рыбка',
  'Улитка',
  'Нотка',
  'Мороженка',
  'Радуга',
] as const;
export const ART_COUNT = ART_NAMES.length;

export type CosmeticUnlock = { kind: 'hat'; id: number } | { kind: 'skin'; id: number };

/** Sizes of the collection when prizes came from one mixed list. */
const LEGACY_HATS = 11;
const LEGACY_SKINS = 3;

/**
 * Old saves unlocked one mixed list (every 5th prize a skin).
 * Kept only so those prizes stay owned after the split into three tracks.
 */
function buildUnlockOrder(): CosmeticUnlock[] {
  const order: CosmeticUnlock[] = [];
  let hat = 0;
  let skin = 1;
  while (hat < LEGACY_HATS || skin <= LEGACY_SKINS) {
    const n = order.length + 1;
    if (n % 5 === 0 && skin <= LEGACY_SKINS) {
      order.push({ kind: 'skin', id: skin });
      skin += 1;
    } else if (hat < LEGACY_HATS) {
      order.push({ kind: 'hat', id: hat });
      hat += 1;
    } else {
      order.push({ kind: 'skin', id: skin });
      skin += 1;
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

export function isArtUnlocked(artId: number, artsUnlocked: number): boolean {
  return artId >= 0 && artId < artsUnlocked && artId < ART_COUNT;
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

export function lastUnlockedArt(artsUnlocked: number): number {
  const n = Math.max(0, Math.min(ART_COUNT, Math.floor(artsUnlocked)));
  return n <= 0 ? -1 : n - 1;
}

export function lastUnlockedSkin(skinsUnlocked: number): number {
  return Math.max(0, Math.min(SKIN_COUNT, Math.floor(skinsUnlocked)));
}

export function skinById(id: number): FrogSkin | null {
  return FROG_SKINS.find((s) => s.id === id) ?? null;
}
