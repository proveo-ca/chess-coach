export * from "~/presentation/animations/boardGeom";
export {
  ATTACK_MS,
  FRAG_FLIGHT_MS,
  ANIM_BY_PIECE,
  IDLE_FRONT_MS,
  screenAimDeg,
  attackFaceFor,
  cellSize,
  centeredBoxStyle,
  groundedBoxStyle,
  muzzleOffsetPx,
} from "~/presentation/animations/attackAnim";
/** Unit geometry lives a layer down — see `presentation/pieces/geometry.ts`. */
export {
  TANK_REST_AIM_DEG,
  CC_REST_AIM_DEG,
  TANK_FRAME_SCALE,
  svgPivotAround,
  svgPivotAroundAniso,
  svgPivotLocal,
} from "~/presentation/pieces/geometry";
export type { DemoPiece, BoardBox, AttackAnimKind } from "~/presentation/animations/attackAnim";
export {
  squareAt,
  screenAngleDeg,
  surround8,
  attackVectorsFor,
  AIM_FORWARD_DEG,
  aimPoseFor,
  tankTravelPose,
  aimTransformCss,
  hoverbikeElbowVec,
  hoverbikeLegVecs,
  hoverbikeAimDiagVec,
} from "~/presentation/animations/attackVectors";
export type { AttackVec, AimPose } from "~/presentation/animations/attackVectors";
export * from "~/presentation/animations/deathAnim";
export * from "~/presentation/pieces/teamColors";
export * from "~/presentation/animations/types";
export * from "~/presentation/animations/ccDamage";
export { CCDamageOverlay } from "~/presentation/animations/components/ccDamageOverlay";
export { AnimationStage } from "~/presentation/animations/components/AnimationStage";
export type { AnimationStageProps } from "~/presentation/animations/components/AnimationStage";
export type { CombatCueFrame } from "~/presentation/animations/combatCueFrame";
export { EMPTY_COMBAT_CUE_FRAME } from "~/presentation/animations/combatCueFrame";
export { CombatOverlayRoot } from "~/presentation/animations/components/CombatOverlayRoot";
export { AttackAnimation } from "~/presentation/animations/components/AttackAnimation";
export { DeathAnimation } from "~/presentation/animations/components/DeathAnimation";
export { MoveAnimation } from "~/presentation/animations/components/MoveAnimation";
export { ShipJumpAnimation } from "~/presentation/animations/components/ShipJumpAnimation";
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
export { MARINE_RIFLE } from "~/presentation/animations/marineRifle";
export { HOVERBIKE_FRAG } from "~/presentation/animations/hoverbikeFrag";
export { MECHA_GATLINGS } from "~/presentation/animations/mechaGatlings";
export { MECHA_CHARON } from "~/presentation/animations/mechaCharon";
export { TANK_BATTERY } from "~/presentation/animations/tankBattery";
export { BATTLESHIP_LASER } from "~/presentation/animations/battleShipLaser";
export { CC_DUAL_CANNON } from "~/presentation/animations/ccDualCannon";
export { SpiderMineFogDemo } from "~/presentation/animations/components/SpiderMineFogDemo";
export { FogVisionDemo } from "~/presentation/animations/components/FogVisionDemo";
