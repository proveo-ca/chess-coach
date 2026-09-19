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
  charonDiagonalSquares,
  charonDiagonalSquaresFromPlacement,
  placementToMap,
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
  // F after a same-mecha classical fires from the post-move square
  // (mirrors validation's projection rule exactly: same color, same
  // from, classical C): offer that square's diagonals so a move +
  // missile intent to the Mecha's future location is pickable.
  // Anything else offers today's squares, unchanged. `from` below
  // stays the arming square in both branches. Note the commit path
  // derives F timing from the same queue state, so arm, commit, and
  // validation always agree — no separate timing gate here.
  let targets: Square[];
  const queuedMove = (snap.queue?.actions ?? []).find(
    (a) =>
      a.timing === "C" &&
      a.kind === "classical" &&
      a.color === color &&
      a.from === ctx.square,
  );
  if (queuedMove?.to) {
    const map = placementToMap(snap.placement);
    const mecha = map.get(ctx.square);
    if (mecha) {
      map.delete(ctx.square);
      map.set(queuedMove.to, mecha);
    }
    targets = charonDiagonalSquares(map, queuedMove.to);
  } else {
    // Free aim always offers squares on 8x8 (a Mecha owns 7–13 diagonals).
    targets = charonDiagonalSquaresFromPlacement(snap.placement, ctx.square);
  }
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
