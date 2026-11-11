// SPEC: _spec/game-core.puml
import type { ScSpecialKind, StarChessPiece } from "./types";
import { MECHA_CHARON_GAS_COST, SPECIAL_ENERGY_COST, TACTICAL_JUMP_GAS_COST } from "./constants";

export type SpecialRegistryEntry = {
  gasCost: number;
  actorHint?: StarChessPiece;
};

export const SPECIAL_REGISTRY: Readonly<Record<ScSpecialKind, Readonly<SpecialRegistryEntry>>> = Object.freeze({
  deploy: Object.freeze({ gasCost: SPECIAL_ENERGY_COST, actorHint: "k" }),
  stimStep: Object.freeze({ gasCost: SPECIAL_ENERGY_COST, actorHint: "p" }),
  spiderMine: Object.freeze({ gasCost: SPECIAL_ENERGY_COST, actorHint: "n" }),
  charonMissiles: Object.freeze({ gasCost: MECHA_CHARON_GAS_COST, actorHint: "b" }),
  siegeMode: Object.freeze({ gasCost: SPECIAL_ENERGY_COST, actorHint: "r" }),
  tacticalJump: Object.freeze({ gasCost: TACTICAL_JUMP_GAS_COST, actorHint: "q" }),
});

export const specialGasCost = (kind: ScSpecialKind): number =>
  SPECIAL_REGISTRY[kind]?.gasCost ?? SPECIAL_ENERGY_COST;
