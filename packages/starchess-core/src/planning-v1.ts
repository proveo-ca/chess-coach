// SPEC: _spec/packages/starchess-training/candidate-generation.puml
export type { Square } from "./model/square";
export type { PieceColor, ScActionInput, SpawnPiece } from "./model/types";
export type { ScPiece } from "./board/placement";
export type { PlanningKnowledge } from "./rules/planning-intents";
export { appendTimeSpecialAnchor, classicalActorAt, knownAppendFailure } from "./rules/planning-intents";
export { classicalRewriteCoordinatesAfterB } from "./rules/planning-order";
export { isScMoveShape } from "./board/moves";
export { charonDiagonalSquaresFromSquare } from "./rules/specials/mechaCharon";
export { marineSingleTarget } from "./rules/specials/stimStep";
export { spawnCCAnchorFromMap } from "./rules/specials/adjacent";
export { specialGasCost } from "./rules/specials/registry";
export { UNIT_COST, CC_MAX_LIVES, MAX_GAME_TURNS, MAX_STORED_MATERIAL } from "./rules/constants";
export { MAX_MINES_PER_SIDE } from "./board/mines";
