import type { Square } from "chess.js";

import { ATTACK_MS } from "~/broodwar/constants";
import type { AttackAnimKind } from "~/types/broodwar";

export { ATTACK_MS, FRAG_FLIGHT_MS } from "~/broodwar/constants";
export type { AttackAnimKind } from "~/types/broodwar";

export type DemoPiece = "p" | "n" | "b" | "r" | "q" | "k";

export const ANIM_BY_PIECE: Record<DemoPiece, AttackAnimKind> = {
  p: "pawnRifle",
  n: "knightFrag",
  b: "bishopGatlings",
  r: "rookBattery",
  q: "queenLaser",
  k: "kingDualCannon",
};

/** Stand still facing the player before each attack — one attack window. */
export const IDLE_FRONT_MS = ATTACK_MS;

/** Resting twin-cannon aim in `public/pieces/nerd/*R.svg` (upper-left diagonal). */
export const ROOK_REST_AIM_DEG = -135;

/** King idle cannons face the player (down the board). */
export const KING_REST_AIM_DEG = 90;


/**
 * Absolute screen aim for a turret: live `aimDeg` while active, else `restDeg`.
 */
export const screenAimDeg = (active: boolean, aimDeg: number, restDeg: number): number =>
  active ? aimDeg : restDeg;

/**
 * Which silhouette to show while attacking (camera-relative, white at bottom).
 *
 * - Pawn / bishop: team rear (`back`) when firing up the board (`dr > 0`);
 *   front glass when firing down. Same rule for both colors — opponent pieces
 *   keep the glass toward the camera when they shoot at the player (do not
 *   reuse white’s “toward-opponent ⇒ back” test, which would hide it).
 */
export const attackFaceFor = (
  piece: DemoPiece,
  vec: { df: number; dr: number },
): "front" | "back" => {
  if (piece === "p" || piece === "b") return vec.dr > 0 ? "back" : "front";
  return "front";
};

/** SVG pivot: rotate `deg` around `(cx, cy)` with absolute-space children. */
export const svgPivotAround = (cx: number, cy: number, deg: number): string =>
  `translate(${cx} ${cy}) rotate(${deg}) translate(${-cx} ${-cy})`;

/** SVG pivot: local-space children at origin, then translate + rotate. */
export const svgPivotLocal = (cx: number, cy: number, deg: number): string =>
  `translate(${cx} ${cy}) rotate(${deg})`;

export type BoardBox = { width: number; height: number };

export const cellSize = (box: BoardBox): { w: number; h: number } => ({
  w: box.width / 8,
  h: box.height / 8,
});

/** Cover one board square (white at bottom). */
export const squareBoxStyle = (
  sq: Square,
  boardWidth: number,
  boardHeight: number,
): Record<string, string> => {
  const file = sq.charCodeAt(0) - 97;
  const rank = Number(sq[1]);
  const { w, h } = cellSize({ width: boardWidth, height: boardHeight });
  return {
    left: `${file * w}px`,
    top: `${(8 - rank) * h}px`,
    width: `${w}px`,
    height: `${h}px`,
  };
};

/** Centered box on a square (e.g. star burst). */
export const centeredBoxStyle = (
  c: { x: number; y: number },
  width: number,
  height: number,
): Record<string, string> => ({
  left: `${c.x}px`,
  top: `${c.y}px`,
  width: `${width}px`,
  height: `${height}px`,
  "margin-left": `${-width / 2}px`,
  "margin-top": `${-height / 2}px`,
});

/** Ground-anchored box (e.g. rook impact rising from square bottom). */
export const groundedBoxStyle = (
  c: { x: number; y: number },
  width: number,
  height: number,
  groundYOffset: number,
): Record<string, string> => ({
  left: `${c.x}px`,
  top: `${c.y + groundYOffset}px`,
  width: `${width}px`,
  height: `${height}px`,
  "margin-left": `${-width / 2}px`,
  "margin-top": `${-height}px`,
});

/** Muzzle offset from piece center given an aim pose (CSS y-down). */
export const muzzleOffsetPx = (
  pose: { mirrorX: boolean; rotateDeg: number },
  dist: number,
): { x: number; y: number } => {
  const α = (pose.rotateDeg * Math.PI) / 180;
  let x = dist * Math.cos(α);
  const y = dist * Math.sin(α);
  if (pose.mirrorX) x = -x;
  return { x, y };
};
