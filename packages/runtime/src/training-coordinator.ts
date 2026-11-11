// SPEC: _spec/checkpoint-runtime.puml, _spec/match-runtime.puml
import type { AttemptDescriptor, RngState, TrainingBindings, TrainingState } from "../../contracts/src/training-state";
import { MatchSession } from "./match-session";
import type { MatchClock, MatchSessionInputs } from "./match-session";
import { PrivateState } from "./private-state";
import { TrainingStore } from "./training-store";
import type { NativeRecord } from "./training-store";
import { experimentShape, finalModelShape } from "../../contracts/src/training-artifact";
import type { TrainingExperiment } from "../../contracts/src/training-artifact";
import type { ByteRef } from "../../contracts/src/training-state";
import { STORAGE_BOUNDS } from "./storage-bounds";

type OwnedDependencies = Pick<MatchSessionInputs, "transport" | "learners" | "verifier" | "corpus" | "strategic" | "onStarted"> & { releaseInputs?: () => void };
export type AttemptSetup = (input: { descriptor: AttemptDescriptor; rng: RngState; model: NativeRecord; directory: string; timing: MatchClock }) => OwnedDependencies | Promise<OwnedDependencies>;
export function evidencePacket(descriptor: AttemptDescriptor): number { return (descriptor.master - 101) * 10 + Math.floor(descriptor.startedOrdinal / 100); }
export class TrainingCoordinator {
  private readonly state: PrivateState;
  private readonly store: TrainingStore;
  private failed = false;
  private busy = false;
  private sealed = false;
  private active: MatchSession | null = null;
  constructor(root: string, bindings: TrainingBindings) {
    this.state = new PrivateState(root);
    this.store = new TrainingStore(this.state.databasePath(), bindings);
  }
  initializeMaster(master: number, record: NativeRecord): TrainingState {
    if (this.failed || this.busy || this.sealed) throw new Error("Training coordinator: CLOSED_OR_PENDING");
    try {
      const state = this.store.initializeMaster(master, record), id = `initial-master-${master}`;
      this.state.attempt(id, (master - 101) * 10);
      const config = Buffer.from(JSON.stringify(record.config));
      if (config.byteLength > STORAGE_BOUNDS.configBytes) throw new Error("Training coordinator: CONFIG_BOUND");
      this.state.write(id, "initial-native-record", record.record);
      this.state.write(id, "initial-model-config", config);
      return state;
    }
    catch (error) { this.stop(error); throw error; }
  }
  private stop(error: unknown): void {
    this.failed = true;
    this.store.stopAll(JSON.stringify({ kind: "infrastructure-abort", type: error instanceof Error ? error.name : typeof error, message: String(error).slice(0, 4096) }));
  }
  snapshot(master: number): TrainingState { return this.store.snapshot(master); }
  async runAttempt(master: number, attemptId: string, timing: MatchClock, createOwned: AttemptSetup): Promise<TrainingState> {
    if (this.busy) {
      const error = new Error("Training coordinator: CLOSED_OR_PENDING");
      this.failed = true;
      try { await this.active?.shutdown(error); } finally { this.stop(error); }
      throw error;
    }
    if (this.failed || this.sealed) throw new Error("Training coordinator: CLOSED_OR_PENDING");
    this.busy = true;
    let session: MatchSession | null = null;
    let dependencies: OwnedDependencies | null = null;
    let inputsReleased = false;
    const check = () => {
      if (this.failed || timing.clockNs() < timing.originNs || timing.clockNs() >= timing.workDeadlineNs) throw new Error("Training coordinator: ORIGINAL_DEADLINE");
    };
    try {
      check();
      if (!/^[A-Za-z0-9._:-]{1,32}$/.test(attemptId) || timing.startupDeadlineNs !== timing.originNs + 10_000_000_000n ||
        timing.workDeadlineNs !== timing.originNs + 297_000_000_000n || timing.cleanupDeadlineNs !== timing.originNs + 300_000_000_000n) throw new Error("Training coordinator: CONTEXT");
      const descriptor = this.store.start(master, attemptId), rng = this.store.snapshot(master).rng;
      check();
      const directory = this.state.attempt(attemptId, evidencePacket(descriptor)), model = this.store.inferenceRecord(master);
      const started = Buffer.from(JSON.stringify({ descriptor, rng }));
      if (started.byteLength > STORAGE_BOUNDS.startedBytes) throw new Error("Training coordinator: STARTED_BOUND");
      this.state.write(attemptId, "started-descriptor", started);
      check();
      dependencies = await createOwned({ descriptor: structuredClone(descriptor), rng: structuredClone(rng), model, directory, timing });
      check();
      session = new MatchSession({ ...dependencies, ...timing, descriptor, rng });
      this.active = session;
      const result = await session.run();
      check();
      dependencies.releaseInputs?.();
      inputsReleased = true;
      check();
      const journalRef = this.state.appendJournal(attemptId, result.auditJson);
      if (Buffer.byteLength(result.historyJson) > STORAGE_BOUNDS.historyBytes) throw new Error("Training coordinator: HISTORY_BOUND");
      const historyRef = this.state.write(attemptId, "authorized-history", Buffer.from(result.historyJson));
      const proposal = result.proposal.kind === "proposed" ? { config: result.proposal.config, record: Uint8Array.from(result.proposal.record) } : null;
      if (proposal && proposal.record.byteLength > STORAGE_BOUNDS.nativeRecordBytes) throw new Error("Training coordinator: RECORD_BOUND");
      const proposalRef = proposal ? this.state.write(attemptId, "native-proposal", proposal.record) : null;
      if (proposal) {
        const config = Buffer.from(JSON.stringify(proposal.config));
        if (config.byteLength > STORAGE_BOUNDS.configBytes) throw new Error("Training coordinator: CONFIG_BOUND");
        this.state.write(attemptId, "proposal-config", config);
      }
      check();
      const completed = this.store.complete(master, attemptId, { reason: result.reason, returnValue: result.returnValue, sampledDecisions: result.sampledDecisions,
        nonzeroPolicyGradient: result.proposal.kind === "proposed" && result.proposal.nonzeroPolicyGradient, rngAfter: result.rngAfter, journalRef, historyRef, proposalRef }, proposal);
      check();
      return completed;
    } catch (error) {
      this.failed = true;
      const errors: unknown[] = [error];
      if (session !== null) {
        try { this.state.write(attemptId, "failed-prefix", Buffer.from(session.diagnosticJson())); } catch (storage) { errors.push(storage); }
      }
      if (session === null && dependencies !== null) {
        const cleanup = await Promise.allSettled([dependencies.transport.terminate(error), dependencies.learners.abort(error)]);
        errors.push(...cleanup.flatMap(value => value.status === "rejected" && value.reason !== error ? [value.reason] : []));
      }
      if (dependencies !== null && !inputsReleased) {
        try { dependencies.releaseInputs?.(); } catch (release) { errors.push(release); }
      }
      try { this.stop(error); } catch (storage) { errors.push(storage); }
      if (errors.length > 1) throw new AggregateError(errors, "Training coordinator: ABORT_ALL");
      throw error;
    } finally { this.busy = false; this.active = null; }
  }
  finalize(timing: MatchClock): { experiment: TrainingExperiment; ref: ByteRef } {
    if (this.failed || this.busy || this.sealed) throw new Error("Training coordinator: CLOSED_OR_PENDING");
    const check = () => { if (timing.clockNs() < timing.originNs || timing.clockNs() >= timing.workDeadlineNs) throw new Error("Training coordinator: ORIGINAL_DEADLINE"); };
    try {
      check();
      const models = this.store.finalModels(), id = "final-artifacts";
      this.state.attempt(id, 49);
      const artifacts = models.map(({ state, model }) => {
        check();
        if (state.journalRef === null) throw new Error("Training coordinator: MISSING_FINAL_JOURNAL");
        if (Buffer.byteLength(JSON.stringify(model.config)) > STORAGE_BOUNDS.configBytes) throw new Error("Training coordinator: CONFIG_BOUND");
        const recordRef = this.state.write(id, `native-${state.master}`, model.record);
        const configRef = this.state.write(id, `config-${state.master}`, Buffer.from(JSON.stringify(model.config)));
        const artifact = finalModelShape.parse({ version: "chess-coach.training-artifact.v1", status: "VALID", master: state.master, model: model.config,
          recordRef, configRef, counters: state.counters, finalJournalRef: state.journalRef, bindings: state.bindings });
        const bytes = Buffer.from(JSON.stringify(artifact));
        if (bytes.byteLength + model.record.byteLength > 1048576) throw new Error("Training coordinator: ARTIFACT_BOUND");
        return { master: state.master, artifactRef: this.state.write(id, `artifact-${state.master}`, bytes) };
      });
      check();
      const experiment = experimentShape.parse({ version: "chess-coach.training-experiment.v1", status: "COMPLETE", artifacts, primaryMaster: 101, primaryArtifactRef: artifacts[0]!.artifactRef });
      const bytes = Buffer.from(JSON.stringify(experiment));
      if (bytes.byteLength > STORAGE_BOUNDS.experimentBytes) throw new Error("Training coordinator: EXPERIMENT_BOUND");
      const ref = this.state.write(id, "experiment-proposal", bytes);
      check();
      this.sealed = true;
      return { experiment, ref };
    } catch (error) { this.stop(error); throw error; }
  }
  close(): void { this.failed = true; this.store.close(); }
}
