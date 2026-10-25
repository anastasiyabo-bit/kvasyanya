/** Tap targets come from the body box, which is the same on both wing frames. */

export interface BodyBox {
  /** Centre offset from the frame centre and size, texture pixels. */
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/** Finger slack around the body, display px. */
export const HIT_SLACK = 12;

export function bodyHitRadius(body: BodyBox, scale: number): number {
  return (Math.max(body.w, body.h) / 2) * scale + HIT_SLACK;
}

/** `x` is the body centre. Forward of `headSplit` (display px, along the flight direction) is the head. */
export function zoneAt(px: number, x: number, dir: 1 | -1, headSplit: number): 'eat' | 'lick' {
  return (px - x) * dir >= headSplit ? 'eat' : 'lick';
}
