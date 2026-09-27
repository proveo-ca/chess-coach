// SPEC: _spec/apps/starchess/turn-input-sequence.puml
/**
 * Hoverbike arm — queue the `spiderMine` drop on its own square.
 * (Moved from `app/BaseScreen.tsx` gas-deploy handlers.)
 */
import type { PieceSymbol, Square } from "chess.js";

import type { ScFenSnapshot } from "@chess-coach/starchess-core";

import type { MatchStore } from "~/types/match";
import { specialTimingFor, tryQueue } from "~/presentation/specials/queue";
import type { ArmResult } from "~/presentation/specials/types";

export const hoverbikeMineArm = (
  store: MatchStore,
  snap: ScFenSnapshot,
  ctx: { square: Square; piece: PieceSymbol },
): ArmResult | boolean => {
  if (ctx.piece !== "n") return false;
  const color = store.view.viewerColor();
  const timing = specialTimingFor(snap.queue, color);
  return tryQueue(
    store,
    { timing, kind: "spiderMine", color, from: ctx.square, to: ctx.square },
    `Spider Mine queued on ${ctx.square} · End to resolve`,
  )
    ? "armed"
    : false;
};
