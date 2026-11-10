// SPEC: _spec/gpu-host-receive.puml
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { renderHostReceive2 } from "../../qualification/host-receive/bootstrap";

const directory = "_work/gpu-owner-recovery/runs/host-input-receive-source-4";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: boolean, label: string) => { if (!value) throw Error(label); };
const proofBytes = await readFile(directory + "/receipt.json"), proof = JSON.parse(proofBytes.toString());
check(proof.status === "PASS_HOST_RECEIVE_SOURCE_ONLY" && proof.sourceChanged === false, "CURRENT_RUN2_PROOF_REQUIRED");
for (const source of proof.sources) check(hash(await readFile(source.path)) === source.sha256, "SOURCE_CHANGED:" + source.path);
let streams = 0;
for (const result of proof.results) for (const stream of result.streams) {
  const bytes = await readFile(stream.path); check(result.status === "PASS" && bytes.length === stream.bytes && hash(bytes) === stream.sha256, "CAPTURE_CHANGED"); streams++;
}
const template = await readFile(proof.commandTemplate.path);
check(template.toString() === renderHostReceive2("0".repeat(40), proof.helper.sha256) + "\n", "RUN2_TEMPLATE_CHANGED");
const index = JSON.parse(await readFile("_spec/.spec-index.json", "utf8"));
for (const path of ["_spec/gpu-host-receive.puml", "_spec/gpu-input-transfer.puml", "_spec/gpu-qualification.puml", "_spec/gpu-build.puml"]) {
  const text = await readFile(path, "utf8"), covers = [...text.matchAll(/^' covers: (.+)$/gm)].map(match => match[1]);
  check(JSON.stringify(covers) === JSON.stringify(index.specs.find((entry: { spec: string }) => entry.spec === path).covers), "SPEC_INDEX_DRIFT");
}
const plan = JSON.parse(await readFile("_work/gpu-owner-recovery/qualification/host-receive/plan-run2.json", "utf8"));
check(plan.sourcePublicationApproved === false && plan.operatorReceiveApproved === false, "FRESH_APPROVAL_NOT_YET_GIVEN");
await writeFile(directory + "/host-command-approval.json", JSON.stringify({ version: "chess-coach.mise-host-receive-run2-approval-proposal.v1", status: "AWAITING_EXECUTOR_COMBINED_HOST_COMMAND_DECISION",
  sourceProof: { path: directory + "/receipt.json", sha256: hash(proofBytes) }, helper: proof.helper,
  template: { path: proof.commandTemplate.path, sha256: hash(template), lateBoundFields: ["helperSourceCommit"], placeholderMustNotBeExecuted: true },
  reportedAlignment: plan.reportedAlignment, sourcePublication: { maximumCommits: 1, maximumHttpsPushes: 1, deadlineMs: 600000, url: plan.sourcePublication.url, branch: plan.sourcePublication.branch },
  operatorCommand: { maximumInvocations: 1, maximumHelperDownloads: 1, maximumAssetDownloads: 2, maximumExtractions: 1, totalMs: 900000, grant: plan.grant,
    workspace: plan.workspace, evidence: plan.evidence, bootstrapEvidence: plan.bootstrapEvidence, execution: plan.execution, limits: plan.limits, manifest: plan.manifest, bundle: plan.bundle },
  sourcePublicationApproved: false, operatorReceiveApproved: false, installationOrTrustOrConfigurationChangesAuthorized: false,
  automaticRetryOrOverwriteOrDeletionAuthorized: false, additionalReleaseOrAssetUploadAuthorized: false, codingPayloadAcquisitionCopyOrRepackAuthorized: false,
  imageBuildOrCompilationAuthorized: false, llvmOrCargoExecutionAuthorized: false, gpuExecutionAuthorized: false, trainingAuthorized: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
await writeFile(directory + "/record-check.json", JSON.stringify({ status: "PASS_RUN2_SOURCE_AND_COMMAND_RECORDS_ONLY", sourceHashesChecked: proof.sources.length, captureStreamsChecked: streams,
  diagramIndexMatches: 4, helper: proof.helper, templateSha256: hash(template), hostCommandDecisionRequired: true, fishSyntaxValidated: false,
  sourcePublicationPerformed: false, operatorRun2Executed: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: "PASS_RUN2_SOURCE_AND_COMMAND_RECORDS_ONLY", sources: proof.sources.length, streams, helperSha256: proof.helper.sha256,
  decision: directory + "/host-command-approval.json" }));
