// SPEC: _spec/gpu-host-receive.puml
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { renderHostReceive } from "../../qualification/host-receive/bootstrap";

const directory = "_work/gpu-owner-recovery/runs/host-input-receive-source-2";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: boolean, label: string) => { if (!value) throw Error(label); };
const receiptBytes = await readFile(directory + "/receipt.json"), receipt = JSON.parse(receiptBytes.toString());
check(receipt.status === "PASS_HOST_RECEIVE_SOURCE_ONLY" && receipt.sourceChanged === false, "PASS_SOURCE_RECEIPT_REQUIRED");
for (const source of receipt.sources) check(hash(await readFile(source.path)) === source.sha256, "SOURCE_CHANGED:" + source.path);
let streamCount = 0;
for (const result of receipt.results) {
  check(result.status === "PASS", "VERIFICATION_COMMAND_FAILED");
  for (const stream of result.streams) { const bytes = await readFile(stream.path); check(bytes.length === stream.bytes && hash(bytes) === stream.sha256, "CAPTURE_CHANGED"); streamCount++; }
}
const helper = await readFile(receipt.helper.path);
check(helper.length === receipt.helper.bytes && hash(helper) === receipt.helper.sha256, "FIXED_HELPER_BINDING");
const template = await readFile(receipt.commandTemplate.path, "utf8");
check(template === renderHostReceive("0".repeat(40), receipt.helper.sha256) + "\n", "COMMAND_TEMPLATE_CHANGED");
const index = JSON.parse(await readFile("_spec/.spec-index.json", "utf8"));
const diagrams = ["_spec/gpu-host-receive.puml", "_spec/gpu-input-transfer.puml", "_spec/gpu-qualification.puml", "_spec/gpu-build.puml"];
for (const path of diagrams) {
  const text = await readFile(path, "utf8"), covers = [...text.matchAll(/^' covers: (.+)$/gm)].map(match => match[1]);
  check(JSON.stringify(covers) === JSON.stringify(index.specs.find((entry: { spec: string }) => entry.spec === path).covers), "SPEC_INDEX_DRIFT:" + path);
}
const proposal = JSON.parse(await readFile("_work/gpu-owner-recovery/qualification/host-receive/plan.json", "utf8"));
check(proposal.codingSourcePublicationApproved === false && proposal.operatorReceiveCommandApproved === false, "HOST_DECISION_NOT_YET_GRANTED");
await writeFile(directory + "/host-command-approval.json", JSON.stringify({ version: "chess-coach.host-command-approval-proposal.v1", status: "AWAITING_EXECUTOR_HOST_COMMAND_DECISION",
  sourceProof: { path: directory + "/receipt.json", sha256: hash(receiptBytes) }, helper: receipt.helper,
  commandTemplate: { path: receipt.commandTemplate.path, sha256: hash(Buffer.from(template)), lateBoundFields: ["handoffCommit"], placeholderMustNotBeExecuted: true },
  codingSourcePublication: { normalCommits: 1, explicitHttpsPushes: 1, deadlineMs: 600000, url: "https://github.com/proveo-ca/chess-coach.git", branch: "feat-ml-adjuntant-ii", existingIdentityAndAuthenticationOnly: true, additionalReleaseOrAssetUpload: false },
  operatorCommand: { invocations: 1, helperSourceDownloads: 1, assetDownloads: 2, extractions: 1, assetSourceCommit: proposal.assetSourceCommit,
    manifest: proposal.manifest, bundle: proposal.bundle, workspace: proposal.workspace, evidence: proposal.evidence, bootstrapEvidence: proposal.bootstrapEvidence, limits: proposal.limits },
  sourcePublicationAuthorized: false, operatorCommandAuthorized: false, automaticRetryOrOverwriteOrDeletionAuthorized: false,
  installationOrAuthenticationChangesAuthorized: false, imageBuildOrCompilationAuthorized: false, llvmOrCargoExecutionAuthorized: false, gpuExecutionAuthorized: false, trainingAuthorized: false,
  fishSyntax: receipt.fishSyntax, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
await writeFile(directory + "/record-check.json", JSON.stringify({ version: "chess-coach.host-command-source-record-check.v1", status: "PASS_REVIEWED_HOST_COMMAND_RECORDS_ONLY",
  sourceHashesChecked: receipt.sources.length, captureStreamsChecked: streamCount, diagramIndexMatches: diagrams.length,
  helperSha256: receipt.helper.sha256, commandTemplateSha256: hash(Buffer.from(template)), fishSyntaxValidated: false, sourcePublicationPerformed: false,
  operatorHostExecuted: false, compilationPerformed: false, gpuExecuted: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: "PASS_REVIEWED_HOST_COMMAND_RECORDS_ONLY", sourceHashes: receipt.sources.length, streams: streamCount, diagrams: diagrams.length,
  helperSha256: receipt.helper.sha256, decision: directory + "/host-command-approval.json" }));
