/**
 * Marine gas drop arm — the pawn `pawnDouble` handler used by StarChessScreen.
 * Extracted so the real drop path is unit-testable via {@link armPieceSpecial}.
 * // SPEC: _spec/apps/starchess/turn-input-sequence.puml
 */
import type { PieceSymbol, Square } from "chess.js";

import {
  pawnSingleTarget,
  type ScFenSnapshot,
  type SpawnPiece,
  type StarChessColor,
} from "@chess-coach/starchess-core";

import { viewerColor } from "~/app/matchEconomy";
import type { MatchStore } from "~/types/match";
import { moveThenGasPromotes } from "~/presentation/board/useBoardInput";
import type { ArmResult } from "~/presentation/specials/pieceSpecials";

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

/**
 * Marine gas drop: queue the pawn gas step (B, or F when a classical is already
 * queued). Last-rank intents open the PromotionModal (gas-only promote, or
 * move-then-gas conversion that peels C and queues B first).
 * Returns `"armed"` / `"pending"` / false.
 */
export const pawnGasArm = (
  store: MatchStore,
  snap: ScFenSnapshot,
  ctx: { square: Square; piece: PieceSymbol },
): ArmResult | boolean => {
  const color = viewerColor(store);
  const timing = specialTimingFor(snap.queue, color);
  const to = pawnSingleTarget(ctx.square, color);
  if (!to) {
    store.dispatch({
      type: "QUEUE_REJECT",
      message: "Pawn cannot step forward off the board",
    });
    return false;
  }
  const lastRank = color === "w" ? "8" : "1";
  if (to[1] === lastRank) {
    // Gas-only promote from the approach rank — picker, then B + promotion.
    store.dispatch({
      type: "SET_PENDING_PROMOTION",
      pending: { color, from: ctx.square, to, via: "gas" },
    });
    store.dispatch({
      type: "QUEUE_REJECT",
      message: `Promote ${ctx.square}→${to} — pick a unit`,
    });
    return "pending";
  }
  // Move-then-gas onto last rank: F would park a marine on 8/1 with no
  // picker. Peel the mid-step C, queue B, open PromotionModal (same as
  // gas-then-move via gasStackPromotes).
  const convert = moveThenGasPromotes(snap, color, ctx.square, to);
  if (convert) {
    store.dispatch({ type: "REMOVE_ACTION", seq: convert.seq });
    if (
      !tryQueue(
        store,
        { timing: "B", kind: "pawnDouble", color, from: ctx.square, to },
        `Gas step ${ctx.square}→${to} queued · pick promotion`,
      )
    ) {
      return false;
    }
    store.dispatch({
      type: "SET_PENDING_PROMOTION",
      pending: { color, from: ctx.square, to },
    });
    return "armed";
  }
  return tryQueue(
    store,
    { timing, kind: "pawnDouble", color, from: ctx.square, to },
    `Gas step ${ctx.square}→${to} queued · End to resolve`,
  )
    ? "armed"
    : false;
};
