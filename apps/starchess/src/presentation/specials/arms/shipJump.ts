// SPEC: _spec/apps/starchess/turn-input-sequence.puml
/**
 * BattleShip arm — open Tactical Jump targeting over visible empty squares
 * (`OPEN_BATTLESHIP_WARP`; commit happens on board click).
 * (Moved from `app/BaseScreen.tsx` gas-deploy handlers.)
 */
import type { PieceSymbol, Square } from "chess.js";

import type { TankMode, ScFenSnapshot } from "@chess-coach/starchess-core";

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
    tankModeFor?: (sq: Square) => TankMode;
  },
): ArmResult | boolean => {
  if (ctx.piece !== "q") return false;
  const color = viewerColor(store);
  const targets = tacticalJumpTargets(snap.placement, ctx.square, color, {
    tankModeFor: opts?.tankModeFor ?? (() => "tank" as TankMode),
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
    type: "OPEN_BATTLESHIP_WARP",
    color,
    from: ctx.square,
    targets,
  });
  opts?.onAfterOpen?.();
  return "pending";
};
