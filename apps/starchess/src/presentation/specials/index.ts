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
export { pawnGasArm } from "~/presentation/specials/pawnGasArm";
export * from "~/presentation/specials/queenTacticalJump";
export * from "~/presentation/specials/deployTargets";
export * from "~/presentation/specials/arms/kingDeploy";
export * from "~/presentation/specials/arms/marineGas";
export * from "~/presentation/specials/arms/rookSiege";
export * from "~/presentation/specials/arms/knightMine";
export * from "~/presentation/specials/arms/bishopSnipe";
export * from "~/presentation/specials/arms/queenJump";
