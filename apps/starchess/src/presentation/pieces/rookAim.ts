/** Minimal attack/aim helpers for InlineRook. */
export const ROOK_REST_AIM_DEG = -135;

/**
 * Anisotropic scale baked into NERD_FRAME.R — turret yaw must conjugate through
 * this or `rotate(aim)` skews (siege tank looks tilted sideways).
 */
export const NERD_ROOK_SCALE = { sx: 0.8299, sy: 1.0503 } as const;

/** SVG pivot: rotate `deg` around `(cx, cy)` with absolute-space children. */
export const svgPivotAround = (cx: number, cy: number, deg: number): string =>
  `translate(${cx} ${cy}) rotate(${deg}) translate(${-cx} ${-cy})`;

/**
 * Screen-space yaw under an anisotropic parent scale (rook NERD_FRAME).
 * Uses S⁻¹ R S so the turret rotates rigidly instead of shearing.
 */
export const svgPivotAroundAniso = (
  cx: number,
  cy: number,
  deg: number,
  sx: number,
  sy: number,
): string =>
  `translate(${cx} ${cy}) scale(${1 / sx} ${1 / sy}) rotate(${deg}) scale(${sx} ${sy}) translate(${-cx} ${-cy})`;

export const SIEGE_TOGGLE_MS = 480;
