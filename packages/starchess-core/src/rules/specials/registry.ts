/**
 * Special-kind registry: gas cost and actor hint (wire kinds unchanged).
 */
import type { ScSpecialKind, SpecialKind, StarChessPiece } from "../../model/types";
import { CHARON_GAS_COST, QUEEN_WARP_GAS_COST, SPECIAL_ENERGY_COST } from "../constants";

export type SpecialRegistryEntry = {
  gasCost: number;
  /** Expected actor piece type when applicable. */
  actorHint?: StarChessPiece;
};

export const SPECIAL_REGISTRY: Record<ScSpecialKind, SpecialRegistryEntry> = {
  spawn: { gasCost: SPECIAL_ENERGY_COST, actorHint: "k" },
  pawnDouble: { gasCost: SPECIAL_ENERGY_COST, actorHint: "p" },
  knightMine: { gasCost: SPECIAL_ENERGY_COST, actorHint: "n" },
  bishopSnipe: { gasCost: CHARON_GAS_COST, actorHint: "b" },
  rookSiege: { gasCost: SPECIAL_ENERGY_COST, actorHint: "r" },
  queenWarp: { gasCost: QUEEN_WARP_GAS_COST, actorHint: "q" },
};

/** Gas burned when queueing a special (Charon = 2, Tactical Jump = 3). */
export const specialGasCost = (kind: ScSpecialKind | SpecialKind): number =>
  SPECIAL_REGISTRY[kind as ScSpecialKind]?.gasCost ?? SPECIAL_ENERGY_COST;
