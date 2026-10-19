export const DOUBLE_TONGUE_MS = 8000;

export interface TongueTarget {
  hittable: boolean;
  x: number;
  y: number;
  pairPartner?: TongueTarget | null;
}

/** Other fly the double tongue should grab. Prefers a live pair partner, else the nearest hittable. */
export function pickSecondTongueTarget<T extends TongueTarget>(insects: readonly T[], primary: T): T | null {
  const partner = primary.pairPartner;
  if (partner && partner !== primary && partner.hittable) return partner as T;

  let best: T | null = null;
  let bestD = Infinity;
  for (const ins of insects) {
    if (ins === primary || !ins.hittable) continue;
    const d = (ins.x - primary.x) ** 2 + (ins.y - primary.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = ins;
    }
  }
  return best;
}
