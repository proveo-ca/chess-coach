// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import type { BeginScTurnResult, EndScTurnResult, ScActionInput } from "@chess-coach/starchess-core";
import type { AuthorizedBoundaryBatch } from "@chess-coach/starchess-arena/events";
import type { H, Ref, Side } from "../economic/contracts";

export type Master = 101 | 102 | 103 | 104 | 105;
export type AttemptId = string;
export type EpisodeStreamLabel = "selection" | "environment-settlement" | "policy-sampling" | "opponent";
export type ActiveStreamState = Readonly<{ status: "active"; root: number; state: number; drawCount: number }>;
export type UnusedEnvironmentState = Readonly<{ status: "unused"; root: number; state: number; drawCount: 0 }>;
export type StreamState = ActiveStreamState | UnusedEnvironmentState;
export type EpisodeStartStreams = Readonly<{
  selection: ActiveStreamState;
  "environment-settlement": UnusedEnvironmentState;
  "policy-sampling": ActiveStreamState;
  opponent: ActiveStreamState;
}>;
export type ScheduleDescriptor = Readonly<
  { suite: "corpus"; candidateSide: "b"; caseIndex: number } |
  { suite: "live-strategic"; candidateSide: Side }
>;
export type OriginalEpisodeRequestV2 = Readonly<{
  version: "starchess-training-episode-v2";
  attemptId: AttemptId;
  master: Master;
  startedOrdinal: number;
  weightsRef: Ref;
  manifestRef: Ref;
  baseline: H;
  schedule: ScheduleDescriptor;
  streams: EpisodeStartStreams;
}>;
export type EpisodeRequestV2 = OriginalEpisodeRequestV2;
export type PrivateEconomicRequestV2 = Readonly<{
  version: "starchess-training-economic-request-v2";
  originalRequest: OriginalEpisodeRequestV2;
  economicPinRef: Ref;
}>;

export type EpisodeMessageKind = "ready" | "turn-open-result" | "turn-open-accepted" | "decision-result" |
  "decision-accepted" | "settlement" | "complete";
export type EpisodeCommonHeader<K extends EpisodeMessageKind = EpisodeMessageKind> = Readonly<{
  version: "starchess-training-episode-v2"; attemptId: AttemptId; messageOrdinal: number; kind: K;
}>;
export type DecisionId = Readonly<{ planningOrdinal: number; side: Side }>;
export type PlanPermit = Readonly<{
  permitId: string; planningOrdinal: number; turn: number; side: Side; role: "candidate" | "strategic";
}>;
export type CompactSampleJournalEntry = Readonly<{
  decisionId: DecisionId; permitId: string; historyDigest: Ref; manifestDigest: Ref;
  generatorVersion: "challenge-composition-v3"; orderedCandidateKeysDigest: Ref;
  selectedIndex: number; selectedKey: string; actions: readonly ScActionInput[];
  requestedSpend: Readonly<{ minerals: number; gas: number }>;
  uniform: H; selectedLogProbability: H; samplingBefore: StreamState; samplingAfter: StreamState;
}>;
export type OppPrivateJournal = Readonly<{
  decisionId: DecisionId; permitId: string; actions: readonly ScActionInput[]; reportedMinSpend: number;
  opponentBefore: StreamState; opponentAfter: StreamState;
}>;
export type ChallengeStop = Readonly<{
  kind: "terminal" | "queue-rejected" | "trace-exhausted" | "watchdog" | "progress-limit" | "exception" | "script-contract";
  phase: string; planningOrdinal: number; turn: number;
  side?: Side; actionIndex?: number; action?: ScActionInput; sourcePlyIndex?: number; reason?: string; engineCode?: string;
  requiredMinerals?: number; availableMinerals?: number; rejectedQueue?: readonly ScActionInput[];
}>;
export type StopReason = "core-terminal" | "candidate-native-rejection" | "recorded-white-rejection" | "trace-exhaustion" |
  "progress-cap" | "candidate-deadline" | "exception" | "policy-schema" | "nonmember" | "version" | "codec" |
  "adapter-mutation" | "distribution" | "nonfinite" | "rng" | "journal" | "gradient" | "protocol" | "permit" |
  "session" | "opponent" | "startup-timeout" | "match-timeout" | "unattributed-timeout" | "dataset" | "source" |
  "identity" | "ledger" | "provenance" | "forged-progress" | "config-override" | "publication" | "storage" | "size";
export type StopProof = Readonly<{
  stop: ChallengeStop; origin: "native" | "recorded-white" | "candidate-deadline" | "infrastructure";
  reason: StopReason; checkedBoundaryOrdinal: number; acceptedCandidateCount: number; evidenceRef: Ref;
}>;
export type EpisodeScoreAccumulator = readonly H[] & Readonly<{ length: 418 }>;
export type CompletePayload = Readonly<{
  acceptedCandidateDecisionIds: readonly DecisionId[]; acceptedOpponentDecisionIds: readonly DecisionId[];
  scoreAccumulator: EpisodeScoreAccumulator; rngSummaries: EpisodeStartStreams; stopProof: StopProof;
}>;
type EpisodeBank = Readonly<{ w: number; b: number }>;
export type ReadyMessage = EpisodeCommonHeader<"ready"> & Readonly<{
  openingDigest: Ref; initialPublicBatch: AuthorizedBoundaryBatch; privateProvenanceDigest: Ref;
}>;
export type TurnOpenResultMessage = EpisodeCommonHeader<"turn-open-result"> & Readonly<{
  planningOrdinal: number; begin: BeginScTurnResult; bank: EpisodeBank;
  publicBatch: AuthorizedBoundaryBatch; privateProvenanceDigest: Ref;
}>;
export type TurnOpenAcceptedMessage = EpisodeCommonHeader<"turn-open-accepted"> & Readonly<{
  planningOrdinal: number; nextPermit: PlanPermit | null;
}>;
export type DecisionResultMessage = EpisodeCommonHeader<"decision-result"> & Readonly<
  { role: "candidate"; journalEntry: CompactSampleJournalEntry } |
  { role: "strategic"; journalEntry: OppPrivateJournal }
>;
export type DecisionAcceptedMessage = EpisodeCommonHeader<"decision-accepted"> & Readonly<{
  decisionId: DecisionId; nextPermit: PlanPermit | null;
}>;
export type SettlementMessage = EpisodeCommonHeader<"settlement"> & Readonly<{
  planningOrdinal: number; end: EndScTurnResult; bank: EpisodeBank;
  publicBatch: AuthorizedBoundaryBatch; privateProvenanceDigest: Ref;
}>;
export type CompleteMessage = EpisodeCommonHeader<"complete"> & CompletePayload;
export type EpisodeMessage = ReadyMessage | TurnOpenResultMessage | TurnOpenAcceptedMessage | DecisionResultMessage |
  DecisionAcceptedMessage | SettlementMessage | CompleteMessage;
