export * from "~/presentation/animations/boardGeom";
export {
  ATTACK_MS,
  FRAG_FLIGHT_MS,
  ANIM_BY_PIECE,
  IDLE_FRONT_MS,
  ROOK_REST_AIM_DEG,
  KING_REST_AIM_DEG,
  ROOK_FRAME_SCALE,
  screenAimDeg,
  attackFaceFor,
  svgPivotAround,
  svgPivotAroundAniso,
  svgPivotLocal,
  cellSize,
  centeredBoxStyle,
  groundedBoxStyle,
  muzzleOffsetPx,
} from "~/presentation/animations/attackAnim";
export type { DemoPiece, BoardBox, AttackAnimKind } from "~/presentation/animations/attackAnim";
export {
  squareAt,
  screenAngleDeg,
  surround8,
  attackVectorsFor,
  AIM_FORWARD_DEG,
  aimPoseFor,
  rookTravelPose,
  aimTransformCss,
  knightElbowVec,
  knightLegVecs,
  knightAimDiagVec,
} from "~/presentation/animations/attackVectors";
export type { AttackVec, AimPose } from "~/presentation/animations/attackVectors";
export * from "~/presentation/animations/deathAnim";
export * from "~/presentation/animations/teamColors";
export * from "~/presentation/animations/types";
export * from "~/presentation/animations/kingDamage";
export { KingDamageOverlay } from "~/presentation/animations/components/kingDamageOverlay";
export { AnimationStage } from "~/presentation/animations/components/AnimationStage";
export type { AnimationStageProps } from "~/presentation/animations/components/AnimationStage";
export type { CombatCueFrame } from "~/presentation/animations/combatCueFrame";
export { EMPTY_COMBAT_CUE_FRAME } from "~/presentation/animations/combatCueFrame";
export { CombatOverlayRoot } from "~/presentation/animations/components/CombatOverlayRoot";
export { AttackAnimation } from "~/presentation/animations/components/AttackAnimation";
export { DeathAnimation } from "~/presentation/animations/components/DeathAnimation";
export { MoveAnimation } from "~/presentation/animations/components/MoveAnimation";
export { QueenJumpAnimation } from "~/presentation/animations/components/QueenJumpAnimation";
export { MineMissileAnimation } from "~/presentation/animations/components/MineMissileAnimation";
export { AttackBoardDemo } from "~/presentation/animations/components/AttackBoardDemo";
export { DeathBoardDemo } from "~/presentation/animations/components/DeathBoardDemo";
export { DeployBoardDemo } from "~/presentation/animations/components/DeployBoardDemo";
export { DeployAnimation } from "~/presentation/animations/components/DeployAnimation";
export { GasDropAnimation } from "~/presentation/animations/components/GasDropAnimation";
export * from "~/presentation/animations/gasDrop";
export * from "~/presentation/animations/deployAnim";
export {
  IMPACT_FRAC,
  impactMsFor,
  fragFlightMsCss,
} from "~/presentation/animations/impactTiming";
export {
  deriveVisualFrame,
} from "~/presentation/animations/visualFrame";
export type {
  VisualFrame,
  VisualFrameInput,
  VisualOwnerKind,
} from "~/presentation/animations/visualFrame";
export { PAWN_RIFLE } from "~/presentation/animations/pawnRifle";
export { KNIGHT_FRAG } from "~/presentation/animations/knightFrag";
export { BISHOP_GATLINGS } from "~/presentation/animations/bishopGatlings";
export { BISHOP_CHARON } from "~/presentation/animations/bishopCharon";
export { ROOK_BATTERY } from "~/presentation/animations/rookBattery";
export { QUEEN_LASER } from "~/presentation/animations/queenLaser";
export { KING_DUAL_CANNON } from "~/presentation/animations/kingDualCannon";
export { SpiderMineFogDemo } from "~/presentation/animations/components/SpiderMineFogDemo";
export { FogVisionDemo } from "~/presentation/animations/components/FogVisionDemo";
