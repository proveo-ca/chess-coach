/** Minimal attack/aim helpers for InlineRook. */
export const ROOK_REST_AIM_DEG = -135;

/** SVG pivot: rotate `deg` around `(cx, cy)` with absolute-space children. */
export const svgPivotAround = (cx: number, cy: number, deg: number): string =>
  `translate(${cx} ${cy}) rotate(${deg}) translate(${-cx} ${-cy})`;

export const SIEGE_TOGGLE_MS = 480;
