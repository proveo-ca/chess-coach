// SPEC: _spec/apps/starchess/architecture/board-entities.puml
/**
 * Single owner for rook siege/tank mode from a sieged-rook set.
 * Used by planning occupancy, fog, intent overlays, board, and timeline cues.
 */
import type { Square } from "chess.js";
import type { RookMode } from "@chess-coach/starchess-core";

export const rookModeForSieged =
  (sieged: ReadonlySet<Square> | readonly Square[]) =>
  (sq: Square): RookMode => {
    const hit =
      sieged instanceof Set ? sieged.has(sq) : (sieged as readonly Square[]).includes(sq);
    return hit ? "siege" : "tank";
  };

/** One-shot lookup (timeline death/attack cues). */
export const rookModeAt = (
  sq: Square,
  sieged: ReadonlySet<Square> | readonly Square[],
): RookMode => rookModeForSieged(sieged)(sq);
