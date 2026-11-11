// SPEC: _spec/gpu-full-qualification.puml
import { readFile, writeFile } from "node:fs/promises";
import { digest, fullSelectors, requireValue } from "./plan";
import { renderFullPacket } from "./render";

const [label] = Bun.argv.slice(2);
requireValue(Bun.argv.length === 3 && /^host-gpu-full-source-[1-9][0-9]*$/.test(label ?? ""), "FULL_SOURCE_RECORD_CONTEXT_REQUIRED");
const root = "_work/gpu-owner-recovery/runs/" + label + "/", receiptBytes = await readFile(root + "receipt.json"), receipt = JSON.parse(receiptBytes.toString());
requireValue(receipt.status === "PASS_GPU_FULL_SOURCE_ONLY" && receipt.sourceChanged === false && receipt.results.length === 7 && receipt.protectedBaselineSources === 327, "COMPLETE_SOURCE_ONLY_PASS_REQUIRED");
for (const source of receipt.sources) requireValue(digest(await readFile(source.path)) === source.sha256, "SOURCE_PROOF_INPUT_CHANGED:" + source.path);
let streams = 0;
for (const result of receipt.results) {
  requireValue(result.status === "PASS" && result.exitCode === 0 && result.failure === null, "ALL_SOURCE_STAGES_PASS_REQUIRED");
  for (const stream of result.streams) { const bytes = await readFile(stream.path); requireValue(bytes.length === stream.bytes && digest(bytes) === stream.sha256, "SOURCE_VERIFICATION_STREAM_CHANGED"); streams++; }
}
const regenerated = await renderFullPacket(), regeneratedBytes = Buffer.from(regenerated.command + "\n");
requireValue(regeneratedBytes.equals(await readFile(receipt.command.path)) && regeneratedBytes.length === receipt.command.bytes && digest(regeneratedBytes) === receipt.command.sha256, "EXACT_COMMAND_REGENERATION_REQUIRED");
const text = [regenerated.programs.host, regenerated.programs.driver, JSON.stringify(regenerated.programs.plan, null, 2) + "\n"];
for (const [i, row] of receipt.programs.entries()) { const bytes = await readFile(row.path); requireValue(bytes.toString() === text[i] && bytes.length === row.bytes && digest(bytes) === row.sha256, "PROGRAM_OR_PLAN_CHANGED"); }
const proposal = JSON.parse(await readFile(root + "approval-proposal.json", "utf8"));
requireValue(proposal.sourceProof.path === root + "receipt.json" && proposal.sourceProof.sha256 === digest(receiptBytes) && JSON.stringify(proposal.command) === JSON.stringify(receipt.command), "EXACT_PROPOSAL_BINDING_REQUIRED");
for (const field of ["hostExecutionApproved", "copyingOrStagingApproved", "gpuExecutionApproved", "kernelJitCompilationApproved", "publicationApproved", "trainingApproved", "trainingReady"]) requireValue(proposal[field] === false, "NO_OPERATIONAL_APPROVAL:" + field);
const fixtures = [];
for (const name of ["happy", "journal-abort", "late-watchdog-failure", "connected-driver-watchdog"]) for (const file of ["receipt.json", "argv.json"]) {
  const path = root + "e2e/" + name + "/" + file, bytes = await readFile(path), row = JSON.parse(bytes.toString());
  requireValue(row.scope === "SOURCE_ONLY_PURE_MOCK_E2E_NOT_HOST_GPU_EVIDENCE" && row.actualDockerProcesses === 0 && row.actualNativeProcesses === 0 && row.gpuExecuted === false, "MOCK_E2E_SCOPE_REQUIRED");
  if (file === "argv.json") requireValue(row.calls.length <= 7 && new Set(row.calls.map((v: any) => v.id)).size === row.calls.length, "BOUNDED_DISTINCT_MOCK_OPERATIONS_REQUIRED");
  if (file === "receipt.json") {
    requireValue(row.result.status === (name === "happy" ? "PASS_HOST_GPU_FULL_ONLY" : "FAIL_HOST_GPU_FULL_ONLY"), "MOCK_EXPECTED_OUTCOME_REQUIRED");
    if (name === "happy") requireValue(JSON.stringify(row.result.innerReceipt.results.map((v: any) => v.id)) === JSON.stringify(fullSelectors), "MOCK_COMPLETE_FULL_SIX_REQUIRED");
  }
  fixtures.push({ path, bytes: bytes.length, sha256: digest(bytes) });
}
const count = (s: string) => ({ tests: Number(s.match(/\n\s+(\d+) pass\n/)?.[1]), assertions: Number(s.match(/\n\s+(\d+) expect\(\) calls/)?.[1]) });
const counts = Object.fromEntries(await Promise.all(["full", "feasibility", "qualification"].map(async name => [name, count(await readFile(root + name + "-unit/command.stderr", "utf8"))] as const)));
requireValue(Object.values(counts).every(row => row.tests > 0 && row.assertions > 0), "PERSISTED_TEST_COUNTS_REQUIRED");
await writeFile(root + "record-check.json", JSON.stringify({ status: "PASS_GPU_FULL_SOURCE_PACKET_RECORDS_ONLY", proof: { path: root + "receipt.json", sha256: digest(receiptBytes) },
  sourceHashesChecked: receipt.sources.length, protectedBaselineSources: receipt.protectedBaselineSources, verificationStreamHashesChecked: streams, programHashesChecked: 3, command: receipt.command,
  counts, typechecks: 4, mockE2e: fixtures, retainedInputsReadOnly: true, operationalAuthority: "NONE_FRESH_EXACT_APPROVAL_REQUIRED", originalHostArtifactBytesRehashed: false,
  actualDockerProcesses: 0, actualNativeProcesses: 0, gpuExecuted: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: "PASS_GPU_FULL_SOURCE_PACKET_RECORDS_ONLY", sources: receipt.sources.length, streams, counts }));
