// SPEC: _spec/match-runtime.puml
import { isDeepStrictEqual } from "node:util";
import { GameAdmissionError, initializeGame, openGame, settleGame } from "../../contracts/src/game-session";
import type { GamePlans, GameSession, GameTransition } from "../../contracts/src/game-session";
import { decodeMatchReply, decodeMatchRequest } from "../../contracts/src/match";
import type { MatchReply, MatchStop } from "../../contracts/src/match";
import type { PlanPermit } from "../../contracts/src/episode";
import type { AttemptDescriptor, RngState } from "../../contracts/src/training-state";
import type { RecordedCorpus, RecordedWindow } from "./corpus";
import { matchBoundary, matchDigest, naturalMatchStop, planningSides } from "./match-state";
import { PolicyWorker } from "./policy-session";
import type { FrozenScorePort } from "./policy-session";
import { StrategicDriver } from "./strategic";
import type { StrategicApi } from "./strategic";

export interface MatchScorer extends FrozenScorePort { close(): Promise<void>; shutdown(reason: unknown): Promise<void> }
export type MatchWorkerInputs = { corpus: RecordedCorpus | null; strategic: StrategicApi | null; scorer: MatchScorer;
  modelId: string; clockNs: () => bigint; workDeadlineNs: bigint };
type ReplyPayload<T = MatchReply> = T extends MatchReply ? Omit<T, "version" | "attemptId" | "ordinal"> : never;

export class MatchWorker {
  private ordinal = 0;
  private busy = false;
  private failed = false;
  private closed = false;
  private descriptor: AttemptDescriptor | null = null;
  private rng!: RngState;
  private game!: GameSession;
  private previous: MatchReply | null = null;
  private strategic: StrategicDriver | null = null;
  private candidate: PolicyWorker | null = null;
  private plans: GamePlans = { w: [], b: [] };
  private sideCursor = 0;
  private windows = 0;
  private plies = 0;
  private stop: MatchStop | null = null;
  private readonly candidateIds: string[] = [];
  private readonly opponentIds: string[] = [];
  private readonly recorded: RecordedWindow[] = [];

  constructor(private readonly attemptId: string, private readonly input: MatchWorkerInputs) {}
  private checkTime(): void { if (this.input.clockNs() >= this.input.workDeadlineNs) throw new Error("Match worker: DEADLINE"); }
  private setTransition(transition: GameTransition): void {
    this.game = transition.session;
    if (transition.native.kind === "settled" || transition.native.value.result.asResolve) this.plies++;
    this.strategic?.advance(transition);
  }
  private reply(payload: ReplyPayload): MatchReply {
    return decodeMatchReply(JSON.stringify({ version: "chess-coach.match.v1", attemptId: this.attemptId, ordinal: this.ordinal, ...payload }));
  }
  private complete(): MatchReply {
    if (this.stop === null) throw new Error("Match worker: UNPROVED_STOP");
    if (this.descriptor!.schedule.kind === "corpus") this.input.corpus!.checkConsumedPrefix(this.descriptor!.schedule.corpusIndex, this.recorded);
    return this.reply({ kind: "complete", stop: this.stop, boundaryOrdinal: this.game.history.length, planningWindows: this.windows, recordedPlies: this.plies,
      candidateIds: this.candidateIds, opponentIds: this.opponentIds, recordedCount: this.recorded.length, recordedDigest: matchDigest(this.recorded), rng: this.rng });
  }
  private nextBoundary(): MatchReply {
    this.stop = naturalMatchStop(this.game, this.descriptor!, this.windows, this.plies, this.input.corpus);
    if (this.stop?.reason === "core-terminal") return this.complete();
    const opened = openGame(this.game);
    this.setTransition(opened);
    this.plans = { w: [], b: [] };
    this.sideCursor = 0;
    this.stop = naturalMatchStop(this.game, this.descriptor!, this.windows, this.plies, this.input.corpus);
    return this.reply({ kind: "opened", planningOrdinal: this.windows, state: matchBoundary(this.game, opened) });
  }
  private async plan(permit: PlanPermit | null): Promise<MatchReply> {
    const side = planningSides(this.descriptor!)[this.sideCursor];
    if (side === undefined || permit === null || permit.side !== side || permit.planningOrdinal !== this.windows || permit.attemptId !== this.attemptId ||
      permit.turn !== this.game.snapshot.turn || permit.role !== (side === this.descriptor!.schedule.candidateSide ? "candidate" : "strategic") ||
      BigInt(permit.deadlineNs) - BigInt(permit.issuedNs) !== 10_000_000_000n) throw new Error("Match worker: PERMIT_ORDER");
    const localStart = this.input.clockNs(), localPermit = { ...permit, issuedNs: String(localStart), deadlineNs: String(localStart + 10_000_000_000n) };
    if (permit.role === "candidate") {
      this.candidate = new PolicyWorker({ permit: localPermit, modelId: this.input.modelId, observationJson: JSON.stringify(this.game.recipients[side].observation),
        sampling: this.rng["policy-sampling"], mode: "sample", clockNs: this.input.clockNs, workDeadlineNs: this.input.workDeadlineNs }, this.input.scorer);
      const journal = JSON.parse(await this.candidate.plan(JSON.stringify(localPermit)));
      return this.reply({ kind: "candidate", journal });
    }
    if (this.strategic === null) throw new Error("Match worker: STRATEGIC_REQUIRED");
    return this.reply({ kind: "strategic", journal: JSON.parse(await this.strategic.plan(JSON.stringify(localPermit))) });
  }
  private admit(): MatchReply {
    if (this.descriptor!.schedule.kind === "corpus") {
      const window = this.input.corpus!.window(this.descriptor!.schedule.corpusIndex, this.windows);
      if (window === null) throw new Error("Match worker: SOURCE_EXHAUSTED");
      this.recorded.push(window);
      this.plans.w = structuredClone(window.actions);
    }
    let settled: GameTransition;
    try { settled = settleGame(this.game, this.plans); }
    catch (error) {
      if (!(error instanceof GameAdmissionError)) throw error;
      const reason = error.side === this.descriptor!.schedule.candidateSide ? "candidate-native-rejection"
        : this.descriptor!.schedule.kind === "corpus" && error.side === "w" ? "recorded-white-rejection" : null;
      if (reason === null) throw error;
      this.stop = { reason, returnValue: -1, side: error.side, actionOrdinal: error.actionOrdinal, code: error.code };
      return this.reply({ kind: "rejected", stop: this.stop });
    }
    this.setTransition(settled);
    const ordinal = this.windows++;
    return this.reply({ kind: "settled", planningOrdinal: ordinal, state: matchBoundary(this.game, settled) });
  }
  async handle(json: string): Promise<string> {
    if (this.failed || this.closed || this.busy) {
      this.failed = true;
      const error = new Error("Match worker: CLOSED_OR_REENTRY");
      await this.input.scorer.shutdown(error);
      throw error;
    }
    this.busy = true;
    try {
      this.checkTime();
      const request = decodeMatchRequest(json);
      if (request.attemptId !== this.attemptId || request.ordinal !== this.ordinal) throw new Error("Match worker: BINDING");
      let reply: MatchReply;
      if (request.operation === "start") {
        if (this.previous !== null || request.descriptor.attemptId !== this.attemptId || request.descriptor.modelId !== this.input.modelId) throw new Error("Match worker: START_BINDING");
        this.descriptor = structuredClone(request.descriptor);
        this.rng = structuredClone(request.rng);
        this.game = initializeGame();
        if (this.descriptor.schedule.kind === "live") {
          if (this.input.strategic === null) throw new Error("Match worker: STRATEGIC_REQUIRED");
          this.strategic = new StrategicDriver(this.attemptId, this.descriptor.schedule.candidateSide === "w" ? "b" : "w", this.game.snapshot,
            this.rng.opponent, this.input.strategic, this.input.clockNs, this.input.workDeadlineNs);
        } else if (this.input.corpus === null) throw new Error("Match worker: CORPUS_REQUIRED");
        reply = this.reply({ kind: "ready", state: matchBoundary(this.game) });
      } else {
        if (this.previous === null || request.replyDigest !== matchDigest(this.previous)) throw new Error("Match worker: ACK_BINDING");
        if (request.operation === "close") {
          if (this.previous.kind !== "complete") throw new Error("Match worker: CLOSE_PHASE");
          await this.input.scorer.close();
          reply = this.reply({ kind: "closed" });
          this.closed = true;
        } else {
          const previous = this.previous;
          if (previous.kind === "ready" || previous.kind === "settled") {
            if (request.nextPermit !== null) throw new Error("Match worker: EARLY_PERMIT");
            reply = this.nextBoundary();
          } else if (previous.kind === "opened") {
            reply = this.stop === null ? await this.plan(request.nextPermit) : request.nextPermit === null ? this.complete() : (() => { throw new Error("Match worker: POST_STOP_PERMIT"); })();
          } else if (previous.kind === "candidate" || previous.kind === "strategic") {
            const journal = previous.journal, digest = matchDigest(journal);
            if (previous.kind === "candidate") {
              this.candidate!.acceptAck(digest);
              this.rng["policy-sampling"] = this.candidate!.sampling();
              this.candidateIds.push(journal.permitId);
              this.candidate = null;
            } else {
              this.strategic!.acceptAck(digest);
              this.rng.opponent = this.strategic!.sampling();
              this.opponentIds.push(journal.permitId);
            }
            this.plans[journal.side] = structuredClone(journal.actions);
            this.sideCursor++;
            if (this.sideCursor < planningSides(this.descriptor!).length) reply = await this.plan(request.nextPermit);
            else {
              if (request.nextPermit !== null) throw new Error("Match worker: UNUSED_PERMIT");
              reply = this.admit();
            }
          } else if (previous.kind === "rejected" && request.nextPermit === null) reply = this.complete();
          else throw new Error("Match worker: PHASE");
        }
      }
      this.checkTime();
      if (this.failed || !isDeepStrictEqual(reply, decodeMatchReply(JSON.stringify(reply)))) throw new Error("Match worker: REVOKED");
      this.previous = reply;
      this.ordinal++;
      return JSON.stringify(reply);
    } catch (error) { this.failed = true; await this.input.scorer.shutdown(error); throw error; }
    finally { this.busy = false; }
  }
}
