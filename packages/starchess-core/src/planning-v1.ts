// SPEC: _spec/packages/starchess-training/candidate-generation.puml, _spec/packages/starchess-core/resolve.puml, _spec/packages/starchess-core/turn-queue-sequence.puml, _spec/apps/starchess/core/board/board-queries.puml
export type { Square } from "./model/square";
export type { PieceColor, ScAction, ScActionInput, SpawnPiece, TankMode } from "./model/types";
export type { ScPiece } from "./board/placement";
export type { SideVision, VisionBoard } from "./board/vision";
export type { PlanningKnowledge } from "./rules/planning-intents";
export type { CountedPlanningKnowledge } from "./rules/counted-planning";
export { countedPlanningKnowledge } from "./rules/counted-planning";
export { appendTimeSpecialAnchor, classicalActorAt, knownAppendFailure } from "./rules/planning-intents";
export { classicalRewriteCoordinatesAfterB, orderBHeadsFirst } from "./rules/planning-order";
export { isScMoveShape } from "./board/moves";
export { charonDiagonalSquaresFromSquare } from "./rules/specials/mechaCharon";
export { marineSingleTarget } from "./rules/specials/stimStep";
export { spawnCCAnchorFromMap } from "./rules/specials/adjacent";
export { specialGasCost } from "./rules/specials/registry";
export { UNIT_COST, CC_MAX_LIVES, MAX_GAME_TURNS, MAX_STORED_MATERIAL, incomeForTurn, energyForTurn } from "./rules/constants";
export { MAX_MINES_PER_SIDE, rayBetween } from "./board/mines";
export { attacksSquare } from "./board/placement";
export { getUnitVision } from "./board/vision";
