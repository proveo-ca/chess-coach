// SPEC: _spec/apps/starchess/turn-input-sequence.puml
/**
 * Mecha arm — open Charon Booster Missiles targeting on the unique diagonal
 * enemy queen (`OPEN_BISHOP_SNIPE`; commit happens on board click).
 * (Moved from `app/BaseScreen.tsx` gas-deploy handlers.)
 */
import type { PieceSymbol, Square } from "chess.js";

import {
  charonTargetQueenFromPlacement,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";

import { viewerColor } from "~/app/matchEconomy";
import type { MatchStore } from "~/types/match";
import type { ArmResult } from "~/presentation/specials/types";

export const bishopSnipeArm = (
  store: MatchStore,
  snap: ScFenSnapshot,
  ctx: { square: Square; piece: PieceSymbol },
  opts?: { resetSpawn?: () => void; onAfterOpen?: () => void },
): ArmResult | boolean => {
  if (ctx.piece !== "b") return false;
  const color = viewerColor(store);
  const queen = charonTargetQueenFromPlacement(snap.placement, ctx.square);
  if (!queen) {
    store.dispatch({
      type: "QUEUE_REJECT",
      message: "Charon Booster Missiles needs exactly one enemy queen on a diagonal",
    });
    return false;
  }
  opts?.resetSpawn?.();
  store.dispatch({
    type: "OPEN_BISHOP_SNIPE",
    color,
    from: ctx.square,
    to: queen,
  });
  opts?.onAfterOpen?.();
  return "pending";
};
