// SPEC: _spec/gpu-qualification.puml
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const directory = "_work/gpu-owner-recovery/runs/host-builder-inputs-1";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: boolean, label: string) => { if (!value) throw Error(label); };
const paste = await readFile(directory + "/operator-paste.txt", "utf8");
const observation = JSON.parse(await readFile(directory + "/operator-observation.json", "utf8"));
const pairs = paste.trimEnd().split("\n").map(line => { const delimiter = line.indexOf("="); check(delimiter > 0, "RECEIPT_LINE"); return [line.slice(0, delimiter), line.slice(delimiter + 1)] as const; });
const values = Object.fromEntries(pairs);
check(new Set(pairs.map(pair => pair[0])).size === pairs.length, "DUPLICATE_RECEIPT_FIELD");
const request = JSON.parse(await readFile("_work/gpu-owner-recovery/qualification/input-request.json", "utf8"));
check(values.status === "PASS_INPUT_METADATA_ONLY" && observation.reportedStatus === values.status, "REPORTED_STATUS");
check(observation.provenance === "NORMALIZED_FROM_OPERATOR_PASTE_NOT_ORIGINAL_HOST_FILES" && observation.originalHostEvidenceFilesReceived === false, "PROVENANCE");
check(values.image === request.operatorHost.image && observation.image === values.image, "IMAGE_PIN");
check(values.lock === observation.reportedLockSha256 + "  Cargo.lock" && hash(await readFile("Cargo.lock")) === observation.reportedLockSha256, "LOCK_PIN");
for (const [key, field] of [["pull_exit", "pullExitCode"], ["inspection_exit", "inspectionExitCode"], ["image_exit", "imageInspectionExitCode"]] as const) {
  check(values[key] === "0" && observation[field] === 0, "REPORTED_PHASE:" + key);
}
check(values.run_attempted === "1" && values.run_exit === "0" && values.cleanup_attempted === "1" && values.cleanup_exit === "0", "CONTAINER_PHASES");
check(observation.container.attemptsReported === 1 && observation.container.exitCode === 0 && observation.container.cleanupAttemptsReported === 1 && observation.container.cleanupExitCode === 0, "CONTAINER_NORMALIZATION");
check(values.cid === observation.container.cid && /^[a-f0-9]{64}$/.test(values.cid!), "CID");
check(Number(values.started) === observation.reportedStarted && Number(values.finished) === observation.reportedFinished
  && observation.reportedFinished - observation.reportedStarted === observation.reportedWallDurationSeconds, "REPORTED_TIMESTAMPS");
check(values.evidence === observation.hostEvidenceDirectoryReported && values.evidence === directory, "EVIDENCE_DIRECTORY");
for (const key of ["remaining_pull_invocations", "remaining_container_invocations"]) check(values[key] === "0", "SPENT_GRANT:" + key);
for (const key of ["automatic_retry_authorized", "compilation_performed", "gpu_execution_performed", "trainingReady"]) check(values[key] === "false", "SCOPE:" + key);
for (const key of ["remainingPullInvocations", "remainingContainerInvocations", "remainingCleanupInvocations"]) check(observation.authorityDisposition[key] === 0, "NORMALIZED_SPENT_GRANT");
for (const key of ["imageFactsOutputReceived", "compilerFactsOutputReceived", "compiledBuilderAbiQualified", "nativeLinkingQualified", "contextStaged", "imageBuilt", "compilationPerformed", "gpuExecutionPerformed", "trainingReady", "additionalAcquisitionOrExecutionAuthorized"]) check(observation[key] === false, "PENDING_SCOPE:" + key);
for (const key of ["imageOsArchitecture", "localImageId", "compilerVersions", "libcVersion", "cxxLibraryPath", "operatorExecutedSourceCommit"]) check(observation[key] === null, "UNKNOWN_DETAIL:" + key);
const proof = JSON.parse(await readFile("_work/gpu-owner-recovery/runs/gpu-input-inventory-source-3/receipt.json", "utf8"));
for (const source of proof.sources) check(hash(await readFile(source.path)) === source.sha256, "HELPER_SOURCE_CHANGED:" + source.path);
const index = JSON.parse(await readFile("_spec/.spec-index.json", "utf8"));
for (const path of ["_spec/gpu-build.puml", "_spec/gpu-qualification.puml"]) {
  const text = await readFile(path, "utf8");
  const covers = [...text.matchAll(/^' covers: (.+)$/gm)].map(match => match[1]);
  check(JSON.stringify(covers) === JSON.stringify(index.specs.find((entry: { spec: string }) => entry.spec === path).covers), "SPEC_INDEX_DRIFT");
}
const paths = [directory + "/operator-paste.txt", directory + "/operator-observation.json", directory + "/verify-records.ts",
  "_spec/gpu-build.puml", "_spec/gpu-qualification.puml", "_spec/.spec-index.json", "_spec/gpu-readiness.md", "_spec/gate-closure.md"];
const sources = await Promise.all(paths.map(async path => ({ path, sha256: hash(await readFile(path)) })));
const stdout = "PASS: normalized operator receipt, exact image/lock, spent grant, pending detail fields, unchanged helper sources and two spec/index inventories; no host operation or replay\n";
await writeFile(directory + "/record-check.stdout", stdout, { flag: "wx" });
await writeFile(directory + "/record-check.stderr", "", { flag: "wx" });
await writeFile(directory + "/record-check.json", JSON.stringify({ version: "chess-coach.host-builder-inputs-record-check.v1", status: "PASS_NORMALIZED_RECORDS_ONLY", sources,
  helperSourceHashesChecked: proof.sources.length, diagramIndexMatches: 2, originalHostFilesReceived: false, operatorMetadataStatusReported: values.status,
  operatorGrantConsumed: true, compilerDetailsReceived: false, dockerCommandsExecuted: false, nativeCompilerQueriesPerformed: false, metadataInventoryRepeated: false,
  compilationPerformed: false, gpuExecutionPerformed: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(stdout.trim());
