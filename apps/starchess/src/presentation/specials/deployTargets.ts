// SPEC: _spec/apps/starchess/core/board/board-queries.puml, _spec/apps/starchess/core/turn/command-queue.puml
/**
 * Command Center deploy ring for the pick step — UI wrapper over the engine
 * `spawnCCAnchor` block set + `adjacentSquares`.
 *
 * Ally-crush aware: the engine block set is Command Centers-only, so ally and enemy
 * non-Command Center ring squares are all valid targets (deployed replaces occupant,
 * victim recorded; Command Centers never crushable).
 */
import type { Square } from "chess.js";

import {
  adjacentSquares,
  spawnCCAnchor,
  type ScFenSnapshot,
  type StarChessColor,
} from "@chess-coach/starchess-core";

import { specialTimingFor } from "~/presentation/specials/queue";

export const ccDeployTargets = (
  snap: ScFenSnapshot,
  color: StarChessColor,
): { commandCenter: Square | null; targets: Square[] } => {
  const timing = specialTimingFor(snap.queue, color);
  const { commandCenter, allyOccupied } = spawnCCAnchor(snap, color, timing);
  if (!commandCenter) return { commandCenter: null, targets: [] };
  return { commandCenter, targets: adjacentSquares(commandCenter, allyOccupied) };
};
