// SPEC: _spec/apps/starchess/turn-input-sequence.puml
/**
 * BattleShip arm — open Tactical Jump targeting over visible empty squares
 * (`OPEN_QUEEN_WARP`; commit happens on board click).
 * (Moved from `app/BaseScreen.tsx` gas-deploy handlers.)
 */
import type { PieceSymbol, Square } from "chess.js";

import type { RookMode, ScFenSnapshot } from "@chess-coach/starchess-core";

import { viewerColor } from "~/app/matchEconomy";
import type { MatchStore } from "~/types/match";
import { tacticalJumpTargets } from "~/presentation/specials/shipTacticalJump";
import type { ArmResult } from "~/presentation/specials/types";

export const shipJumpArm = (
  store: MatchStore,
  snap: ScFenSnapshot,
  ctx: { square: Square; piece: PieceSymbol },
  opts?: {
    resetSpawn?: () => void;
    onAfterOpen?: () => void;
    /** Live vision mode lookup; defaults to all-tank (no siege). */
    rookModeFor?: (sq: Square) => RookMode;
  },
): ArmResult | boolean => {
  if (ctx.piece !== "q") return false;
  const color = viewerColor(store);
  const targets = tacticalJumpTargets(snap.placement, ctx.square, color, {
    rookModeFor: opts?.rookModeFor ?? (() => "tank" as RookMode),
  });
  if (targets.length === 0) {
    store.dispatch({
      type: "QUEUE_REJECT",
      message: "Tactical Jump needs a visible empty square",
    });
    return false;
  }
  opts?.resetSpawn?.();
  store.dispatch({
    type: "OPEN_QUEEN_WARP",
    color,
    from: ctx.square,
    targets,
  });
  opts?.onAfterOpen?.();
  return "pending";
};
