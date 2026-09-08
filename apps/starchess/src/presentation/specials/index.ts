/**
 * Specials barrel — single presentation owner for gas/special arms.
 * Engine rules stay in `@chess-coach/starchess-core` (public index only).
 */
export * from "~/presentation/specials/types";
export * from "~/presentation/specials/copy";
export * from "~/presentation/specials/queue";
export {
  armPieceSpecial,
  pieceSpecialDef,
  type PieceSpecialArmHandlers,
  type PieceSpecialDef,
} from "~/presentation/specials/pieceSpecials";
export * from "~/presentation/specials/shipTacticalJump";
export * from "~/presentation/specials/spiderMineLegs";
export * from "~/presentation/specials/hooks/usePieceSpecialArm";
export * from "~/presentation/specials/planning/occupancy";
export * from "~/presentation/specials/deployTargets";
export * from "~/presentation/specials/arms/CCDeploy";
export * from "~/presentation/specials/arms/marineGas";
export * from "~/presentation/specials/arms/tankSiege";
export * from "~/presentation/specials/arms/hoverbikeMine";
export * from "~/presentation/specials/arms/bishopSnipe";
export * from "~/presentation/specials/arms/shipJump";
