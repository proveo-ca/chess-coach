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

export const SPECIAL_REGISTRY: Record<ScSpecialKind, SpecialRegistryEntry> = Object.freeze({
  deploy: Object.freeze({ gasCost: SPECIAL_ENERGY_COST, actorHint: "k" }),
  stimStep: Object.freeze({ gasCost: SPECIAL_ENERGY_COST, actorHint: "p" }),
  spiderMine: Object.freeze({ gasCost: SPECIAL_ENERGY_COST, actorHint: "n" }),
  charonMissiles: Object.freeze({ gasCost: MECHA_CHARON_GAS_COST, actorHint: "b" }),
  siegeMode: Object.freeze({ gasCost: SPECIAL_ENERGY_COST, actorHint: "r" }),
  tacticalJump: Object.freeze({ gasCost: TACTICAL_JUMP_GAS_COST, actorHint: "q" }),
});

/** Gas burned when queueing a special (Charon = 2, Tactical Jump = 3). */
export const specialGasCost = (kind: ScSpecialKind | SpecialKind): number =>
  SPECIAL_REGISTRY[kind as ScSpecialKind]?.gasCost ?? SPECIAL_ENERGY_COST;
