// SPEC: _spec/checkpoint-runtime.puml
import type {} from "bun";
import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { closeSync, constants, fsyncSync, openSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { modelConfigShape } from "../../contracts/src/learning-channel";
import { attemptDescriptorShape, bindingsShape, byteRefShape, journalRefShape, rngStateShape } from "../../contracts/src/training-state";
import type { AttemptDescriptor, TrainingBindings, TrainingState } from "../../contracts/src/training-state";
import { checkTrainingState, initialTrainingState, nextAttempt } from "./curriculum";

export type NativeRecord = { config: z.infer<typeof modelConfigShape>; record: Uint8Array };
const completionShape = z.strictObject({ reason: z.enum(["core-terminal", "candidate-native-rejection", "recorded-white-rejection", "trace-exhaustion", "progress-cap", "candidate-deadline"]),
  returnValue: z.union([z.literal(-1), z.literal(0), z.literal(1)]), sampledDecisions: z.int().min(0).max(64), nonzeroPolicyGradient: z.boolean(),
  rngAfter: rngStateShape, journalRef: journalRefShape, historyRef: byteRefShape, proposalRef: byteRefShape.nullable() });
export type CompletionValues = z.infer<typeof completionShape>;
type MasterRow = { master: number; state: string; config: string; record: Uint8Array; pending: string | null; status: string };
type AttemptRow = { descriptor: string; status: string };
const sha = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
function fail(code: string): never { throw new Error(`Training store: ${code}`); }
function record(input: NativeRecord): NativeRecord {
  const config = modelConfigShape.parse(input.config), bytes = new Uint8Array(input.record);
  if (!bytes.byteLength || bytes.byteLength > 1048576 || sha(bytes) !== config.recordSha256) fail("MODEL_RECORD");
  return { config, record: bytes };
}

export class TrainingStore {
  private readonly db: Database;
  private readonly bindings: TrainingBindings;
  private failed = false;
  private closed = false;
  private busy = false;

  constructor(path: string, bindings: TrainingBindings) {
    if (!isAbsolute(path)) fail("PATH");
    this.bindings = bindingsShape.parse(bindings);
    const fd = openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    closeSync(fd);
    this.db = new Database(path, { create: false, readwrite: true, strict: true });
    this.db.run("PRAGMA page_size=4096; PRAGMA max_page_count=16384; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=0; PRAGMA cache_size=-2048; PRAGMA temp_store=MEMORY;");
    if (this.db.query<{ journal_mode: string }, []>("PRAGMA journal_mode=DELETE").get()?.journal_mode !== "delete" ||
      this.db.query<{ synchronous: number }, []>("PRAGMA synchronous").get()?.synchronous !== 2) fail("SQLITE_POLICY");
    this.db.run(`
      CREATE TABLE control (id INTEGER PRIMARY KEY CHECK(id=1), bindings TEXT NOT NULL CHECK(json_valid(bindings)), aborted INTEGER NOT NULL CHECK(aborted IN (0,1)), failure TEXT CHECK(failure IS NULL OR json_valid(failure))) STRICT;
      CREATE TABLE masters (master INTEGER PRIMARY KEY CHECK(master BETWEEN 101 AND 105), state TEXT NOT NULL CHECK(json_valid(state)),
        config TEXT NOT NULL CHECK(json_valid(config)), record BLOB NOT NULL CHECK(length(record) BETWEEN 1 AND 1048576), pending TEXT,
        status TEXT NOT NULL CHECK(status IN ('active','complete'))) STRICT;
      CREATE TABLE attempts (id TEXT PRIMARY KEY, master INTEGER NOT NULL REFERENCES masters(master), ordinal INTEGER NOT NULL CHECK(ordinal BETWEEN 0 AND 999),
        descriptor TEXT NOT NULL CHECK(json_valid(descriptor)), status TEXT NOT NULL CHECK(status IN ('STARTED','COMPLETED','ABORTED')),
        completion TEXT CHECK(completion IS NULL OR json_valid(completion)), UNIQUE(master,ordinal)) STRICT;
      CREATE TABLE checkpoints (master INTEGER NOT NULL REFERENCES masters(master), epoch INTEGER NOT NULL CHECK(epoch BETWEEN 1 AND 1000),
        state TEXT NOT NULL CHECK(json_valid(state)), config TEXT NOT NULL CHECK(json_valid(config)), record BLOB NOT NULL CHECK(length(record) BETWEEN 1 AND 1048576),
        PRIMARY KEY(master,epoch)) STRICT;
    `);
    this.db.run("INSERT INTO control VALUES (1,?,0,NULL)", [JSON.stringify(this.bindings)]);
    const directory = openSync(dirname(path), constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try { fsyncSync(directory); } finally { closeSync(directory); }
  }

  private row(master: number): MasterRow {
    return this.db.query<MasterRow, [number]>("SELECT * FROM masters WHERE master=?").get(master) ?? fail("MASTER");
  }
  snapshot(master: number): TrainingState {
    if (this.closed) fail("CLOSED");
    const state = checkTrainingState(JSON.parse(this.row(master).state));
    if (!isDeepStrictEqual(state.bindings, this.bindings)) fail("BINDINGS");
    return state;
  }
  private mutate<T>(action: () => T): T {
    if (this.busy) { this.failed = true; fail("CLOSED_OR_PENDING"); }
    if (this.failed || this.closed) fail("CLOSED_OR_PENDING");
    this.busy = true;
    try {
      if (this.db.query<{ aborted: number }, []>("SELECT aborted FROM control WHERE id=1").get()?.aborted !== 0) fail("ABORTED");
      return this.db.transaction(() => {
        const result = action();
        if (this.failed) fail("REVOKED");
        return result;
      }).immediate();
    } catch (error) {
      this.failed = true;
      try { this.db.run("UPDATE control SET aborted=1 WHERE id=1"); } catch {}
      throw error;
    } finally { this.busy = false; }
  }

  initializeMaster(master: number, input: NativeRecord): TrainingState {
    return this.mutate(() => {
      const latest = this.db.query<MasterRow, []>("SELECT * FROM masters ORDER BY master DESC LIMIT 1").get();
      if (master !== (latest ? latest.master + 1 : 101) || latest && latest.status !== "complete") fail("SERIAL_MASTERS");
      const selected = record(input), state = initialTrainingState(master, selected.config.recordSha256, this.bindings);
      this.db.run("INSERT INTO masters VALUES (?,?,?,?,NULL,'active')", [master, JSON.stringify(state), JSON.stringify(selected.config), selected.record]);
      return state;
    });
  }

  start(master: number, attemptId: string): AttemptDescriptor {
    return this.mutate(() => {
      const row = this.row(master);
      if (row.pending !== null || row.status !== "active") fail("PENDING_OR_COMPLETE");
      const { descriptor, consumed } = nextAttempt(this.snapshot(master), attemptId);
      this.db.run("INSERT INTO attempts VALUES (?,?,?,?,'STARTED',NULL)", [attemptId, master, descriptor.startedOrdinal, JSON.stringify(descriptor)]);
      this.db.run("UPDATE masters SET state=?,pending=? WHERE master=?", [JSON.stringify(consumed), attemptId, master]);
      return structuredClone(descriptor);
    });
  }

  complete(master: number, attemptId: string, input: CompletionValues, proposal: NativeRecord | null): TrainingState {
    return this.mutate(() => {
      const values = completionShape.parse(input), row = this.row(master), state = this.snapshot(master);
      const attempt = this.db.query<AttemptRow, [string]>("SELECT descriptor,status FROM attempts WHERE id=?").get(attemptId) ?? fail("ATTEMPT");
      const descriptor = attemptDescriptorShape.parse(JSON.parse(attempt.descriptor));
      if (row.pending !== attemptId || attempt.status !== "STARTED" || descriptor.master !== master || descriptor.startedOrdinal !== state.counters.started - 1 ||
        descriptor.modelId !== state.modelId || descriptor.frozenBaseline !== (state.counters.baselineCount ? state.counters.baselineSum / state.counters.baselineCount : 0)) fail("STALE_ATTEMPT");
      if (values.reason !== "core-terminal" && values.returnValue !== -1 || values.sampledDecisions === 0 && (proposal !== null || values.nonzeroPolicyGradient || values.proposalRef !== null)) fail("COMPLETION_DOMAIN");
      for (const label of ["selection", "environment-settlement", "generator"] as const) if (!isDeepStrictEqual(values.rngAfter[label], state.rng[label])) fail("RNG_PREFIX");
      if (values.rngAfter["policy-sampling"].root !== state.rng["policy-sampling"].root || values.rngAfter["policy-sampling"].drawCount !== state.rng["policy-sampling"].drawCount + values.sampledDecisions ||
        values.rngAfter.opponent.root !== state.rng.opponent.root || values.rngAfter.opponent.drawCount < state.rng.opponent.drawCount) fail("RNG_PREFIX");
      if (state.journalRef && (values.journalRef.lastRecordOrdinal <= state.journalRef.lastRecordOrdinal || values.journalRef.byteLength <= state.journalRef.byteLength)) fail("JOURNAL_PREFIX");
      const next = structuredClone(state);
      next.counters.verifiedCompleted++;
      next.rng = values.rngAfter;
      next.journalRef = values.journalRef;
      next.historyRefs.push(values.historyRef);
      let selected: NativeRecord = { config: modelConfigShape.parse(JSON.parse(row.config)), record: new Uint8Array(row.record) };
      let checkpoint = false;
      if (values.sampledDecisions > 0) {
        if (proposal === null || values.proposalRef === null) fail("MISSING_PROPOSAL");
        selected = record(proposal);
        if (values.proposalRef.byteLength !== selected.record.byteLength || values.proposalRef.sha256 !== selected.config.recordSha256 ||
          descriptor.frozenBaseline === values.returnValue && values.nonzeroPolicyGradient) fail("PROPOSAL_BINDING");
        next.modelId = selected.config.recordSha256;
        next.counters.eligibleCompleted++;
        next.counters.updates++;
        next.counters.baselineCount++;
        next.counters.baselineSum += values.returnValue;
        if (values.nonzeroPolicyGradient) next.counters.nonzeroPGUpdates++;
        if (next.control.dueBucket > next.control.fulfilledBucket) {
          next.control.fulfilledBucket = next.control.dueBucket;
          checkpoint = true;
        }
      }
      const checked = checkTrainingState(next), status = checked.counters.started === 1000 ? "complete" : "active";
      if (status === "complete" && checked.counters.nonzeroPGUpdates < 1) fail("FINAL_VALIDITY");
      const json = JSON.stringify(checked);
      if (Buffer.byteLength(json) + selected.record.byteLength > 16 * 1024 * 1024) fail("CHECKPOINT_BOUND");
      this.db.run("UPDATE masters SET state=?,config=?,record=?,pending=NULL,status=? WHERE master=?", [json, JSON.stringify(selected.config), selected.record, status, master]);
      this.db.run("UPDATE attempts SET status='COMPLETED',completion=? WHERE id=?", [JSON.stringify(values), attemptId]);
      if (checkpoint) this.db.run("INSERT INTO checkpoints VALUES (?,?,?,?,?)", [master, checked.counters.started, json, JSON.stringify(selected.config), selected.record]);
      return checked;
    });
  }

  abort(master: number, attemptId: string, diagnosticRef: z.infer<typeof byteRefShape>): void {
    this.mutate(() => {
      const row = this.row(master);
      if (row.pending !== attemptId) fail("STALE_ATTEMPT");
      const ref = byteRefShape.parse(diagnosticRef);
      this.db.run("UPDATE attempts SET status='ABORTED',completion=? WHERE id=? AND status='STARTED'", [JSON.stringify({ diagnosticRef: ref }), attemptId]);
      this.db.run("UPDATE control SET aborted=1 WHERE id=1");
    });
    this.failed = true;
  }

  inferenceRecord(master: number): NativeRecord {
    if (this.failed || this.closed) fail("CLOSED");
    const row = this.row(master), state = this.snapshot(master), selected = record({ config: JSON.parse(row.config), record: row.record });
    if (selected.config.recordSha256 !== state.modelId) fail("MODEL_RECORD");
    return selected;
  }
  stopAll(diagnosticJson: string): void {
    this.failed = true;
    if (this.closed || this.busy || Buffer.byteLength(diagnosticJson) > 1048576) fail("ABORT_DIAGNOSTIC");
    JSON.parse(diagnosticJson);
    this.db.transaction(() => { this.db.run("UPDATE control SET aborted=1,failure=COALESCE(failure,?) WHERE id=1", [diagnosticJson]); }).immediate();
  }
  primaryRecord(): NativeRecord {
    this.finalModels();
    return this.inferenceRecord(101);
  }
  finalModels(): { state: TrainingState; model: NativeRecord }[] {
    if (this.failed || this.closed) fail("CLOSED");
    const rows = this.db.query<MasterRow, []>("SELECT * FROM masters ORDER BY master").all();
    if (rows.length !== 5 || this.db.query<{ aborted: number }, []>("SELECT aborted FROM control WHERE id=1").get()?.aborted !== 0) fail("INCOMPLETE_EXPERIMENT");
    return rows.map((row, index) => {
      const state = this.snapshot(row.master);
      if (row.master !== 101 + index || row.pending !== null || row.status !== "complete" || state.counters.started !== 1000 ||
        state.counters.verifiedCompleted !== 1000 || state.counters.nonzeroPGUpdates < 1) fail("FINAL_VALIDITY");
      return { state, model: this.inferenceRecord(row.master) };
    });
  }
  close(): void { if (!this.closed) { this.db.close(); this.closed = true; } }
}
