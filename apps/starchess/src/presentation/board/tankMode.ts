// SPEC: _spec/apps/starchess/architecture/board-entities.puml
/**
 * Single owner for Tank siege/tank mode from a sieged-Tank set.
 * Used by planning occupancy, fog, intent overlays, board, and timeline cues.
 */
import type { Square } from "chess.js";
import type { TankMode } from "@chess-coach/starchess-core";

export const tankModeForSieged =
  (sieged: ReadonlySet<Square> | readonly Square[]) =>
  (sq: Square): TankMode => {
    const hit =
      sieged instanceof Set ? sieged.has(sq) : (sieged as readonly Square[]).includes(sq);
    return hit ? "siege" : "tank";
  };

/** One-shot lookup (timeline death/attack cues). */
export const tankModeAt = (
  sq: Square,
  sieged: ReadonlySet<Square> | readonly Square[],
): TankMode => tankModeForSieged(sieged)(sq);
