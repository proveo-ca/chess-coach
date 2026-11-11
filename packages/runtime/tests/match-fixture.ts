// SPEC: _spec/match-runtime.puml
import { RecordedCorpus, CORPUS_MANIFEST_SHA256 } from "../src/corpus";
import { MatchSession } from "../src/match-session";
import type { MatchCutoffReceipt, MatchLearners, OwnedMatchTransport } from "../src/match-session";
import { MatchWorker } from "../src/match-worker";
import type { MatchScorer } from "../src/match-worker";
import type { MatchReply, MatchRequest } from "../../contracts/src/match";
import type { AttemptDescriptor, RngState } from "../../contracts/src/training-state";
import type { ScoreRequest } from "../../contracts/src/inference";
import type { AckedDecision } from "../src/policy-session";
import type { PairedProposal } from "../src/learner-pair";
import type { StrategicApi } from "../src/strategic";
import { initialTrainingState } from "../src/curriculum";
import { bindings, syntheticRecord } from "./training-fixture";
import { cleanExit } from "./fixture";

export function syntheticCorpus(windows = 1, rejectWhite = false): RecordedCorpus {
  const openingScfen = "SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";
  const traces = Array.from({ length: 18 }, (_, index) => ({ caseId: `white-trace-${String(index + 1).padStart(2, "0")}`, gameId: `synthetic-${index}`,
    historicalResult: "win", openingScfen, traceSha256: index.toString(16).padStart(64, "0"), windows: Array.from({ length: windows }, (_, planningOrdinal) => ({
      planningOrdinal, sourcePlyIndex: planningOrdinal, sourceTurn: planningOrdinal,
      actions: rejectWhite ? [{ kind: "classical", timing: "C", color: "w", from: "a1", to: "b1" }] : [] })) }));
  return new RecordedCorpus({ manifestSha256: CORPUS_MANIFEST_SHA256, manifest: { openingScfen, expectedGames: 18,
    cases: traces.map((trace, sourceIndex) => ({ caseId: trace.caseId, gameId: trace.gameId, sourceIndex, traceSha256: trace.traceSha256, planningWindows: windows })) }, traces });
}
export class SyntheticMatchScorer implements MatchScorer {
  scores = 0;
  closed = 0;
  stopped = 0;
  constructor(private readonly clock: () => bigint) {}
  async score(json: string) {
    this.scores++;
    const request: ScoreRequest = JSON.parse(json);
    const logits = Array(request.rows).fill(-1000); logits[0] = 1000;
    return { json: JSON.stringify({ version: request.version, featureVersion: request.featureVersion, requestId: request.requestId, modelId: request.modelId, logits }), receivedNs: this.clock() };
  }
  async close() { this.closed++; }
  async shutdown() { this.stopped++; }
}
export function syntheticStrategic(): StrategicApi {
  const memory = () => ({ perSide: { w: {}, b: {} } });
  return { strategicScript: () => ({ play: (snapshot: unknown, context: unknown) => {
    (context as { rng: () => number }).rng();
    return { snapshot: structuredClone(snapshot), spendMinerals: 0 };
  } }), seedKvsForOpening: memory, seedCcIntelForOpening: memory, seedRunnerMemory: memory, seedAttackerMemory: memory,
    updateKvsForSnap: value => value, updateCcIntelForSnap: value => value, updateRunnersForSnap: value => value,
    updateAttackersForSnap: value => value, witnessFromEndTurn: () => ({}) };
}
export class SyntheticMatchLearners implements MatchLearners {
  samples = 0;
  begun = 0;
  proposed = 0;
  closed = 0;
  aborted = 0;
  nonzero = false;
  failAccumulate = false;
  failClose = false;
  async begin() { this.begun++; }
  async accumulate(_accepted: AckedDecision) { if (this.failAccumulate) throw new Error("synthetic gradient failure"); this.samples++; }
  async propose(_returnValue: -1 | 0 | 1): Promise<PairedProposal> {
    this.proposed++;
    const selected = syntheticRecord("synthetic-proposal-not-a-burn-model");
    return this.samples ? { kind: "proposed", config: selected.config, record: Array.from(selected.record), sampledDecisions: this.samples,
      parameterSha256: "b".repeat(64), objective: 0.1, nonzeroPolicyGradient: this.nonzero } : { kind: "diagnostic" };
  }
  async close() { if (this.failClose) throw new Error("synthetic learner close failure"); this.closed++; }
  async abort(reason: unknown): Promise<never> { this.aborted++; throw reason; }
}
export class SyntheticMatchTransport implements OwnedMatchTransport {
  readonly requests: MatchRequest[] = [];
  readonly replies: MatchReply[] = [];
  alter: ((reply: MatchReply, request: MatchRequest) => void) | null = null;
  before: ((request: MatchRequest) => void) | null = null;
  receipt = cleanExit();
  cutoffReceipt: MatchCutoffReceipt = { exit: { ...cleanExit(), exitCode: null, forced: true }, groupGone: true, fault: false, frame: null };
  finished = 0;
  stopped = 0;
  cutoffs = 0;
  constructor(readonly worker: MatchWorker, private readonly clock: () => bigint) {}
  async exchange(json: string) {
    const request: MatchRequest = JSON.parse(json);
    this.requests.push(request);
    this.before?.(request);
    const reply: MatchReply = JSON.parse(await this.worker.handle(json));
    this.alter?.(reply, request);
    this.replies.push(structuredClone(reply));
    return { json: JSON.stringify(reply), receivedNs: this.clock() };
  }
  async finish() { this.finished++; return this.receipt; }
  async cutoff() { this.cutoffs++; return this.cutoffReceipt; }
  async terminate() { this.stopped++; }
}
export function matchFixture(options: { windows?: number; rejectWhite?: boolean; liveSide?: "w" | "b" } = {}) {
  let now = 0n;
  const clock = () => now, corpus = syntheticCorpus(options.windows ?? 1, options.rejectWhite), strategic = syntheticStrategic();
  const descriptor: AttemptDescriptor = { version: "chess-coach.attempt.v1", attemptId: "synthetic-match", master: 101, startedOrdinal: 0, modelId: "a".repeat(64), frozenBaseline: 0,
    schedule: options.liveSide ? { kind: "live", liveOrdinal: options.liveSide === "w" ? 0 : 1, candidateSide: options.liveSide } : { kind: "corpus", corpusIndex: 0, candidateSide: "b" } };
  const rng: RngState = initialTrainingState(101, descriptor.modelId, bindings()).rng;
  const scorer = new SyntheticMatchScorer(clock), verifier = new SyntheticMatchScorer(clock), learners = new SyntheticMatchLearners();
  const worker = new MatchWorker(descriptor.attemptId, { corpus, strategic, scorer, modelId: descriptor.modelId, clockNs: clock, workDeadlineNs: 297_000_000_000n });
  const transport = new SyntheticMatchTransport(worker, clock);
  const session = new MatchSession({ descriptor, rng, corpus, strategic, verifier, learners, transport, clockNs: clock, originNs: 0n,
    startupDeadlineNs: 10_000_000_000n, workDeadlineNs: 297_000_000_000n, cleanupDeadlineNs: 300_000_000_000n });
  return { session, worker, transport, descriptor, rng, corpus, scorer, verifier, learners, setTime: (value: bigint) => { now = value; } };
}
