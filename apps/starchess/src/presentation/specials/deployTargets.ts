// SPEC: _spec/apps/starchess/core/board/board-queries.puml, _spec/apps/starchess/core/turn/command-queue.puml
/**
 * Command Center deploy ring for the pick step — UI wrapper over the engine
 * `spawnKingAnchor` block set + `adjacentSquares`.
 *
 * Ally-crush aware: the engine block set is kings-only, so ally and enemy
 * non-king ring squares are all valid targets (deployed replaces occupant,
 * victim recorded; kings never crushable).
 */
import type { Square } from "chess.js";

import {
  adjacentSquares,
  spawnKingAnchor,
  type ScFenSnapshot,
  type StarChessColor,
} from "@chess-coach/starchess-core";

import { specialTimingFor } from "~/presentation/specials/queue";

export const ccDeployTargets = (
  snap: ScFenSnapshot,
  color: StarChessColor,
): { king: Square | null; targets: Square[] } => {
  const timing = specialTimingFor(snap.queue, color);
  const { king, allyOccupied } = spawnKingAnchor(snap, color, timing);
  if (!king) return { king: null, targets: [] };
  return { king, targets: adjacentSquares(king, allyOccupied) };
};
