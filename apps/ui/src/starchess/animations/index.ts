export * from "~/starchess/animations/boardGeom";
export {
  ATTACK_MS,
  FRAG_FLIGHT_MS,
  ANIM_BY_PIECE,
  IDLE_FRONT_MS,
  ROOK_REST_AIM_DEG,
  KING_REST_AIM_DEG,
  screenAimDeg,
  attackFaceFor,
  svgPivotAround,
  svgPivotLocal,
  cellSize,
  centeredBoxStyle,
  groundedBoxStyle,
  muzzleOffsetPx,
} from "~/starchess/animations/attackAnim";
export type { DemoPiece, BoardBox, AttackAnimKind } from "~/starchess/animations/attackAnim";
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
} from "~/starchess/animations/attackVectors";
export type { AttackVec, AimPose } from "~/starchess/animations/attackVectors";
export * from "~/starchess/animations/deathAnim";
export * from "~/starchess/animations/teamColors";
export * from "~/starchess/animations/types";
export * from "~/starchess/animations/kingDamage";
export { KingDamageOverlay } from "~/starchess/animations/kingDamageOverlay";
export { AttackAnimation } from "~/starchess/animations/AttackAnimation";
export { DeathAnimation } from "~/starchess/animations/DeathAnimation";
export { MoveAnimation } from "~/starchess/animations/MoveAnimation";
export { QueenJumpAnimation } from "~/starchess/animations/QueenJumpAnimation";
export { MineMissileAnimation } from "~/starchess/animations/MineMissileAnimation";
export { AttackBoardDemo } from "~/starchess/animations/AttackBoardDemo";
export { DeathBoardDemo } from "~/starchess/animations/DeathBoardDemo";
export { DeployBoardDemo } from "~/starchess/animations/DeployBoardDemo";
export { DeployAnimation } from "~/starchess/animations/DeployAnimation";
export * from "~/starchess/animations/deployAnim";
export { PAWN_RIFLE } from "~/starchess/animations/pawnRifle";
export { KNIGHT_FRAG } from "~/starchess/animations/knightFrag";
export { BISHOP_GATLINGS } from "~/starchess/animations/bishopGatlings";
export { BISHOP_CHARON } from "~/starchess/animations/bishopCharon";
export { ROOK_BATTERY } from "~/starchess/animations/rookBattery";
export { QUEEN_LASER } from "~/starchess/animations/queenLaser";
export { KING_DUAL_CANNON } from "~/starchess/animations/kingDualCannon";
export { PathCollideDemo } from "~/starchess/animations/PathCollideDemo";
export { PathCollideAllyMineDemo } from "~/starchess/animations/PathCollideAllyMineDemo";
export { AttackMineDemo } from "~/starchess/animations/AttackMineDemo";
export { SpiderMineFogDemo } from "~/starchess/animations/SpiderMineFogDemo";
export { FogEdgeDemo } from "~/starchess/animations/FogEdgeDemo";
export { FogVisionDemo, FOG_SIEGE_ROOK_SCFEN } from "~/starchess/animations/FogVisionDemo";
