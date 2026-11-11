// SPEC: _spec/game-core.puml
export * from "./types";
export * from "./constants";
export * from "./board";
export * from "./specials";
export * from "./economy";
export * from "./outcome";
export * from "./mines";
export * from "./moves";
export * from "./vision";
export * from "./planning-order";
export * from "./native-classical";
export * from "./planning-specials";
export * from "./planning-intents";
export * from "./queue-contract";
export * from "./queue-validation";
export * from "./queue-action";
export * from "./mine-contact";
export * from "./move-timing";
export * from "./ray-scan";
export * from "./charon";
export * from "./initialization";
export { resolveTurn, applyPendingCCShots, applyPathRevealAttack, applyPathRevealCCShot,
  hasDepartingPlan, isActorAnchored, isApproachOwnedDestination, clearDepartedGhost } from "./classical-resolution";
export type { ClassicalPlan, ResolvePromotion, ResolveMove, ResolveAttack, ResolveTurnInput,
  ResolveBoard, ResolveTurnResult, PathRevealSnap, PathRevealApply } from "./classical-resolution";
export { beginScTurn, endScTurn, refillTurnGas, rewriteClassicalAfterB } from "./resolve";
export type { ResolveEvent, EndScTurnResult, EndScTurnOptions, BeginScTurnResult } from "./resolve";
