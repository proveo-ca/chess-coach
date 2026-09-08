// SPEC: _spec/apps/starchess/turn-input-sequence.puml
/**
 * Marine gas drop arm — the pawn `pawnDouble` handler.
 */
import type { PieceSymbol, Square } from "chess.js";

import {
  pawnSingleTarget,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";

import { viewerColor } from "~/app/matchEconomy";
import type { MatchStore } from "~/types/match";
import { moveThenGasPromotes } from "~/presentation/board/hooks/useBoardInput";
import { specialTimingFor, tryQueue } from "~/presentation/specials/queue";
import type { ArmResult } from "~/presentation/specials/types";

/**
 * Marine gas drop: queue the pawn gas step (B, or F when a classical is already
 * queued). Last-rank intents open the PromotionModal (gas-only promote, or
 * move-then-gas conversion that peels C and queues B first).
 * Returns `"armed"` / `"pending"` / false.
 */
export const marineGasArm = (
  store: MatchStore,
  snap: ScFenSnapshot,
  ctx: { square: Square; piece: PieceSymbol },
): ArmResult | boolean => {
  if (ctx.piece !== "p") return false;
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
