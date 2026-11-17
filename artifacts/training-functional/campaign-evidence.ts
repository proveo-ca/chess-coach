// SPEC: _spec/runtime-protocol.puml, _spec/checkpoint-runtime.puml, _spec/policy-runtime.puml
import type {} from "bun";
import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync } from "node:fs";
import { isAbsolute, join, normalize, parse, relative, sep } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { decodeCausalJournal, decodeCausalState } from "../../packages/contracts/src/causal-journal";
import { decisionJournalShape, planPermitShape } from "../../packages/contracts/src/episode";
import type { PlanPermit } from "../../packages/contracts/src/episode";
import { gameRecordShape, initializeGame } from "../../packages/contracts/src/game-session";
import type { GameSession, GameTransition } from "../../packages/contracts/src/game-session";
import { modelConfigShape } from "../../packages/contracts/src/learning-channel";
import { matchReplyShape, matchStopShape, opponentJournalShape } from "../../packages/contracts/src/match";
import { nativeIntentsShape } from "../../packages/contracts/src/native-intents";
import { recipientBatchShape } from "../../packages/contracts/src/recipient-codec";
import { nativeSnapshotShape } from "../../packages/contracts/src/resolution";
import { scOutcome } from "../../packages/starchess-core/src/engine";
import { experimentShape, finalModelShape } from "../../packages/contracts/src/training-artifact";
import { attemptDescriptorShape, bindingsShape, byteRefShape, journalRefShape, rngStateShape } from "../../packages/contracts/src/training-state";
import type { AttemptDescriptor, ByteRef, TrainingBindings, TrainingState } from "../../packages/contracts/src/training-state";
import { checkTrainingState, initialTrainingState, nextAttempt } from "../../packages/runtime/src/curriculum";
import { planningSides } from "../../packages/runtime/src/match-state";
import { drawStream, MASTERS } from "../../packages/runtime/src/rng";
import { STORAGE_BOUNDS } from "../../packages/runtime/src/storage-bounds";
import type { TrainingCampaign } from "../../packages/runtime/src/training-campaign";
import type { CompletionValues, NativeRecord } from "../../packages/runtime/src/training-store";

export type CampaignResult = Awaited<ReturnType<TrainingCampaign["run"]>>;
export type CampaignReadback = {
  control(): { bindings: TrainingBindings; aborted: number; failure: string | null };
  masters(): Iterable<{ master: number; state: string; config: string; record: Uint8Array; pending: string | null; status: string }>;
  attempts(master: number): Iterable<{ id: string; master: number; ordinal: number; descriptor: string; status: string; completion: string }>;
  checkpoints(master: number): Iterable<{ master: number; epoch: number; state: string; config: string; record: Uint8Array }>;
  read(relativePath: string, maximumBytes: number): Uint8Array;
  close(): void;
};
export type CampaignMetrics = { returnSum: number; sampledDecisions: number; reasons: Record<string, number>;
  objectives: { count: number; minimum: number | null; maximum: number | null }; parameterDigestChain: ByteRef | null };
export type CampaignEvidence = {
  status: "PASS_CAMPAIGN_RETAINED_RESULT_VALIDATION" | "FAIL_CAMPAIGN_RETAINED_RESULT_VALIDATION";
  scope: "LOCAL_RETAINED_RESULT_VALIDATION_ONLY";
  failures: string[];
  masters: { master: number; counters: TrainingState["counters"]; modelId: string; recordRef: ByteRef; configRef: ByteRef; artifactRef: ByteRef; checkpoints: number; metrics: CampaignMetrics }[];
  attempts: number;
  experimentRef: ByteRef | null;
  startedDescriptorsRef: ByteRef | null;
  nativeScoresReplayed: false;
  nativeRngReplayed: false;
  nativeParameterDigestsRecomputed: false;
  heldOutQualityMetrics: "NOT_RECORDED";
  trainingExecutionAuthorized: false;
};

const MIB = 1024 * 1024, DATABASE_BYTES = 64 * MIB, MAX_PAGES = 16384;
const sha = (bytes: Uint8Array | string): string => createHash("sha256").update(bytes).digest("hex");
const ref = (bytes: Uint8Array): ByteRef => ({ byteLength: bytes.byteLength, sha256: sha(bytes) });
function requireValue(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
function equal(actual: unknown, expected: unknown, code: string): void { requireValue(isDeepStrictEqual(actual, expected), code); }
function equalBytes(actual: Uint8Array, expected: Uint8Array, code: string): void { requireValue(Buffer.from(actual).equals(Buffer.from(expected)), code); }
function text(value: unknown, bound: number, code: string): string {
  requireValue(typeof value === "string" && value.length > 0 && value.length <= bound && Buffer.byteLength(value) <= bound, code); return value;
}
function bytes(value: Uint8Array, bound: number, code = "PAYLOAD_BOUND"): Uint8Array {
  requireValue(value instanceof Uint8Array && value.byteLength > 0 && value.byteLength <= bound, code); return value;
}
function json(value: Uint8Array, bound: number): unknown { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes(value, bound))); }
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  requireValue(value !== null && typeof value === "object" && !Array.isArray(value), "OBJECT_SCHEMA");
  equal(Object.keys(value).sort(), [...keys].sort(), "OBJECT_KEYS"); return value as Record<string, unknown>;
}
function completion(input: unknown): CompletionValues {
  const value = object(input, ["reason", "returnValue", "sampledDecisions", "nonzeroPolicyGradient", "rngAfter", "journalRef", "historyRef", "proposalRef"]);
  requireValue(typeof value.reason === "string" && ["core-terminal", "candidate-native-rejection", "recorded-white-rejection", "trace-exhaustion", "progress-cap", "candidate-deadline"].includes(value.reason) &&
    (value.returnValue === -1 || value.returnValue === 0 || value.returnValue === 1) && typeof value.sampledDecisions === "number" &&
    Number.isInteger(value.sampledDecisions) && value.sampledDecisions >= 0 && value.sampledDecisions <= 64 && typeof value.nonzeroPolicyGradient === "boolean", "COMPLETION_SCHEMA");
  return { reason: value.reason as CompletionValues["reason"], returnValue: value.returnValue, sampledDecisions: value.sampledDecisions,
    nonzeroPolicyGradient: value.nonzeroPolicyGradient, rngAfter: rngStateShape.parse(value.rngAfter), journalRef: journalRefShape.parse(value.journalRef),
    historyRef: byteRefShape.parse(value.historyRef), proposalRef: value.proposalRef === null ? null : byteRefShape.parse(value.proposalRef) };
}
function envelope(input: unknown): { recordOrdinal: number; attemptId: string; event: { ordinal: number; kind: string; value: unknown } } {
  const value = object(input, ["recordOrdinal", "attemptId", "event"]), event = object(value.event, ["ordinal", "kind", "value"]);
  requireValue(typeof value.recordOrdinal === "number" && Number.isSafeInteger(value.recordOrdinal) && value.recordOrdinal > 0 &&
    typeof value.attemptId === "string" && value.attemptId.length <= 32 && typeof event.ordinal === "number" && Number.isInteger(event.ordinal) &&
    event.ordinal >= 0 && event.ordinal < STORAGE_BOUNDS.auditRecords && typeof event.kind === "string" && event.kind.length > 0 && event.kind.length <= 32, "ENVELOPE_SCHEMA");
  return { recordOrdinal: value.recordOrdinal, attemptId: value.attemptId, event: { ordinal: event.ordinal, kind: event.kind, value: event.value } };
}
function model(record: Uint8Array, config: string): NativeRecord {
  text(config, STORAGE_BOUNDS.configBytes, "CONFIG_BOUND"); bytes(record, STORAGE_BOUNDS.nativeRecordBytes, "RECORD_BOUND");
  const parsed = modelConfigShape.parse(JSON.parse(config)); requireValue(sha(record) === parsed.recordSha256, "MODEL_HASH");
  return { record, config: parsed };
}
function safeDirectory(path: string): void {
  requireValue(isAbsolute(path) && !path.includes("\0") && normalize(path) === path, "READBACK_PATH");
  let current = parse(path).root;
  for (const part of relative(current, path).split(sep).filter(Boolean)) {
    current = join(current, part); requireValue(lstatSync(current).isDirectory(), "READBACK_DIRECTORY");
  }
}
function readBounded(path: string, bound: number): Uint8Array {
  safeDirectory(parse(path).dir);
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = fstatSync(fd); requireValue(before.isFile() && before.size > 0 && before.size <= bound, "READBACK_FILE_BOUND");
    const result = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < result.byteLength) {
      const count = readSync(fd, result, offset, result.byteLength - offset, offset);
      requireValue(count > 0, "READBACK_SHORT_READ"); offset += count;
    }
    requireValue(readSync(fd, Buffer.alloc(1), 0, 1, offset) === 0, "READBACK_FILE_CHANGED");
    const after = fstatSync(fd);
    requireValue(after.size === before.size && after.mtimeMs === before.mtimeMs && after.ctimeMs === before.ctimeMs, "READBACK_FILE_CHANGED");
    return result;
  } finally { closeSync(fd); }
}

export function openCampaignReadback(root: string): CampaignReadback {
  safeDirectory(root);
  const path = join(root, "private.sqlite"), stat = lstatSync(path);
  requireValue(stat.isFile() && stat.size > 0 && stat.size <= DATABASE_BYTES, "READBACK_DATABASE_BOUND");
  const db = new Database(path, { readonly: true, create: false, strict: true });
  let closed = false;
  try {
    db.run("PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; PRAGMA busy_timeout=0; PRAGMA cache_size=-2048; PRAGMA temp_store=MEMORY;");
    const pages = db.query<{ page_count: number }, []>("PRAGMA page_count").get()?.page_count;
    const size = db.query<{ page_size: number }, []>("PRAGMA page_size").get()?.page_size;
    requireValue(typeof pages === "number" && pages > 0 && pages <= MAX_PAGES && size === 4096, "READBACK_DATABASE_PAGES");
    const bounded = (table: string, predicate: string, minimum: number, maximum: number): void => {
      const row = db.query<{ count: number; invalid: number }, []>(`SELECT count(*) AS count,coalesce(sum(CASE WHEN ${predicate} THEN 0 ELSE 1 END),0) AS invalid FROM ${table}`).get();
      requireValue(row && row.count >= minimum && row.count <= maximum && row.invalid === 0, "READBACK_ROW_BOUND");
    };
    const field = (name: string, maximum: number): string => `typeof(${name})='text' AND length(CAST(${name} AS BLOB)) BETWEEN 1 AND ${maximum}`;
    const storedModel = `${field("state", STORAGE_BOUNDS.historyBytes)} AND ${field("config", STORAGE_BOUNDS.configBytes)} AND typeof(record)='blob' AND length(record) BETWEEN 1 AND ${STORAGE_BOUNDS.nativeRecordBytes}`;
    bounded("control", `id=1 AND ${field("bindings", STORAGE_BOUNDS.startedBytes)} AND aborted IN (0,1) AND (failure IS NULL OR ${field("failure", MIB)})`, 1, 1);
    bounded("masters", `${storedModel} AND typeof(master)='integer' AND (pending IS NULL OR ${field("pending", 64)}) AND ${field("status", 16)}`, 5, 6);
    bounded("attempts", `master BETWEEN 101 AND 105 AND typeof(ordinal)='integer' AND ${field("id", 32)} AND ${field("descriptor", STORAGE_BOUNDS.startedBytes)} AND ${field("completion", STORAGE_BOUNDS.startedBytes)} AND ${field("status", 16)}`, 5000, 5000);
    bounded("checkpoints", `${storedModel} AND master BETWEEN 101 AND 105 AND typeof(epoch)='integer'`, 0, 50);
    const admitted = (): void => { requireValue(!closed, "READBACK_CLOSED"); };
    return {
      control() {
        admitted();
        const row = db.query<{ bindings: string; aborted: number; failure: string | null }, []>("SELECT bindings,aborted,failure FROM control WHERE id=1").get();
        requireValue(row, "READBACK_CONTROL");
        return { ...row, bindings: bindingsShape.parse(JSON.parse(text(row.bindings, STORAGE_BOUNDS.startedBytes, "BINDINGS_BOUND"))) };
      },
      *masters() {
        admitted();
        yield* db.query<IterableValue<ReturnType<CampaignReadback["masters"]>>, []>("SELECT master,state,config,record,pending,status FROM masters ORDER BY master LIMIT 6").iterate();
      },
      *attempts(master) {
        admitted();
        yield* db.query<IterableValue<ReturnType<CampaignReadback["attempts"]>>, [number]>("SELECT id,master,ordinal,descriptor,status,completion FROM attempts WHERE master=? ORDER BY ordinal LIMIT 1001").iterate(master);
      },
      *checkpoints(master) {
        admitted();
        yield* db.query<IterableValue<ReturnType<CampaignReadback["checkpoints"]>>, [number]>("SELECT master,epoch,state,config,record FROM checkpoints WHERE master=? ORDER BY epoch LIMIT 11").iterate(master);
      },
      read(path, maximumBytes) {
        admitted();
        requireValue(typeof path === "string" && path.length <= 256 && !path.includes("\0") && !isAbsolute(path) && normalize(path) === path &&
          path.split(sep).every(part => part !== ".." && part !== "." && part !== "") && Number.isSafeInteger(maximumBytes) && maximumBytes > 0 &&
          maximumBytes <= STORAGE_BOUNDS.journalSegmentBytes, "READBACK_RELATIVE_PATH");
        return readBounded(join(root, path), maximumBytes);
      },
      close() { if (!closed) { closed = true; db.close(); } },
    };
  } catch (error) { db.close(); throw error; }
}

type IterableValue<T> = T extends Iterable<infer Value> ? Value : never;
type JournalCursor = { hash: ReturnType<typeof createHash>; byteLength: number; ordinal: number };
function packet(master: number, ordinal = 0): string { return `packet-${String((master - 101) * 10 + Math.floor(ordinal / 100)).padStart(2, "0")}`; }
const finalDirectory = "packet-49/attempt-final-artifacts";
function finalPath(index: number, offset: number, role: string): string { return `${finalDirectory}/${String(index * 3 + offset).padStart(6, "0")}-${role}-${101 + index}.bin`; }
function read(reader: CampaignReadback, path: string, maximumBytes: number): Uint8Array { return bytes(reader.read(path, maximumBytes), maximumBytes); }
function absent(reader: CampaignReadback, path: string, bound: number): void {
  try { read(reader, path, bound); }
  catch (error) { if (error instanceof Error && Reflect.get(error, "code") === "ENOENT") return; throw error; }
  throw new Error("UNEXPECTED_PROPOSAL_PAYLOAD");
}
function loadModel(reader: CampaignReadback, recordPath: string, configPath: string): { model: NativeRecord; configRef: ByteRef } {
  const record = read(reader, recordPath, STORAGE_BOUNDS.nativeRecordBytes), config = read(reader, configPath, STORAGE_BOUNDS.configBytes);
  return { model: model(record, new TextDecoder("utf-8", { fatal: true }).decode(config)), configRef: ref(config) };
}
function cleanExit(input: unknown, forced = false): void {
  const value = object(input, ["stdinClosed", "stdoutEof", "stderrEof", "reaped", "exitCode", "forced"]);
  requireValue(value.stdinClosed === true && value.stdoutEof === true && value.stderrEof === true && value.reaped === true && value.forced === forced &&
    (value.exitCode === null || typeof value.exitCode === "number" && Number.isInteger(value.exitCode)) && (forced || value.exitCode === 0), "JOURNAL_EXIT");
}
function checkSession(value: GameSession): void {
  object(value, ["version", "phase", "snapshot", "bank", "native", "recipients", "batches", "history"]);
  requireValue(value.version === "chess-coach.game-session.v1" && ["unopened", "opened", "terminal"].includes(value.phase) &&
    Array.isArray(value.history) && value.history.length <= 91 && value.history.every(item => typeof item === "string" && /^[a-f0-9]{64}$/.test(item)), "JOURNAL_SESSION");
  decodeCausalState(JSON.stringify(value.native));
  requireValue(value.native.callOrdinal === value.history.length && value.native.turn === value.snapshot.turn, "JOURNAL_SESSION_ORDINAL");
  equal(value.snapshot.stored, value.bank, "JOURNAL_BANK");
  equal(value.native.ccLives, value.snapshot.ccLives, "JOURNAL_LIVES");
  object(value.recipients, ["w", "b"]); object(value.batches, ["w", "b"]);
  for (const side of ["w", "b"] as const) {
    const batch = recipientBatchShape.parse(value.batches[side]), recipient = value.recipients[side];
    requireValue(batch.side === side && batch.observation.side === side && batch.ordinal === value.history.length && recipient.callOrdinal === value.history.length &&
      recipient.batchOrdinal === batch.ordinal && recipient.planningOrdinal === batch.planningOrdinal, "JOURNAL_SESSION_BATCH");
    equal(batch.observation, recipient.observation, "JOURNAL_OBSERVATION");
  }
}
function checkJournal(reader: CampaignReadback, directory: string, descriptor: AttemptDescriptor, consumed: TrainingState,
  completion: CompletionValues, cursor: JournalCursor, initial: GameSession): { objective: number | null; parameterSha256: string | null } {
  const segment = read(reader, `${directory}/000001-verified-journal.bin`, STORAGE_BOUNDS.journalSegmentBytes);
  const rawHistory = read(reader, `${directory}/000002-authorized-history.bin`, STORAGE_BOUNDS.historyBytes);
  equal(ref(rawHistory), completion.historyRef, "HISTORY_REF");
  const parsedHistory = json(rawHistory, STORAGE_BOUNDS.historyBytes);
  requireValue(Array.isArray(parsedHistory) && parsedHistory.length >= 1 && parsedHistory.length <= 92, "HISTORY_SCHEMA");
  const history = parsedHistory.map(value => recipientBatchShape.parse(value));
  const source = new TextDecoder("utf-8", { fatal: true }).decode(segment);
  requireValue(source.endsWith("\n"), "JOURNAL_LINES");
  let offset = 0, count = 0, historyOrdinal = 0, windows = 0, plies = 0, sideCursor = 0, matchOrdinal = 0;
  let game: GameSession | null = null, permit: PlanPermit | null = null;
  let phase: "started" | "initial" | "running" | "complete" | "exited" | "deadline" | "closed" = "started";
  let rejection: ReturnType<typeof matchStopShape.parse> | null = null;
  let objective: number | null = null, parameterSha256: string | null = null;
  const rng = structuredClone(consumed.rng), candidateIds: string[] = [], opponentIds: string[] = [];
  const started = { descriptor, rng: consumed.rng };
  const retainHistory = (next: GameSession): void => { equal(history[historyOrdinal++], next.batches[descriptor.schedule.candidateSide], "AUTHORIZED_HISTORY"); };
  while (offset < source.length) {
    requireValue(count < STORAGE_BOUNDS.auditRecords, "JOURNAL_RECORD_BOUND");
    const end = source.indexOf("\n", offset); requireValue(end > offset, "JOURNAL_LINES");
    const retained = envelope(JSON.parse(source.slice(offset, end))), event = retained.event;
    requireValue(retained.recordOrdinal === cursor.ordinal + count + 1 && retained.attemptId === descriptor.attemptId && event.ordinal === count, "JOURNAL_ORDINAL");
    if (event.kind === "started") {
      requireValue(phase === "started" && count === 0, "JOURNAL_STARTED_ORDER"); equal(event.value, started, "JOURNAL_STARTED"); phase = "initial";
    } else if (event.kind === "initial") {
      requireValue(phase === "initial", "JOURNAL_INITIAL_ORDER"); equal(event.value, initial, "JOURNAL_INITIAL");
      game = event.value as GameSession; retainHistory(game); phase = "running"; matchOrdinal++;
    } else if (event.kind === "native") {
      requireValue(phase === "running" && game && permit === null && rejection === null, "JOURNAL_NATIVE_ORDER");
      const value = object(event.value, ["session", "record", "native"]), transition = value as unknown as GameTransition;
      const record = gameRecordShape.parse(transition.record), native = object(transition.native, ["kind", "value"]);
      const next = transition.session; checkSession(next);
      requireValue(native.kind === "opened" || native.kind === "settled", "JOURNAL_NATIVE_KIND");
      object(native.value, ["result", "state", "journal"]);
      const causal = decodeCausalJournal(JSON.stringify(transition.native.value.journal));
      equal(transition.native.value.state, next.native, "JOURNAL_NATIVE_STATE");
      requireValue(record.ordinal === game.history.length + 1 && causal.callOrdinal === record.ordinal, "JOURNAL_NATIVE_ORDINAL");
      equal(next.history, [...game.history, sha(JSON.stringify(transition.record))], "JOURNAL_RECORD_HASH");
      equal({ bank: record.bank, snapshot: record.snapshot, batches: record.batches }, { bank: next.bank, snapshot: next.snapshot, batches: next.batches }, "JOURNAL_RECORD_STATE");
      for (const side of ["w", "b"] as const) {
        equal(causal.initialCells[side], game.batches[side].observation.cells, "JOURNAL_PARENT_CELLS");
        equal(causal.finalCells[side], next.batches[side].observation.cells, "JOURNAL_FINAL_CELLS");
      }
      if (native.kind === "opened") {
        requireValue(game.phase === "unopened" && record.operation.kind === "open" && sideCursor === 0, "JOURNAL_OPEN_ORDER");
      } else {
        requireValue(game.phase === "opened" && record.operation.kind === "settle" && sideCursor === planningSides(descriptor).length, "JOURNAL_SETTLE_ORDER");
        windows++; sideCursor = 0;
      }
      if (transition.native.kind === "settled" || transition.native.value.result.asResolve) plies++;
      game = next; retainHistory(game); matchOrdinal++;
    } else if (event.kind === "permit") {
      requireValue(phase === "running" && game?.phase === "opened" && permit === null && rejection === null, "JOURNAL_PERMIT_ORDER");
      permit = planPermitShape.parse(event.value);
      const side = planningSides(descriptor)[sideCursor];
      requireValue(permit.attemptId === descriptor.attemptId && permit.permitId === `${descriptor.attemptId}:plan:${windows}:${side}` && permit.side === side &&
        permit.planningOrdinal === windows && permit.turn === game.snapshot.turn && permit.role === (side === descriptor.schedule.candidateSide ? "candidate" : "strategic") &&
        BigInt(permit.deadlineNs) === BigInt(permit.issuedNs) + 10_000_000_000n, "JOURNAL_PERMIT");
    } else if (event.kind === "decision-acked") {
      requireValue(phase === "running" && game && permit, "JOURNAL_DECISION_ORDER");
      if (permit.role === "candidate") {
        const value = decisionJournalShape.parse(event.value), draw = drawStream(rng["policy-sampling"]);
        requireValue(value.attemptId === descriptor.attemptId && value.permitId === permit.permitId && value.planningOrdinal === windows && value.side === permit.side &&
          value.modelId === descriptor.modelId && value.mode === "sample" && value.historyDigest === sha(JSON.stringify(game.recipients[value.side].observation)) &&
          Object.is(value.uniform, draw.uniform), "JOURNAL_CANDIDATE_BINDING");
        equal(value.samplingBefore, rng["policy-sampling"], "POLICY_RNG_BEFORE"); equal(value.samplingAfter, draw.after, "POLICY_RNG_AFTER");
        requireValue(value.selectedKey === JSON.stringify(value.actions), "JOURNAL_SELECTED_KEY");
        rng["policy-sampling"] = value.samplingAfter; candidateIds.push(value.permitId);
      } else {
        const value = opponentJournalShape.parse(event.value);
        requireValue(descriptor.schedule.kind === "live" && value.attemptId === descriptor.attemptId && value.permitId === permit.permitId && value.planningOrdinal === windows &&
          value.side === permit.side && value.snapshotDigest === sha(JSON.stringify(nativeSnapshotShape.parse(game.snapshot))) && value.opponentAfter.root === rng.opponent.root &&
          value.opponentAfter.status === "active" && value.opponentAfter.drawCount >= rng.opponent.drawCount, "JOURNAL_OPPONENT_BINDING");
        equal(value.opponentBefore, rng.opponent, "OPPONENT_RNG_BEFORE"); rng.opponent = value.opponentAfter; opponentIds.push(value.permitId);
      }
      sideCursor++; permit = null; matchOrdinal++;
    } else if (event.kind === "native-rejection") {
      requireValue(phase === "running" && game && permit === null && rejection === null && sideCursor === planningSides(descriptor).length, "JOURNAL_REJECTION_ORDER");
      const value = object(event.value, ["stop", "plans", "boundaryOrdinal"]), stop = matchStopShape.parse(value.stop), plans = object(value.plans, ["w", "b"]);
      requireValue(value.boundaryOrdinal === game.history.length && (stop.reason === "candidate-native-rejection" ? stop.side === descriptor.schedule.candidateSide
        : stop.reason === "recorded-white-rejection" && descriptor.schedule.kind === "corpus" && stop.side === "w"), "JOURNAL_REJECTION");
      nativeIntentsShape.parse(plans.w); nativeIntentsShape.parse(plans.b); rejection = stop; matchOrdinal++;
    } else if (event.kind === "complete") {
      requireValue(phase === "running" && game && permit === null && completion.reason !== "candidate-deadline", "JOURNAL_COMPLETE_ORDER");
      const value = matchReplyShape.parse(event.value);
      requireValue(value.kind === "complete" && value.attemptId === descriptor.attemptId && value.ordinal === matchOrdinal && value.stop.reason === completion.reason &&
        value.stop.returnValue === completion.returnValue && value.boundaryOrdinal === game.history.length && value.planningWindows === windows && value.recordedPlies === plies &&
        value.recordedCount === (descriptor.schedule.kind === "corpus" ? windows + (rejection ? 1 : 0) : 0), "JOURNAL_COMPLETION");
      if (rejection) equal(value.stop, rejection, "JOURNAL_REJECTION_STOP");
      else {
        requireValue(!["candidate-native-rejection", "recorded-white-rejection"].includes(value.stop.reason), "JOURNAL_MISSING_REJECTION");
        if (value.stop.reason === "core-terminal") {
          const outcome = scOutcome(game.snapshot);
          requireValue(outcome && value.stop.returnValue === (outcome.winner === null ? 0 : outcome.winner === descriptor.schedule.candidateSide ? 1 : -1), "JOURNAL_TERMINAL_RETURN");
        } else if (value.stop.reason === "progress-cap") requireValue(windows >= 64 || plies >= 128, "JOURNAL_PROGRESS_CAP");
        else requireValue(descriptor.schedule.kind === "corpus", "JOURNAL_TRACE_SCHEDULE");
      }
      if (descriptor.schedule.kind === "live") requireValue(value.recordedDigest === sha("[]"), "JOURNAL_LIVE_DIGEST");
      equal(value.candidateIds, candidateIds, "JOURNAL_CANDIDATE_IDS"); equal(value.opponentIds, opponentIds, "JOURNAL_OPPONENT_IDS"); equal(value.rng, rng, "JOURNAL_RNG"); phase = "complete";
    } else if (event.kind === "match-exit") {
      requireValue(phase === "complete", "JOURNAL_EXIT_ORDER"); cleanExit(event.value); phase = "exited";
    } else if (event.kind === "candidate-deadline") {
      requireValue(phase === "running" && permit?.role === "candidate" && completion.reason === "candidate-deadline", "JOURNAL_DEADLINE_ORDER");
      const value = object(event.value, ["permit", "receipt", "observedNs"]), receipt = object(value.receipt, ["exit", "groupGone", "fault", "frame"]);
      equal(value.permit, permit, "JOURNAL_DEADLINE_PERMIT");
      requireValue(typeof value.observedNs === "string" && /^(0|[1-9][0-9]{0,24})$/.test(value.observedNs) && BigInt(value.observedNs) >= BigInt(permit.deadlineNs) &&
        receipt.groupGone === true && receipt.fault === false, "JOURNAL_DEADLINE");
      cleanExit(receipt.exit, true); phase = "deadline";
    } else if (event.kind === "learners-closed") {
      requireValue((phase === "exited" || phase === "deadline") && end === source.length - 1, "JOURNAL_CLOSE_ORDER");
      const value = object(event.value, completion.sampledDecisions > 0 ? ["kind", "parameterSha256", "objective"] : ["kind"]);
      requireValue(value.kind === (completion.sampledDecisions > 0 ? "proposed" : "diagnostic") && (value.kind !== "proposed" ||
         typeof value.parameterSha256 === "string" && /^[a-f0-9]{64}$/.test(value.parameterSha256) && typeof value.objective === "number" && Number.isFinite(value.objective)), "JOURNAL_PROPOSAL_KIND"); phase = "closed";
      if (value.kind === "proposed") { objective = value.objective as number; parameterSha256 = value.parameterSha256 as string; }
    } else throw new Error("JOURNAL_EVENT_KIND");
    offset = end + 1; count++;
  }
  requireValue(phase === "closed" && historyOrdinal === history.length && candidateIds.length === completion.sampledDecisions, "JOURNAL_FINAL");
  equal(rng, completion.rngAfter, "COMPLETION_RNG");
  cursor.hash.update(segment); cursor.ordinal += count; cursor.byteLength += segment.byteLength;
  equal(completion.journalRef, { byteLength: cursor.byteLength, sha256: cursor.hash.copy().digest("hex"), lastRecordOrdinal: cursor.ordinal }, "CUMULATIVE_JOURNAL_REF");
  return { objective, parameterSha256 };
}

export function validateCampaignResult(result: CampaignResult, reader: CampaignReadback, expectedBindings: TrainingBindings,
  progress?: (completed: number) => void): CampaignEvidence {
  const output: CampaignEvidence = { status: "FAIL_CAMPAIGN_RETAINED_RESULT_VALIDATION", scope: "LOCAL_RETAINED_RESULT_VALIDATION_ONLY", failures: [], masters: [],
    attempts: 0, experimentRef: null, startedDescriptorsRef: null, nativeScoresReplayed: false, nativeRngReplayed: false,
    nativeParameterDigestsRecomputed: false, heldOutQualityMetrics: "NOT_RECORDED", trainingExecutionAuthorized: false };
  let phase = "control";
  const failure = (error: unknown): void => {
    const message = error instanceof Error && error.name === "ZodError" ? "SCHEMA" : error instanceof Error ? error.message.slice(0, 192) : "VALIDATION_ERROR";
    output.failures.push(`${phase}:${message}`);
  };
  try {
    const expected = bindingsShape.parse(expectedBindings), control = reader.control();
    equal(bindingsShape.parse(control.bindings), expected, "CONTROL_BINDINGS");
    requireValue(control.aborted === 0 && control.failure === null, "CONTROL_UNSETTLED");
    phase = "experiment";
    const returned = object(result, ["experiment", "ref"]);
    text(JSON.stringify(returned.experiment), STORAGE_BOUNDS.experimentBytes, "EXPERIMENT_BOUND");
    const experiment = experimentShape.parse(returned.experiment), experimentRef = byteRefShape.parse(returned.ref);
    const rawExperiment = read(reader, `${finalDirectory}/000015-experiment-proposal.bin`, STORAGE_BOUNDS.experimentBytes);
    equal(ref(rawExperiment), experimentRef, "EXPERIMENT_REF"); equal(experimentShape.parse(json(rawExperiment, STORAGE_BOUNDS.experimentBytes)), experiment, "RETURNED_EXPERIMENT");
    output.experimentRef = experimentRef;
    const cursor: JournalCursor = { hash: createHash("sha256"), byteLength: 0, ordinal: 0 }, initial = initializeGame(), startedHash = createHash("sha256");
    let startedBytes = 0;
    let masterIndex = 0;
    for (const row of reader.masters()) {
      phase = `master-${101 + masterIndex}`;
      requireValue(masterIndex < MASTERS.length && row.master === MASTERS[masterIndex] && row.status === "complete" && row.pending === null, "MASTER_ROSTER_STATUS");
      text(row.state, STORAGE_BOUNDS.historyBytes, "STATE_BOUND"); text(row.config, STORAGE_BOUNDS.configBytes, "CONFIG_BOUND"); bytes(row.record, STORAGE_BOUNDS.nativeRecordBytes, "RECORD_BOUND");
      const master = row.master, initialDirectory = `${packet(master)}/attempt-initial-master-${master}`;
      let current = loadModel(reader, `${initialDirectory}/000000-initial-native-record.bin`, `${initialDirectory}/000001-initial-model-config.bin`).model;
      let state = initialTrainingState(master, current.config.recordSha256, expected), ordinal = 0, checkpointCount = 0;
      const metrics: CampaignMetrics = { returnSum: 0, sampledDecisions: 0, reasons: {}, objectives: { count: 0, minimum: null, maximum: null }, parameterDigestChain: null };
      const parameters = createHash("sha256"); let parameterBytes = 0;
      const checkpoints = reader.checkpoints(master)[Symbol.iterator]();
      try {
        for (const attempt of reader.attempts(master)) {
          phase = `m${master}-a${String(ordinal).padStart(4, "0")}`;
          const id = `m${master}-a${String(ordinal).padStart(4, "0")}`;
          requireValue(ordinal < 1000 && attempt.id === id && attempt.master === master && attempt.ordinal === ordinal && attempt.status === "COMPLETED", "ATTEMPT_ROSTER_STATUS");
          text(attempt.descriptor, STORAGE_BOUNDS.startedBytes, "DESCRIPTOR_BOUND"); text(attempt.completion, STORAGE_BOUNDS.startedBytes, "COMPLETION_BOUND");
          const descriptor = attemptDescriptorShape.parse(JSON.parse(attempt.descriptor)), values = completion(JSON.parse(attempt.completion));
          const next = nextAttempt(state, id); equal(descriptor, next.descriptor, "DESCRIPTOR_REPLAY");
          const directory = `${packet(master, ordinal)}/attempt-${id}`;
          const started = read(reader, `${directory}/000000-started-descriptor.bin`, STORAGE_BOUNDS.startedBytes);
          startedHash.update(started); startedBytes += started.byteLength;
          equal(json(started, STORAGE_BOUNDS.startedBytes), { descriptor, rng: next.consumed.rng }, "STARTED_ARTIFACT");
          requireValue(values.reason === "core-terminal" || values.returnValue === -1, "NONCORE_RETURN");
          requireValue(values.sampledDecisions > 0 ? values.proposalRef !== null : values.proposalRef === null && !values.nonzeroPolicyGradient, "PROPOSAL_DOMAIN");
          requireValue(!values.nonzeroPolicyGradient || descriptor.frozenBaseline !== values.returnValue, "FROZEN_BASELINE_GRADIENT");
          for (const label of ["selection", "environment-settlement", "generator"] as const) equal(values.rngAfter[label], next.consumed.rng[label], "RNG_FIXED_PREFIX");
          requireValue(values.rngAfter["policy-sampling"].root === next.consumed.rng["policy-sampling"].root &&
            values.rngAfter["policy-sampling"].drawCount === next.consumed.rng["policy-sampling"].drawCount + values.sampledDecisions &&
            values.rngAfter.opponent.root === next.consumed.rng.opponent.root && values.rngAfter.opponent.drawCount >= next.consumed.rng.opponent.drawCount, "RNG_PROGRESS");
          const declared = checkJournal(reader, directory, descriptor, next.consumed, values, cursor, initial);
          metrics.returnSum += values.returnValue; metrics.sampledDecisions += values.sampledDecisions;
          metrics.reasons[values.reason] = (metrics.reasons[values.reason] ?? 0) + 1;
          if (declared.objective !== null && declared.parameterSha256 !== null) {
            metrics.objectives.count++; metrics.objectives.minimum = Math.min(metrics.objectives.minimum ?? declared.objective, declared.objective);
            metrics.objectives.maximum = Math.max(metrics.objectives.maximum ?? declared.objective, declared.objective);
            const declaration = `${id}\t${declared.parameterSha256}\n`; parameters.update(declaration); parameterBytes += Buffer.byteLength(declaration);
          }
          state = next.consumed; state.counters.verifiedCompleted++; state.rng = values.rngAfter; state.journalRef = values.journalRef; state.historyRefs.push(values.historyRef);
          if (values.sampledDecisions > 0) {
            current = loadModel(reader, `${directory}/000003-native-proposal.bin`, `${directory}/000004-proposal-config.bin`).model;
            equal(ref(current.record), values.proposalRef, "PROPOSAL_REF");
            state.modelId = current.config.recordSha256; state.counters.eligibleCompleted++; state.counters.updates++; state.counters.baselineCount++;
            state.counters.baselineSum += values.returnValue; if (values.nonzeroPolicyGradient) state.counters.nonzeroPGUpdates++;
            if (state.control.dueBucket > state.control.fulfilledBucket) {
              state.control.fulfilledBucket = state.control.dueBucket;
              const checkpoint = checkpoints.next(); requireValue(!checkpoint.done, "CHECKPOINT_MISSING");
              const stored = checkpoint.value;
              requireValue(stored.master === master && stored.epoch === state.counters.started, "CHECKPOINT_EPOCH");
              text(stored.state, STORAGE_BOUNDS.historyBytes, "CHECKPOINT_STATE_BOUND");
              const selected = model(stored.record, stored.config);
              equal(checkTrainingState(JSON.parse(stored.state)), state, "CHECKPOINT_STATE"); equal(selected.config, current.config, "CHECKPOINT_CONFIG");
              equalBytes(selected.record, current.record, "CHECKPOINT_RECORD"); checkpointCount++;
            }
          } else {
            absent(reader, `${directory}/000003-native-proposal.bin`, STORAGE_BOUNDS.nativeRecordBytes);
            absent(reader, `${directory}/000004-proposal-config.bin`, STORAGE_BOUNDS.configBytes);
          }
          ordinal++; output.attempts++; phase = "progress"; progress?.(output.attempts);
        }
        phase = `master-${master}-final`;
        requireValue(ordinal === 1000 && state.counters.nonzeroPGUpdates >= 1, "MASTER_ATTEMPT_COUNT_GRADIENT");
        requireValue(checkpoints.next().done === true, "CHECKPOINT_EXTRA");
      } finally { checkpoints.return?.(); }
      equal(checkTrainingState(JSON.parse(row.state)), state, "MASTER_STATE");
      const persisted = model(row.record, row.config); equal(persisted.config, current.config, "MASTER_CONFIG"); equalBytes(persisted.record, current.record, "MASTER_RECORD");
      phase = `artifact-${master}`;
      const selected = loadModel(reader, finalPath(masterIndex, 0, "native"), finalPath(masterIndex, 1, "config"));
      equal(selected.model.config, current.config, "FINAL_CONFIG"); equalBytes(selected.model.record, current.record, "FINAL_RECORD");
      const artifactBytes = read(reader, finalPath(masterIndex, 2, "artifact"), STORAGE_BOUNDS.nativeRecordBytes), artifactRef = ref(artifactBytes);
      requireValue(artifactBytes.byteLength + selected.model.record.byteLength <= STORAGE_BOUNDS.nativeRecordBytes, "FINAL_ARTIFACT_BOUND");
      equal(artifactRef, experiment.artifacts[masterIndex]!.artifactRef, "FINAL_ARTIFACT_REF");
      const artifact = finalModelShape.parse(json(artifactBytes, STORAGE_BOUNDS.nativeRecordBytes));
      equal(artifact, { version: "chess-coach.training-artifact.v1", status: "VALID", master, model: current.config, recordRef: ref(current.record),
        configRef: selected.configRef, counters: state.counters, finalJournalRef: state.journalRef, bindings: expected }, "FINAL_ARTIFACT");
      metrics.parameterDigestChain = parameterBytes ? { byteLength: parameterBytes, sha256: parameters.digest("hex") } : null;
      output.masters.push({ master, counters: { ...state.counters }, modelId: state.modelId, recordRef: artifact.recordRef, configRef: artifact.configRef, artifactRef, checkpoints: checkpointCount, metrics });
      masterIndex++;
    }
    phase = "final";
    requireValue(masterIndex === 5 && output.attempts === 5000, "CAMPAIGN_ROSTER");
    output.startedDescriptorsRef = { byteLength: startedBytes, sha256: startedHash.digest("hex") };
  } catch (error) { failure(error); }
  finally { phase = "close"; try { reader.close(); } catch (error) { failure(error); } }
  if (!output.failures.length) output.status = "PASS_CAMPAIGN_RETAINED_RESULT_VALIDATION";
  return output;
}
