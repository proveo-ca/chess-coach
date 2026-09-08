// SPEC: _spec/specials/mecha-charon.puml
import {
  FRAG_FLIGHT_MS,
  cellSize,
  centeredBoxStyle,
  squareBoxStyle,
} from "~/presentation/animations/attackAnim";
import {
  aimPoseFor,
  aimTransformCss,
  squareCenterPx,
} from "~/presentation/animations/attackVectors";
import { vecBetween } from "~/presentation/animations/boardGeom";
import type { AttackCue } from "~/presentation/types";

/**
 * Mecha special attack cue id — Charon Booster Missiles (`data-attack-anim`).
 * String value `"bishopCharon"` is wire-frozen (VFX cue coverage e2e) —
 * only the symbol moved to StarChess terms.
 */
export const MECHA_CHARON = "bishopCharon" as const;

/**
 * Rotated origin-square volley frame: local +x points at the ship so the
 * longitudinal missile channel is 1-D (`translateX(var(--charon-span))`).
 * Fizzle cues (no ship at resolve) extend the span past the ray edge so the
 * missiles visibly fly off the board instead of stopping on an empty square.
 */
export const charonVolleyStyle = (
  cue: AttackCue,
  boardWidth: number,
  boardHeight: number,
): Record<string, string> => {
  const { w: cell } = cellSize({ width: boardWidth, height: boardHeight });
  const vec = vecBetween(cue.from, cue.to);
  const span = cell * Math.hypot(vec.df, vec.dr);
  return {
    ...squareBoxStyle(cue.from, boardWidth, boardHeight),
    transform: aimTransformCss(aimPoseFor(vec)),
    "transform-origin": "50% 50%",
    "--attack-ms": `${FRAG_FLIGHT_MS}ms`,
    "--charon-span": `${cue.fizzle ? span + cell * 2.5 : span}px`,
    "--charon-arc": `${cell * 0.42}px`,
  };
};

/** End-of-missile burst on the ship square (timed to the 250ms impact). */
export const charonImpactStyle = (
  cue: AttackCue,
  boardWidth: number,
  boardHeight: number,
): Record<string, string> => {
  const { w: cell } = cellSize({ width: boardWidth, height: boardHeight });
  return {
    ...centeredBoxStyle(
      squareCenterPx(cue.to, boardWidth, boardHeight),
      cell * 1.15,
      cell * 1.15,
    ),
    "--attack-ms": `${FRAG_FLIGHT_MS}ms`,
  };
};
