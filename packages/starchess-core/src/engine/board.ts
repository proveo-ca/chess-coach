// SPEC: _spec/engine-consolidation.puml
export { sq, parseSquare, placementToMap, tankSquaresInPlacement, mapToPlacement, attacksSquare, isSquareAttackedBy, findCC, collectLegalCCChecks, isCCInCheck } from "../board/placement";
export type { CCCheck } from "../board/placement";
export { hasExactCCPair } from "../scfen/codec";
export { toClassicFen } from "../board/classicFen";
