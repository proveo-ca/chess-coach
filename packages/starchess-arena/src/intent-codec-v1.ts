// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import type { PieceColor, ScActionInput } from "@chess-coach/starchess-core/planning-v1";
import { decodeCandidate as decodeWireCandidate, encodeCandidateForSide, requestedSpend as wireRequestedSpend, validateActions as validateWireActions, MAX_QUEUE_ACTIONS, type EncodedCandidate } from "./challengeContract/candidateWire";
import { array, inspectDto, parseJson, side } from "./challengeContract/validation";
import { validateObservationV1, type AuthorizedObservationV1 } from "./observations";

export { type EncodedCandidate, ACTION_KINDS, CANDIDATE_CODEC_VERSION, MAX_QUEUE_ACTIONS } from "./challengeContract/candidateWire";
export const encodeCandidate = (observation: AuthorizedObservationV1, actions: readonly ScActionInput[]): EncodedCandidate => {
  const authorized = validateObservationV1(observation);
  return encodeCandidateForSide(authorized.side, inspectDto(actions) as ScActionInput[]);
};
export const validateActions = (input: unknown, color: PieceColor): ScActionInput[] => {
  const dto = inspectDto(input);
  return validateWireActions(dto, side(color, "$.side"));
};
export const requestedSpend = (input: readonly ScActionInput[]) => wireRequestedSpend(array(inspectDto(input), "$.actions", MAX_QUEUE_ACTIONS) as ScActionInput[]);
export const decodeCandidate = (value: unknown, color: PieceColor): EncodedCandidate => {
  const dto = typeof value === "string" ? parseJson(value) : value;
  return decodeWireCandidate(inspectDto(dto), color);
};
