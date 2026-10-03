// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import type { PieceColor, ScActionInput } from "@chess-coach/starchess-core";
import {
  decodeCandidate as decodeLegacyCandidate, encodeValidatedCandidate,
  requestedSpend as legacyRequestedSpend, validateActions as legacyValidateActions,
  type EncodedCandidate,
} from "./authorized/v1/candidateWire";
import { guardDto } from "./authorized/v1/guard";
import { validateObservationV1 } from "./authorized/v1/observationCodec";
import type { AuthorizedObservationV1 } from "./authorized/v1/types";
import { parseJson } from "./challengeContract/validation";

export { ACTION_KINDS, CANDIDATE_CODEC_VERSION, MAX_QUEUE_ACTIONS, type EncodedCandidate } from "./authorized/v1/candidateWire";
export const validateActions = (value: unknown, side: PieceColor): ScActionInput[] => {
  guardDto(value, "$.actions");
  return legacyValidateActions(value, side);
};
export const requestedSpend = (actions: readonly ScActionInput[]): { minerals: number; gas: number } => {
  guardDto(actions, "$.actions");
  return legacyRequestedSpend(actions);
};
export const encodeCandidate = (observation: AuthorizedObservationV1, actions: readonly ScActionInput[]): EncodedCandidate => {
  const authorized = validateObservationV1(observation);
  guardDto(actions, "$.actions");
  return encodeValidatedCandidate(authorized, actions);
};
export const decodeCandidate = (value: unknown, side: PieceColor): EncodedCandidate => {
  const record = typeof value === "string" ? parseJson(value) : value;
  guardDto(record);
  return decodeLegacyCandidate(record, side);
};
