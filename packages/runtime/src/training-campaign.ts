// SPEC: _spec/checkpoint-runtime.puml, _spec/match-runtime.puml
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { modelConfigShape } from "../../contracts/src/learning-channel";
import { experimentShape } from "../../contracts/src/training-artifact";
import { byteRefShape } from "../../contracts/src/training-state";
import type { TrainingBindings, TrainingState } from "../../contracts/src/training-state";
import { checkTrainingState, initialTrainingState } from "./curriculum";
import type { MatchClock } from "./match-session";
import { MASTERS } from "./rng";
import { STORAGE_BOUNDS } from "./storage-bounds";
import type { AttemptSetup, TrainingCoordinator } from "./training-coordinator";
import type { NativeRecord } from "./training-store";

export type CampaignMaster = (typeof MASTERS)[number];
export type CampaignCoordinator = Pick<TrainingCoordinator, "initializeMaster" | "runAttempt" | "finalize" | "close">;
export type TrainingCampaignInput = Readonly<{
  coordinator: CampaignCoordinator;
  initialRecord(master: CampaignMaster, timing: MatchClock): NativeRecord | Promise<NativeRecord>;
  createOwned: AttemptSetup;
  clockNs?: () => bigint;
}>;
type CampaignResult = ReturnType<TrainingCoordinator["finalize"]>;
const fail = (code: string): never => { throw new Error(`Training campaign: ${code}`); };

export class TrainingCampaign {
  private readonly initialize: CampaignCoordinator["initializeMaster"];
  private readonly attempt: CampaignCoordinator["runAttempt"];
  private readonly finalize: CampaignCoordinator["finalize"];
  private readonly close: CampaignCoordinator["close"];
  private readonly initialRecord: TrainingCampaignInput["initialRecord"];
  private readonly createOwned: AttemptSetup;
  private readonly rawClock: () => bigint;
  private readonly clockNs = (): bigint => {
    if (this.clockFailed) throw this.clockFault;
    try {
      const now = this.rawClock();
      if (typeof now !== "bigint" || now < 0n || this.lastNow !== null && now < this.lastNow) fail("CLOCK");
      this.lastNow = now;
      return now;
    } catch (error) { this.clockFailed = true; this.clockFault = error; throw error; }
  };
  private lastNow: bigint | null = null;
  private clockFailed = false;
  private clockFault: unknown;
  private consumed = false;
  private revoked = false;

  constructor(input: TrainingCampaignInput) {
    if (!input?.coordinator) fail("INPUT");
    const { coordinator, initialRecord, createOwned, clockNs = process.hrtime.bigint } = input;
    const { initializeMaster, runAttempt, finalize, close } = coordinator;
    if ([initializeMaster, runAttempt, finalize, close, initialRecord, createOwned, clockNs].some(value => typeof value !== "function")) fail("INPUT");
    this.initialize = initializeMaster.bind(coordinator);
    this.attempt = runAttempt.bind(coordinator);
    this.finalize = finalize.bind(coordinator);
    this.close = close.bind(coordinator);
    this.initialRecord = initialRecord.bind(input);
    this.createOwned = createOwned;
    this.rawClock = clockNs;
  }

  private admitted(): void { if (this.revoked) fail("REVOKED"); }
  private timing(): MatchClock {
    this.admitted();
    const originNs = this.clockNs();
    this.admitted();
    return Object.freeze({ clockNs: this.clockNs, originNs, startupDeadlineNs: originNs + 10_000_000_000n,
      workDeadlineNs: originNs + 297_000_000_000n, cleanupDeadlineNs: originNs + 300_000_000_000n });
  }
  private check(deadline: bigint): void {
    const now = this.clockNs();
    this.admitted();
    if (now >= deadline) fail("DEADLINE");
  }
  private async load(master: CampaignMaster, timing: MatchClock): Promise<NativeRecord> {
    this.check(timing.startupDeadlineNs);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const remaining = timing.startupDeadlineNs - this.clockNs();
      if (remaining <= 0n) fail("DEADLINE");
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Training campaign: INITIAL_DEADLINE")), Number((remaining + 999999n) / 1000000n));
      });
      const input = await Promise.race([Promise.resolve().then(() => {
        this.check(timing.startupDeadlineNs);
        return this.initialRecord(master, timing);
      }), timeout]);
      this.check(timing.startupDeadlineNs);
      if (!(input?.record instanceof Uint8Array) || !input.record.byteLength || input.record.byteLength > STORAGE_BOUNDS.nativeRecordBytes) fail("MODEL_RECORD");
      const config = modelConfigShape.parse(input.config), record = Uint8Array.from(input.record);
      if (Buffer.byteLength(JSON.stringify(config)) > STORAGE_BOUNDS.configBytes || createHash("sha256").update(record).digest("hex") !== config.recordSha256) fail("MODEL_RECORD");
      this.check(timing.startupDeadlineNs);
      return { config, record };
    } finally { if (timer !== undefined) clearTimeout(timer); }
  }
  private progress(input: TrainingState, previous: TrainingState, master: CampaignMaster, completed: number): TrainingState {
    const state = checkTrainingState(input), delta = state.counters.updates - previous.counters.updates;
    if (state.master !== master || state.counters.started !== completed || state.counters.verifiedCompleted !== completed ||
      !isDeepStrictEqual(state.bindings, previous.bindings) || delta !== 0 && delta !== 1 ||
      state.counters.nonzeroPGUpdates < previous.counters.nonzeroPGUpdates || state.counters.nonzeroPGUpdates > previous.counters.nonzeroPGUpdates + delta ||
      Math.abs(state.counters.baselineSum - previous.counters.baselineSum) > delta || delta === 0 && state.modelId !== previous.modelId ||
      state.journalRef === null || previous.journalRef !== null && (state.journalRef.byteLength <= previous.journalRef.byteLength ||
        state.journalRef.lastRecordOrdinal <= previous.journalRef.lastRecordOrdinal) ||
      !previous.historyRefs.every((ref, index) => isDeepStrictEqual(ref, state.historyRefs[index]))) fail("PROGRESS");
    return state;
  }

  async run(): Promise<CampaignResult> {
    if (this.consumed) { this.revoked = true; fail("NO_RETRY"); }
    this.consumed = true;
    const errors: unknown[] = [];
    const retain = (error: unknown): void => { if (!errors.includes(error)) errors.push(error); };
    let result: CampaignResult | undefined, finalTiming: MatchClock | undefined;
    try {
      let bindings: TrainingBindings | null = null;
      for (const master of MASTERS) {
        const timing = this.timing(), record = await this.load(master, timing);
        const modelId = record.config.recordSha256;
        this.check(timing.startupDeadlineNs);
        let state = checkTrainingState(this.initialize(master, record));
        this.check(timing.startupDeadlineNs);
        if (!isDeepStrictEqual(state, initialTrainingState(master, modelId, state.bindings)) ||
          bindings !== null && !isDeepStrictEqual(bindings, state.bindings)) fail("INITIAL_STATE");
        this.check(timing.startupDeadlineNs);
        bindings = state.bindings;
        for (let ordinal = 0; ordinal < 1000; ordinal++) {
          const attemptTiming = this.timing();
          const returned = await this.attempt(master, `m${master}-a${String(ordinal).padStart(4, "0")}`, attemptTiming, this.createOwned);
          this.check(attemptTiming.workDeadlineNs);
          state = this.progress(returned, state, master, ordinal + 1);
          this.check(attemptTiming.workDeadlineNs);
        }
        if (state.counters.started !== 1000 || state.counters.verifiedCompleted !== 1000 || state.counters.nonzeroPGUpdates < 1) fail("FINAL_VALIDITY");
      }
      finalTiming = this.timing();
      const finalized = await this.finalize(finalTiming);
      this.check(finalTiming.workDeadlineNs);
      result = { experiment: experimentShape.parse(finalized.experiment), ref: byteRefShape.parse(finalized.ref) };
      if (!result.ref.byteLength || result.ref.byteLength > STORAGE_BOUNDS.experimentBytes) fail("EXPERIMENT_BOUND");
      this.check(finalTiming.workDeadlineNs);
    } catch (error) { retain(error); }
    let cleanupDeadlineNs = finalTiming?.cleanupDeadlineNs;
    try { cleanupDeadlineNs ??= this.clockNs() + 300_000_000_000n; } catch (error) { retain(error); }
    try { await this.close(); } catch (error) { retain(error); }
    try {
      const now = this.clockNs();
      if (cleanupDeadlineNs !== undefined && now >= cleanupDeadlineNs) fail("DEADLINE");
      if (!errors.length) this.admitted();
    } catch (error) { retain(error); }
    if (errors.length > 1) throw new AggregateError(errors, "Training campaign: ABORT_ALL");
    if (errors.length) throw errors[0];
    return result ?? fail("INCOMPLETE");
  }
}
