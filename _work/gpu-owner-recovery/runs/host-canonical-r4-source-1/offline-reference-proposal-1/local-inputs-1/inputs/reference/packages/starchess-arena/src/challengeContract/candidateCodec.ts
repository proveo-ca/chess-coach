// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { baselineProposals } from "../challenge/baseline";
import { deepFreeze } from "../challenge/config";
import type { AuthorizedObservation } from "../challenge/types";
import { validateObservation } from "./observationCodec";
import { CANDIDATE_ENUMERATION_VERSION, COMPARATOR_VERSION, encodeCandidate } from "./candidateWire";

export * from "./candidateWire";
export const encodeBaselineCandidates = (observation: AuthorizedObservation) => {
  const authorized = validateObservation(observation);
  return deepFreeze(baselineProposals(authorized).map((proposal) => ({
    enumerationVersion: CANDIDATE_ENUMERATION_VERSION, comparatorVersion: COMPARATOR_VERSION,
    candidate: encodeCandidate(authorized, proposal.actions), baselineScore: proposal.score,
  })));
};
