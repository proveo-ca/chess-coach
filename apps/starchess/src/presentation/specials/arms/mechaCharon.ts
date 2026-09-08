// SPEC: _spec/specials/mecha-charon.puml
/**
 * Mecha arm — open Charon Booster Missiles targeting on every Mecha diagonal
 * square (`OPEN_BISHOP_SNIPE`; commit happens on board click — highlight all,
 * click-to-pick). Free aim: any FEN-legal diagonal is selectable; shots that
 * meet no first-ship fizzle off the board at resolve.
 * (Moved from `app/BaseScreen.tsx` gas-deploy handlers.)
 */
import type { PieceSymbol, Square } from "chess.js";

import {
  charonDiagonalSquaresFromPlacement,
  type ScFenSnapshot,
} from "@chess-coach/starchess-core";

import { viewerColor } from "~/app/matchEconomy";
import type { MatchStore } from "~/types/match";
import type { ArmResult } from "~/presentation/specials/types";

export const mechaCharonArm = (
  store: MatchStore,
  snap: ScFenSnapshot,
  ctx: { square: Square; piece: PieceSymbol },
  opts?: { resetSpawn?: () => void; onAfterOpen?: () => void },
): ArmResult | boolean => {
  if (ctx.piece !== "b") return false;
  const color = viewerColor(store);
  // Free aim always offers squares on 8x8 (a Mecha owns 7–13 diagonals).
  const targets = charonDiagonalSquaresFromPlacement(snap.placement, ctx.square);
  opts?.resetSpawn?.();
  store.dispatch({
    type: "OPEN_BISHOP_SNIPE",
    color,
    from: ctx.square,
    targets,
  });
  opts?.onAfterOpen?.();
  return "pending";
};
