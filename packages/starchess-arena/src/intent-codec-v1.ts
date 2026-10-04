// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import type { PieceColor } from "@chess-coach/starchess-core";
import { decodeCandidate as decodeWireCandidate, type EncodedCandidate } from "./challengeContract/candidateWire";
import { inspectDto, parseJson } from "./challengeContract/validation";

export { type EncodedCandidate, ACTION_KINDS, MAX_QUEUE_ACTIONS, encodeCandidate, requestedSpend, validateActions } from "./challengeContract/candidateWire";
export const decodeCandidate = (value: unknown, color: PieceColor): EncodedCandidate => {
  const dto = typeof value === "string" ? parseJson(value) : value;
  return decodeWireCandidate(inspectDto(dto), color);
};
