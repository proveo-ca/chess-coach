// SPEC: _spec/runtime-protocol.puml, _spec/checkpoint-runtime.puml, _spec/policy-runtime.puml
import { afterAll, beforeAll, expect, spyOn, test } from "bun:test";
import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { initializeGame, openGame } from "../../packages/contracts/src/game-session";
import type { PlanPermit } from "../../packages/contracts/src/episode";
import { nativeSnapshotShape } from "../../packages/contracts/src/resolution";
import { experimentShape } from "../../packages/contracts/src/training-artifact";
import type { ByteRef, TrainingState } from "../../packages/contracts/src/training-state";
import { initialTrainingState, nextAttempt } from "../../packages/runtime/src/curriculum";
import { planningSides } from "../../packages/runtime/src/match-state";
import { drawStream, MASTERS } from "../../packages/runtime/src/rng";
import { STORAGE_BOUNDS } from "../../packages/runtime/src/storage-bounds";
import { TrainingStore } from "../../packages/runtime/src/training-store";
import type { CompletionValues, NativeRecord } from "../../packages/runtime/src/training-store";
import { cleanExit } from "../../packages/runtime/tests/fixture";
import { repositoryScratch } from "../../packages/runtime/tests/repository-scratch";
import { bindings, syntheticCompletion, syntheticRecord } from "../../packages/runtime/tests/training-fixture";
import type { CampaignEvidence, CampaignReadback, CampaignResult } from "./campaign-evidence";

const spawn = spyOn(Bun, "spawn").mockImplementation(() => { throw new Error("FORBIDDEN_PROCESS_SPAWN"); });
const spawnSync = spyOn(Bun, "spawnSync").mockImplementation(() => { throw new Error("FORBIDDEN_PROCESS_SPAWN_SYNC"); });
const network = spyOn(globalThis, "fetch").mockImplementation(Object.assign(() => { throw new Error("FORBIDDEN_NETWORK"); }, { preconnect() {} }));
const { openCampaignReadback, validateCampaignResult } = await import("./campaign-evidence");
const sha = (value: Uint8Array | string): string => createHash("sha256").update(value).digest("hex");
const encode = (value: unknown): Uint8Array => Buffer.from(JSON.stringify(value));
const ref = (value: Uint8Array): ByteRef => ({ byteLength: value.byteLength, sha256: sha(value) });
const expectedBindings = bindings(), initialGame = initializeGame(), opened = openGame(initialGame);
const initialEventJson = JSON.stringify({ ordinal: 1, kind: "initial", value: initialGame });
const openedEventJson = JSON.stringify({ ordinal: 2, kind: "native", value: opened });
const histories = { w: encode([initialGame.batches.w, opened.session.batches.w]), b: encode([initialGame.batches.b, opened.session.batches.b]) };
const historyDigests = { w: sha(JSON.stringify(opened.session.recipients.w.observation)), b: sha(JSON.stringify(opened.session.recipients.b.observation)) };
const openedSnapshotDigest = sha(JSON.stringify(nativeSnapshotShape.parse(opened.session.snapshot)));
const packet = (master: number, ordinal = 0): string => `packet-${String((master - 101) * 10 + Math.floor(ordinal / 100)).padStart(2, "0")}`;
const finalDirectory = "packet-49/attempt-final-artifacts";
const finalPath = (index: number, offset: number, role: string): string => `${finalDirectory}/${String(index * 3 + offset).padStart(6, "0")}-${role}-${101 + index}.bin`;
type MasterRow = IterableValue<ReturnType<CampaignReadback["masters"]>>;
type AttemptRow = IterableValue<ReturnType<CampaignReadback["attempts"]>>;
type CheckpointRow = IterableValue<ReturnType<CampaignReadback["checkpoints"]>>;
type IterableValue<T> = T extends Iterable<infer Value> ? Value : never;
type Cursor = { hash: ReturnType<typeof createHash>; ordinal: number; byteLength: number };
type Step = { row: AttemptRow; state: TrainingState; model: NativeRecord; payloads: Map<string, Uint8Array>; checkpoint: boolean };

function advance(state: TrainingState, completion: CompletionValues, selected: NativeRecord | null): { state: TrainingState; checkpoint: boolean } {
  state.counters.verifiedCompleted++; state.rng = completion.rngAfter; state.journalRef = completion.journalRef; state.historyRefs.push(completion.historyRef);
  let checkpoint = false;
  if (selected) {
    state.modelId = selected.config.recordSha256; state.counters.eligibleCompleted++; state.counters.updates++; state.counters.baselineCount++;
    state.counters.baselineSum += completion.returnValue;
    if (completion.nonzeroPolicyGradient) state.counters.nonzeroPGUpdates++;
    if (state.control.dueBucket > state.control.fulfilledBucket) { state.control.fulfilledBucket = state.control.dueBucket; checkpoint = true; }
  }
  return { state, checkpoint };
}
function step(previous: TrainingState, selected: NativeRecord, cursor: Cursor): Step {
  const ordinal = previous.counters.started, master = previous.master, id = `m${master}-a${String(ordinal).padStart(4, "0")}`;
  const { descriptor, consumed } = nextAttempt(previous, id), rng = structuredClone(consumed.rng), directory = `${packet(master, ordinal)}/attempt-${id}`;
  const payloads = new Map<string, Uint8Array>(), events: { ordinal: number; kind: string; value: unknown }[] = [];
  const append = (kind: string, value: unknown): void => { events.push({ ordinal: events.length, kind, value }); };
  const started = { descriptor, rng: structuredClone(rng) }, deadline = ordinal === 99 || ordinal === 999;
  const candidateIds: string[] = [], opponentIds: string[] = [];
  let matchOrdinal = 2;
  append("started", started); append("initial", initialGame); append("native", opened);
  for (const side of planningSides(descriptor)) {
    const permit: PlanPermit = { version: "chess-coach.plan-permit.v1", attemptId: id, permitId: `${id}:plan:0:${side}`, planningOrdinal: 0,
      turn: opened.session.snapshot.turn, side, role: side === descriptor.schedule.candidateSide ? "candidate" : "strategic", issuedNs: "0", deadlineNs: "10000000000" };
    append("permit", permit);
    if (permit.role === "candidate") {
      if (deadline) {
        append("candidate-deadline", { permit, receipt: { exit: { ...cleanExit(), forced: true, exitCode: 137 }, groupGone: true, fault: false, frame: null }, observedNs: "10000000000" });
        break;
      }
      const draw = drawStream(rng["policy-sampling"]);
      append("decision-acked", { version: "chess-coach.decision.v1", attemptId: id, permitId: permit.permitId, planningOrdinal: 0, side, modelId: descriptor.modelId,
        historyDigest: historyDigests[side], featureVersion: "chess-coach.features.v1", enumerationVersion: "chess-coach.enumeration.v1",
        orderedCandidateDigest: sha("SYNTHETIC-NO-NATIVE-SCORES"), mode: "sample", selectedIndex: 0, selectedKey: "[]", actions: [], requestedSpend: { minerals: 0, gas: 0 },
        uniform: draw.uniform, selectedLogProbability: 0, samplingBefore: rng["policy-sampling"], samplingAfter: draw.after });
      rng["policy-sampling"] = draw.after; candidateIds.push(permit.permitId);
    } else {
      const draw = drawStream(rng.opponent);
      append("decision-acked", { version: "chess-coach.opponent.v1", attemptId: id, permitId: permit.permitId, planningOrdinal: 0, side,
        snapshotDigest: openedSnapshotDigest, actions: [], reportedMinSpend: 0, opponentBefore: rng.opponent, opponentAfter: draw.after });
      rng.opponent = draw.after; opponentIds.push(permit.permitId);
    }
    matchOrdinal++;
  }
  const stop = { reason: "candidate-native-rejection" as const, returnValue: -1 as const, side: descriptor.schedule.candidateSide, actionOrdinal: 0, code: "SC_SPECIAL" as const };
  if (!deadline) {
    append("native-rejection", { stop, plans: { w: [], b: [] }, boundaryOrdinal: 1 }); matchOrdinal++;
    append("complete", { version: "chess-coach.match.v1", attemptId: id, ordinal: matchOrdinal, kind: "complete", stop, boundaryOrdinal: 1,
      planningWindows: 0, recordedPlies: opened.native.kind === "opened" && opened.native.value.result.asResolve ? 1 : 0, candidateIds, opponentIds,
      recordedCount: descriptor.schedule.kind === "corpus" ? 1 : 0, recordedDigest: sha("[]"), rng });
    append("match-exit", cleanExit());
  }
  const proposal = deadline ? null : syntheticRecord(`SYNTHETIC-ONLY-NOT-A-NATIVE-MODEL:${id}`);
  append("learners-closed", proposal ? { kind: "proposed", parameterSha256: sha(`SYNTHETIC-PARAMETERS:${id}`), objective: -1 - descriptor.frozenBaseline } : { kind: "diagnostic" });
  const journal = Buffer.from(events.map(event => {
    const json = event.kind === "initial" ? initialEventJson : event.kind === "native" ? openedEventJson : JSON.stringify(event);
    return `{"recordOrdinal":${++cursor.ordinal},"attemptId":${JSON.stringify(id)},"event":${json}}`;
  }).join("\n") + "\n");
  cursor.hash.update(journal); cursor.byteLength += journal.byteLength;
  const history = histories[descriptor.schedule.candidateSide];
  const completion: CompletionValues = { reason: deadline ? "candidate-deadline" : stop.reason, returnValue: -1, sampledDecisions: candidateIds.length,
    nonzeroPolicyGradient: !!proposal && descriptor.frozenBaseline !== -1, rngAfter: rng,
    journalRef: { byteLength: cursor.byteLength, sha256: cursor.hash.copy().digest("hex"), lastRecordOrdinal: cursor.ordinal }, historyRef: ref(history), proposalRef: proposal ? ref(proposal.record) : null };
  payloads.set(`${directory}/000000-started-descriptor.bin`, encode(started)); payloads.set(`${directory}/000001-verified-journal.bin`, journal);
  payloads.set(`${directory}/000002-authorized-history.bin`, history);
  if (proposal) { payloads.set(`${directory}/000003-native-proposal.bin`, proposal.record); payloads.set(`${directory}/000004-proposal-config.bin`, encode(proposal.config)); }
  const next = advance(consumed, completion, proposal);
  return { row: { id, master, ordinal, descriptor: JSON.stringify(descriptor), status: "COMPLETED", completion: JSON.stringify(completion) },
    ...next, model: proposal ?? selected, payloads };
}

type Fixture = { masters: MasterRow[]; checkpoints: Map<number, CheckpointRow[]>; files: Map<string, Uint8Array>; result: CampaignResult; buildMs: number };
function fixture(): Fixture {
  const started = performance.now(), masters: MasterRow[] = [], checkpoints = new Map<number, CheckpointRow[]>(), files = new Map<string, Uint8Array>();
  const cursor: Cursor = { hash: createHash("sha256"), ordinal: 0, byteLength: 0 }, artifacts: { master: 101 | 102 | 103 | 104 | 105; artifactRef: ByteRef }[] = [];
  for (const [index, master] of MASTERS.entries()) {
    let selected = syntheticRecord(`SYNTHETIC-INITIAL-NOT-A-NATIVE-MODEL:${master}`), state = initialTrainingState(master, selected.config.recordSha256, expectedBindings);
    const initialDirectory = `${packet(master)}/attempt-initial-master-${master}`;
    files.set(`${initialDirectory}/000000-initial-native-record.bin`, selected.record); files.set(`${initialDirectory}/000001-initial-model-config.bin`, encode(selected.config));
    const rows: CheckpointRow[] = []; checkpoints.set(master, rows);
    for (let ordinal = 0; ordinal < 1000; ordinal++) {
      const next = step(state, selected, cursor); state = next.state; selected = next.model;
      if (next.checkpoint) rows.push({ master, epoch: ordinal + 1, state: JSON.stringify(state), config: JSON.stringify(selected.config), record: selected.record });
    }
    masters.push({ master, state: JSON.stringify(state), config: JSON.stringify(selected.config), record: selected.record, pending: null, status: "complete" });
    const config = encode(selected.config), artifact = encode({ version: "chess-coach.training-artifact.v1", status: "VALID", master, model: selected.config,
      recordRef: ref(selected.record), configRef: ref(config), counters: state.counters, finalJournalRef: state.journalRef, bindings: expectedBindings });
    files.set(finalPath(index, 0, "native"), selected.record); files.set(finalPath(index, 1, "config"), config); files.set(finalPath(index, 2, "artifact"), artifact);
    artifacts.push({ master, artifactRef: ref(artifact) });
  }
  const experiment = experimentShape.parse({ version: "chess-coach.training-experiment.v1", status: "COMPLETE", artifacts, primaryMaster: 101, primaryArtifactRef: artifacts[0]!.artifactRef });
  const raw = encode(experiment); files.set(`${finalDirectory}/000015-experiment-proposal.bin`, raw);
  return { masters, checkpoints, files, result: { experiment, ref: ref(raw) }, buildMs: performance.now() - started };
}
type Options = {
  control?: (value: ReturnType<CampaignReadback["control"]>) => void;
  master?: (row: MasterRow, index: number) => void;
  attempt?: (value: Step) => void;
  checkpoint?: (row: CheckpointRow, index: number) => void;
  read?: (path: string, value: Uint8Array, bound: number) => Uint8Array;
  missingAttempt?: number;
  extraAttempt?: boolean;
  masterCount?: number;
  missingCheckpoint?: boolean;
  extraCheckpoint?: boolean;
  throwClose?: boolean;
};
let base: Fixture;
beforeAll(() => { base = fixture(); }, 30000);
afterAll(() => {
  try { expect(spawn).not.toHaveBeenCalled(); expect(spawnSync).not.toHaveBeenCalled(); expect(network).not.toHaveBeenCalled(); }
  finally { spawn.mockRestore(); spawnSync.mockRestore(); network.mockRestore(); }
});
function reader(options: Options = {}) {
  let current = new Map<string, Uint8Array>(), closeCalls = 0, payloadPeak = 0, generated = 0;
  const cursor: Cursor = { hash: createHash("sha256"), ordinal: 0, byteLength: 0 };
  const result: CampaignReadback = {
    control() { const value = { bindings: structuredClone(expectedBindings), aborted: 0, failure: null as string | null }; options.control?.(value); return value; },
    *masters() {
      for (let index = 0; index < (options.masterCount ?? 5); index++) {
        const original = base.masters[Math.min(index, 4)]!, row = { ...original, master: 101 + index, record: Uint8Array.from(original.record) };
        options.master?.(row, index); yield row;
      }
    },
    *attempts(master) {
      let selected = syntheticRecord(`SYNTHETIC-INITIAL-NOT-A-NATIVE-MODEL:${master}`), state = initialTrainingState(master, selected.config.recordSha256, expectedBindings);
      let last: AttemptRow | undefined;
      for (let ordinal = 0; ordinal < 1000; ordinal++) {
        const next = step(state, selected, cursor); state = next.state; selected = next.model; generated++;
        options.attempt?.(next); current = next.payloads; payloadPeak = Math.max(payloadPeak, current.size); last = next.row;
        if (ordinal !== options.missingAttempt) yield next.row;
      }
      if (options.extraAttempt) yield last!;
      current = new Map();
    },
    *checkpoints(master) {
      const rows = base.checkpoints.get(master)!;
      for (const [index, original] of rows.entries()) {
        if (options.missingCheckpoint && index === 0) continue;
        const row = { ...original, record: Uint8Array.from(original.record) }; options.checkpoint?.(row, index); yield row;
      }
      if (options.extraCheckpoint) yield { ...rows.at(-1)!, epoch: 1000 };
    },
    read(path, bound) {
      const value = current.get(path) ?? base.files.get(path);
      if (!value) throw Object.assign(new Error("MISSING_SYNTHETIC_PAYLOAD"), { code: "ENOENT" });
      const copy = Uint8Array.from(value); return options.read ? options.read(path, copy, bound) : copy;
    },
    close() { closeCalls++; if (options.throwClose) throw new Error("SYNTHETIC_CLOSE_FAILURE"); },
  };
  return { reader: result, counts: () => ({ closeCalls, payloadPeak, generated }) };
}
function fail(options: Options, code?: string): CampaignEvidence {
  const env = reader(options), output = validateCampaignResult(base.result, env.reader, expectedBindings);
  expect(output.status).toBe("FAIL_CAMPAIGN_RETAINED_RESULT_VALIDATION"); expect(output.failures.length).toBeGreaterThan(0);
  expect(output.trainingExecutionAuthorized).toBe(false); expect(output.nativeScoresReplayed).toBe(false); expect(output.nativeRngReplayed).toBe(false);
  expect(Buffer.byteLength(JSON.stringify(output))).toBeLessThanOrEqual(1024 * 1024); expect(env.counts().closeCalls).toBe(1);
  if (code) expect(output.failures.join()).toContain(code);
  return output;
}
function editCompletion(value: Step, change: (completion: CompletionValues) => void): void {
  const completion: CompletionValues = JSON.parse(value.row.completion); change(completion); value.row.completion = JSON.stringify(completion);
}
function editDescriptor(value: Step, change: (descriptor: ReturnType<typeof nextAttempt>["descriptor"]) => void): void {
  const descriptor = JSON.parse(value.row.descriptor); change(descriptor); value.row.descriptor = JSON.stringify(descriptor);
}
function first(change: (value: Step) => void, master = 101, ordinal = 0): Options {
  return { attempt: value => { if (value.row.master === master && value.row.ordinal === ordinal) change(value); } };
}
function rewriteJournal(value: Step, change: (envelopes: any[]) => void): void {
  const path = [...value.payloads.keys()].find(path => path.endsWith("verified-journal.bin"))!;
  const envelopes = Buffer.from(value.payloads.get(path)!).toString().trimEnd().split("\n").map(line => JSON.parse(line));
  change(envelopes); value.payloads.set(path, Buffer.from(envelopes.map(value => JSON.stringify(value)).join("\n") + "\n"));
}

test("imports remain inert under process and network denial", () => {
  expect(typeof openCampaignReadback).toBe("function"); expect(typeof validateCampaignResult).toBe("function");
  expect(spawn).not.toHaveBeenCalled(); expect(spawnSync).not.toHaveBeenCalled(); expect(network).not.toHaveBeenCalled();
});
test("streams 5000 SYNTHETIC attempts with zero-PG changed proposals and delayed checkpoints", () => {
  const handoff: { modelId: string; proposalSha256: string; baseline: number; gradient: boolean }[] = [];
  const env = reader({ attempt: value => {
    if (value.row.master === 101 && value.row.ordinal < 2) {
      const descriptor = JSON.parse(value.row.descriptor), completion = JSON.parse(value.row.completion);
      handoff.push({ modelId: descriptor.modelId, proposalSha256: completion.proposalRef.sha256, baseline: descriptor.frozenBaseline, gradient: completion.nonzeroPolicyGradient });
    }
  } }), progress: number[] = [], started = performance.now();
  const output = validateCampaignResult(base.result, env.reader, expectedBindings, count => progress.push(count));
  expect(output.failures).toEqual([]); expect(output.status).toBe("PASS_CAMPAIGN_RETAINED_RESULT_VALIDATION");
  expect(output.attempts).toBe(5000); expect(output.masters.map(row => row.master)).toEqual([...MASTERS]);
  expect(output.masters.map(row => row.checkpoints)).toEqual([9, 9, 9, 9, 9]);
  expect(output.masters.every(row => row.counters.updates === 998 && row.counters.nonzeroPGUpdates === 1)).toBe(true);
  expect(output.masters.every(row => row.metrics.returnSum === -1000 && row.metrics.sampledDecisions === 998 &&
    row.metrics.reasons["candidate-native-rejection"] === 998 && row.metrics.reasons["candidate-deadline"] === 2 &&
    row.metrics.objectives.count === 998 && row.metrics.objectives.minimum === -1 && row.metrics.objectives.maximum === 0 &&
    row.metrics.parameterDigestChain?.byteLength === 998 * 76)).toBe(true);
  expect(output.nativeParameterDigestsRecomputed).toBe(false); expect(output.heldOutQualityMetrics).toBe("NOT_RECORDED");
  expect(handoff[1]!.modelId).toBe(handoff[0]!.proposalSha256); expect(handoff[1]!.proposalSha256).not.toBe(handoff[0]!.proposalSha256);
  expect(handoff.map(value => [value.baseline, value.gradient])).toEqual([[0, true], [-1, false]]);
  expect(JSON.parse(base.checkpoints.get(101)![0]!.state).control.fulfilledBucket).toBe(1); expect(base.checkpoints.get(101)![0]!.epoch).toBe(101);
  expect(progress.length).toBe(5000); expect(progress.every((value, index) => value === index + 1)).toBe(true);
  expect(env.counts()).toEqual({ closeCalls: 1, payloadPeak: 5, generated: 5000 });
  expect(output.startedDescriptorsRef!.byteLength).toBeGreaterThan(5000); expect(output.experimentRef).toEqual(base.result.ref);
  expect(output).toMatchObject({ scope: "LOCAL_RETAINED_RESULT_VALIDATION_ONLY", nativeScoresReplayed: false, nativeRngReplayed: false, trainingExecutionAuthorized: false });
  expect(Buffer.byteLength(JSON.stringify(output))).toBeLessThan(1024 * 1024);
  console.log("CAMPAIGN_EVIDENCE_SYNTHETIC_STREAM " + JSON.stringify({ buildMs: base.buildMs, validationMs: performance.now() - started,
    attempts: output.attempts, checkpoints: output.masters.reduce((sum, row) => sum + row.checkpoints, 0), reportBytes: Buffer.byteLength(JSON.stringify(output)), ...env.counts(), nativeExecuted: false }));
}, 60000);
for (const fault of ["SYNTHETIC_PROGRESS_FAILURE", "DEADLINE"]) test(`closes exactly once and returns bounded FAIL when progress throws ${fault}`, () => {
  const env = reader(), progress: number[] = [];
  const output = validateCampaignResult(base.result, env.reader, expectedBindings, count => { progress.push(count); if (count === 3) throw new Error(fault); });
  expect(progress).toEqual([1, 2, 3]); expect(output.failures).toEqual([`progress:${fault}`]);
  expect(output.status).toBe("FAIL_CAMPAIGN_RETAINED_RESULT_VALIDATION"); expect(env.counts().closeCalls).toBe(1);
  expect(Buffer.byteLength(JSON.stringify(output))).toBeLessThan(1024 * 1024);
});
test("close failure overturns an otherwise successful result", () => { fail({ throwClose: true }, "close:SYNTHETIC_CLOSE_FAILURE"); }, 60000);
test("both validation and close failures remain explicit", () => {
  const output = fail({ control: value => { value.aborted = 1; }, throwClose: true });
  expect(output.failures).toEqual(["control:CONTROL_UNSETTLED", "close:SYNTHETIC_CLOSE_FAILURE"]);
});
test("checks all fourteen expected bindings", () => {
  for (const key of Object.keys(expectedBindings) as (keyof typeof expectedBindings)[]) fail({ control: value => { value.bindings[key].sha256 = "f".repeat(64); } }, "CONTROL_BINDINGS");
});
test("rejects a missing expected binding", () => {
  const expected = structuredClone(expectedBindings); Reflect.deleteProperty(expected, "hostConfiguration");
  const env = reader(), output = validateCampaignResult(base.result, env.reader, expected); expect(output.failures).toEqual(["control:SCHEMA"]); expect(env.counts().closeCalls).toBe(1);
});
test("rejects a persisted failure", () => { fail({ control: value => { value.failure = "{}"; } }, "CONTROL_UNSETTLED"); });
test("checks completion scalar domains and required keys", () => {
  for (const [key, invalid] of [["reason", "unknown"], ["returnValue", 2], ["sampledDecisions", -1], ["sampledDecisions", 65],
    ["sampledDecisions", 0.5], ["nonzeroPolicyGradient", null]] as const) {
    fail(first(value => editCompletion(value, completion => { Reflect.set(completion, key, invalid); })), "COMPLETION_SCHEMA");
  }
  fail(first(value => editCompletion(value, completion => { Reflect.deleteProperty(completion, "reason"); })), "OBJECT_KEYS");
});
test("requires a nonzero policy-gradient update within each master", () => {
  fail({
    ...first(value => editCompletion(value, completion => { completion.nonzeroPolicyGradient = false; })),
    checkpoint: row => { const state = JSON.parse(row.state); state.counters.nonzeroPGUpdates = 0; row.state = JSON.stringify(state); },
  }, "MASTER_ATTEMPT_COUNT_GRADIENT");
}, 30000);

for (const [name, options, code] of [
  ["sixth master", { masterCount: 6 }, "MASTER_ROSTER_STATUS"], ["missing fifth master", { masterCount: 4 }, "CAMPAIGN_ROSTER"],
  ["reordered master", { master: (row: MasterRow, index: number) => { if (index === 0) row.master = 102; } }, "MASTER_ROSTER_STATUS"],
  ["incomplete master", { master: (row: MasterRow) => { row.status = "active"; } }, "MASTER_ROSTER_STATUS"],
  ["pending master", { master: (row: MasterRow) => { row.pending = "pending"; } }, "MASTER_ROSTER_STATUS"],
  ["missing attempt", { missingAttempt: 999 }, "MASTER_ATTEMPT_COUNT_GRADIENT"], ["extra attempt", { extraAttempt: true }, "ATTEMPT_ROSTER_STATUS"],
  ["missing checkpoint", { missingCheckpoint: true }, "CHECKPOINT_EPOCH"], ["extra checkpoint", { extraCheckpoint: true }, "CHECKPOINT_EXTRA"],
  ["checkpoint epoch", { checkpoint: (row: CheckpointRow) => { row.epoch++; } }, "CHECKPOINT_EPOCH"],
  ["checkpoint state", { checkpoint: (row: CheckpointRow) => { const state = JSON.parse(row.state); state.counters.baselineSum++; row.state = JSON.stringify(state); } }, "CHECKPOINT_STATE"],
  ["checkpoint record", { checkpoint: (row: CheckpointRow) => { row.record[0]! ^= 1; } }, "MODEL_HASH"],
  ["master state counters", { master: (row: MasterRow) => { const state = JSON.parse(row.state); state.counters.baselineSum++; row.state = JSON.stringify(state); } }, "MASTER_STATE"],
  ["master record", { master: (row: MasterRow) => { row.record[0]! ^= 1; } }, "MODEL_HASH"],
  ["master config", { master: (row: MasterRow) => { row.config = JSON.stringify(syntheticRecord("SYNTHETIC-OTHER").config); } }, "MODEL_HASH"],
] satisfies [string, Options, string][]) test(`rejects ${name}`, () => { fail(options, code); }, 60000);

for (const [name, change, code, ordinal] of [
  ["attempt identity", (value: Step) => { value.row.id = "wrong"; }, "ATTEMPT_ROSTER_STATUS", 0],
  ["attempt ordinal", (value: Step) => { value.row.ordinal++; }, "ATTEMPT_ROSTER_STATUS", 0],
  ["attempt master", (value: Step) => { value.row.master++; }, "ATTEMPT_ROSTER_STATUS", 0],
  ["attempt status", (value: Step) => { value.row.status = "ABORTED"; }, "ATTEMPT_ROSTER_STATUS", 0],
  ["descriptor model handoff", (value: Step) => editDescriptor(value, item => { item.modelId = "f".repeat(64); }), "DESCRIPTOR_REPLAY", 1],
  ["frozen baseline", (value: Step) => editDescriptor(value, item => { item.frozenBaseline = 0; }), "DESCRIPTOR_REPLAY", 1],
  ["baseline-equal nonzero gradient", (value: Step) => editCompletion(value, item => { item.nonzeroPolicyGradient = true; }), "FROZEN_BASELINE_GRADIENT", 1],
  ["noncore return", (value: Step) => editCompletion(value, item => { item.returnValue = 1; }), "NONCORE_RETURN", 0],
  ["proposal missing reference", (value: Step) => editCompletion(value, item => { item.proposalRef = null; }), "PROPOSAL_DOMAIN", 0],
  ["diagnostic proposal reference", (value: Step) => editCompletion(value, item => { item.proposalRef = ref(encode("extra")); }), "PROPOSAL_DOMAIN", 99],
  ["diagnostic gradient", (value: Step) => editCompletion(value, item => { item.nonzeroPolicyGradient = true; }), "PROPOSAL_DOMAIN", 99],
  ["proposal stale digest", (value: Step) => editCompletion(value, item => { item.proposalRef!.sha256 = "f".repeat(64); }), "PROPOSAL_REF", 0],
  ["proposal stale length", (value: Step) => editCompletion(value, item => { item.proposalRef!.byteLength++; }), "PROPOSAL_REF", 0],
  ["history stale digest", (value: Step) => editCompletion(value, item => { item.historyRef.sha256 = "f".repeat(64); }), "HISTORY_REF", 0],
  ["history stale length", (value: Step) => editCompletion(value, item => { item.historyRef.byteLength++; }), "HISTORY_REF", 0],
  ["journal stale digest", (value: Step) => editCompletion(value, item => { item.journalRef.sha256 = "f".repeat(64); }), "CUMULATIVE_JOURNAL_REF", 0],
  ["journal stale length", (value: Step) => editCompletion(value, item => { item.journalRef.byteLength++; }), "CUMULATIVE_JOURNAL_REF", 0],
  ["journal stale ordinal", (value: Step) => editCompletion(value, item => { item.journalRef.lastRecordOrdinal++; }), "CUMULATIVE_JOURNAL_REF", 0],
  ["policy RNG draw count", (value: Step) => editCompletion(value, item => { item.rngAfter["policy-sampling"] = drawStream(item.rngAfter["policy-sampling"]).after; }), "RNG_PROGRESS", 0],
  ["opponent RNG progression", (value: Step) => editCompletion(value, item => { item.rngAfter.opponent = drawStream(item.rngAfter.opponent).after; }), "COMPLETION_RNG", 1],
  ["policy RNG root", (value: Step) => editCompletion(value, item => { item.rngAfter["policy-sampling"].root ^= 1; }), "SCHEMA", 0],
  ["completion extra keys", (value: Step) => { value.row.completion = value.row.completion.replace("{", '{"extra":true,'); }, "OBJECT_KEYS", 0],
  ["descriptor extra keys", (value: Step) => { value.row.descriptor = value.row.descriptor.replace("{", '{"extra":true,'); }, "SCHEMA", 0],
  ["envelope global ordinal", (value: Step) => rewriteJournal(value, lines => { lines[0].recordOrdinal++; }), "JOURNAL_ORDINAL", 0],
  ["envelope attempt binding", (value: Step) => rewriteJournal(value, lines => { lines[0].attemptId = "other"; }), "JOURNAL_ORDINAL", 0],
  ["event ordinal", (value: Step) => rewriteJournal(value, lines => { lines[1].event.ordinal++; }), "JOURNAL_ORDINAL", 0],
  ["candidate RNG state", (value: Step) => rewriteJournal(value, lines => { lines.find(line => line.event.kind === "decision-acked").event.value.samplingAfter.state ^= 1; }), "SCHEMA", 0],
  ["retained raw record digest", (value: Step) => rewriteJournal(value, lines => { const bank = lines.find(line => line.event.kind === "native").event.value.record.bank; bank.w = bank.w === 12 ? 11 : bank.w + 1; }), "JOURNAL_RECORD_HASH", 0],
] satisfies [string, (value: Step) => void, string, number][]) test(`rejects ${name}`, () => { fail(first(change, 101, ordinal), code); }, 30000);

test("never resets cumulative journal hash or byte count at the second master", () => {
  fail(first(value => editCompletion(value, completion => {
    const segment = [...value.payloads.entries()].find(([path]) => path.endsWith("verified-journal.bin"))![1];
    completion.journalRef = { ...ref(segment), lastRecordOrdinal: Buffer.from(segment).toString().trimEnd().split("\n").length };
  }), 102), "CUMULATIVE_JOURNAL_REF");
}, 30000);
test("never resets global record ordinals at the second master", () => {
  fail(first(value => rewriteJournal(value, lines => { lines.forEach((line, index) => { line.recordOrdinal = index + 1; }); }), 102), "JOURNAL_ORDINAL");
}, 30000);

for (const [name, suffix, replacement, code] of [
  ["initial record", "initial-native-record.bin", Buffer.from("CHANGED"), "MODEL_HASH"],
  ["initial config", "initial-model-config.bin", encode({}), "SCHEMA"],
  ["started descriptor", "started-descriptor.bin", encode({}), "STARTED_ARTIFACT"],
  ["history root is not a GameRecord", "authorized-history.bin", encode(opened.record), "HISTORY_REF"],
  ["proposal record", "native-proposal.bin", Buffer.from("CHANGED"), "MODEL_HASH"],
  ["proposal config", "proposal-config.bin", encode({}), "SCHEMA"],
  ["final native record", "000000-native-101.bin", Buffer.from("CHANGED"), "MODEL_HASH"],
  ["final config", "000001-config-101.bin", encode({}), "SCHEMA"],
  ["final artifact", "000002-artifact-101.bin", encode({}), "FINAL_ARTIFACT_REF"],
  ["experiment raw bytes", "experiment-proposal.bin", encode({}), "EXPERIMENT_REF"],
] as const) test(`rejects changed ${name}`, () => { fail({ read: (path, value) => path.endsWith(suffix) ? replacement : value }, code); }, 30000);

test("checks the authorized history schema after a coherent raw hash rebind", () => {
  fail(first(value => {
    const path = [...value.payloads.keys()].find(path => path.endsWith("authorized-history.bin"))!, raw = encode([opened.record]);
    value.payloads.set(path, raw); editCompletion(value, completion => { completion.historyRef = ref(raw); });
  }), "SCHEMA");
});
test("hashes history bytes without normalizing JSON key order", () => {
  const output = fail(first(value => {
    const path = [...value.payloads.keys()].find(path => path.endsWith("authorized-history.bin"))!, raw = JSON.parse(Buffer.from(value.payloads.get(path)!).toString());
    raw[0] = Object.fromEntries(Object.entries(raw[0]).reverse()); value.payloads.set(path, encode(raw));
  }), "HISTORY_REF");
  expect(output.attempts).toBe(0);
});
test("rejects retained proposal bytes on a zero-sample attempt", () => {
  fail(first(value => {
    const directory = [...value.payloads.keys()][0]!.split("/").slice(0, -1).join("/");
    value.payloads.set(`${directory}/000003-native-proposal.bin`, Buffer.from("EXTRA"));
  }, 101, 99), "UNEXPECTED_PROPOSAL_PAYLOAD");
});
test("checks returned experiment equality independently of the persisted experiment hash", () => {
  const returned = structuredClone(base.result); returned.experiment.artifacts[1]!.artifactRef.sha256 = "f".repeat(64);
  const env = reader(), output = validateCampaignResult(returned, env.reader, expectedBindings);
  expect(output.failures.join()).toContain("RETURNED_EXPERIMENT"); expect(env.counts().closeCalls).toBe(1);
});
test("checks primary master and experiment completion status", () => {
  for (const change of [(result: any) => { result.experiment.primaryMaster = 102; }, (result: any) => { result.experiment.status = "STARTED"; }]) {
    const returned = structuredClone(base.result); change(returned); const env = reader();
    expect(validateCampaignResult(returned, env.reader, expectedBindings).failures).toEqual(["experiment:SCHEMA"]); expect(env.counts().closeCalls).toBe(1);
  }
});
test("checks final artifact semantics even after rebinding artifact and experiment hashes", () => {
  const files = new Map(base.files), returned = structuredClone(base.result), path = finalPath(0, 2, "artifact"), raw = JSON.parse(Buffer.from(files.get(path)!).toString());
  raw.counters.baselineSum++; const artifact = encode(raw); files.set(path, artifact); returned.experiment.artifacts[0]!.artifactRef = ref(artifact);
  returned.experiment.primaryArtifactRef = ref(artifact); const experiment = encode(returned.experiment); returned.ref = ref(experiment);
  files.set(`${finalDirectory}/000015-experiment-proposal.bin`, experiment);
  const env = reader({ read: (path, value) => files.get(path) ?? value }), output = validateCampaignResult(returned, env.reader, expectedBindings);
  expect(output.failures.join()).toContain("FINAL_ARTIFACT"); expect(env.counts().closeCalls).toBe(1);
}, 30000);

for (const [label, options, code] of [
  ["state", { master: (row: MasterRow) => { row.state = "{".repeat(STORAGE_BOUNDS.historyBytes + 1); } }, "STATE_BOUND"],
  ["record", { master: (row: MasterRow) => { row.record = new Uint8Array(STORAGE_BOUNDS.nativeRecordBytes + 1); } }, "RECORD_BOUND"],
  ["config", { master: (row: MasterRow) => { row.config = "{".repeat(4097); } }, "CONFIG_BOUND"],
  ["descriptor", first(value => { value.row.descriptor = "{".repeat(4097); }), "DESCRIPTOR_BOUND"],
  ["completion", first(value => { value.row.completion = "{".repeat(4097); }), "COMPLETION_BOUND"],
  ["checkpoint state", { checkpoint: (row: CheckpointRow) => { row.state = "{".repeat(STORAGE_BOUNDS.historyBytes + 1); } }, "CHECKPOINT_STATE_BOUND"],
] satisfies [string, Options, string][]) test(`bounds ${label} before parsing`, () => { fail(options, code); }, 30000);
test("checks UTF-8 field byte length before parsing", () => { fail(first(value => { value.row.descriptor = "é".repeat(2049); }), "DESCRIPTOR_BOUND"); });
test("rejects malformed UTF-8 and missing journal line termination", () => {
  fail({ read: (path, value) => path.endsWith("started-descriptor.bin") ? Uint8Array.of(255) : value });
  fail({ read: (path, value) => path.endsWith("verified-journal.bin") ? value.subarray(0, value.byteLength - 1) : value }, "JOURNAL_LINES");
});
for (const suffix of ["initial-native-record.bin", "initial-model-config.bin", "started-descriptor.bin", "verified-journal.bin", "authorized-history.bin", "native-proposal.bin", "proposal-config.bin", "experiment-proposal.bin"]) {
  test(`rejects a reader exceeding the ${suffix} file bound`, () => {
    fail({ read: (path, value, bound) => path.endsWith(suffix) ? new Uint8Array(bound + 1) : value }, "PAYLOAD_BOUND");
  });
}
test("rejects a retained SQLite database with a non-4096 page size", () => {
  const root = repositoryScratch("campaign-evidence-pages-"), db = new Database(join(root, "private.sqlite"), { create: true, strict: true });
  try { db.run("PRAGMA page_size=512; CREATE TABLE synthetic_capacity_only (id INTEGER PRIMARY KEY) STRICT;"); }
  finally { db.close(); }
  expect(() => openCampaignReadback(root)).toThrow("READBACK_DATABASE_PAGES");
});

test("repository-local SQLite holds 5000 rows, 50 full checkpoints, and five 582144-byte synthetic records under unchanged 64 MiB admission", () => {
  const started = performance.now(), root = repositoryScratch("campaign-evidence-capacity-"), path = join(root, "private.sqlite");
  const schema = new TrainingStore(path, expectedBindings); schema.close();
  const db = new Database(path, { readwrite: true, create: false, strict: true });
  const record = new Uint8Array(582144).fill(83), selected: NativeRecord = { config: { ...syntheticRecord("SYNTHETIC-CAPACITY-NOT-A-NATIVE-MODEL").config, recordSha256: sha(record) }, record };
  let pages = 0;
  try {
    db.run("PRAGMA page_size=4096; PRAGMA max_page_count=16384; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE;");
    db.transaction(() => {
      for (const master of MASTERS) {
        let state = initialTrainingState(master, selected.config.recordSha256, expectedBindings);
        db.run("INSERT INTO masters VALUES (?,?,?,?,NULL,'active')", [master, JSON.stringify(state), JSON.stringify(selected.config), selected.record]);
        for (let ordinal = 0; ordinal < 1000; ordinal++) {
          const id = `m${master}-a${String(ordinal).padStart(4, "0")}`, next = nextAttempt(state, id), completion = syntheticCompletion(next.consumed, 1, -1, selected);
          const advanced = advance(next.consumed, completion, selected); state = advanced.state;
          db.run("INSERT INTO attempts VALUES (?,?,?,?,'COMPLETED',?)", [id, master, ordinal, JSON.stringify(next.descriptor), JSON.stringify(completion)]);
          if (advanced.checkpoint) db.run("INSERT INTO checkpoints VALUES (?,?,?,?,?)", [master, ordinal + 1, JSON.stringify(state), JSON.stringify(selected.config), selected.record]);
        }
        db.run("UPDATE masters SET state=?,status='complete' WHERE master=?", [JSON.stringify(state), master]);
      }
    }).immediate();
    pages = db.query<{ page_count: number }, []>("PRAGMA page_count").get()!.page_count;
    expect(db.query<{ max_page_count: number }, []>("PRAGMA max_page_count").get()!.max_page_count).toBe(16384);
    expect(db.query<{ page_size: number }, []>("PRAGMA page_size").get()!.page_size).toBe(4096);
    expect(db.query<{ count: number }, []>("SELECT count(*) AS count FROM attempts").get()!.count).toBe(5000);
    expect(db.query<{ count: number }, []>("SELECT count(*) AS count FROM checkpoints").get()!.count).toBe(50);
  } finally { db.close(); }
  const byteLength = statSync(path).size, beforeHash = sha(readFileSync(path)), readback = openCampaignReadback(root);
  try {
    expect(readback.control()).toEqual({ bindings: expectedBindings, aborted: 0, failure: null });
    let masterCount = 0, attemptCount = 0, checkpointCount = 0;
    for (const master of readback.masters()) {
      masterCount++; expect(master.record.byteLength).toBe(582144); expect(JSON.parse(master.state).historyRefs.length).toBe(1000);
      for (const _attempt of readback.attempts(master.master)) attemptCount++;
      for (const checkpoint of readback.checkpoints(master.master)) { checkpointCount++; expect(checkpoint.record.byteLength).toBe(582144); expect(JSON.parse(checkpoint.state).historyRefs.length).toBe(checkpoint.epoch); }
    }
    expect({ masterCount, attemptCount, checkpointCount }).toEqual({ masterCount: 5, attemptCount: 5000, checkpointCount: 50 });
    writeFileSync(join(root, "small.bin"), "small"); expect(Buffer.from(readback.read("small.bin", 5)).toString()).toBe("small");
    expect(() => readback.read("small.bin", 4)).toThrow("READBACK_FILE_BOUND");
    for (const invalid of ["../private.sqlite", "/etc/passwd", "./small.bin", "a/../small.bin", "small.bin\0"]) expect(() => readback.read(invalid, 32)).toThrow("READBACK_RELATIVE_PATH");
    expect(() => readback.read("small.bin", STORAGE_BOUNDS.journalSegmentBytes + 1)).toThrow("READBACK_RELATIVE_PATH");
    symlinkSync(join(root, "small.bin"), join(root, "linked.bin")); expect(() => readback.read("linked.bin", 5)).toThrow();
    mkdirSync(join(root, "directory")); symlinkSync(join(root, "directory"), join(root, "linked-directory"));
    expect(() => readback.read("linked-directory/missing.bin", 5)).toThrow("READBACK_DIRECTORY");
  } finally { readback.close(); }
  expect(() => readback.control()).toThrow("READBACK_CLOSED"); expect(sha(readFileSync(path))).toBe(beforeHash);
  expect(byteLength).toBeLessThan(64 * 1024 * 1024); expect(pages).toBeLessThanOrEqual(16384);
  const mutation = new Database(path, { readwrite: true, create: false, strict: true });
  try { mutation.run("UPDATE attempts SET completion=? WHERE master=101 AND ordinal=0", [JSON.stringify("x".repeat(4097))]); }
  finally { mutation.close(); }
  expect(() => openCampaignReadback(root)).toThrow("READBACK_ROW_BOUND");
  console.log("CAMPAIGN_EVIDENCE_SQLITE_CAPACITY " + JSON.stringify({ scope: "SYNTHETIC_SQLITE_CAPACITY_ONLY", elapsedMs: performance.now() - started,
    byteLength, pages, pageSize: 4096, maxPages: 16384, masters: 5, attempts: 5000, checkpoints: 50, recordBytes: 582144, nativeExecuted: false, fullPipelineExecuted: false }));
}, 30000);
