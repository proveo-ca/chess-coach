// SPEC: _spec/runtime-protocol.puml
import { createHash } from "node:crypto";
import { isDeepStrictEqual as same } from "node:util";
import { modelConfigShape } from "../../../packages/contracts/src/learning-channel";
import { checkNativeBoundary, nativeBoundaryShape } from "../../../packages/contracts/src/native-protocol";
import { bindingsShape, byteRefShape } from "../../../packages/contracts/src/training-state";
import type { TrainingBindings, TrainingState } from "../../../packages/contracts/src/training-state";
import { checkTrainingState, initialTrainingState, nextAttempt } from "../../../packages/runtime/src/curriculum";
import { qualificationBootstrapPlan } from "../qualification-bootstrap.ts";
import type { BootstrapReceipt } from "../qualification-bootstrap.ts";
import { QUALIFICATION_LIMITS, REFERENCE_FILES } from "../qualification-operator.ts";
import type { PreparedInputManifest } from "../qualification-operator.ts";
import type { QualificationEvidence } from "../qualification-evidence.ts";
import type { observeCanonical } from "../qualification.ts";
import type { R4ModelObservation, R4Observation, R4StateObservation } from "../r4-observation.ts";
import { inspectQualificationReports, PUBLICATION } from "./validate.ts";

export type ReadbackInput = Record<"bootstrap" | "operator" | "canonical" | "r4" | "functional" | "preparation" |
  "manifest" | "sourceManifest" | "bindingDocuments", Uint8Array>;
type Canonical = Awaited<ReturnType<typeof observeCanonical>>;
type SourceManifest = { fileCount: number; byteLength: number; files: PreparedInputManifest["source"] };
type BindingDocuments = { scope: string; documents: PreparedInputManifest["documents"] };
const MIB = 1048576, plan = qualificationBootstrapPlan();
const sha = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const ref = (bytes: Uint8Array | string) => ({ byteLength: typeof bytes === "string" ? Buffer.byteLength(bytes) : bytes.byteLength, sha256: sha(bytes) });
const jsonRef = (value: unknown) => ref(JSON.stringify(value));
function requireValue(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
function equal(actual: unknown, expected: unknown, code: string): void { requireValue(same(actual, expected), code); }
function parse<T>(bytes: Uint8Array): T {
  requireValue(bytes instanceof Uint8Array && bytes.byteLength > 0 && bytes.byteLength <= MIB, "JSON_BOUND");
  const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes));
  requireValue(value && typeof value === "object" && !Array.isArray(value), "JSON_OBJECT"); return value as T;
}
function ns(value: string): bigint { requireValue(typeof value === "string" && /^(0|[1-9][0-9]{0,24})$/.test(value), "NS_FORMAT"); return BigInt(value); }
function integer(value: number, minimum: number, maximum: number): boolean { return Number.isSafeInteger(value) && value >= minimum && value <= maximum; }
function safe(path: string): boolean { return typeof path === "string" && path.length <= 512 && !/[\\\0,]/.test(path) && path.split("/").every(p => p && p !== "." && p !== ".."); }
function natural(value: { stdinClosed: boolean; stdoutEof: boolean; stderrEof: boolean; reaped: boolean; exitCode: number | null; forced: boolean } | null): void {
  requireValue(value && value.stdinClosed === true && value.stdoutEof === true && value.stderrEof === true && value.reaped === true && value.exitCode === 0 && value.forced === false, "NATURAL_FINISH");
}
function model(value: R4ModelObservation | null): R4ModelObservation {
  requireValue(value, "MODEL_METADATA"); const config = modelConfigShape.parse(value.config), record = byteRefShape.parse(value.recordRef);
  equal(value.configRef, jsonRef(config), "CONFIG_REF"); requireValue(record.byteLength > 0 && record.byteLength <= MIB && record.sha256 === config.recordSha256 &&
    config.architecture === "mlp-relu-32" && config.inputFeatures === 2271 && config.hiddenUnits === 32, "MODEL_CONFIG_BINDING"); return value;
}
function state(value: R4StateObservation | null, bindings: TrainingBindings): TrainingState {
  requireValue(value, "STATE_METADATA"); const parsed = checkTrainingState(value.state);
  equal(value.serializedStateRef, jsonRef(parsed), "STATE_REF"); equal(parsed.bindings, bindings, "STATE_BINDINGS");
  requireValue(parsed.master === 101 && parsed.initializationSeed === 101, "STATE_MASTER"); return parsed;
}
export function inspectRetainedReadback(input: ReadbackInput) {
  const checks: { id: string; status: "PASS" | "FAIL"; error: string | null }[] = [];
  const verify = (id: string, action: () => void) => { try { action(); checks.push({ id, status: "PASS", error: null }); }
    catch (error) { checks.push({ id, status: "FAIL", error: error instanceof Error ? error.message.slice(0, 160) : "INVALID_INPUT" }); } };
  let b!: BootstrapReceipt, c!: Canonical, r!: R4Observation, f!: QualificationEvidence, p!: BootstrapReceipt;
  let m!: PreparedInputManifest, source!: SourceManifest, docs!: BindingDocuments, bindings!: TrainingBindings;
  verify("bounded-json-documents", () => {
    b = parse(input.bootstrap); c = parse(input.canonical); r = parse(input.r4); f = parse(input.functional);
    p = parse(input.preparation); m = parse(input.manifest); source = parse(input.sourceManifest); docs = parse(input.bindingDocuments);
  });
  verify("operator-and-bootstrap-consistency", () => requireValue(inspectQualificationReports(input.bootstrap, input.operator).status === "PASS_LOCAL_TRANSCRIPTION_CONSISTENCY_ONLY", "OPERATOR_CONSISTENCY"));
  verify("immutable-source3-document-pins", () => {
    equal(ref(input.sourceManifest), { byteLength: plan.contract.documents[0]!.byteLength, sha256: plan.contract.documents[0]!.sha256 }, "SOURCE3_MANIFEST");
    equal(ref(input.bindingDocuments), { byteLength: plan.contract.documents[2]!.byteLength, sha256: plan.contract.documents[2]!.sha256 }, "SOURCE3_BINDINGS");
    requireValue(source.fileCount === 108 && source.files.length === 108 && source.byteLength === 641523 && source.files.reduce((n, row) => n + row.byteLength, 0) === 641523, "SOURCE3_COUNTS");
  });
  verify("manifest-fourteen-bindings-and-nine-reference-rows", () => {
    requireValue(m.version === "chess-coach.qualification-inputs.v1" && docs.scope === "FOURTEEN_ACTUAL_DOCUMENT_REFS_NOT_STAGED_NOT_EXECUTION_AUTHORITY" &&
      m.documents.length === 14 && new Set(m.documents.map(d => d.role)).size === 14, "DOCUMENT_MEMBERSHIP");
    equal(m.documents, docs.documents, "DOCUMENT_REFS"); equal(m.reference, REFERENCE_FILES, "REFERENCE_ROWS");
    bindings = bindingsShape.parse(Object.fromEntries(m.documents.map(d => [d.role, { byteLength: d.source.byteLength, sha256: d.source.sha256 }])));
  });
  verify("manifest-source-and-dependency-inventory", () => {
    requireValue(Array.isArray(m.source) && integer(m.source.length, 108, 4096) && new Set(m.source.map(row => row.path)).size === m.source.length, "PHYSICAL_MEMBERSHIP");
    let total = 0; for (const row of m.source) { requireValue(safe(row.path), "PHYSICAL_PATH"); byteRefShape.parse({ byteLength: row.byteLength, sha256: row.sha256 });
      requireValue(integer(row.byteLength, 1, 16 * MIB) && (total += row.byteLength) <= 128 * MIB, "PHYSICAL_BOUND"); }
    const byPath = new Map(m.source.map(row => [row.path, row]));
    for (const row of source.files) equal(byPath.get(row.path), row, "WORKER_SOURCE_REF");
    const code = new Set(source.files.map(row => row.path)), dependencies = m.source.filter(row => !code.has(row.path));
    requireValue(dependencies.length > 0 && dependencies.every(row => row.path.startsWith("node_modules/zod/")) && byPath.has("node_modules/zod/package.json"), "DEPENDENCY_INVENTORY");
  });
  verify("preparation-manifest-and-builder-join", () => {
    requireValue(p.version === "chess-coach.qualification-bootstrap.v1" && p.phase === "preparation" && p.scope === plan.scope && p.status === "PASS" &&
      p.publicationCommit === PUBLICATION && p.referenceBuilds === 6 && p.qualified === false && p.trainingReady === false && p.preparationReceipt === null &&
      same(p.failures, []) && p.commands.length === 1, "PREPARATION_STATUS");
    const manifestRef = { path: `${plan.inputs}/qualification-inputs/input-manifest.json`, ...ref(input.manifest) };
    equal(p.inputManifest, manifestRef, "PREPARATION_MANIFEST_REF"); equal(b.inputManifest, manifestRef, "BOOTSTRAP_MANIFEST_REF");
    equal(b.preparationReceipt, { path: `${plan.delivery}/preparation-receipt.json`, ...ref(input.preparation) }, "PREPARATION_RECEIPT_REF");
    const command = p.commands[0]!, result = command.result;
    equal(command.argv, [plan.bun, "--no-env-file", "--no-install", `${plan.source}/tooling/build-reference.ts`, `${plan.delivery}/reference-source`, `${plan.delivery}/reference-bundles`], "BUILDER_ARGV");
    requireValue(command.cwd === plan.source && Number.isFinite(command.deadlineMs) && command.deadlineMs >= plan.preparationMs &&
      command.cleanupDeadlineMs === command.deadlineMs + plan.cleanupMs && result.exitCode === 0 && result.signal === null && result.exited === true &&
      result.reaped === true && result.stdoutEOF === true && result.stderrEOF === true && result.forced === false && result.error === null, "BUILDER_LIFECYCLE");
    for (const [name, row] of [["stdout", command.stdout], ["stderr", command.stderr]] as const) {
      requireValue(row.path === `${plan.delivery}/logs/reference-builder.${name}` && integer(row.byteLength, 0, MIB) && /^[a-f0-9]{64}$/.test(row.sha256), "BUILDER_LOG_REF");
    }
    equal(b.commands[4]!.stdout, { path: `${plan.delivery}/logs/prepare-worker.stdout`, ...ref("Executor: " + new TextDecoder().decode(input.preparation)) }, "PREPARATION_STDOUT_REF");
  });
  verify("canonical-real-status-and-original-timing", () => {
    const t = c.receipt;
    requireValue(c.status === "PASS" && c.error === null && t.execution === "REAL" && t.scope === "FIXED_NATIVE_PROOF_ONLY" && t.success === true &&
      t.phase === "complete" && same(t.failures, []) && t.cleanup === "NOT_REQUESTED" && t.trainingExecuted === false && t.trainingReady === false &&
      t.hostProofQualified === false && t.independentReferenceQualified === false && t.referenceInputDelivery === "REFERENCE_INPUT_DELIVERY_UNSELECTED", "CANONICAL_STATUS");
    requireValue(ns(t.workDeadlineNs!) === ns(t.originNs!) + 10000000000n && ns(t.cleanupDeadlineNs!) === ns(t.originNs!) + 300000000000n, "CANONICAL_TIMING");
    for (const frame of [t.boot, t.start, t.reply]) { requireValue(frame && integer(frame.bytes, 1, MIB), "CANONICAL_FRAME"); equal({ byteLength: frame.bytes, sha256: frame.sha256 }, ref(frame.json), "CANONICAL_FRAME_REF"); }
  });
  verify("canonical-both-boundaries-and-completion-digests", () => {
    requireValue(c.receipt.boundaries.length === 3, "BOUNDARY_COUNT");
    c.receipt.boundaries.forEach((row, i) => {
      const parsed = nativeBoundaryShape.parse(row.boundary); checkNativeBoundary(parsed);
      requireValue(parsed.kind === ["initial", "opened", "settled"][i], "BOUNDARY_KIND");
      equal({ byteLength: row.bytes, sha256: row.sha256 }, jsonRef(parsed), "BOUNDARY_REF"); requireValue(row.digest === row.sha256, "BOUNDARY_DIGEST");
    });
    const reply = JSON.parse(c.receipt.reply!.json) as { kind: string; boundaries: string[] };
    requireValue(reply.kind === "native-proof-complete", "COMPLETION_KIND"); equal(reply.boundaries, c.receipt.boundaries.map(row => row.digest), "COMPLETION_BOUNDARIES");
  });
  verify("canonical-fourteen-exchanges-two-natural-finishes", () => {
    const t = c.receipt, operations = ["init", "commit", "open", "commit", "settle", "commit", "close"];
    requireValue(t.exchanges.length === 14 && t.lifecycle.length === 2, "CANONICAL_COUNTS");
    for (const [index, role] of (["main", "reference"] as const).entries()) {
      const lifecycle = t.lifecycle[index]!; requireValue(lifecycle.role === role && lifecycle.finishError === null && lifecycle.terminateCalls === 0 && lifecycle.terminateError === null, "CANONICAL_LIFECYCLE"); natural(lifecycle.finish);
      const peer = t.exchanges.filter(e => e.role === role), other = t.exchanges.filter(e => e.role !== role); requireValue(peer.length === 7 && other.length === 7, "PEER_EXCHANGES");
      peer.forEach((e, ordinal) => {
        const reply = e.reply, boundary = t.boundaries[Math.floor(ordinal / 2)];
        requireValue(e.operation === operations[ordinal] && e.ordinal === ordinal && e.cursor === [-1, -1, 0, 0, 1, 1, 2][ordinal] && e.error === undefined && reply &&
          reply.role === role && reply.ordinal === ordinal && reply.cursor === [-1, 0, 0, 1, 1, 2, 2][ordinal] &&
          reply.kind === (ordinal === 6 ? "closed" : ordinal % 2 ? "committed" : "staged") && ns(reply.receivedNs) >= ns(t.originNs!) && ns(reply.receivedNs) < ns(t.workDeadlineNs!), "EXCHANGE_METADATA");
        for (const frame of [e.request, reply]) requireValue(integer(frame.bytes, 1, MIB) && /^[a-f0-9]{64}$/.test(frame.sha256), "EXCHANGE_FRAME_REF");
        requireValue(e.stagedCursor === (ordinal % 2 && ordinal < 6 ? Math.floor(ordinal / 2) : null) && e.requestDigest === (ordinal % 2 && ordinal < 6 ? boundary!.digest : null) &&
          reply.stagedCursor === (ordinal % 2 === 0 && ordinal < 6 ? ordinal / 2 : null) && reply.digest === (ordinal < 6 ? boundary!.digest : null), "EXCHANGE_BOUNDARY_JOIN");
        equal(e.request, other[ordinal]!.request, "PAIRED_REQUEST_REF");
      });
    }
    equal(c.observed, { exchangeCount: 14, boundaryKinds: ["initial", "opened", "settled"], peers: t.lifecycle.map(({ role, finish }) => ({ role, operations, finish })) }, "CANONICAL_SUMMARY");
  });
  verify("functional-summary-and-native-counts", () => {
    requireValue(f.status === "PASS_RETAINED_FUNCTIONAL_EVIDENCE" && f.scope === "INPUTS_UNATTESTED_FUNCTIONAL_EVIDENCE_ONLY" && f.qualified === false && same(f.failures, []) && f.proof, "FUNCTIONAL_STATUS");
    equal(f.proof.canonical, { exchanges: 14, boundaries: 3, naturalFinishes: 2, executionLabel: "REAL" }, "FUNCTIONAL_CANONICAL");
    const n = f.proof.native;
    requireValue(f.proof.attempts.length === 2 && n.ports === 4 && n.naturalFinishes === 4 && integer(n.events, 28, QUALIFICATION_LIMITS.nativeEvents) &&
      integer(n.rawJsonBytes, 1, QUALIFICATION_LIMITS.nativeBytes) && integer(n.serializedBytes, n.rawJsonBytes, QUALIFICATION_LIMITS.nativeBytes) &&
      integer(n.scoredReplies, 1, 128) && n.scoredReplies === f.proof.attempts.reduce((sum, a) => sum + a.samples, 0) && n.events === 28 + 6 * n.scoredReplies, "NATIVE_SUMMARY_COUNTS");
    byteRefShape.parse(f.proof.initialRecordRef); byteRefShape.parse(f.proof.finalRecordRef);
  });
  verify("r4-status-initial-state-and-config-refs", () => {
    requireValue(r.scope === "COMPOSITION_ONLY_INPUTS_UNQUALIFIED" && r.qualified === false && r.status === "PASS" && same(r.failures, []) &&
      r.attempts.length === 2 && r.close.calls === 1 && r.close.status === "PASS" && r.close.cleanupDeadlineNs === r.attempts[1]!.cleanupDeadlineNs, "R4_STATUS");
    const initial = model(r.initialRecord); equal(initial.recordRef, f.proof!.initialRecordRef, "INITIAL_MODEL_JOIN");
    equal(state(r.initialState, bindings), initialTrainingState(101, initial.recordRef.sha256, bindings), "R4_INITIAL_STATE"); equal(r.initialSnapshot, r.initialState, "R4_INITIAL_SNAPSHOT");
  });
  verify("r4-attempt-state-proof-and-model-handoffs", () => {
    let previous = state(r.initialState, bindings), selectedRef = model(r.initialRecord).recordRef;
    for (const [i, attempt] of r.attempts.entries()) {
      const id = ["r4-m101-a0000", "r4-m101-a0001"][i]!, proof = f.proof!.attempts[i]!, expected = nextAttempt(previous, id);
      requireValue(attempt.attemptId === id && attempt.setupCalls === 1 && proof.id === id && integer(proof.samples, 0, 64) && typeof proof.nonzeroPolicyGradient === "boolean", "ATTEMPT_ID_OR_SAMPLES");
      equal(attempt.descriptor, expected.descriptor, "ATTEMPT_DESCRIPTOR"); equal(attempt.rng, expected.consumed.rng, "ATTEMPT_RNG_CONTEXT");
      const selected = model(attempt.model); equal(selected.recordRef, selectedRef, "MODEL_HANDOFF_RECORD_REF");
      requireValue(selected.recordRef.sha256 === previous.modelId && selected.config.recordSha256 === expected.descriptor.modelId, "MODEL_HANDOFF");
      const origin = ns(attempt.originNs); requireValue(ns(attempt.startupDeadlineNs) === origin + 10000000000n && ns(attempt.workDeadlineNs) === origin + 297000000000n &&
        ns(attempt.cleanupDeadlineNs) === origin + 300000000000n && (i === 0 || origin >= ns(r.attempts[i - 1]!.originNs)), "ATTEMPT_ORIGINAL_TIMING");
      const returned = state(attempt.returned, bindings); equal(attempt.snapshot, attempt.returned, "ATTEMPT_SNAPSHOT");
      byteRefShape.parse(proof.historyRef); requireValue(proof.journalRef && proof.journalRef.byteLength > (previous.journalRef?.byteLength ?? 0) &&
        proof.journalRef.lastRecordOrdinal > (previous.journalRef?.lastRecordOrdinal ?? 0), "JOURNAL_PREFIX_GROWTH");
      const next = structuredClone(expected.consumed); next.counters.verifiedCompleted++; next.rng = returned.rng; next.journalRef = proof.journalRef; next.historyRefs.push(proof.historyRef);
      for (const name of ["selection", "environment-settlement", "generator"] as const) equal(returned.rng[name], expected.consumed.rng[name], "UNCONSUMED_RNG_STREAM");
      for (const name of ["policy-sampling", "opponent"] as const) requireValue(returned.rng[name].root === expected.consumed.rng[name].root && returned.rng[name].drawCount >= expected.consumed.rng[name].drawCount, "RNG_PROGRESS_METADATA");
      if (proof.proposalRef !== null) {
        const proposal = byteRefShape.parse(proof.proposalRef), reward = returned.counters.baselineSum - previous.counters.baselineSum;
        requireValue(proof.samples > 0 && proposal.byteLength > 0 && proposal.byteLength <= MIB && typeof proof.parameterSha256 === "string" && /^[a-f0-9]{64}$/.test(proof.parameterSha256) &&
          [-1, 0, 1].includes(reward) && (!proof.nonzeroPolicyGradient || reward !== expected.descriptor.frozenBaseline), "PROPOSAL_METADATA");
        selectedRef = proposal; next.modelId = proposal.sha256; next.counters.eligibleCompleted++; next.counters.updates++; next.counters.baselineCount++; next.counters.baselineSum += reward;
        if (proof.nonzeroPolicyGradient) next.counters.nonzeroPGUpdates++;
      } else requireValue(proof.parameterSha256 === null && proof.nonzeroPolicyGradient === false, "NO_PROPOSAL_METADATA");
      equal(returned, checkTrainingState(next), "ATTEMPT_RETURNED_STATE_JOIN"); previous = returned;
    }
    requireValue(previous.counters.started === 2 && previous.counters.verifiedCompleted === 2 && previous.counters.nonzeroPGUpdates >= 1 &&
      previous.counters.nonzeroPGUpdates === f.proof!.nonzeroPGUpdates && f.proof!.attempts.some(a => a.nonzeroPolicyGradient), "NONZERO_PG_EXERCISE");
    equal(f.proof!.finalRecordRef, f.proof!.attempts[1]!.proposalRef ?? f.proof!.attempts[0]!.proposalRef ?? f.proof!.initialRecordRef, "FINAL_RECORD_JOIN");
    requireValue(previous.modelId === f.proof!.finalRecordRef.sha256, "FINAL_STATE_MODEL_JOIN");
  });
  let summary: unknown = null;
  try { summary = { canonical: f.proof!.canonical, attempts: f.proof!.attempts, native: f.proof!.native, nonzeroPGUpdates: f.proof!.nonzeroPGUpdates,
    physicalInventory: { sourceRows: m.source.length, codeRows: source.files.length, zodRows: m.source.length - source.files.length, declaredBytes: m.source.reduce((n, row) => n + row.byteLength, 0), referenceRows: m.reference.length },
    finalCounters: r.attempts[1]!.returned!.state.counters }; } catch {}
  return { status: checks.every(c => c.status === "PASS") ? "PASS_RETAINED_READBACK_CONSISTENCY_NOT_FULL_REPLAY" : "FAIL_RETAINED_READBACK_CONSISTENCY",
    scope: "LOCAL_CHECKS_OF_USER_TRANSFERRED_RETAINED_DOCUMENTS", checks, summary,
    inputRefs: Object.fromEntries(Object.entries(input).map(([name, bytes]) => [name, ref(bytes)])),
    limits: { independentHostAttestation: false, physicalPayloadRehashed: false, modelPayloadRehashed: false, historyJournalPayloadReplayed: false,
      nativeTraceReplayed: false, retainedDatabaseReopened: false, trainingCampaignRunOrFinalizeExecuted: false },
    functionalAcceptance: "PENDING_EXPLICIT_EXECUTOR_DECISION", trainingExecutionAuthorized: false, qualified: false, trainingReady: false } as const;
}
