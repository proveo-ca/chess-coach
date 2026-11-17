// SPEC: _spec/runtime-protocol.puml
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { inspectRetainedReadback } from "./readback.ts";
import type { ReadbackInput } from "./readback.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url));
const input: ReadbackInput = { bootstrap: read("./bootstrap.json"), operator: read("./returned-2/operator-report.json"), canonical: read("./returned-2/canonical.json"),
  r4: read("./returned-2/r4.json"), functional: read("./returned-2/functional-evidence.json"), preparation: read("./returned-2/preparation-receipt.json"), manifest: read("./returned-2/input-manifest.json"),
  sourceManifest: read("../qualification-packet-1/source-3/source-manifest.json"), bindingDocuments: read("../qualification-packet-1/source-3/binding-documents.json") };
function changed(key: keyof ReadbackInput, mutate: (value: any) => void): ReadbackInput {
  const value = JSON.parse(Buffer.from(input[key]).toString()); mutate(value);
  return { ...input, [key]: Buffer.from(JSON.stringify(value) + "\n") };
}
test("byte-bound returned documents pass consistency without granting acceptance", () => {
  const r = inspectRetainedReadback(input);
  expect(r.checks.filter(c => c.status === "FAIL")).toEqual([]);
  expect(r.status).toBe("PASS_RETAINED_READBACK_CONSISTENCY_NOT_FULL_REPLAY");
  expect(r.functionalAcceptance).toBe("PENDING_EXPLICIT_EXECUTOR_DECISION"); expect(r.trainingReady).toBe(false); expect(r.trainingExecutionAuthorized).toBe(false);
  expect(Object.values(r.limits).every(value => value === false)).toBe(true);
});
test("zero-PG second update remains valid despite different serialized model bytes", () => {
  const f = JSON.parse(Buffer.from(input.functional).toString());
  expect(f.proof.attempts[1].nonzeroPolicyGradient).toBe(false); expect(f.proof.attempts[0].proposalRef.sha256).not.toBe(f.proof.attempts[1].proposalRef.sha256);
  expect(inspectRetainedReadback(input).status).toBe("PASS_RETAINED_READBACK_CONSISTENCY_NOT_FULL_REPLAY");
});
const cases: [string, keyof ReadbackInput, string, (value: any) => void][] = [
  ["stale worker manifest", "sourceManifest", "immutable-source3-document-pins", v => { v.byteLength++; }],
  ["changed document pin", "manifest", "manifest-fourteen-bindings-and-nine-reference-rows", v => { v.documents[0].source.sha256 = "a".repeat(64); }],
  ["duplicate document", "manifest", "manifest-fourteen-bindings-and-nine-reference-rows", v => { v.documents[1] = v.documents[0]; }],
  ["changed reference row", "manifest", "manifest-fourteen-bindings-and-nine-reference-rows", v => { v.reference[0].byteLength++; }],
  ["changed source row", "manifest", "manifest-source-and-dependency-inventory", v => { v.source[0].byteLength++; }],
  ["unexpected dependency", "manifest", "manifest-source-and-dependency-inventory", v => { v.source.find((r: { path: string }) => r.path.startsWith("node_modules/")).path = "node_modules/other/index.js"; }],
  ["wrong builder argv", "preparation", "preparation-manifest-and-builder-join", v => { v.commands[0].argv.push("--install"); }],
  ["forced builder", "preparation", "preparation-manifest-and-builder-join", v => { v.commands[0].result.forced = true; }],
  ["wrong preparation commit", "preparation", "preparation-manifest-and-builder-join", v => { v.publicationCommit = "a".repeat(40); }],
  ["MOCK execution", "canonical", "canonical-real-status-and-original-timing", v => { v.receipt.execution = "MOCK"; }],
  ["rewritten legacy scope", "canonical", "canonical-real-status-and-original-timing", v => { v.receipt.independentReferenceQualified = true; }],
  ["changed embedded frame", "canonical", "canonical-real-status-and-original-timing", v => { v.receipt.boot.json += " "; }],
  ["changed boundary", "canonical", "canonical-both-boundaries-and-completion-digests", v => { v.receipt.boundaries[0].boundary.bank.w++; }],
  ["changed digest", "canonical", "canonical-both-boundaries-and-completion-digests", v => { v.receipt.boundaries[0].digest = "a".repeat(64); }],
  ["missing exchange", "canonical", "canonical-fourteen-exchanges-two-natural-finishes", v => { v.receipt.exchanges.pop(); }],
  ["changed commit reference", "canonical", "canonical-fourteen-exchanges-two-natural-finishes", v => { v.receipt.exchanges[2].requestDigest = "a".repeat(64); }],
  ["forced natural finish", "canonical", "canonical-fourteen-exchanges-two-natural-finishes", v => { v.receipt.lifecycle[0].finish.forced = true; }],
  ["MOCK functional summary", "functional", "functional-summary-and-native-counts", v => { v.proof.canonical.executionLabel = "MOCK"; }],
  ["over-budget trace declaration", "functional", "functional-summary-and-native-counts", v => { v.proof.native.serializedBytes = 1073741825; }],
  ["inconsistent event count", "functional", "functional-summary-and-native-counts", v => { v.proof.native.events++; }],
  ["inconsistent scored replies", "functional", "functional-summary-and-native-counts", v => { v.proof.native.scoredReplies++; }],
  ["rewritten R4 qualification", "r4", "r4-status-initial-state-and-config-refs", v => { v.qualified = true; }],
  ["multiple coordinator closes", "r4", "r4-status-initial-state-and-config-refs", v => { v.close.calls = 2; }],
  ["bad config ref", "r4", "r4-status-initial-state-and-config-refs", v => { v.initialRecord.configRef.byteLength++; }],
  ["bad serialized state ref", "r4", "r4-status-initial-state-and-config-refs", v => { v.initialState.serializedStateRef.byteLength++; }],
  ["stale model handoff", "r4", "r4-attempt-state-proof-and-model-handoffs", v => { v.attempts[1].model = v.initialRecord; }],
  ["initial handoff byte length", "r4", "r4-attempt-state-proof-and-model-handoffs", v => { v.attempts[0].model.recordRef.byteLength++; }],
  ["proposal handoff byte length", "r4", "r4-attempt-state-proof-and-model-handoffs", v => { v.attempts[1].model.recordRef.byteLength++; }],
  ["retained first proposal byte length", "functional", "r4-attempt-state-proof-and-model-handoffs", v => { v.proof.attempts[0].proposalRef.byteLength++; }],
  ["changed attempt descriptor", "r4", "r4-attempt-state-proof-and-model-handoffs", v => { v.attempts[1].descriptor.startedOrdinal = 0; }],
  ["renewed attempt deadline", "r4", "r4-attempt-state-proof-and-model-handoffs", v => { v.attempts[1].workDeadlineNs = String(BigInt(v.attempts[1].workDeadlineNs) + 1n); }],
  ["changed counter", "r4", "r4-attempt-state-proof-and-model-handoffs", v => { v.attempts[1].returned.state.counters.verifiedCompleted++; }],
  ["changed history ref", "functional", "r4-attempt-state-proof-and-model-handoffs", v => { v.proof.attempts[1].historyRef.sha256 = "a".repeat(64); }],
  ["missing nonzero PG", "functional", "r4-attempt-state-proof-and-model-handoffs", v => { v.proof.nonzeroPGUpdates = 0; }],
  ["changed final record", "functional", "r4-attempt-state-proof-and-model-handoffs", v => { v.proof.finalRecordRef.sha256 = "a".repeat(64); }],
];
for (const [name, key, check, mutate] of cases) test(`rejects ${name} in the relevant cross-document check`, () => {
  const r = inspectRetainedReadback(changed(key, mutate));
  expect(r.status).toBe("FAIL_RETAINED_READBACK_CONSISTENCY"); expect(r.checks.find(c => c.id === check)?.status).toBe("FAIL");
});
for (const bytes of [Buffer.from("null"), Buffer.from("not-json"), Buffer.alloc(1048577)]) test(`rejects malformed or oversized input ${bytes.length}`, () => {
  expect(inspectRetainedReadback({ ...input, canonical: bytes }).status).toBe("FAIL_RETAINED_READBACK_CONSISTENCY");
});
