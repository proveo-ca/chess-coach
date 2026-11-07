// SPEC: _spec/observations.puml
import { observationShape } from "./shape";
import { observationIssues } from "./semantics";
import type { Observation } from "./shape";

export type { Observation, ObservedCell } from "./shape";
export { observationJsonSchema } from "./shape";
export { MAX_INFERENCE_BYTES, decodeScoreResponse, encodeScoreRequest } from "./inference";
export type { ScoreRequest, ScoreResponse } from "./inference";
export { decodeCandidate } from "./candidate";
export type { Candidate } from "./candidate";
export const MAX_OBSERVATION_BYTES = 1_048_576;

const observation = observationShape.superRefine((snapshot, context) => {
  for (const issue of observationIssues(snapshot)) context.addIssue({ code: "custom", ...issue });
});

export function decodeObservation(json: string): Observation {
  if (json.length > MAX_OBSERVATION_BYTES || new TextEncoder().encode(json).byteLength > MAX_OBSERVATION_BYTES) {
    throw new RangeError("Observation exceeds byte limit");
  }
  return observation.parse(JSON.parse(json));
}

export const encodeObservation = (snapshot: Observation): string => {
  const json = JSON.stringify(snapshot);
  decodeObservation(json);
  return json;
};
