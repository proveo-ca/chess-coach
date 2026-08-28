// SPEC: _spec/apps/starchess/architecture/board-entities.puml
/**
 * Pivot math and rest poses for the inline units.
 *
 * This sits **below** `presentation/animations/` on purpose: the units render on
 * the resting board as well as inside combat VFX, so their geometry cannot live
 * in the animation layer without the board importing upward. `attackAnim.ts`
 * consumes this module; nothing here may import from `animations/`.
 *
 * It replaces the hand-extracted `rookAim.ts`, whose own docstring recorded the
 * duplicate-constant drift that splitting these values caused before.
 */

/** Resting twin-cannon aim for the siege tank (upper-left diagonal). */
export const ROOK_REST_AIM_DEG = -135;

/**
 * Anisotropic scale baked into `PIECE_FRAME.R` — turret yaw must conjugate
 * through this or `rotate(aim)` skews (siege tank looks tilted sideways).
 */
export const ROOK_FRAME_SCALE = { sx: 0.8299, sy: 1.0503 } as const;

/** King idle cannons face the player (down the board). */
export const KING_REST_AIM_DEG = 90;

/** SVG pivot: rotate `deg` around `(cx, cy)` with absolute-space children. */
export const svgPivotAround = (cx: number, cy: number, deg: number): string =>
  `translate(${cx} ${cy}) rotate(${deg}) translate(${-cx} ${-cy})`;

/**
 * Screen-space yaw under an anisotropic parent scale (e.g. rook PIECE_FRAME).
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

/** SVG pivot: local-space children at origin, then translate + rotate. */
export const svgPivotLocal = (cx: number, cy: number, deg: number): string =>
  `translate(${cx} ${cy}) rotate(${deg})`;

/**
 * How a unit is turned to face its target. Lives here rather than with the
 * attack-vector math because the units themselves take it as a prop — a board
 * component must be able to name the type without importing `animations/`.
 * `aimPoseFor` in `animations/attackVectors.ts` is what computes one.
 */
export type AimPose = {
  /** Horizontal mirror so legs stay down when the target is on the left. */
  mirrorX: boolean;
  /** CSS rotate after mirror — muzzle (+x) points at the target. */
  rotateDeg: number;
};

/**
 * Re-export, not a second copy: the duplicate that used to live in `rookAim.ts`
 * silently drifted from the canonical value in `presentation/constants`.
 */
export { SIEGE_TOGGLE_MS } from "~/presentation/constants";
