// SPEC: _spec/gpu-host-build-inventory.puml
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const directory = "_work/gpu-owner-recovery/runs/host-build-inventory-observation-1";
const check = (value: boolean, label: string) => { if (!value) throw Error(label); };
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const observation = JSON.parse(await readFile(directory + "/observation.json", "utf8"));
const lines = (await readFile(observation.paste, "utf8")).trimEnd().split("\n");
const summary = JSON.parse(lines[0]!), receiptText = lines.slice(1, -1).join("\n") + "\n", receipt = JSON.parse(receiptText);
const request = JSON.parse(await readFile(observation.request, "utf8"));
check(lines.at(-1) === "HOST_BUILD_INVENTORY_EXIT=1" && summary.status === "FAIL_METADATA_ONLY" && receipt.status === summary.status && receipt.failure === "QUERY_NONZERO:selected-builder", "FAILED_REPORT_FRAMES");
check(summary.receipt === request.expectedReceipt && summary.queries === 3 && receipt.results.length === 3 && receipt.captures.length === 3, "REPORTED_ATTEMPT_COUNT");
check(JSON.stringify(receipt.results.map((row: { exitCode: number }) => row.exitCode)) === JSON.stringify(observation.reportedQueryExits), "REPORTED_QUERY_EXITS");
check(JSON.stringify(receipt.results[2].argv) === JSON.stringify(["docker", "buildx", "inspect", "--format", "{{json .}}"]), "HISTORICAL_INVALID_COMMAND_RETAINED");
check(receipt.metadata.contextName === observation.reportedContextName && receipt.metadata.contextEndpoint.DockerEndpoint === observation.reportedDockerEndpoint && receipt.metadata.dockerHostOverridePresent === false, "REPORTED_CONTEXT");
check(request.hostExecutionApproved === true && receipt.hostInvocationsConsumed === 1 && receipt.remainingHostInvocations === 0 && observation.remainingHostInvocations === 0, "CONSUMED_ONE_HOST_GRANT");
for (const [key, value] of Object.entries(request.limits)) check(receipt.limits[key] === value, "REPORTED_LIMIT_CHANGED:" + key);
for (const field of ["automaticRetryAuthorized", "buildAuthorized", "buildPerformed", "containerExecutionPerformed", "imagePullPerformed", "nativeExecuted", "gpuExecuted", "trainingExecuted", "trainingReady"]) check(receipt[field] === false, "REPORTED_SCOPE:" + field);
const stderr = receipt.captures[2].streams[1];
check(stderr.bytes === 118 && stderr.seenBytes === 118 && stderr.sha256 === observation.reportedSelectedBuilderStderr.sha256 && receipt.captures[2].streams[0].bytes === 0, "STDERR_METADATA_NOT_TEXT");
check(observation.selectedBuilderStderrTextReceived === false && observation.exactHostDiagnosticEstablished === false && observation.originalHostFilesReceived === false, "DIAGNOSTIC_BOUNDARY");
for (const capture of receipt.captures) for (const stream of capture.streams) check(stream.path === request.expectedReceipt.replace("receipt.json", capture.id + "." + (stream === capture.streams[0] ? "stdout" : "stderr")) && stream.bytes >= 0 && stream.bytes <= request.limits.perQueryStreamBytes && /^[a-f0-9]{64}$/.test(stream.sha256), "REPORTED_CAPTURE_METADATA");
const paths = [directory + "/observation.json", observation.paste, directory + "/verify-report.ts", observation.request];
const sources = await Promise.all(paths.map(async path => ({ path, sha256: hash(await readFile(path)) })));
await writeFile(directory + "/reported-receipt.json", receiptText, { flag: "wx" });
await writeFile(directory + "/record-check.json", JSON.stringify({ status: "PASS_OPERATOR_REPORTED_FAILED_INVENTORY_RECORDS_ONLY", sources, reportedReceiptSha256: hash(Buffer.from(receiptText)),
  reportedQueries: 3, reportedCaptureMetadata: 6, originalHostBytesRehashed: false, exactHostDiagnosticEstablished: false,
  remainingHostInvocations: 0, automaticRetryAuthorized: false, hostOrNativeOrGpuOperationsPerformed: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log("PASS_OPERATOR_REPORTED_FAILED_INVENTORY_RECORDS_ONLY: failure retained; invocation consumed; stderr text absent");
