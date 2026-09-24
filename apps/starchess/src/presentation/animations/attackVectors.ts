import type { Square } from "chess.js";

import type { DemoPiece } from "~/presentation/animations/attackAnim";
import type { AimPose } from "~/presentation/pieces/geometry";

export type { DemoPiece } from "~/presentation/animations/attackAnim";

/** File/rank deltas from the attacker (white’s +rank is toward the opponent). */
export type AttackVec = {
  df: number;
  dr: number;
};

export const squareAt = (origin: Square, vec: AttackVec): Square | null => {
  const file = origin.charCodeAt(0) - 97 + vec.df;
  const rank = Number(origin[1]) + vec.dr;
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  return `${String.fromCharCode(97 + file)}${rank}` as Square;
};

/** Screen degrees: 0 = +file (right), 90 = toward rank 1 (down the board). */
export const screenAngleDeg = (vec: AttackVec): number =>
  (Math.atan2(-vec.dr, vec.df) * 180) / Math.PI;

const hoverbikeOffsets: AttackVec[] = [
  { df: 1, dr: 2 },
  { df: 2, dr: 1 },
  { df: 2, dr: -1 },
  { df: 1, dr: -2 },
  { df: -1, dr: -2 },
  { df: -2, dr: -1 },
  { df: -2, dr: 1 },
  { df: -1, dr: 2 },
];

const diagDirs: AttackVec[] = [
  { df: 1, dr: 1 },
  { df: 1, dr: -1 },
  { df: -1, dr: -1 },
  { df: -1, dr: 1 },
];

const orthoDirs: AttackVec[] = [
  { df: 0, dr: 1 },
  { df: 1, dr: 0 },
  { df: 0, dr: -1 },
  { df: -1, dr: 0 },
];

/** Eight surrounding squares (BattleShip/Command Center adjacent). */
export const surround8: AttackVec[] = [
  { df: 0, dr: 1 },
  { df: 1, dr: 1 },
  { df: 1, dr: 0 },
  { df: 1, dr: -1 },
  { df: 0, dr: -1 },
  { df: -1, dr: -1 },
  { df: -1, dr: 0 },
  { df: -1, dr: 1 },
];

/** Legal attack vectors for the demo origin (clipped to the board). */
export const attackVectorsFor = (
  piece: DemoPiece,
  origin: Square,
  color: "w" | "b" = "w",
): AttackVec[] => {
  const keep = (vecs: AttackVec[]) => vecs.filter((v) => squareAt(origin, v) != null);

  switch (piece) {
    case "p": {
      // Capture diagonals toward that color’s forward rank.
      const dr = color === "w" ? 1 : -1;
      return keep([
        { df: -1, dr },
        { df: 1, dr },
      ]);
    }
    case "n":
      return keep(hoverbikeOffsets);
    case "b":
      return keep(diagDirs);
    case "r":
      return keep(orthoDirs);
    case "q":
    case "k":
      return keep(surround8);
  }
};

/**
 * SVG-local “muzzle forward” angle (0 = +x right, 90 = +y down) after we normalize
 * each inline piece so its attack aims along +x.
 */
export const AIM_FORWARD_DEG = 0;

/** Canonical definition is a layer down, with the rest of the pose geometry. */
export type { AimPose } from "~/presentation/pieces/geometry";

const normalizeDeg = (deg: number): number =>
  ((((deg + 180) % 360) + 360) % 360) - 180;

/**
 * Aim without spinning the unit upside-down: keep head up / legs down, mirror
 * when the target is in the left half-plane, then tilt so +x meets the target.
 * Marine example: diag-right = rotate(-45°); diag-left = scaleX(-1) rotate(-45°).
 */
export const aimPoseFor = (vec: AttackVec): AimPose => {
  const theta = screenAngleDeg(vec) - AIM_FORWARD_DEG;
  const rad = (theta * Math.PI) / 180;
  const mirrorX = Math.cos(rad) < -1e-9;
  const rotateDeg = normalizeDeg(mirrorX ? 180 - theta : theta);
  return { mirrorX, rotateDeg };
};

/**
 * Siege Tank move facing — hull is a fixed ¾ front silhouette, so file travel
 * (up/down) keeps rest orientation; rank travel turns around in place.
 * Rest art reads leftish (guns ≈ −135°); a half-turn faces right.
 * Mirror is forbidden here (it reads papery mid-slide): rotation only,
 * so `mirrorX` is always false and callers never emit `scaleX(-1)`.
 *
 * @deprecated Do not apply this to the mover root: rotating the root flips
 * the hull upside down (tracks on top). The root must stay unrotated and only
 * the turret yaws (see the `r` branch of `MoveAnimation`, which aims the
 * turret along travel via `screenAngleDeg` instead). Kept exported so the
 * `animations/index.ts` barrel does not break external importers.
 */
export const tankTravelPose = (vec: AttackVec): AimPose => {
  if (vec.df === 0) return { mirrorX: false, rotateDeg: 0 };
  return { mirrorX: false, rotateDeg: vec.df > 0 ? 180 : 0 };
};

export const aimTransformCss = (pose: AimPose): string => {
  const flip = pose.mirrorX ? "scaleX(-1) " : "";
  return `${flip}rotate(${pose.rotateDeg}deg)`;
};

/**
 * Hoverbike L waypoint: travel the length-2 leg first, then the length-1 leg.
 * Returns the elbow offset from the origin (not the final square).
 */
export const hoverbikeElbowVec = (vec: AttackVec): AttackVec => {
  if (Math.abs(vec.df) === 2 && Math.abs(vec.dr) === 1) return { df: vec.df, dr: 0 };
  if (Math.abs(vec.dr) === 2 && Math.abs(vec.df) === 1) return { df: 0, dr: vec.dr };
  return { df: 0, dr: 0 };
};

/** Long leg then short leg of a Hoverbike L (deltas along each segment). */
export const hoverbikeLegVecs = (vec: AttackVec): { leg1: AttackVec; leg2: AttackVec } => {
  const leg1 = hoverbikeElbowVec(vec);
  return { leg1, leg2: { df: vec.df - leg1.df, dr: vec.dr - leg1.dr } };
};

/**
 * Hoverbike facing: one of the 4 diagonals in the target’s quadrant (not the
 * orthogonal long-leg of the L).
 */
export const hoverbikeAimDiagVec = (vec: AttackVec): AttackVec => ({
  df: Math.sign(vec.df) || 1,
  dr: Math.sign(vec.dr) || 1,
});

/** Pixel center of a square inside an 8×8 board overlay (white at bottom). */
export const squareCenterPx = (
  sq: Square,
  boardWidth: number,
  boardHeight: number,
): { x: number; y: number } => {
  const file = sq.charCodeAt(0) - 97;
  const rank = Number(sq[1]);
  const cellW = boardWidth / 8;
  const cellH = boardHeight / 8;
  return {
    x: (file + 0.5) * cellW,
    y: (8 - rank + 0.5) * cellH,
  };
};
