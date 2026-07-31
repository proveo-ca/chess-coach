import type { Square } from "chess.js";
import { createSignal } from "solid-js";

import {
  resetBroodWarEconomy,
  rookModeAt,
  setRookMode,
  spendEnergy,
  toggleRookSiege,
} from "~/broodwar/broodWarStore";
import type { PieceSpecialArmCtx } from "~/broodwar/hooks/usePieceSpecialArm";
import { activePlayerColor } from "~/store/settingsStore";

/** Packed tank (starts in tank mode). */
export const SIEGE_TANK_SQ: Square = "d4";
/** Unpacked siege tank (starts in siege mode) — alternate for both-way demos. */
export const SIEGE_TANK_SIEGE_SQ: Square = "f4";

/** Kings + two Siege Tanks (d4 tank, f4 siege). */
export const SIEGE_TANK_FEN = "7k/8/8/8/3R1R2/8/8/K7 w - - 0 1";

/**
 * Siege Tank (rook) special — toggle tank ↔ siege mode (both directions).
 * Armed via GasDeploy onto either tank; spends 1 vespene.
 */
export const useRookSiege = () => {
  const [caption, setCaption] = createSignal(
    "Drag gas onto either tank (d4 packed / f4 sieged) to toggle mode",
  );

  const seedEconomy = () => {
    // Turn 21 → energy cap 3 so both tanks can be toggled in one session.
    resetBroodWarEconomy({
      turn: 21,
      white: { stored: 12, deployed: 6 },
      black: { stored: 0, deployed: 1 },
      energy: 3,
      startTimer: false,
    });
    // After economy reset (clears sieged set): f4 starts unpacked, d4 stays tank.
    setRookMode(SIEGE_TANK_SIEGE_SQ, "siege");
  };

  const arm = (ctx: PieceSpecialArmCtx): boolean => {
    if (ctx.piece !== "r") return false;
    if (!spendEnergy(activePlayerColor())) {
      setCaption("Need vespene gas to toggle siege mode");
      return false;
    }
    const next = toggleRookSiege(ctx.square);
    setCaption(
      next === "siege"
        ? `Siege mode on ${ctx.square}: unpacked, 9×9 vision, immobile`
        : `Tank mode on ${ctx.square}: packed treads, 5×5 vision, can move`,
    );
    return true;
  };

  return {
    tankSquare: SIEGE_TANK_SQ,
    siegeSquare: SIEGE_TANK_SIEGE_SQ,
    caption,
    modeAt: rookModeAt,
    /** @deprecated Prefer {@link modeAt} — d4 only. */
    mode: () => rookModeAt(SIEGE_TANK_SQ),
    seedEconomy,
    arm,
  };
};
