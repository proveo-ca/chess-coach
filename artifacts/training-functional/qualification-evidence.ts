// SPEC: _spec/runtime-protocol.puml, _spec/checkpoint-runtime.puml, _spec/policy-runtime.puml
import type {} from "bun";
import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync } from "node:fs";
import { isAbsolute, join, normalize, parse, relative, sep } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { encodeFeatures, enumerateCandidates, ENUMERATION_VERSION, FEATURES, FEATURE_VERSION } from "../../packages/policy/src/index";
import { applyStoredIncome, scOutcome, specialGasCost, UNIT_COST } from "../../packages/starchess-core/src/engine";
import { decodeCausalJournal, decodeCausalState } from "../../packages/contracts/src/causal-journal";
import { decodeDecisionJournal, planPermitShape } from "../../packages/contracts/src/episode";
import type { DecisionJournal, PlanPermit } from "../../packages/contracts/src/episode";
import { gameRecordShape, initializeGame } from "../../packages/contracts/src/game-session";
import type { GamePlans, GameSession, GameTransition } from "../../packages/contracts/src/game-session";
import { MAX_INFERENCE_BYTES, scoreResponseShape } from "../../packages/contracts/src/inference";
import type { ScoreRequest } from "../../packages/contracts/src/inference";
import { decodeLearningReply, modelConfigShape } from "../../packages/contracts/src/learning-channel";
import type { LearningReply, LearningRequest } from "../../packages/contracts/src/learning-channel";
import { decodeMatchReply, matchStopShape, opponentJournalShape } from "../../packages/contracts/src/match";
import { decodeNativeIntents } from "../../packages/contracts/src/native-intents";
import { checkNativeBoundary, MAX_NATIVE_MESSAGE_BYTES, nativeBoundaryShape } from "../../packages/contracts/src/native-protocol";
import { decodeRecipientBatch } from "../../packages/contracts/src/recipient-codec";
import { nativeSnapshotShape } from "../../packages/contracts/src/resolution";
import { attemptDescriptorShape, bindingsShape, byteRefShape, journalRefShape, rngStateShape } from "../../packages/contracts/src/training-state";
import type { AttemptDescriptor, ByteRef, TrainingBindings, TrainingState } from "../../packages/contracts/src/training-state";
import { checkTrainingState, initialTrainingState, nextAttempt } from "../../packages/runtime/src/curriculum";
import type { NativeObservation } from "../../packages/runtime/src/fixed-attempt";
import { matchBoundary, planningSides } from "../../packages/runtime/src/match-state";
import type { ExitReceipt } from "../../packages/runtime/src/native-session";
import { distribution, selectedIndex } from "../../packages/runtime/src/policy-session";
import { drawStream } from "../../packages/runtime/src/rng";
import { STORAGE_BOUNDS } from "../../packages/runtime/src/storage-bounds";
import type { CompletionValues, NativeRecord } from "../../packages/runtime/src/training-store";
import type { observeCanonical } from "./qualification";
import type { R4AttemptObservation, R4Observation, R4StateObservation } from "./r4-observation";

export type QualificationReadback = {
  initial: NativeRecord;
  master: { master: number; state: TrainingState; config: NativeRecord["config"]; record: Uint8Array; pending: string | null; status: string };
  attempts: { id: string; master: number; ordinal: number; descriptor: AttemptDescriptor; status: string; completion: CompletionValues;
    artifacts: { started: Uint8Array; journal: Uint8Array; history: Uint8Array; proposal: NativeRecord | null } }[];
  control: { bindings: TrainingBindings; aborted: number; failure: string | null };
  checkpoints: number;
};
export type QualificationEvidenceInput = { canonical: Awaited<ReturnType<typeof observeCanonical>>; r4: R4Observation;
  native: readonly NativeObservation[]; readback: QualificationReadback };
type Proposal = Extract<LearningReply["result"], { kind: "proposed" | "diagnostic" }>;
type Exchange = { kind: LearningRequest["command"]["kind"]; requestRef: ByteRef | null; selected: number | null; digest: string | null;
  logits: readonly number[] | null; receivedNs: bigint };
type Channel = { ordinal: number; phase: "new" | "active" | "finished" | "closed" | "reaped"; pending: LearningRequest | null;
  exchanges: Exchange[]; samples: number; proposal: Proposal | null; lastReceivedNs: bigint };
type Proof = { canonical: { exchanges: 14; boundaries: 3; naturalFinishes: 2; executionLabel: "MOCK" | "REAL" };
  attempts: { id: string; samples: number; historyRef: ByteRef; journalRef: CompletionValues["journalRef"]; proposalRef: ByteRef | null;
    parameterSha256: string | null; nonzeroPolicyGradient: boolean }[]; native: { events: number; rawJsonBytes: number; serializedBytes: number; ports: 4; naturalFinishes: 4; scoredReplies: number };
  initialRecordRef: ByteRef; finalRecordRef: ByteRef; nonzeroPGUpdates: number };
export type QualificationEvidence = { status: "PASS_RETAINED_FUNCTIONAL_EVIDENCE" | "FAIL_RETAINED_FUNCTIONAL_EVIDENCE";
  scope: "INPUTS_UNATTESTED_FUNCTIONAL_EVIDENCE_ONLY"; qualified: false; failures: string[]; proof: Proof | null };

const ids = ["r4-m101-a0000", "r4-m101-a0001"] as const;
const limits = { events: 800, serializedBytes: 1024 * 1024 * 1024, databaseBytes: 64 * 1024 * 1024, pages: 16384 } as const;
function requireValue(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
function object(input: unknown, keys: readonly string[]): Record<string, unknown> {
  requireValue(input && typeof input === "object" && !Array.isArray(input), "OBJECT_SCHEMA");
  equal(Object.keys(input).sort(), [...keys].sort(), "OBJECT_KEYS"); return input as Record<string, unknown>;
}
function boundedNumber(input: unknown, minimum: number, maximum: number, integer = false): number {
  requireValue(typeof input === "number" && Number.isFinite(input) && input >= minimum && input <= maximum && (!integer || Number.isInteger(input)), "REQUEST_NUMBER");
  return input;
}
function matchingString(input: unknown, pattern: RegExp): string {
  requireValue(typeof input === "string" && pattern.test(input), "REQUEST_STRING"); return input;
}
function parseQualificationScoreRequest(input: unknown, freezeValues: boolean): ScoreRequest {
  const value = object(input, ["version", "featureVersion", "requestId", "modelId", "rows", "values"]);
  requireValue(value.version === "chess-coach.inference.v1" && value.featureVersion === FEATURE_VERSION, "SCORE_REQUEST_VERSION");
  const requestId = matchingString(value.requestId, /^[A-Za-z0-9._:-]{1,64}$/), modelId = matchingString(value.modelId, /^[a-f0-9]{64}$/);
  const rows = boundedNumber(value.rows, 1, 512, true), values = value.values;
  requireValue(Array.isArray(values) && values.length === rows * FEATURES, "SCORE_REQUEST_DIMENSION");
  for (let index = 0; index < values.length; index++) boundedNumber(values[index], -1_000_000, 1_000_000);
  const checked: readonly number[] = freezeValues ? Object.freeze(values as number[]) : values as number[];
  return Object.freeze({ version: "chess-coach.inference.v1", featureVersion: FEATURE_VERSION, requestId, modelId, rows, values: checked });
}
function decodeQualificationRequest(json: string, freezeValues: boolean): LearningRequest {
  requireValue(typeof json === "string" && json.length <= MAX_INFERENCE_BYTES && Buffer.byteLength(json) <= MAX_INFERENCE_BYTES, "NATIVE_FRAME_BOUND");
  const value = object(JSON.parse(json), ["version", "sessionId", "ordinal", "modelId", "command"]);
  requireValue(value.version === "chess-coach.learning-channel.v1", "LEARNING_REQUEST_VERSION");
  const sessionId = matchingString(value.sessionId, /^[A-Za-z0-9._:-]{1,64}$/), ordinal = boundedNumber(value.ordinal, 0, 255, true);
  const modelId = matchingString(value.modelId, /^[a-f0-9]{64}$/);
  requireValue(value.command && typeof value.command === "object" && !Array.isArray(value.command), "LEARNING_REQUEST_COMMAND");
  const raw = value.command as Record<string, unknown>;
  let command: LearningRequest["command"];
  if (raw.kind === "begin") {
    object(raw, ["kind", "baseline"]); command = { kind: "begin", baseline: boundedNumber(raw.baseline, -1, 1) };
  } else if (raw.kind === "score") {
    object(raw, ["kind", "request"]); command = { kind: "score", request: parseQualificationScoreRequest(raw.request, freezeValues) };
  } else if (raw.kind === "acknowledge") {
    object(raw, ["kind", "request", "selected", "journalDigest"]);
    command = { kind: "acknowledge", request: parseQualificationScoreRequest(raw.request, freezeValues), selected: boundedNumber(raw.selected, 0, 511, true),
      journalDigest: matchingString(raw.journalDigest, /^[a-f0-9]{64}$/) };
  } else if (raw.kind === "finish") {
    object(raw, ["kind", "returnValue"]); const returnValue = raw.returnValue;
    requireValue(returnValue === -1 || returnValue === 0 || returnValue === 1, "LEARNING_REQUEST_RETURN"); command = { kind: "finish", returnValue };
  } else {
    requireValue(raw.kind === "close", "LEARNING_REQUEST_COMMAND"); object(raw, ["kind"]); command = { kind: "close" };
  }
  return { version: "chess-coach.learning-channel.v1", sessionId, ordinal, modelId, command };
}
export function decodeQualificationLearningRequest(json: string): LearningRequest { return decodeQualificationRequest(json, true); }
function parseCompletion(input: unknown): CompletionValues {
  const value = object(input, ["reason", "returnValue", "sampledDecisions", "nonzeroPolicyGradient", "rngAfter", "journalRef", "historyRef", "proposalRef"]);
  requireValue(typeof value.reason === "string" && ["core-terminal", "candidate-native-rejection", "recorded-white-rejection", "trace-exhaustion", "progress-cap", "candidate-deadline"].includes(value.reason) &&
    (value.returnValue === -1 || value.returnValue === 0 || value.returnValue === 1) && typeof value.sampledDecisions === "number" &&
    Number.isInteger(value.sampledDecisions) && value.sampledDecisions >= 0 && value.sampledDecisions <= 64 && typeof value.nonzeroPolicyGradient === "boolean", "COMPLETION_SCHEMA");
  return { reason: value.reason as CompletionValues["reason"], returnValue: value.returnValue, sampledDecisions: value.sampledDecisions,
    nonzeroPolicyGradient: value.nonzeroPolicyGradient, rngAfter: rngStateShape.parse(value.rngAfter), journalRef: journalRefShape.parse(value.journalRef),
    historyRef: byteRefShape.parse(value.historyRef), proposalRef: value.proposalRef === null ? null : byteRefShape.parse(value.proposalRef) };
}
function parseEnvelope(input: unknown) {
  const value = object(input, ["recordOrdinal", "attemptId", "event"]), event = object(value.event, ["ordinal", "kind", "value"]);
  requireValue(typeof value.recordOrdinal === "number" && Number.isSafeInteger(value.recordOrdinal) && value.recordOrdinal > 0 && typeof value.attemptId === "string" &&
    typeof event.ordinal === "number" && Number.isInteger(event.ordinal) && event.ordinal >= 0 && event.ordinal < STORAGE_BOUNDS.auditRecords &&
    typeof event.kind === "string" && event.kind.length <= 32, "ENVELOPE_SCHEMA");
  return { recordOrdinal: value.recordOrdinal, attemptId: value.attemptId, event: { ordinal: event.ordinal, kind: event.kind, value: event.value } };
}
const sha = (bytes: Uint8Array | string): string => createHash("sha256").update(bytes).digest("hex");
const ref = (bytes: Uint8Array | string): ByteRef => ({ byteLength: typeof bytes === "string" ? Buffer.byteLength(bytes) : bytes.byteLength, sha256: sha(bytes) });
const jsonRef = (value: unknown): ByteRef => ref(JSON.stringify(value));
function equal(actual: unknown, expected: unknown, code: string): void { requireValue(isDeepStrictEqual(actual, expected), code); }
function bytes(input: Uint8Array, bound: number, code: string): Uint8Array {
  requireValue(input instanceof Uint8Array && input.byteLength > 0 && input.byteLength <= bound, code); return input;
}
function json(input: Uint8Array, bound: number): unknown { return JSON.parse(Buffer.from(bytes(input, bound, "ARTIFACT_BOUND")).toString("utf8")); }
function model(input: NativeRecord): NativeRecord {
  const config = modelConfigShape.parse(input.config), record = bytes(input.record, STORAGE_BOUNDS.nativeRecordBytes, "MODEL_BOUND");
  requireValue(Buffer.byteLength(JSON.stringify(config)) <= STORAGE_BOUNDS.configBytes && sha(record) === config.recordSha256, "MODEL_HASH");
  return { config, record };
}
function clean(receipt: ExitReceipt | null): void {
  requireValue(receipt && receipt.stdinClosed === true && receipt.stdoutEof === true && receipt.stderrEof === true && receipt.reaped === true &&
    receipt.exitCode === 0 && receipt.forced === false, "NATURAL_CLOSE");
}
function ns(value: string): bigint { requireValue(typeof value === "string" && /^(0|[1-9][0-9]{0,24})$/.test(value), "TIMING_FORMAT"); return BigInt(value); }
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
    const before = fstatSync(fd);
    requireValue(before.isFile() && before.size > 0 && before.size <= bound, "READBACK_FILE_BOUND");
    const result = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < result.byteLength) {
      const count = readSync(fd, result, offset, result.byteLength - offset, offset);
      requireValue(count > 0, "READBACK_SHORT_READ"); offset += count;
    }
    requireValue(readSync(fd, Buffer.alloc(1), 0, 1, offset) === 0, "READBACK_FILE_CHANGED");
    const after = fstatSync(fd);
    requireValue(result.byteLength === before.size && after.size === before.size && after.mtimeMs === before.mtimeMs && after.ctimeMs === before.ctimeMs, "READBACK_FILE_CHANGED");
    return result;
  } finally { closeSync(fd); }
}

export function readQualificationReadback(root: string): QualificationReadback {
  safeDirectory(root);
  const databasePath = join(root, "private.sqlite"), stat = lstatSync(databasePath);
  requireValue(stat.isFile() && stat.size > 0 && stat.size <= limits.databaseBytes, "READBACK_DATABASE_BOUND");
  const db = new Database(databasePath, { readonly: true, create: false, strict: true });
  try {
    db.run("PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; PRAGMA busy_timeout=0;");
    const pages = db.query<{ page_count: number }, []>("PRAGMA page_count").get()?.page_count;
    const pageSize = db.query<{ page_size: number }, []>("PRAGMA page_size").get()?.page_size;
    requireValue(typeof pages === "number" && pages > 0 && pages <= limits.pages && pageSize === 4096, "READBACK_DATABASE_PAGES");
    const controls = db.query<{ id: number; bindings: string; aborted: number; failure: string | null }, []>("SELECT id,bindings,aborted,failure FROM control LIMIT 2").all();
    const masters = db.query<{ master: number; state: string; config: string; record: Uint8Array; pending: string | null; status: string }, []>(
      "SELECT master,state,config,record,pending,status FROM masters LIMIT 2").all();
    const rows = db.query<{ id: string; master: number; ordinal: number; descriptor: string; status: string; completion: string }, []>(
      "SELECT id,master,ordinal,descriptor,status,completion FROM attempts ORDER BY ordinal LIMIT 3").all();
    const checkpoints = db.query<{ count: number }, []>("SELECT count(*) AS count FROM checkpoints").get()?.count;
    requireValue(controls.length === 1 && controls[0]!.id === 1 && masters.length === 1 && rows.length === 2 && checkpoints === 0, "READBACK_ROWS");
    const control = controls[0]!, selected = masters[0]!;
    requireValue(Buffer.byteLength(control.bindings) <= STORAGE_BOUNDS.startedBytes && Buffer.byteLength(selected.state) <= STORAGE_BOUNDS.historyBytes &&
      Buffer.byteLength(selected.config) <= STORAGE_BOUNDS.configBytes, "READBACK_JSON_BOUND");
    const loadModel = (directory: string, recordName: string, configName: string): NativeRecord => model({
      record: readBounded(join(directory, recordName), STORAGE_BOUNDS.nativeRecordBytes),
      config: modelConfigShape.parse(json(readBounded(join(directory, configName), STORAGE_BOUNDS.configBytes), STORAGE_BOUNDS.configBytes)) });
    const packet = join(root, "packet-00");
    const initial = loadModel(join(packet, "attempt-initial-master-101"), "000000-initial-native-record.bin", "000001-initial-model-config.bin");
    const attempts = rows.map((row, index) => {
      requireValue(row.id === ids[index] && row.master === 101 && row.ordinal === index && row.status === "COMPLETED" &&
        typeof row.completion === "string" && Buffer.byteLength(row.completion) <= STORAGE_BOUNDS.startedBytes &&
        Buffer.byteLength(row.descriptor) <= STORAGE_BOUNDS.startedBytes, "READBACK_ATTEMPT");
      const completion = parseCompletion(JSON.parse(row.completion)), directory = join(packet, `attempt-${row.id}`);
      return { ...row, descriptor: attemptDescriptorShape.parse(JSON.parse(row.descriptor)), completion, artifacts: {
        started: readBounded(join(directory, "000000-started-descriptor.bin"), STORAGE_BOUNDS.startedBytes),
        journal: readBounded(join(directory, "000001-verified-journal.bin"), STORAGE_BOUNDS.journalSegmentBytes),
        history: readBounded(join(directory, "000002-authorized-history.bin"), STORAGE_BOUNDS.historyBytes),
        proposal: completion.proposalRef === null ? null : loadModel(directory, "000003-native-proposal.bin", "000004-proposal-config.bin") } };
    });
    const finalModel = model({ config: JSON.parse(selected.config), record: selected.record });
    return { initial, master: { ...selected, ...finalModel, state: checkTrainingState(JSON.parse(selected.state)) }, attempts,
      control: { bindings: bindingsShape.parse(JSON.parse(control.bindings)), aborted: control.aborted, failure: control.failure }, checkpoints };
  } finally { db.close(); }
}

function canonical(input: QualificationEvidenceInput["canonical"]): Proof["canonical"] {
  const { receipt, observed } = input;
  requireValue(input.status === "PASS" && input.error === null && receipt.success === true && receipt.phase === "complete" && receipt.failures.length === 0 &&
    receipt.cleanup === "NOT_REQUESTED" && ["MOCK", "REAL"].includes(receipt.execution) && receipt.scope === "FIXED_NATIVE_PROOF_ONLY" &&
    receipt.trainingExecuted === false && receipt.trainingReady === false && receipt.hostProofQualified === false && receipt.independentReferenceQualified === false &&
    receipt.referenceInputDelivery === "REFERENCE_INPUT_DELIVERY_UNSELECTED", "CANONICAL_STATUS");
  const origin = ns(receipt.originNs!), work = ns(receipt.workDeadlineNs!);
  requireValue(work === origin + 10_000_000_000n && ns(receipt.cleanupDeadlineNs!) === origin + 300_000_000_000n, "CANONICAL_TIMING");
  for (const frame of [receipt.boot, receipt.start, receipt.reply]) {
    requireValue(frame && typeof frame.json === "string" && frame.bytes <= 1048576, "CANONICAL_FRAME");
    equal({ byteLength: frame.bytes, sha256: frame.sha256 }, ref(frame.json), "CANONICAL_FRAME_HASH");
  }
  requireValue(receipt.exchanges.length === 14 && receipt.boundaries.length === 3 && receipt.lifecycle.length === 2, "CANONICAL_COUNTS");
  for (const [index, boundary] of receipt.boundaries.entries()) {
    const parsed = nativeBoundaryShape.parse(boundary.boundary); checkNativeBoundary(parsed);
    requireValue(parsed.kind === ["initial", "opened", "settled"][index], "CANONICAL_BOUNDARY_KIND");
    equal({ byteLength: boundary.bytes, sha256: boundary.sha256 }, jsonRef(parsed), "CANONICAL_BOUNDARY_HASH");
    requireValue(boundary.digest === sha(JSON.stringify(parsed)), "CANONICAL_BOUNDARY_DIGEST");
    if (index === 0) equal(parsed, matchBoundary(initializeGame()).boundary, "CANONICAL_INITIAL");
  }
  const operations = ["init", "commit", "open", "commit", "settle", "commit", "close"];
  for (const [index, role] of (["main", "reference"] as const).entries()) {
    const lifecycle = receipt.lifecycle[index]!;
    requireValue(lifecycle.role === role && lifecycle.finishError === null && lifecycle.terminateCalls === 0 && lifecycle.terminateError === null, "CANONICAL_LIFECYCLE");
    clean(lifecycle.finish);
    const exchanges = receipt.exchanges.filter(item => item.role === role);
    requireValue(exchanges.length === 7, "CANONICAL_PEER_COUNT");
    for (const [ordinal, item] of exchanges.entries()) {
      const reply = item.reply, boundary = receipt.boundaries[Math.floor(ordinal / 2)];
      requireValue(item.operation === operations[ordinal] && item.ordinal === ordinal && item.cursor === [-1, -1, 0, 0, 1, 1, 2][ordinal] &&
        item.error === undefined && reply && reply.role === role && reply.ordinal === ordinal && reply.cursor === [-1, 0, 0, 1, 1, 2, 2][ordinal] &&
        reply.kind === (ordinal === 6 ? "closed" : ordinal % 2 ? "committed" : "staged") && ns(reply.receivedNs) >= origin && ns(reply.receivedNs) < work,
      "CANONICAL_EXCHANGE");
      for (const frame of [item.request, reply]) requireValue(Number.isSafeInteger(frame.bytes) && frame.bytes > 0 && frame.bytes <= MAX_NATIVE_MESSAGE_BYTES && /^[a-f0-9]{64}$/.test(frame.sha256), "CANONICAL_EXCHANGE_FRAME");
      requireValue(item.stagedCursor === (ordinal % 2 && ordinal < 6 ? Math.floor(ordinal / 2) : null) &&
        item.requestDigest === (ordinal % 2 && ordinal < 6 ? boundary!.digest : null) &&
        reply.stagedCursor === (ordinal % 2 === 0 && ordinal < 6 ? ordinal / 2 : null) &&
        reply.digest === (ordinal < 6 ? boundary!.digest : null), "CANONICAL_COMMIT");
      const other = receipt.exchanges.filter(value => value.role !== role)[ordinal]!;
      equal(item.request, other.request, "CANONICAL_PAIRED_REQUEST");
    }
  }
  equal(observed, { exchangeCount: 14, boundaryKinds: ["initial", "opened", "settled"], peers: receipt.lifecycle.map(({ role, finish }) => ({ role, operations, finish })) }, "CANONICAL_SUMMARY");
  return { exchanges: 14, boundaries: 3, naturalFinishes: 2, executionLabel: receipt.execution };
}

export type QualificationNativeUsage = Readonly<{ events: number; rawJsonBytes: number; serializedBytes: number }>;
export function addQualificationNativeUsage(usage: QualificationNativeUsage, event: NativeObservation): QualificationNativeUsage {
  requireValue(Object.values(usage).every(value => Number.isSafeInteger(value) && value >= 0) && usage.rawJsonBytes <= usage.serializedBytes, "NATIVE_USAGE");
  requireValue(usage.events < limits.events, "NATIVE_EVENT_BOUND");
  requireValue(event && ids.includes(event.attemptId as typeof ids[number]) && ["a", "b"].includes(event.channel) && ["request", "reply", "finish"].includes(event.kind), "NATIVE_EVENT");
  let rawJsonBytes = usage.rawJsonBytes;
  if (event.kind !== "finish") {
    requireValue(typeof event.json === "string" && event.json.length <= MAX_INFERENCE_BYTES, "NATIVE_FRAME_BOUND");
    const count = Buffer.byteLength(event.json); requireValue(count <= MAX_INFERENCE_BYTES, "NATIVE_FRAME_BOUND"); rawJsonBytes += count;
  }
  const encoded = JSON.stringify(event, (_, value: unknown) => typeof value === "bigint" ? String(value) : value instanceof Error ? { name: value.name, message: value.message } : value) + "\n";
  const serializedBytes = usage.serializedBytes + Buffer.byteLength(encoded);
  requireValue(Number.isSafeInteger(serializedBytes) && serializedBytes <= limits.serializedBytes, "NATIVE_TOTAL_BOUND");
  return { events: usage.events + 1, rawJsonBytes, serializedBytes };
}

function native(input: QualificationEvidenceInput): { channels: Map<string, Channel>; rawJsonBytes: number; serializedBytes: number; scoredReplies: number } {
  requireValue(Array.isArray(input.native) && input.native.length <= limits.events, "NATIVE_EVENT_BOUND");
  let usage: QualificationNativeUsage = { events: 0, rawJsonBytes: 0, serializedBytes: 0 }, scoredReplies = 0;
  for (const event of input.native) usage = addQualificationNativeUsage(usage, event);
  const channels = new Map<string, Channel>();
  for (const id of ids) for (const suffix of ["a", "b"]) channels.set(`${id}:${suffix}`, {
    ordinal: 0, phase: "new", pending: null, exchanges: [], samples: 0, proposal: null, lastReceivedNs: -1n });
  for (const event of input.native) {
    const channel = channels.get(`${event.attemptId}:${event.channel}`)!, index = ids.indexOf(event.attemptId as typeof ids[number]);
    const attempt = input.r4.attempts[index]!, descriptor = input.readback.attempts[index]!.descriptor;
    if (event.kind === "finish") {
      requireValue(channel.phase === "closed" && channel.pending === null, "NATIVE_FINISH_ORDER"); clean(event.receipt); channel.phase = "reaped"; continue;
    }
    requireValue(channel.phase !== "closed" && channel.phase !== "reaped", "NATIVE_AFTER_CLOSE");
    if (event.kind === "request") {
      requireValue(channel.pending === null, "NATIVE_REQUEST_OVERWRITE");
      const request = decodeQualificationRequest(event.json, false), command = request.command;
      requireValue(request.ordinal === channel.ordinal && request.sessionId === `${event.attemptId}:learner:${event.channel}` && request.modelId === descriptor.modelId, "NATIVE_REQUEST_BINDING");
      requireValue(command.kind === "begin" ? channel.phase === "new" && Object.is(command.baseline, descriptor.frozenBaseline)
        : command.kind === "close" ? channel.phase === "finished" : channel.phase === "active", "NATIVE_REQUEST_ORDER");
      const peer = channels.get(`${event.attemptId}:${event.channel === "a" ? "b" : "a"}`)!;
      if (command.kind === "begin" && index > 0) {
        for (const suffix of ["a", "b"]) {
          const previous = channels.get(`${ids[index - 1]}:${suffix}`)!;
          requireValue(previous.phase === "reaped" && previous.lastReceivedNs <= ns(attempt.originNs), "NATIVE_SERIAL_ATTEMPTS");
        }
      }
      if (command.kind === "score" || command.kind === "acknowledge") requireValue(peer.phase === "active", "NATIVE_PAIRED_BEGIN_ORDER");
      if (command.kind === "finish") requireValue((peer.phase === "active" || peer.phase === "finished") && channel.samples === peer.samples &&
        channel.samples === input.readback.attempts[index]!.completion.sampledDecisions, "NATIVE_PAIRED_FINISH_ORDER");
      if (command.kind === "close") requireValue(peer.phase === "finished" || peer.phase === "closed" || peer.phase === "reaped", "NATIVE_PAIRED_CLOSE_ORDER");
      if (command.kind === "score" || command.kind === "acknowledge") requireValue(command.request.modelId === descriptor.modelId, "NATIVE_SCORE_MODEL");
      const last = channel.exchanges.at(-1);
      if (command.kind === "score") requireValue(event.channel === "a" && (last?.kind === "begin" || last?.kind === "acknowledge"), "NATIVE_SCORE_ORDER");
      if (command.kind === "acknowledge" && event.channel === "a") {
        requireValue(last?.kind === "score", "NATIVE_ACK_ORDER"); equal(jsonRef(command.request), last.requestRef, "NATIVE_ACK_SCORE_MATRIX");
      }
      if (command.kind === "finish") requireValue(last?.kind === "begin" || last?.kind === "acknowledge", "NATIVE_FINISH_WITH_UNACKED_SCORE");
      if (command.kind === "finish") requireValue(command.returnValue === input.readback.attempts[index]!.completion.returnValue, "NATIVE_RETURN");
      channel.pending = request; continue;
    }
    const request = channel.pending; requireValue(request !== null, "NATIVE_REPLY_WITHOUT_REQUEST");
    const reply = decodeLearningReply(event.json), command = request.command, result = reply.result;
    requireValue(reply.ordinal === request.ordinal && reply.modelId === request.modelId && reply.sessionId === request.sessionId &&
      typeof event.receivedNs === "bigint" && event.receivedNs >= ns(attempt.originNs) && event.receivedNs >= channel.lastReceivedNs && event.receivedNs < ns(attempt.workDeadlineNs), "NATIVE_REPLY_BINDING");
    const exchange: Exchange = { kind: command.kind, requestRef: null, selected: null, digest: null, logits: null, receivedNs: event.receivedNs };
    if (command.kind === "begin") { requireValue(result.kind === "begun" && event.receivedNs < ns(attempt.startupDeadlineNs), "NATIVE_BEGIN"); channel.phase = "active"; }
    else if (command.kind === "score") {
      requireValue(result.kind === "scored", "NATIVE_SCORE");
      const response = scoreResponseShape.parse(result.response);
      requireValue(response.requestId === command.request.requestId && response.modelId === command.request.modelId &&
        response.featureVersion === command.request.featureVersion && response.logits.length === command.request.rows, "NATIVE_SCORE_BINDING");
      requireValue(response.logits.every(Number.isFinite), "NATIVE_FINITE_LOGITS");
      exchange.requestRef = jsonRef(command.request); exchange.logits = response.logits; scoredReplies++;
    } else if (command.kind === "acknowledge") {
      requireValue(result.kind === "acknowledged" && result.journalDigest === command.journalDigest && result.sampledDecisions === channel.samples + 1 && command.selected < command.request.rows, "NATIVE_ACK_PREFIX");
      channel.samples++; exchange.requestRef = jsonRef(command.request); exchange.selected = command.selected; exchange.digest = command.journalDigest;
    } else if (command.kind === "finish") {
      requireValue(result.kind === "proposed" || result.kind === "diagnostic", "NATIVE_PROPOSAL_KIND");
      if (result.kind === "proposed") { model({ config: result.config, record: Uint8Array.from(result.record) }); requireValue(result.sampledDecisions === channel.samples && Number.isFinite(result.objective), "NATIVE_PROPOSAL_COUNT"); }
      else requireValue(channel.samples === 0, "NATIVE_DIAGNOSTIC_COUNT");
      channel.proposal = result; channel.phase = "finished";
    } else { requireValue(result.kind === "closed", "NATIVE_CLOSE"); channel.phase = "closed"; }
    channel.exchanges.push(exchange); channel.ordinal++; channel.lastReceivedNs = event.receivedNs; channel.pending = null;
  }
  for (const channel of channels.values()) requireValue(channel.phase === "reaped" && channel.pending === null, "NATIVE_PARTIAL_CLOSE");
  return { channels, rawJsonBytes: usage.rawJsonBytes, serializedBytes: usage.serializedBytes, scoredReplies };
}

function stateObservation(input: R4StateObservation | null): TrainingState {
  requireValue(input !== null, "R4_STATE_MISSING");
  const state = checkTrainingState(input.state); equal(input.serializedStateRef, jsonRef(state), "R4_STATE_HASH"); return state;
}
function modelObservation(input: R4Observation["initialRecord"], selected: NativeRecord): void {
  requireValue(input !== null, "R4_MODEL_MISSING"); equal(input.config, selected.config, "R4_MODEL_CONFIG");
  equal(input.recordRef, ref(selected.record), "R4_RECORD_REF"); equal(input.configRef, jsonRef(selected.config), "R4_CONFIG_REF");
}
function session(input: GameSession, kind: "initial" | "opened" | "settled", transition?: GameTransition): GameSession {
  requireValue(input && input.version === "chess-coach.game-session.v1" && ["unopened", "opened", "terminal"].includes(input.phase) &&
    Array.isArray(input.history) && input.history.length <= 91 && input.history.every(value => /^[a-f0-9]{64}$/.test(value)), "JOURNAL_SESSION");
  const boundary = matchBoundary(input, transition).boundary; checkNativeBoundary(boundary);
  requireValue(boundary.kind === kind && input.native.callOrdinal === input.history.length && input.native.turn === input.snapshot.turn, "JOURNAL_SESSION_NATIVE");
  decodeCausalState(JSON.stringify(input.native)); equal(input.snapshot.stored, input.bank, "JOURNAL_BANK");
  equal(input.native.ccLives, input.snapshot.ccLives, "JOURNAL_NATIVE_LIVES");
  requireValue(input.phase === "terminal" || input.phase === (kind === "opened" ? "opened" : "unopened"), "JOURNAL_SESSION_PHASE");
  for (const side of ["w", "b"] as const) {
    const recipient = input.recipients[side], batch = decodeRecipientBatch(JSON.stringify(input.batches[side]));
    requireValue(batch.side === side && batch.ordinal === input.history.length && recipient.callOrdinal === input.history.length &&
      recipient.batchOrdinal === batch.ordinal && recipient.planningOrdinal === batch.planningOrdinal && recipient.observation.side === side &&
      batch.observation.own.gas === input.snapshot.gas[side] && batch.observation.own.gasIncome === input.snapshot.gasIncome[side], "JOURNAL_RECIPIENT");
    equal(recipient.observation, batch.observation, "JOURNAL_RECIPIENT_OBSERVATION");
  }
  return input;
}
function decision(journal: DecisionJournal, permit: PlanPermit, game: GameSession, descriptor: AttemptDescriptor,
  sampling: TrainingState["rng"]["policy-sampling"], score: Exchange, ackA: Exchange, ackB: Exchange): void {
  requireValue(journal.attemptId === descriptor.attemptId && journal.permitId === permit.permitId && journal.planningOrdinal === permit.planningOrdinal &&
    journal.side === permit.side && journal.side === descriptor.schedule.candidateSide && journal.modelId === descriptor.modelId && journal.mode === "sample" &&
    journal.featureVersion === FEATURE_VERSION && journal.enumerationVersion === ENUMERATION_VERSION, "DECISION_CONTEXT");
  const history = JSON.stringify(game.recipients[journal.side].observation), candidates = enumerateCandidates(history).candidates;
  const keys = candidates.map(candidate => JSON.stringify(candidate.actions)), features = encodeFeatures(history, candidates.map(candidate => JSON.stringify(candidate)));
  const request: ScoreRequest = { version: "chess-coach.inference.v1", featureVersion: features.featureVersion, requestId: permit.permitId,
    modelId: descriptor.modelId, rows: features.rows, values: Array.from(features.values) };
  requireValue(score && ackA && ackB && score.kind === "score" && ackA.kind === "acknowledge" && ackB.kind === "acknowledge" && score.logits !== null, "DECISION_NATIVE_MISSING");
  for (const exchange of [score, ackA, ackB]) {
    equal(exchange.requestRef, jsonRef(request), "DECISION_FEATURE_MATRIX");
    requireValue(exchange.receivedNs >= ns(permit.issuedNs), "DECISION_RECEIPT");
  }
  const draw = drawStream(sampling), probabilities = distribution(score.logits), index = selectedIndex(score.logits, keys, "sample", draw.uniform), candidate = candidates[index]!;
  equal(journal.samplingBefore, sampling, "DECISION_SAMPLING_BEFORE"); equal(journal.samplingAfter, draw.after, "DECISION_SAMPLING_AFTER");
  requireValue(journal.historyDigest === sha(history) && journal.orderedCandidateDigest === sha(JSON.stringify(keys)) && Object.is(journal.uniform, draw.uniform) &&
    journal.selectedIndex === index && journal.selectedKey === keys[index] && Object.is(journal.selectedLogProbability, probabilities.logProbabilities[index]), "DECISION_SELECTION");
  equal(journal.actions, candidate.actions, "DECISION_ACTIONS");
  const spend = { minerals: 0, gas: 0 };
  for (const action of journal.actions) { if (action.kind === "deploy") spend.minerals += UNIT_COST[action.unit]; if (action.kind !== "classical") spend.gas += specialGasCost(action.kind); }
  equal(journal.requestedSpend, spend, "DECISION_SPEND");
  requireValue(spend.minerals <= game.bank[journal.side] && spend.gas <= game.snapshot.gas[journal.side], "DECISION_BANK");
  const digest = sha(JSON.stringify(journal));
  for (const ack of [ackA, ackB]) requireValue(ack.selected === index && ack.digest === digest, "DECISION_ACK_BINDING");
}

function journal(row: QualificationReadback["attempts"][number], observed: R4AttemptObservation, consumed: TrainingState, a: Channel, b: Channel,
  cumulative: ReturnType<typeof createHash>, offset: number): { ordinal: number; proposal: Proposal } {
  const { descriptor, completion, artifacts } = row, started = { descriptor, rng: consumed.rng };
  equal(json(artifacts.started, STORAGE_BOUNDS.startedBytes), started, "STARTED_ARTIFACT");
  const segment = bytes(artifacts.journal, STORAGE_BOUNDS.journalSegmentBytes, "JOURNAL_BOUND"), lines = Buffer.from(segment).toString("utf8").split("\n");
  requireValue(lines.pop() === "" && lines.length >= 5 && lines.length <= STORAGE_BOUNDS.auditRecords, "JOURNAL_LINES");
  const history = json(artifacts.history, STORAGE_BOUNDS.historyBytes); requireValue(Array.isArray(history) && history.length <= 92, "HISTORY_BOUND");
  const retainedHistory: unknown[] = [], candidateIds: string[] = [], opponentIds: string[] = [];
  const scores = a.exchanges.filter(value => value.kind === "score"), acksA = a.exchanges.filter(value => value.kind === "acknowledge"), acksB = b.exchanges.filter(value => value.kind === "acknowledge");
  requireValue(b.exchanges.every(value => value.kind !== "score"), "NATIVE_SECOND_VERIFIER");
  let game: GameSession | null = null, permit: PlanPermit | null = null, windows = 0, plies = 0, cursor = 0, matchOrdinal = 0;
  let phase: "started" | "initial" | "running" | "complete" | "exited" | "closed" = "started";
  let rejection: ReturnType<typeof matchStopShape.parse> | null = null;
  const rng = structuredClone(consumed.rng), plans: GamePlans = { w: [], b: [] };
  const first = a.proposal, second = b.proposal;
  requireValue(first && second && first.kind === second.kind, "PAIRED_PROPOSAL_KIND");
  if (first.kind === "proposed") {
    requireValue(second.kind === "proposed" && first.parameterSha256 === second.parameterSha256 && Object.is(first.objective, second.objective) &&
      first.sampledDecisions === second.sampledDecisions && first.nonzeroPolicyGradient === second.nonzeroPolicyGradient, "PAIRED_PROPOSAL");
    requireValue(artifacts.proposal !== null, "RETAINED_PROPOSAL_MISSING");
    const selected = model(artifacts.proposal);
    equal(selected.config, first.config, "SELECTED_PROPOSAL_CONFIG"); equal(ref(selected.record), ref(Uint8Array.from(first.record)), "SELECTED_FIRST_PROPOSAL");
    equal(completion.proposalRef, ref(selected.record), "PROPOSAL_REF");
    requireValue(completion.nonzeroPolicyGradient === first.nonzeroPolicyGradient && completion.sampledDecisions === first.sampledDecisions &&
      !(Object.is(descriptor.frozenBaseline, completion.returnValue) && first.nonzeroPolicyGradient), "PROPOSAL_COMPLETION");
  } else requireValue(artifacts.proposal === null && completion.proposalRef === null && completion.sampledDecisions === 0 && !completion.nonzeroPolicyGradient, "DIAGNOSTIC_COMPLETION");
  for (const [ordinal, line] of lines.entries()) {
    const envelope = parseEnvelope(JSON.parse(line)), event = envelope.event;
    requireValue(envelope.recordOrdinal === offset + ordinal + 1 && envelope.attemptId === row.id && event.ordinal === ordinal, "JOURNAL_ORDINAL");
    if (event.kind === "started") { requireValue(ordinal === 0 && phase === "started", "JOURNAL_STARTED_ORDER"); equal(event.value, started, "JOURNAL_STARTED"); phase = "initial"; }
    else if (event.kind === "initial") {
      requireValue(phase === "initial" && game === null, "JOURNAL_INITIAL_ORDER"); game = session(event.value as GameSession, "initial");
      equal(game, initializeGame(), "JOURNAL_CANONICAL_INITIAL"); retainedHistory.push(game.batches[descriptor.schedule.candidateSide]); phase = "running"; matchOrdinal++;
    } else if (event.kind === "native") {
      requireValue(phase === "running" && game && permit === null && rejection === null, "JOURNAL_NATIVE_ORDER");
      const transition = event.value as GameTransition, record = gameRecordShape.parse(transition.record), kind = transition.native.kind;
      requireValue(kind === "opened" || kind === "settled", "JOURNAL_NATIVE_KIND");
      const next = session(transition.session, kind, transition);
      requireValue(record.ordinal === game.history.length + 1 && transition.native.value.journal.callOrdinal === record.ordinal &&
        next.history.length === record.ordinal && record.operation.kind === (kind === "opened" ? "open" : "settle"), "JOURNAL_NATIVE_RECORD");
      const causal = decodeCausalJournal(JSON.stringify(transition.native.value.journal));
      for (const side of ["w", "b"] as const) {
        equal(causal.initialCells[side], game.batches[side].observation.cells, "JOURNAL_PARENT_CELLS");
        equal(causal.finalCells[side], next.batches[side].observation.cells, "JOURNAL_FINAL_CELLS");
      }
      equal(transition.native.value.state, next.native, "JOURNAL_NATIVE_STATE"); equal(next.history, [...game.history, sha(JSON.stringify(transition.record))], "JOURNAL_NATIVE_PREFIX");
      equal({ snapshot: record.snapshot, bank: record.bank, batches: record.batches }, { snapshot: next.snapshot, bank: next.bank, batches: next.batches }, "JOURNAL_RECORD_SESSION");
      if (kind === "opened") {
        requireValue(game.phase === "unopened" && cursor === 0, "JOURNAL_OPEN_ORDER"); equal(next.bank, game.bank, "JOURNAL_OPEN_BANK");
        plans.w = []; plans.b = [];
      } else {
        requireValue(game.phase === "opened" && cursor === planningSides(descriptor).length && record.operation.kind === "settle", "JOURNAL_SETTLE_ORDER");
        equal(record.operation.plans[descriptor.schedule.candidateSide], plans[descriptor.schedule.candidateSide], "JOURNAL_CANDIDATE_PLAN");
        if (descriptor.schedule.kind === "live") equal(record.operation.plans, plans, "JOURNAL_LIVE_PLANS");
        const debited = { ...game.bank };
        for (const side of ["w", "b"] as const) {
          decodeNativeIntents(JSON.stringify(record.operation.plans[side]), side);
          for (const action of record.operation.plans[side]) if (action.kind === "deploy") debited[side] -= UNIT_COST[action.unit];
          requireValue(debited[side] >= 0, "JOURNAL_SETTLE_SPEND");
        }
        equal(next.bank, applyStoredIncome(debited, next.snapshot.turn), "JOURNAL_SETTLE_BANK");
        windows++; cursor = 0;
      }
      if (kind === "settled" || transition.native.value.result.asResolve) plies++;
      game = next; retainedHistory.push(game.batches[descriptor.schedule.candidateSide]); matchOrdinal++;
    } else if (event.kind === "permit") {
      requireValue(phase === "running" && game && game.phase === "opened" && permit === null && rejection === null, "JOURNAL_PERMIT_ORDER");
      permit = planPermitShape.parse(event.value);
      const side = planningSides(descriptor)[cursor];
      requireValue(permit.attemptId === row.id && permit.permitId === `${row.id}:plan:${windows}:${side}` && permit.planningOrdinal === windows && permit.side === side &&
        permit.turn === game.snapshot.turn && permit.role === (side === descriptor.schedule.candidateSide ? "candidate" : "strategic") &&
        ns(permit.issuedNs) >= ns(observed.originNs) && ns(permit.deadlineNs) === ns(permit.issuedNs) + 10_000_000_000n && ns(permit.deadlineNs) <= ns(observed.workDeadlineNs), "JOURNAL_PERMIT");
    } else if (event.kind === "decision-acked") {
      requireValue(phase === "running" && game && permit, "JOURNAL_DECISION_ORDER");
      if (permit.role === "candidate") {
        const value = decodeDecisionJournal(JSON.stringify(event.value)), index = candidateIds.length;
        decision(value, permit, game, descriptor, rng["policy-sampling"], scores[index]!, acksA[index]!, acksB[index]!);
        rng["policy-sampling"] = value.samplingAfter; candidateIds.push(value.permitId); plans[value.side] = value.actions;
      } else {
        const value = opponentJournalShape.parse(event.value); decodeNativeIntents(JSON.stringify(value.actions), permit.side);
        requireValue(descriptor.schedule.kind === "live" && value.attemptId === row.id && value.permitId === permit.permitId && value.side === permit.side &&
          value.planningOrdinal === windows && value.snapshotDigest === sha(JSON.stringify(nativeSnapshotShape.parse(game.snapshot))) && value.opponentAfter.root === rng.opponent.root &&
          value.opponentAfter.status === "active" && value.opponentAfter.drawCount >= rng.opponent.drawCount, "OPPONENT_CONTEXT");
        equal(value.opponentBefore, rng.opponent, "OPPONENT_PREFIX");
        const spend = value.actions.reduce((sum, action) => sum + (action.kind === "deploy" ? UNIT_COST[action.unit] : 0), 0);
        requireValue(spend === value.reportedMinSpend && spend <= game.bank[value.side], "OPPONENT_SPEND");
        rng.opponent = value.opponentAfter; opponentIds.push(value.permitId); plans[value.side] = value.actions;
      }
      cursor++; permit = null; matchOrdinal++;
    } else if (event.kind === "native-rejection") {
      requireValue(phase === "running" && game && permit === null && rejection === null && cursor === planningSides(descriptor).length, "JOURNAL_REJECTION_ORDER");
      const raw = object(event.value, ["stop", "plans", "boundaryOrdinal"]), value = { stop: matchStopShape.parse(raw.stop), plans: object(raw.plans, ["w", "b"]), boundaryOrdinal: raw.boundaryOrdinal };
      requireValue(value.stop.reason === "candidate-native-rejection" || value.stop.reason === "recorded-white-rejection", "JOURNAL_REJECTION_KIND");
      requireValue(value.stop.reason === "candidate-native-rejection" ? value.stop.side === descriptor.schedule.candidateSide
        : descriptor.schedule.kind === "corpus" && value.stop.side === "w", "JOURNAL_REJECTION_SIDE");
      requireValue(value.boundaryOrdinal === game.history.length, "JOURNAL_REJECTION_BOUNDARY");
      for (const side of ["w", "b"] as const) decodeNativeIntents(JSON.stringify(value.plans[side]), side);
      equal(value.plans[descriptor.schedule.candidateSide], plans[descriptor.schedule.candidateSide], "JOURNAL_REJECTION_PLAN"); rejection = value.stop; matchOrdinal++;
    } else if (event.kind === "complete") {
      requireValue(phase === "running" && game && permit === null, "JOURNAL_COMPLETE_ORDER");
      const value = decodeMatchReply(JSON.stringify(event.value));
      requireValue(value.kind === "complete" && value.attemptId === row.id && value.ordinal === matchOrdinal && value.stop.reason === completion.reason && value.stop.returnValue === completion.returnValue &&
        value.boundaryOrdinal === game.history.length && value.planningWindows === windows && value.recordedPlies === plies &&
        value.recordedCount === (descriptor.schedule.kind === "corpus" ? windows + (rejection ? 1 : 0) : 0), "JOURNAL_COMPLETION");
      if (rejection) equal(value.stop, rejection, "JOURNAL_REJECTION_STOP");
      else {
        requireValue(!["candidate-native-rejection", "recorded-white-rejection"].includes(value.stop.reason), "JOURNAL_MISSING_REJECTION");
        const outcome = scOutcome(game.snapshot);
        if (value.stop.reason === "core-terminal") requireValue(outcome && value.stop.returnValue === (outcome.winner === null ? 0 : outcome.winner === descriptor.schedule.candidateSide ? 1 : -1), "JOURNAL_TERMINAL_STOP");
        else if (value.stop.reason === "progress-cap") requireValue(windows >= 64 || plies >= 128, "JOURNAL_PROGRESS_STOP");
        else requireValue(descriptor.schedule.kind === "corpus", "JOURNAL_CORPUS_STOP");
      }
      if (descriptor.schedule.kind === "live") requireValue(value.recordedDigest === sha(JSON.stringify([])), "JOURNAL_LIVE_RECORDED_DIGEST");
      equal(value.candidateIds, candidateIds, "JOURNAL_CANDIDATE_IDS"); equal(value.opponentIds, opponentIds, "JOURNAL_OPPONENT_IDS"); equal(value.rng, rng, "JOURNAL_COMPLETION_RNG"); phase = "complete";
    } else if (event.kind === "match-exit") { requireValue(phase === "complete", "JOURNAL_EXIT_ORDER"); clean(event.value as ExitReceipt); phase = "exited"; }
    else if (event.kind === "learners-closed") {
      requireValue(phase === "exited" && ordinal === lines.length - 1, "JOURNAL_LEARNER_CLOSE_ORDER");
      equal(event.value, JSON.parse(JSON.stringify(first.kind === "proposed" ? { kind: first.kind, parameterSha256: first.parameterSha256, objective: first.objective } : { kind: first.kind })), "JOURNAL_LEARNER_PROPOSAL"); phase = "closed";
    } else throw new Error("JOURNAL_UNSUPPORTED_EVENT");
  }
  requireValue(phase === "closed" && candidateIds.length === completion.sampledDecisions && scores.length === candidateIds.length && acksA.length === candidateIds.length &&
    acksB.length === candidateIds.length && a.samples === candidateIds.length && b.samples === candidateIds.length, "JOURNAL_SAMPLE_COUNT");
  equal(rng, completion.rngAfter, "COMPLETION_RNG"); equal(history, retainedHistory, "RETAINED_HISTORY"); equal(completion.historyRef, ref(artifacts.history), "HISTORY_REF");
  cumulative.update(segment);
  requireValue(completion.journalRef.lastRecordOrdinal === offset + lines.length && completion.journalRef.sha256 === cumulative.copy().digest("hex"), "CUMULATIVE_JOURNAL_HASH");
  return { ordinal: offset + lines.length, proposal: first };
}

export function checkQualificationEvidence(input: QualificationEvidenceInput): QualificationEvidence {
  const output: QualificationEvidence = { status: "FAIL_RETAINED_FUNCTIONAL_EVIDENCE", scope: "INPUTS_UNATTESTED_FUNCTIONAL_EVIDENCE_ONLY", qualified: false, failures: [], proof: null };
  let phase = "canonical";
  try {
    const canonicalProof = canonical(input.canonical); phase = "readback";
    const { readback, r4 } = input, initial = model(readback.initial), final = model(readback.master);
    requireValue(readback.attempts.length === 2 && readback.master.master === 101 && readback.master.pending === null && readback.master.status === "active" &&
      readback.control.aborted === 0 && readback.control.failure === null && readback.checkpoints === 0, "SETTLED_READBACK");
    const bindings = bindingsShape.parse(readback.control.bindings);
    requireValue(r4.scope === "COMPOSITION_ONLY_INPUTS_UNQUALIFIED" && r4.qualified === false && r4.status === "PASS" && r4.failures.length === 0 &&
      r4.attempts.length === 2 && r4.close.calls === 1 && r4.close.status === "PASS" && r4.close.cleanupDeadlineNs === r4.attempts[1]!.cleanupDeadlineNs, "R4_STATUS");
    modelObservation(r4.initialRecord, initial);
    let previous = initialTrainingState(101, initial.config.recordSha256, bindings);
    equal(stateObservation(r4.initialState), previous, "INITIAL_STATE"); equal(stateObservation(r4.initialSnapshot), previous, "INITIAL_SNAPSHOT");
    phase = "native"; const nativeProof = native(input);
    let ordinal = 0, journalBytes = 0; const cumulative = createHash("sha256"), attempts: Proof["attempts"] = [];
    for (const [index, id] of ids.entries()) {
      phase = id;
      const row = readback.attempts[index]!, observed = r4.attempts[index]!, expected = nextAttempt(previous, id), descriptor = attemptDescriptorShape.parse(row.descriptor), completion = parseCompletion(row.completion);
      requireValue(row.id === id && row.master === 101 && row.ordinal === index && row.status === "COMPLETED" && observed.attemptId === id && observed.setupCalls === 1, "ATTEMPT_BINDING");
      equal(descriptor, expected.descriptor, "DESCRIPTOR"); equal(observed.descriptor, descriptor, "R4_DESCRIPTOR"); equal(observed.rng, expected.consumed.rng, "R4_RNG");
      const origin = ns(observed.originNs);
      requireValue(ns(observed.startupDeadlineNs) === origin + 10_000_000_000n && ns(observed.workDeadlineNs) === origin + 297_000_000_000n &&
        ns(observed.cleanupDeadlineNs) === origin + 300_000_000_000n && (index === 0 || origin >= ns(r4.attempts[index - 1]!.originNs)), "R4_TIMING");
      const selected = index === 0 ? initial : readback.attempts[0]!.artifacts.proposal ?? initial;
      modelObservation(observed.model, model(selected)); requireValue(selected.config.recordSha256 === descriptor.modelId, "MODEL_HANDOFF");
      requireValue(completion.reason === "core-terminal" || completion.returnValue === -1, "COMPLETION_RETURN");
      const checked = journal(row, observed, expected.consumed, nativeProof.channels.get(`${id}:a`)!, nativeProof.channels.get(`${id}:b`)!, cumulative, ordinal);
      ordinal = checked.ordinal; journalBytes += row.artifacts.journal.byteLength;
      requireValue(completion.journalRef.byteLength === journalBytes, "CUMULATIVE_JOURNAL_BYTES");
      const next = structuredClone(expected.consumed); next.counters.verifiedCompleted++; next.rng = completion.rngAfter; next.journalRef = completion.journalRef; next.historyRefs.push(completion.historyRef);
      if (checked.proposal.kind === "proposed") {
        next.modelId = checked.proposal.config.recordSha256; next.counters.eligibleCompleted++; next.counters.updates++; next.counters.baselineCount++;
        next.counters.baselineSum += completion.returnValue; if (checked.proposal.nonzeroPolicyGradient) next.counters.nonzeroPGUpdates++;
      }
      checkTrainingState(next); equal(stateObservation(observed.returned), next, "RETURNED_STATE"); equal(stateObservation(observed.snapshot), next, "SNAPSHOT_STATE");
      previous = next;
      attempts.push({ id, samples: completion.sampledDecisions, historyRef: completion.historyRef, journalRef: completion.journalRef, proposalRef: completion.proposalRef,
        parameterSha256: checked.proposal.kind === "proposed" ? checked.proposal.parameterSha256 : null, nonzeroPolicyGradient: completion.nonzeroPolicyGradient });
    }
    phase = "final"; equal(checkTrainingState(readback.master.state), previous, "FINAL_STATE"); equal(previous.bindings, bindings, "FINAL_BINDINGS");
    const lastSelected = readback.attempts[1]!.artifacts.proposal ?? readback.attempts[0]!.artifacts.proposal ?? initial;
    equal(final.config, lastSelected.config, "FINAL_CONFIG"); equal(ref(final.record), ref(lastSelected.record), "FINAL_RECORD");
    requireValue(previous.modelId === final.config.recordSha256 && previous.counters.started === 2 && previous.counters.verifiedCompleted === 2 && previous.counters.nonzeroPGUpdates >= 1 &&
      attempts.some(attempt => attempt.nonzeroPolicyGradient), "INSUFFICIENT_EXERCISE");
    output.proof = { canonical: canonicalProof, attempts, native: { events: input.native.length, rawJsonBytes: nativeProof.rawJsonBytes, serializedBytes: nativeProof.serializedBytes, ports: 4, naturalFinishes: 4, scoredReplies: nativeProof.scoredReplies },
      initialRecordRef: ref(initial.record), finalRecordRef: ref(final.record), nonzeroPGUpdates: previous.counters.nonzeroPGUpdates };
    output.status = "PASS_RETAINED_FUNCTIONAL_EVIDENCE";
  } catch (error) {
    output.failures.push(`${phase}:${error instanceof Error && error.name === "ZodError" ? "SCHEMA" : error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "MALFORMED_INPUT"}`.slice(0, 160));
  }
  return output;
}
