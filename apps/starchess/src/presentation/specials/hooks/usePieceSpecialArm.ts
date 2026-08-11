import type { GasDeployTarget } from "~/types/specials";
import {
  armPieceSpecial,
  type PieceSpecialArmHandlers,
} from "~/presentation/specials/pieceSpecials";
import { useMatchStore } from "~/app/MatchStoreContext";

/**
 * Connects {@link GasDeploy} drops to per-piece special activators.
 */
export const usePieceSpecialArm = (handlers: PieceSpecialArmHandlers) => {
  const store = useMatchStore();
  const onGasDeploy = (target: GasDeployTarget) => {
    armPieceSpecial(store, target, handlers);
  };
  return { onGasDeploy };
};
