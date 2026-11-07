// SPEC: _spec/match-runtime.puml, _spec/checkpoint-runtime.puml
import { isDeepStrictEqual } from "node:util";
import { GameAdmissionError, initializeGame, openGame, settleGame } from "../../contracts/src/game-session";
import type { GamePlans, GameSession, GameTransition } from "../../contracts/src/game-session";
import { decodeMatchReply, decodeMatchRequest, MAX_MATCH_COMPLETION_BYTES } from "../../contracts/src/match";
import type { MatchReply, MatchRequest, MatchStop } from "../../contracts/src/match";
import type { PlanPermit } from "../../contracts/src/episode";
import { attemptDescriptorShape, rngStateShape } from "../../contracts/src/training-state";
import type { AttemptDescriptor, RngState } from "../../contracts/src/training-state";
import type { RecordedCorpus, RecordedWindow } from "./corpus";
import { matchBoundary, matchDigest, naturalMatchStop, planningSides } from "./match-state";
import { PolicySession } from "./policy-session";
import type { AckedDecision, FrozenScorePort } from "./policy-session";
import { StrategicDriver } from "./strategic";
import type { StrategicApi } from "./strategic";
import type { ExitReceipt, OwnedTransport } from "./native-session";
import type { PairedProposal } from "./learner-pair";

type RawFrame = { json: string; receivedNs: bigint };
export type MatchCutoffReceipt = { exit: ExitReceipt; groupGone: boolean; fault: boolean; frame: RawFrame | null };
export interface OwnedMatchTransport extends OwnedTransport { cutoff(reason: unknown): Promise<MatchCutoffReceipt> }
export interface MatchLearners {
  begin(baseline: number): Promise<void>;
  accumulate(accepted: AckedDecision): Promise<void>;
  propose(returnValue: -1 | 0 | 1): Promise<PairedProposal>;
  close(): Promise<void>;
  abort(reason: unknown): Promise<never>;
}
export type MatchClock = { clockNs: () => bigint; originNs: bigint; startupDeadlineNs: bigint; workDeadlineNs: bigint; cleanupDeadlineNs: bigint };
export type MatchSessionInputs = MatchClock & { descriptor: AttemptDescriptor; rng: RngState; corpus: RecordedCorpus | null; strategic: StrategicApi | null;
  verifier: FrozenScorePort; learners: MatchLearners; transport: OwnedMatchTransport };
export type VerifiedMatchResult = { descriptor: AttemptDescriptor; reason: MatchStop["reason"] | "candidate-deadline"; returnValue: -1 | 0 | 1;
  sampledDecisions: number; rngAfter: RngState; proposal: PairedProposal; auditJson: string; historyJson: string };
const expired = Symbol("owned-match-deadline");
const clean = (receipt: ExitReceipt): boolean => receipt.stdinClosed && receipt.stdoutEof && receipt.stderrEof && receipt.reaped && receipt.exitCode === 0 && !receipt.forced;

export class MatchSession {
  private readonly input: MatchSessionInputs;
  private ordinal = 0;
  private consumed = false;
  private failed = false;
  private game!: GameSession;
  private rng: RngState;
  private strategic: StrategicDriver | null = null;
  private previous: MatchReply | null = null;
  private permit: PlanPermit | null = null;
  private windows = 0;
  private plies = 0;
  private sideCursor = 0;
  private plans: GamePlans = { w: [], b: [] };
  private candidateSession: PolicySession | null = null;
  private stop: MatchStop | null = null;
  private readonly candidateIds: string[] = [];
  private readonly opponentIds: string[] = [];
  private readonly recorded: RecordedWindow[] = [];
  private readonly audit: string[] = [];
  private auditBytes = 0;
  private readonly history: unknown[] = [];
  private cleanup: Promise<void> | null = null;

  constructor(input: MatchSessionInputs) {
    const descriptor = attemptDescriptorShape.parse(input.descriptor), rng = rngStateShape.parse(input.rng), now = input.clockNs();
    if (now < input.originNs || now >= input.startupDeadlineNs || input.startupDeadlineNs !== input.originNs + 10_000_000_000n ||
      input.workDeadlineNs <= input.startupDeadlineNs || input.cleanupDeadlineNs - input.workDeadlineNs !== 3_000_000_000n ||
      input.cleanupDeadlineNs > input.originNs + 300_000_000_000n || descriptor.attemptId.length > 32) throw new Error("Match session: CONTEXT");
    this.input = { ...input, descriptor, rng };
    this.rng = structuredClone(rng);
  }
  private time(deadline = this.input.workDeadlineNs): void {
    const now = this.input.clockNs();
    if (now < this.input.originNs || now >= deadline) throw new Error("Match session: DEADLINE");
    if (this.failed) throw new Error("Match session: REVOKED");
  }
  private async bounded<T>(action: () => Promise<T>, deadline = this.input.workDeadlineNs): Promise<T> {
    this.time(deadline);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<typeof expired>(resolve => { timer = setTimeout(() => resolve(expired), Number((deadline - this.input.clockNs() + 999999n) / 1000000n)); });
      const result = await Promise.race([Promise.resolve().then(action), timeout]);
      if (result === expired) { this.time(deadline); throw new Error("Match session: EARLY_TIMER"); }
      this.time(deadline);
      return result;
    } finally { if (timer !== undefined) clearTimeout(timer); }
  }
  private append(kind: string, value: unknown): void {
    const json = JSON.stringify({ ordinal: this.audit.length, kind, value });
    this.auditBytes += Buffer.byteLength(json) + 1;
    if (this.auditBytes > MAX_MATCH_COMPLETION_BYTES) throw new Error("Match session: AUDIT_BOUND");
    this.audit.push(json);
  }
  private transition(transition: GameTransition): void {
    this.game = transition.session;
    if (transition.native.kind === "settled" || transition.native.value.result.asResolve) this.plies++;
    this.strategic?.advance(transition);
    this.append("native", transition);
    this.history.push(structuredClone(this.game.batches[this.input.descriptor.schedule.candidateSide]));
  }
  private issue(): PlanPermit {
    this.time();
    const side = planningSides(this.input.descriptor)[this.sideCursor];
    if (side === undefined) throw new Error("Match session: PERMIT_ORDER");
    const issued = this.input.clockNs(), deadline = issued + 10_000_000_000n;
    if (deadline > this.input.workDeadlineNs) throw new Error("Match session: INSUFFICIENT_PLAN_BUDGET");
    const permit: PlanPermit = { version: "chess-coach.plan-permit.v1", attemptId: this.input.descriptor.attemptId,
      permitId: `${this.input.descriptor.attemptId}:plan:${this.windows}:${side}`, planningOrdinal: this.windows, turn: this.game.snapshot.turn,
      side, role: side === this.input.descriptor.schedule.candidateSide ? "candidate" : "strategic", issuedNs: String(issued), deadlineNs: String(deadline) };
    this.permit = permit;
    this.append("permit", permit);
    return permit;
  }
  private request(operation: "start" | "accept" | "close", nextPermit: PlanPermit | null = null): MatchRequest {
    const header = { version: "chess-coach.match.v1" as const, attemptId: this.input.descriptor.attemptId, ordinal: this.ordinal };
    return operation === "start" ? { ...header, operation, descriptor: this.input.descriptor, rng: this.input.rng }
      : operation === "close" ? { ...header, operation, replyDigest: matchDigest(this.previous) }
      : { ...header, operation, replyDigest: matchDigest(this.previous), nextPermit };
  }
  private decode(raw: RawFrame, issued: bigint, deadline: bigint): MatchReply {
    if (raw.receivedNs < issued || raw.receivedNs > this.input.clockNs() || raw.receivedNs >= deadline) throw new Error("Match session: RECEIPT");
    const reply = decodeMatchReply(raw.json);
    if (reply.attemptId !== this.input.descriptor.attemptId || reply.ordinal !== this.ordinal) throw new Error("Match session: BINDING");
    return reply;
  }
  private lateCandidate(raw: RawFrame | null, permit: PlanPermit): void {
    if (raw === null) return;
    if (raw.receivedNs < BigInt(permit.deadlineNs) || raw.receivedNs > this.input.clockNs()) throw new Error("Match session: TIMEOUT_RACE");
    const reply = decodeMatchReply(raw.json);
    if (reply.attemptId !== this.input.descriptor.attemptId || reply.ordinal !== this.ordinal || reply.kind !== "candidate" ||
      reply.journal.permitId !== permit.permitId || reply.journal.side !== permit.side || reply.journal.planningOrdinal !== permit.planningOrdinal) throw new Error("Match session: LATE_BINDING");
  }
  private async exchange(request: MatchRequest, startup = false): Promise<MatchReply | null> {
    const json = JSON.stringify(request);
    decodeMatchRequest(json);
    this.time(startup ? this.input.startupDeadlineNs : this.input.workDeadlineNs);
    const issued = this.input.clockNs(), permit = this.permit;
    const deadline = permit === null ? startup ? this.input.startupDeadlineNs : this.input.workDeadlineNs : BigInt(permit.deadlineNs);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let observed: RawFrame | null = null, fault: unknown = null;
    try {
      const response = Promise.resolve().then(() => this.input.transport.exchange(json)).then(raw => { observed = raw; return raw; }, error => { fault = error; throw error; });
      const timeout = new Promise<typeof expired>(resolve => { timer = setTimeout(() => resolve(expired), Number((deadline - this.input.clockNs() + 999999n) / 1000000n)); });
      const result = await Promise.race([response, timeout]);
      if (result === expired || result.receivedNs >= deadline) {
        if (this.input.clockNs() < deadline || permit?.role !== "candidate" || this.input.clockNs() >= this.input.workDeadlineNs || fault !== null) throw new Error("Match session: NONCANDIDATE_TIMEOUT");
        const receipt = await this.bounded(() => this.input.transport.cutoff(new Error("Match session: CANDIDATE_CUTOFF")));
        if (receipt.fault || !receipt.groupGone || !receipt.exit.reaped || !receipt.exit.stdinClosed || !receipt.exit.stdoutEof || !receipt.exit.stderrEof || !receipt.exit.forced) throw new Error("Match session: CUTOFF_RECEIPT");
        this.lateCandidate(receipt.frame ?? observed, permit);
        this.append("candidate-deadline", { permit, receipt, observedNs: String(this.input.clockNs()) });
        return null;
      }
      const reply = this.decode(result, issued, deadline);
      this.time(startup ? this.input.startupDeadlineNs : this.input.workDeadlineNs);
      this.acceptedPermit = permit;
      this.lastReceivedNs = result.receivedNs;
      this.permit = null;
      this.previous = reply;
      this.ordinal++;
      return reply;
    } finally { if (timer !== undefined) clearTimeout(timer); }
  }
  private checkState(reply: Extract<MatchReply, { kind: "ready" | "opened" | "settled" }>, transition?: GameTransition): void {
    if (!isDeepStrictEqual(reply.state, matchBoundary(this.game, transition))) throw new Error("Match session: NATIVE_MISMATCH");
  }
  private async admission(): Promise<MatchReply | null> {
    if (this.input.descriptor.schedule.kind === "corpus") {
      const window = this.input.corpus!.window(this.input.descriptor.schedule.corpusIndex, this.windows);
      if (window === null) throw new Error("Match session: SOURCE_EXHAUSTED");
      this.recorded.push(window);
      this.plans.w = structuredClone(window.actions);
    }
    if (this.candidateSession === null) throw new Error("Match session: MISSING_CANDIDATE_ACK");
    let transition: GameTransition;
    try { transition = await this.candidateSession.admit(() => settleGame(this.game, this.plans)); }
    catch (error) {
      if (!(error instanceof GameAdmissionError)) throw error;
      const reason = error.side === this.input.descriptor.schedule.candidateSide ? "candidate-native-rejection"
        : this.input.descriptor.schedule.kind === "corpus" && error.side === "w" ? "recorded-white-rejection" : null;
      if (reason === null) throw error;
      this.stop = { reason, returnValue: -1, side: error.side, actionOrdinal: error.actionOrdinal, code: error.code };
      const reply = await this.exchange(this.request("accept"));
      if (reply === null || reply.kind !== "rejected" || !isDeepStrictEqual(reply.stop, this.stop)) throw new Error("Match session: REJECTION_MISMATCH");
      this.append("native-rejection", { stop: this.stop, plans: this.plans, boundaryOrdinal: this.game.history.length });
      return this.exchange(this.request("accept"));
    }
    const reply = await this.exchange(this.request("accept"));
    if (reply === null || reply.kind !== "settled" || reply.planningOrdinal !== this.windows) throw new Error("Match session: SETTLEMENT_PHASE");
    this.transition(transition);
    this.checkState(reply, transition);
    this.windows++;
    this.candidateSession = null;
    return this.exchange(this.request("accept"));
  }
  private verifyCompletion(reply: Extract<MatchReply, { kind: "complete" }>): void {
    const stop = this.stop ?? naturalMatchStop(this.game, this.input.descriptor, this.windows, this.plies, this.input.corpus);
    if (stop === null || !isDeepStrictEqual(reply.stop, stop) || reply.boundaryOrdinal !== this.game.history.length || reply.planningWindows !== this.windows ||
      reply.recordedPlies !== this.plies || !isDeepStrictEqual(reply.candidateIds, this.candidateIds) || !isDeepStrictEqual(reply.opponentIds, this.opponentIds) ||
      !isDeepStrictEqual(reply.rng, this.rng) || reply.recordedCount !== this.recorded.length || reply.recordedDigest !== matchDigest(this.recorded)) throw new Error("Match session: COMPLETION_MISMATCH");
    if (this.input.descriptor.schedule.kind === "corpus") this.input.corpus!.checkConsumedPrefix(this.input.descriptor.schedule.corpusIndex, this.recorded);
    this.stop = stop;
  }
  async run(): Promise<VerifiedMatchResult> {
    if (this.consumed) {
      const error = new Error("Match session: NO_RETRY");
      if (this.completed) throw error;
      await this.revoke(error);
      throw error;
    }
    this.consumed = true;
    try {
      this.append("started", { descriptor: this.input.descriptor, rng: this.rng });
      await this.bounded(() => this.input.learners.begin(this.input.descriptor.frozenBaseline), this.input.startupDeadlineNs);
      let reply = await this.exchange(this.request("start"), true);
      if (reply?.kind !== "ready") throw new Error("Match session: READY_PHASE");
      this.game = initializeGame();
      this.checkState(reply);
      this.append("initial", this.game);
      this.history.push(structuredClone(this.game.batches[this.input.descriptor.schedule.candidateSide]));
      if (this.input.descriptor.schedule.kind === "live") {
        if (this.input.strategic === null) throw new Error("Match session: STRATEGIC_REQUIRED");
        this.strategic = new StrategicDriver(this.input.descriptor.attemptId, this.input.descriptor.schedule.candidateSide === "w" ? "b" : "w",
          this.game.snapshot, this.rng.opponent, this.input.strategic, this.input.clockNs, this.input.workDeadlineNs);
      } else if (this.input.corpus === null) throw new Error("Match session: CORPUS_REQUIRED");
      this.time(this.input.startupDeadlineNs);
      reply = await this.exchange(this.request("accept"));
      let deadlineStop = false;
      while (reply !== null) {
        this.time();
        if (reply.kind === "opened") {
          if (reply.planningOrdinal !== this.windows) throw new Error("Match session: OPEN_ORDINAL");
          const opened = openGame(this.game);
          this.transition(opened);
          this.checkState(reply, opened);
          this.plans = { w: [], b: [] };
          this.sideCursor = 0;
          this.stop = naturalMatchStop(this.game, this.input.descriptor, this.windows, this.plies, this.input.corpus);
          reply = await this.exchange(this.request("accept", this.stop === null ? this.issue() : null));
        } else if (reply.kind === "candidate" || reply.kind === "strategic") {
          const expectedSide = planningSides(this.input.descriptor)[this.sideCursor];
          const journal = reply.journal;
          if (journal.side !== expectedSide || journal.planningOrdinal !== this.windows) throw new Error("Match session: DECISION_ORDER");
          const permit = this.lastPermit();
          if (reply.kind === "candidate") {
            if (permit.role !== "candidate") throw new Error("Match session: DECISION_ROLE");
            const session = new PolicySession({ permit, modelId: this.input.descriptor.modelId, observationJson: JSON.stringify(this.game.recipients[journal.side].observation),
              sampling: this.rng["policy-sampling"], mode: "sample", workDeadlineNs: this.input.workDeadlineNs, clockNs: this.input.clockNs }, this.input.verifier);
            const accepted = await session.acknowledge({ json: JSON.stringify(journal), receivedNs: this.lastReceivedNs });
            await this.bounded(() => this.input.learners.accumulate(accepted));
            this.candidateSession = session;
            this.rng["policy-sampling"] = accepted.journal.samplingAfter;
            this.candidateIds.push(journal.permitId);
          } else {
            if (permit.role !== "strategic" || this.strategic === null) throw new Error("Match session: DECISION_ROLE");
            const accepted = await this.strategic.verify({ json: JSON.stringify(journal), receivedNs: this.lastReceivedNs }, permit);
            this.rng.opponent = accepted.journal.opponentAfter;
            this.opponentIds.push(journal.permitId);
          }
          this.plans[journal.side] = structuredClone(journal.actions);
          this.append("decision-acked", journal);
          this.sideCursor++;
          reply = this.sideCursor < planningSides(this.input.descriptor).length ? await this.exchange(this.request("accept", this.issue())) : await this.admission();
        } else if (reply.kind === "complete") {
          this.verifyCompletion(reply);
          this.append("complete", reply);
          const closed = await this.exchange(this.request("close"));
          if (closed?.kind !== "closed") throw new Error("Match session: CLOSE_ACK");
          const receipt = await this.bounded(() => this.input.transport.finish());
          if (!clean(receipt)) throw new Error("Match session: CLEAN_CLOSE");
          this.append("match-exit", receipt);
          break;
        } else throw new Error("Match session: UNEXPECTED_STAGE");
      }
      if (reply === null) deadlineStop = true;
      const stop = deadlineStop ? { reason: "candidate-deadline" as const, returnValue: -1 as const } : this.stop;
      if (stop === null) throw new Error("Match session: MISSING_STOP");
      const proposal = await this.bounded(() => this.input.learners.propose(stop.returnValue));
      if (proposal.kind === "proposed" ? proposal.sampledDecisions !== this.candidateIds.length : this.candidateIds.length !== 0) throw new Error("Match session: SAMPLE_COUNT");
      await this.bounded(() => this.input.learners.close());
      this.append("learners-closed", { kind: proposal.kind, ...(proposal.kind === "proposed" ? { parameterSha256: proposal.parameterSha256, objective: proposal.objective } : {}) });
      this.time();
      const historyJson = JSON.stringify(this.history);
      if (Buffer.byteLength(historyJson) > MAX_MATCH_COMPLETION_BYTES) throw new Error("Match session: HISTORY_BOUND");
      this.completed = true;
      return { descriptor: structuredClone(this.input.descriptor), reason: stop.reason, returnValue: stop.returnValue, sampledDecisions: this.candidateIds.length,
        rngAfter: structuredClone(this.rng), proposal, auditJson: this.audit.join("\n") + "\n", historyJson };
    } catch (error) {
      await this.revoke(error);
      throw error;
    }
  }
  private lastReceivedNs = 0n;
  private completed = false;
  private acceptedPermit: PlanPermit | null = null;
  private lastPermit(): PlanPermit { return this.acceptedPermit ?? (() => { throw new Error("Match session: MISSING_PERMIT"); })(); }
  diagnosticJson(): string {
    return JSON.stringify({ descriptor: this.input.descriptor, rng: this.rng, candidateIds: this.candidateIds, opponentIds: this.opponentIds,
      pendingPermit: this.permit, boundaryOrdinal: this.game?.history.length ?? null, records: this.audit });
  }
  shutdown(reason: unknown): Promise<void> { return this.revoke(reason); }
  private revoke(reason: unknown): Promise<void> {
    this.failed = true;
    if (this.cleanup !== null) return this.cleanup;
    const operations = Promise.allSettled([Promise.resolve().then(() => this.input.transport.terminate(reason)), Promise.resolve().then(() => this.input.learners.abort(reason))]);
    this.cleanup = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const remaining = this.input.cleanupDeadlineNs - this.input.clockNs();
        const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Match session: CLEANUP_DEADLINE")), Math.max(0, Number((remaining + 999999n) / 1000000n))); });
        const results = await Promise.race([operations, timeout]);
        const failures = results.flatMap(value => value.status === "rejected" && value.reason !== reason ? [value.reason] : []);
        if (this.input.clockNs() >= this.input.cleanupDeadlineNs) failures.push(new Error("Match session: CLEANUP_DEADLINE"));
        if (failures.length) throw new AggregateError([reason, ...failures], "Match session: CLEANUP");
      } finally { if (timer !== undefined) clearTimeout(timer); }
    })();
    return this.cleanup;
  }
}
