// SPEC: _spec/gpu-host-build-inventory.puml
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { renderHostBuildInventory } from "../../qualification/host-build-inventory/render";

const directory = "_work/gpu-owner-recovery/runs/host-build-inventory-source-5";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: boolean, label: string) => { if (!value) throw Error(label); };
const proofBytes = await readFile(directory + "/receipt.json"), proof = JSON.parse(proofBytes.toString());
check(proof.status === "PASS_HOST_BUILD_INVENTORY_SOURCE_ONLY" && proof.sourceChanged === false && proof.sources.length === 298, "CURRENT_CORRECTED_SOURCE_REQUIRED");
for (const source of proof.sources) check(hash(await readFile(source.path)) === source.sha256, "SOURCE_CHANGED:" + source.path);
let streams = 0, e2eStreams = 0;
for (const result of proof.results) {
  check(result.status === "PASS" && result.exitCode === 0, "SOURCE_CHECK_FAILED");
  for (const stream of result.streams) { const bytes = await readFile(stream.path); check(bytes.length === stream.bytes && hash(bytes) === stream.sha256, "SOURCE_CAPTURE_CHANGED"); streams++; }
}
for (const mode of ["pass", "overflow", "deadline"]) {
  const path = directory + "/e2e/" + mode + "/", fixture = JSON.parse(await readFile(path + "fixture-scope.json", "utf8"));
  const receipt = JSON.parse(await readFile(path + "receipt.json", "utf8"));
  check(fixture.actualDockerQueries === 0 && fixture.scope === "SOURCE_ONLY_MOCKED_QUERIES_NOT_HOST_EVIDENCE", "MOCKED_SCOPE_REQUIRED");
  for (const capture of receipt.captures) for (const stream of capture.streams) { const bytes = await readFile(stream.path); check(bytes.length === stream.bytes && bytes.length <= 32768 && hash(bytes) === stream.sha256, "MOCKED_CAPTURE_CHANGED"); e2eStreams++; }
}
const command = await readFile(proof.command.path);
check(command.length === proof.command.bytes && hash(command) === proof.command.sha256 && command.toString() === await renderHostBuildInventory() + "\n", "CORRECTED_LITERAL_CHANGED");
check(proof.plan.grant === "--approved-host-build-inventory-2" && proof.plan.evidence.endsWith("/host-build-inventory-2") && proof.plan.hostExecutionApproved === false, "FRESH_UNAPPROVED_RUN2_REQUIRED");
const index = JSON.parse(await readFile("_spec/.spec-index.json", "utf8"));
for (const path of ["_spec/gpu-host-build-inventory.puml", "_spec/gpu-host-receive.puml", "_spec/gpu-input-transfer.puml", "_spec/gpu-qualification.puml", "_spec/gpu-build.puml"]) {
  const covers = [...(await readFile(path, "utf8")).matchAll(/^' covers: (.+)$/gm)].map(match => match[1]);
  check(JSON.stringify(covers) === JSON.stringify(index.specs.find((entry: { spec: string }) => entry.spec === path).covers), "SPEC_INDEX_DRIFT");
}
const observation = JSON.parse(await readFile("_work/gpu-owner-recovery/runs/host-build-inventory-observation-1/record-check.json", "utf8"));
check(observation.status === "PASS_OPERATOR_REPORTED_FAILED_INVENTORY_RECORDS_ONLY" && observation.remainingHostInvocations === 0 && observation.exactHostDiagnosticEstablished === false, "FAILED_RUN1_RETAINED");
const sourceProof = { path: directory + "/receipt.json", sha256: hash(proofBytes) };
await writeFile(directory + "/host-command-approval.json", JSON.stringify({ version: "chess-coach.corrected-host-build-inventory-approval-proposal.v1", status: "AWAITING_FRESH_CORRECTED_HOST_INVOCATION_APPROVAL",
  sourceProof, command: proof.command, plan: proof.plan, sourcePublicationAuthorizedByLaterExecutorRequest: true,
  maximumHostInvocations: 1, hostExecutionApproved: false, helperDownloads: 0, trainingAuthorized: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
await writeFile(directory + "/record-check.json", JSON.stringify({ status: "PASS_CORRECTED_HOST_INVENTORY_SOURCE_AND_COMMAND_RECORDS_ONLY", sourceProof,
  sourceHashesChecked: 298, verificationStreamsChecked: streams, mockedE2eStreamsChecked: e2eStreams, diagramIndexMatches: 5, commandSha256: hash(command),
  localFishSyntaxValidated: false, sourcePublicationPerformed: false, actualHostQueriesPerformed: false, hostRun2Approved: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: "PASS_CORRECTED_HOST_INVENTORY_SOURCE_AND_COMMAND_RECORDS_ONLY", sourceProof, command: proof.command }));
