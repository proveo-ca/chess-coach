/**
 * Shared special queue helpers — timing + single-commit used by every arm.
 * Extracted from `pawnGasArm.ts` so all arms share one owner.
 * // SPEC: _spec/apps/starchess/turn-input-sequence.puml
 */
import type { Square } from "chess.js";

import type {
  ScFenSnapshot,
  SpawnPiece,
  StarChessColor,
} from "@chess-coach/starchess-core";

import type { MatchStore } from "~/types/match";

/** B if no classical yet this turn for the side; else F (stack order). */
export const specialTimingFor = (
  queue: ScFenSnapshot["queue"],
  color: StarChessColor,
): "B" | "F" => {
  const side = queue?.actions.filter((a) => a.color === color) ?? [];
  return side.some((a) => a.timing === "C") ? "F" : "B";
};

/** Queue one special; false when the queue rejected it (no mutation). */
export const tryQueue = (
  store: MatchStore,
  action: {
    timing: "B" | "F" | "C";
    kind: string;
    color: StarChessColor;
    from: Square;
    to?: Square;
    unit?: SpawnPiece;
  },
  okMsg: string,
): boolean => {
  const beforeSnap = store.state().liveSnapshot;
  store.dispatch({ type: "QUEUE_ACTION", action: action as never });
  const after = store.state();
  if (after.liveSnapshot === beforeSnap) return false;
  store.dispatch({ type: "QUEUE_REJECT", message: okMsg });
  return true;
};
