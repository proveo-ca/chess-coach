// SPEC: _spec/gpu-host-build-inventory.puml
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const root = "_work/gpu-owner-recovery/runs/host-build-inventory-observation-2/";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: boolean, label: string) => { if (!value) throw Error(label); };
const report = JSON.parse(await readFile(root + "reported-receipt.json", "utf8")), observation = JSON.parse(await readFile(root + "observation.json", "utf8"));
const request = JSON.parse(await readFile(observation.request, "utf8")), summary = (await readFile(root + "operator-summary.txt", "utf8")).trimEnd().split("\n");
const frame = JSON.parse(summary[0]!);
check(summary.length === 2 && summary[1] === "HOST_BUILD_INVENTORY_EXIT=0" && frame.status === "PASS_METADATA_ONLY" && frame.failure === null && frame.queries === 8 && frame.receipt === request.expectedReceipt, "REPORTED_PASS_FRAMES");
check(report.status === "PASS_METADATA_ONLY" && report.failure === null && report.results.length === 8 && report.results.every((row: { exitCode: number; failure: null }) => row.exitCode === 0 && row.failure === null), "REPORTED_EIGHT_SUCCESSFUL_QUERIES");
check(JSON.stringify(report.results[2].argv) === JSON.stringify(["docker", "buildx", "inspect"]), "CORRECTED_INSPECT_REPORTED");
const metadata = report.metadata;
check(metadata.contextName === "default" && metadata.contextEndpoint.DockerEndpoint === "unix:///var/run/docker.sock" && metadata.dockerHostOverridePresent === false, "REPORTED_LOCAL_CONTEXT");
check(metadata.builder.Name === "proveo-multiarch" && metadata.builder.Driver === "docker-container" && metadata.builder.Nodes.length === 1 && metadata.builder.Nodes[0].Name === "proveo-multiarch0" && metadata.builder.Nodes[0].Status === "running", "REPORTED_SHARED_BUILDER");
for (const key of ["NanoCpus", "CpuQuota", "CpuPeriod", "Memory", "MemorySwap"]) check(metadata.builderContainer[key] === 0, "NO_FINITE_BUILDER_CAP_REPORTED:" + key);
check(metadata.engine.NCPU === 16 && metadata.engine.MemTotal === 41706151936 && metadata.engine.CgroupVersion === "2" && metadata.engine.ServerVersion === "29.9.2", "REPORTED_ENGINE");
const digests = ["4c2fd73ef19c5ef9d54bee03b06b2839a392604fbfcd578ed948b71b37c1d7fb", "18639686662e5cd8a963ffb967dd130034a2a2d076a52e65dfd4fe18f75cc038"];
check(metadata.images.length === 2 && metadata.images.every((image: { Id: string; Os: string; Architecture: string; RepoDigests: string[] }, i: number) => image.Id === "sha256:" + digests[i] && image.Os === "linux" && image.Architecture === "amd64" && image.RepoDigests.some(value => value.endsWith("@sha256:" + digests[i]))), "REPORTED_PINNED_ENGINE_IMAGES");
check(metadata.hostMemory.includes("MemAvailable:   27194428 kB\n") && metadata.hostFilesystem.includes("168915672"), "REPORTED_HOST_CAPACITY_NOT_BUILDER_GUARANTEE");
check(report.captures.length === 8 && report.captures.every((capture: { id: string; streams: { bytes: number; seenBytes: number; sha256: string }[] }, i: number) => capture.id === report.results[i].id && capture.streams.length === 2 && capture.streams.every(stream => stream.bytes === stream.seenBytes && stream.bytes <= 32768 && /^[a-f0-9]{64}$/.test(stream.sha256))), "REPORTED_SIXTEEN_CAPTURE_METADATA_ROWS");
for (const field of ["automaticRetryAuthorized", "buildAuthorized", "buildPerformed", "containerExecutionPerformed", "imagePullPerformed", "nativeExecuted", "gpuExecuted", "trainingExecuted", "trainingReady"]) check(report[field] === false, "METADATA_ONLY_SCOPE:" + field);
check(report.hostInvocationsConsumed === 1 && report.remainingHostInvocations === 0 && observation.remainingHostInvocations === 0 && observation.originalHostFilesReceived === false, "REPORT_SCOPE_CONSUMPTION");
const paths = [root + "reported-receipt.json", root + "operator-summary.txt", root + "observation.json", root + "verify-report.ts", observation.request];
const sources = await Promise.all(paths.map(async path => ({ path, sha256: hash(await readFile(path)) })));
await writeFile(root + "record-check.json", JSON.stringify({ status: "PASS_OPERATOR_REPORTED_INVENTORY2_RECORDS_ONLY", sources, reportedQueryExits: 8, reportedCaptureMetadataRows: 16,
  originalHostArtifactBytesRehashed: false, hostInvocationsRemaining: 0, sharedBuilderFiniteLimitsEstablished: false, buildAuthorized: false, hostOrNativeOrGpuOperationsPerformed: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log("PASS_OPERATOR_REPORTED_INVENTORY2_RECORDS_ONLY: eight exits accepted; shared builder caps unset; grant consumed");
