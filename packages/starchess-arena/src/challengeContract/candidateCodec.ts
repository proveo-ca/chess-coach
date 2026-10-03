// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { baselineProposals } from "../challenge/baseline";
import { deepFreeze } from "../authorized/v1/canonical";
import type { AuthorizedObservation } from "../authorized/v1/types";
import { CANDIDATE_ENUMERATION_VERSION, COMPARATOR_VERSION, encodeCandidate } from "../authorized/v1/candidateWire";
import { validateObservation } from "../authorized/v1/observationCodec";

export {
  CANDIDATE_CODEC_VERSION, CANDIDATE_ENUMERATION_VERSION, COMPARATOR_VERSION, MAX_QUEUE_ACTIONS,
  ACTION_KINDS, validateActions, requestedSpend, encodeCandidate, decodeCandidate, compareRankedCandidates,
  type EncodedCandidate,
} from "../authorized/v1/candidateWire";

export const encodeBaselineCandidates = (observation: AuthorizedObservation) => {
  const authorized = validateObservation(observation);
  return deepFreeze(baselineProposals(authorized).map((proposal) => ({
    enumerationVersion: CANDIDATE_ENUMERATION_VERSION, comparatorVersion: COMPARATOR_VERSION,
    candidate: encodeCandidate(authorized, proposal.actions), baselineScore: proposal.score,
  })));
};
