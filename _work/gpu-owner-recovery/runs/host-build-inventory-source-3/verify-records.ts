// SPEC: _spec/gpu-host-build-inventory.puml
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { renderHostBuildInventory } from "../../qualification/host-build-inventory/render";

const directory = "_work/gpu-owner-recovery/runs/host-build-inventory-source-3";
const check = (value: boolean, label: string) => { if (!value) throw Error(label); };
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const bytes = await readFile(directory + "/receipt.json"), proof = JSON.parse(bytes.toString());
check(proof.status === "PASS_HOST_BUILD_INVENTORY_SOURCE_ONLY" && proof.sourceChanged === false && proof.sources.length === 288 && proof.results.length === 6, "CURRENT_SOURCE_PROOF_REQUIRED");
for (const source of proof.sources) check(hash(await readFile(source.path)) === source.sha256, "SOURCE_CHANGED:" + source.path);
let streams = 0;
for (const result of proof.results) {
  check(result.status === "PASS" && result.exitCode === 0, "VERIFICATION_STAGE_FAILED");
  for (const stream of result.streams) { const bytes = await readFile(stream.path); check(bytes.length === stream.bytes && hash(bytes) === stream.sha256, "VERIFICATION_CAPTURE_CHANGED"); streams++; }
}
const command = await readFile(proof.command.path);
check(command.length === proof.command.bytes && hash(command) === proof.command.sha256 && command.toString() === await renderHostBuildInventory() + "\n", "COMMAND_BINDING_CHANGED");
const index = JSON.parse(await readFile("_spec/.spec-index.json", "utf8"));
const diagrams = ["_spec/gpu-host-receive.puml", "_spec/gpu-input-transfer.puml", "_spec/gpu-qualification.puml", "_spec/gpu-build.puml", "_spec/gpu-host-build-inventory.puml"];
for (const path of diagrams) {
  const text = await readFile(path, "utf8"), covers = [...text.matchAll(/^' covers: (.+)$/gm)].map(match => match[1]);
  check(JSON.stringify(covers) === JSON.stringify(index.specs.find((entry: { spec: string }) => entry.spec === path).covers), "SPEC_INDEX_DRIFT:" + path);
}
const observationRoot = "_work/gpu-owner-recovery/runs/host-input-receive-observation-2/";
const observation = JSON.parse(await readFile(observationRoot + "record-check.json", "utf8"));
check(observation.status === "PASS_OPERATOR_REPORTED_RECEIVE2_RECORDS_WITH_LIST_DISCREPANCY" && observation.remainingHostInvocations === 0, "RECEIVE_REPORT_SCOPE_REQUIRED");
for (const source of observation.sources) check(hash(await readFile(source.path)) === source.sha256, "RECEIVE_RECORD_CHANGED:" + source.path);
check(hash(await readFile(observationRoot + "reported-receipt.json")) === observation.reportedReceiptSha256, "REPORTED_RECEIPT_CHANGED");
let e2eStreams = 0;
for (const mode of ["pass", "overflow", "deadline"]) {
  const root = directory + "/e2e/" + mode + "/", fixture = JSON.parse(await readFile(root + "fixture-scope.json", "utf8"));
  const receipt = JSON.parse(await readFile(root + "receipt.json", "utf8"));
  check(fixture.actualDockerQueries === 0 && fixture.scope === "SOURCE_ONLY_MOCKED_QUERIES_NOT_HOST_EVIDENCE", "MOCKED_E2E_SCOPE_REQUIRED");
  for (const capture of receipt.captures) for (const stream of capture.streams) { const bytes = await readFile(stream.path); check(bytes.length === stream.bytes && bytes.length <= 32768 && hash(bytes) === stream.sha256, "MOCKED_E2E_CAPTURE_CHANGED"); e2eStreams++; }
}
await writeFile(directory + "/host-command-approval.json", JSON.stringify({ version: "chess-coach.host-build-inventory-approval-proposal.v1", status: "AWAITING_EXECUTOR_EXACT_HOST_METADATA_DECISION",
  sourceProof: { path: directory + "/receipt.json", sha256: hash(bytes) }, command: proof.command, plan: proof.plan,
  maximumHostInvocations: 1, helperDownloads: 0, sourcePublicationRequired: false, hostExecutionApproved: false,
  imagePullOrBuildOrNativeOrGpuExecutionAuthorized: false, trainingAuthorized: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
await writeFile(directory + "/record-check.json", JSON.stringify({ status: "PASS_HOST_METADATA_SOURCE_AND_COMMAND_RECORDS_ONLY", sourcesChecked: 288, verificationStreamsChecked: streams,
  mockedE2eStreamsChecked: e2eStreams, diagramIndexMatches: diagrams.length, sourceProofSha256: hash(bytes), commandSha256: hash(command),
  receiveDiscrepancyRetained: observation.discrepancy, localFishSyntaxValidated: false, hostQueriesPerformed: false, hostExecutionApproved: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: "PASS_HOST_METADATA_SOURCE_AND_COMMAND_RECORDS_ONLY", commandSha256: hash(command), diagrams: diagrams.length, decisionRequired: true }));
