import type { PieceSymbol, Square } from "chess.js";

import type { GasDeployTarget } from "~/broodwar/features/GasDeploy";
import {
  armPieceSpecial,
  type PieceSpecialArmHandlers,
} from "~/broodwar/specials/pieceSpecials";

/**
 * Connects {@link GasDeploy} drops to per-piece special activators.
 * Handlers are piece-owned (command center deploy, vulture mine, …).
 */
export const usePieceSpecialArm = (handlers: PieceSpecialArmHandlers) => {
  const onGasDeploy = (target: GasDeployTarget) => {
    armPieceSpecial(target, handlers);
  };
  return { onGasDeploy };
};

export type PieceSpecialArmCtx = { square: Square; piece: PieceSymbol };
