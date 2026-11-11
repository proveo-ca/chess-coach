/**
 * Special-kind registry: gas cost and actor hint (wire kinds unchanged).
 */
import type { ScSpecialKind, SpecialKind, StarChessPiece } from "../../model/types";
import { MECHA_CHARON_GAS_COST, TACTICAL_JUMP_GAS_COST, SPECIAL_ENERGY_COST } from "../constants";

export type SpecialRegistryEntry = {
  gasCost: number;
  /** Expected actor piece type when applicable. */
  actorHint?: StarChessPiece;
};

export const SPECIAL_REGISTRY: Record<ScSpecialKind, SpecialRegistryEntry> = {
  deploy: { gasCost: SPECIAL_ENERGY_COST, actorHint: "k" },
  stimStep: { gasCost: SPECIAL_ENERGY_COST, actorHint: "p" },
  spiderMine: { gasCost: SPECIAL_ENERGY_COST, actorHint: "n" },
  charonMissiles: { gasCost: MECHA_CHARON_GAS_COST, actorHint: "b" },
  siegeMode: { gasCost: SPECIAL_ENERGY_COST, actorHint: "r" },
  tacticalJump: { gasCost: TACTICAL_JUMP_GAS_COST, actorHint: "q" },
};

/** Gas burned when queueing a special (Charon = 2, Tactical Jump = 3). */
export const specialGasCost = (kind: ScSpecialKind | SpecialKind): number =>
  SPECIAL_REGISTRY[kind as ScSpecialKind]?.gasCost ?? SPECIAL_ENERGY_COST;
