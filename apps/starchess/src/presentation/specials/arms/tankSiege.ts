// SPEC: _spec/apps/starchess/turn-input-sequence.puml
/**
 * Siege Tank arm — queue the `siegeMode` toggle (B, or F after a classical).
 * (Moved from `app/BaseScreen.tsx` gas-deploy handlers.)
 */
import type { PieceSymbol, Square } from "chess.js";

import type { ScFenSnapshot } from "@chess-coach/starchess-core";

import { viewerColor } from "~/app/matchEconomy";
import type { MatchStore } from "~/types/match";
import { specialTimingFor, tryQueue } from "~/presentation/specials/queue";
import type { ArmResult } from "~/presentation/specials/types";

export const tankSiegeArm = (
  store: MatchStore,
  snap: ScFenSnapshot,
  ctx: { square: Square; piece: PieceSymbol },
): ArmResult | boolean => {
  if (ctx.piece !== "r") return false;
  const color = viewerColor(store);
  const timing = specialTimingFor(snap.queue, color);
  return tryQueue(
    store,
    { timing, kind: "siegeMode", color, from: ctx.square },
    `Siege Tank toggle queued on ${ctx.square} · End to resolve`,
  )
    ? "armed"
    : false;
};
