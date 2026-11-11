// SPEC: _spec/recovery.md
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { environment, repository } from "./provision";

export const requestPath = "_work/gpu-owner-recovery/cuda-llvm-request.json";
export const bindingPath = "_work/gpu-owner-recovery/cuda-acquire-reviewed.json";
export const acquisitionTaskConfiguration = "_work/gpu-owner-recovery/cuda-acquire-mise.toml";
export const bindingVersion = "chess-coach.cuda-acquisition-source-review.v1";
export const reviewedFiles = [
  "_work/gpu-owner-recovery/cuda-continuation.ts", "_work/gpu-owner-recovery/cuda-continuation.test.ts",
  "_work/gpu-owner-recovery/cuda-acquire.ts", "_work/gpu-owner-recovery/cuda-acquire.test.ts", acquisitionTaskConfiguration,
  "_work/gpu-owner-recovery/provision.ts", "_work/gpu-owner-recovery/verify.ts", "_work/gpu-owner-recovery/verify.test.ts",
  "_work/gpu-owner-recovery/command-supervisor.ts", "_work/gpu-owner-recovery/tsconfig.json", "tsconfig.json",
  "_work/gpu-owner-recovery/cuda-isolation.ts", "_work/gpu-owner-recovery/cuda-isolation.test.ts",
  "_work/gpu-owner-recovery/cuda-mise.toml", "_work/gpu-owner-recovery/mise.toml",
] as const;
export const predecessorPaths = [
  "_work/gpu-owner-recovery/runs/cuda-isolation-probe-3/approved-request.json",
  "_work/gpu-owner-recovery/cuda-isolation-reviewed-v3.json",
  "_work/gpu-owner-recovery/runs/cuda-isolation-probe-3/receipt.json",
  "_work/gpu-owner-recovery/cuda-isolation-probe-3-classification.json",
  "_work/gpu-owner-recovery/runs/cuda-isolation-probe-3/command.stdout",
  "_work/gpu-owner-recovery/runs/cuda-isolation-probe-3/command.stderr",
] as const;
export const approvedRequestSha256 = "2882f02baf9054e1890d58f4c984d3adc49fbbf0fad2ee5359312759a17a64c5";
export const inertReviewSha256 = "509d75b8bdda611f8059307368a043130b34a75179cb72c31ae3ba28a8257f94";
export type ArtifactId = "llvm-archive" | "llvm-checksums";
export type ArtifactIdentity = Readonly<{ name: string; url: string; byteLength: number; sha256: string; destination: string }>;
export const artifactIdentities: Readonly<Record<ArtifactId, ArtifactIdentity>> = Object.freeze({
  "llvm-archive": Object.freeze({ name: "tracel-llvm-23.1.0-4-linux-x64.tar.xz",
    url: "https://github.com/tracel-ai/tracel-llvm/releases/download/v23.1.0-4/linux-x64.tar.xz", byteLength: 45439652,
    sha256: "c394bb1b10ac785f16d3d92d688a9343ba869f720e9cf9ca3f1abf2f401f165f",
    destination: "_work/gpu-owner-recovery/cache/home/.cache/tracel/tracel-llvm-23.1.0-4-linux-x64.tar.xz" }),
  "llvm-checksums": Object.freeze({ name: "tracel-llvm-23.1.0-4-linux-x64.checksums.json",
    url: "https://github.com/tracel-ai/tracel-llvm/releases/download/v23.1.0-4/linux-x64.checksums.json", byteLength: 297,
    sha256: "57780b96c702d2ac595c52da61961549450648b8d18f5b81b7a1d06afa83682d",
    destination: "_work/gpu-owner-recovery/cache/home/.cache/tracel/tracel-llvm-23.1.0-4-linux-x64.checksums.json" }),
});
export const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("OBJECT_REQUIRED");
  return value as Record<string, unknown>;
};
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
const exactKeys = (value: object, keys: readonly string[]) => same(Object.keys(value).sort(), [...keys].sort());
const parse = (bytes: Uint8Array): unknown => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
export type ContinuationEvidence = Readonly<{ files: Readonly<Record<string, Uint8Array>>; predecessorProofs: Readonly<Record<string, Uint8Array>> }>;
export type ContinuationInputs = Readonly<{ requestBytes: Uint8Array; binding: unknown; evidence: ContinuationEvidence }>;

export function validateAcquisitionTaskConfiguration(bytes: Uint8Array): void {
  if (bytes.byteLength > 4096) throw Error("EXACT_ACQUISITION_TASK_CONFIGURATION_REQUIRED");
  const configuration = Bun.TOML.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  const tasks = Object.fromEntries((["llvm-archive", "llvm-checksums"] as const).map(id => [`cuda:acquire-${id}`, { dir: "../..",
    run: `/usr/local/bin/bun --no-env-file --no-install _work/gpu-owner-recovery/cuda-acquire.ts ${id}` }]));
  if (!same(configuration, { tasks })) throw Error("EXACT_ACQUISITION_TASK_CONFIGURATION_REQUIRED");
}

export function validateContinuation(requestBytes: Uint8Array, binding: unknown, evidence: ContinuationEvidence): void {
  const review = object(binding), files = object(review.files), proofs = object(review.predecessorProofs);
  const accepted = ["staticUnitTestsPassed", "staticTypesPassed", "adversarialSourceAccepted", "securitySourceAccepted"];
  if (!exactKeys(review, ["version", ...accepted, "requestSha256", "files", "predecessorProofs"]) || review.version !== bindingVersion ||
      accepted.some(key => review[key] !== true)) throw Error("ACQUISITION_SOURCE_ACCEPTANCE_REQUIRED");
  if (review.requestSha256 !== sha256(requestBytes) || !exactKeys(files, reviewedFiles) || !exactKeys(evidence.files, reviewedFiles) ||
      !exactKeys(proofs, predecessorPaths) || !exactKeys(evidence.predecessorProofs, predecessorPaths) ||
      reviewedFiles.some(path => files[path] !== sha256(evidence.files[path]!)) ||
      predecessorPaths.some(path => proofs[path] !== sha256(evidence.predecessorProofs[path]!))) throw Error("CONTINUATION_HASH_MISMATCH");
  const raw = evidence.predecessorProofs;
  if (sha256(raw[predecessorPaths[0]]!) !== approvedRequestSha256 || sha256(raw[predecessorPaths[1]]!) !== inertReviewSha256) throw Error("PINNED_PREDECESSOR_REQUIRED");
  const approved = object(parse(raw[predecessorPaths[0]]!)), originalReview = object(parse(raw[predecessorPaths[1]]!));
  const originalHashes = object(originalReview.files), request = object(parse(requestBytes)), authorization = object(request.authorization);
  if (approved.authorityGranted !== true || request.authorityGranted !== true || request.renewedExecutorDecisionRequired !== false ||
      authorization.scope !== "EXACT_TWO_LLVM_FILES_GATED_LOCAL_PROVISIONING_AND_TWO_ISOLATED_NO_RUN_TARGETS_ONLY" ||
      authorization.source !== "EXECUTOR_SELECTED_RENEW_FULL_SCOPE_AFTER_GNU_TRUE_LAYOUT_CORRECTION" || authorization.firstActualFailureStopsSequence !== true ||
      !same(request.artifacts, [artifactIdentities["llvm-archive"], artifactIdentities["llvm-checksums"]])) throw Error("FULL_UNCHANGED_GRANT_REQUIRED");
  const expected = { ...approved, status: "APPROVED_SEQUENCE_IN_PROGRESS_AFTER_INERT_PROBE_PASS",
    authorization: { ...object(approved.authorization), grantStatus: "APPROVED_SEQUENCE_IN_PROGRESS" },
    phase: "INERT_PREFLIGHT_PASSED_REMAINING_PIPELINE_SOURCE_GATES_PENDING",
    historicalSecondAttemptReceipt: "_work/gpu-owner-recovery/runs/cuda-isolation-probe-2/receipt.json",
    historicalSecondAttemptClassification: "_work/gpu-owner-recovery/cuda-isolation-probe-2-classification.json",
    actualAttemptReceipt: predecessorPaths[2], actualAttemptClassification: predecessorPaths[3], acquisitionTaskConfiguration,
    inertProbe: { status: "PASS", receipt: predecessorPaths[2], inertNamespaceLaunchEstablished: true,
      fullBuildIsolationQualified: false, custodyQualified: false, cudaCompilationEstablished: false } };
  if (!same(request, expected)) throw Error("EXACT_CONTINUATION_PROGRESS_REQUIRED");
  for (const path of ["_work/gpu-owner-recovery/cuda-isolation.ts", "_work/gpu-owner-recovery/cuda-isolation.test.ts",
    "_work/gpu-owner-recovery/cuda-mise.toml", "_work/gpu-owner-recovery/provision.ts"]) {
    if (sha256(evidence.files[path]!) !== originalHashes[path]) throw Error("FROZEN_PREDECESSOR_SOURCE_CHANGED");
  }
  if (new TextDecoder().decode(evidence.files["_work/gpu-owner-recovery/mise.toml"]!) !==
      '[tools]\n"core:rust" = { version = "1.95.0", profile = "minimal", components = ["rustfmt", "clippy"], targets = [] }\n') throw Error("ORIGINAL_TOOL_CONFIGURATION_CHANGED");
  validateAcquisitionTaskConfiguration(evidence.files[acquisitionTaskConfiguration]!);
  const receipt = object(parse(raw[predecessorPaths[2]]!)), classification = object(parse(raw[predecessorPaths[3]]!));
  if (receipt.version !== "chess-coach.cuda-renewed-inert-isolation-probe.v1" || receipt.status !== "PASS" || receipt.exitCode !== 0 ||
      receipt.failure !== null || receipt.sourceChanged !== false || receipt.pinnedRequestSha256 !== approvedRequestSha256 ||
      receipt.pinnedReviewSha256 !== inertReviewSha256 || !same(receipt.reviewedFiles, originalHashes) || receipt.oneOutsideDeadlineMs !== 30000 ||
      receipt.stageConsumer !== "runMiseStages" || receipt.attemptOrder !== "INERT_STAGE_BEFORE_ANY_LLVM_ACQUISITION") throw Error("PASS_PREDECESSOR_RECEIPT_REQUIRED");
  for (const key of ["llvmArchiveDownloaded", "llvmCodeExecuted", "cudaCompilationEstablished", "buildIsolationQualified", "custodyQualified", "actualHostExecuted", "cudaGpuCodeExecuted", "trainingReady"]) {
    if (receipt[key] !== false) throw Error("NARROW_INERT_RECEIPT_REQUIRED");
  }
  const streamHashes = ["62f891ad39613ffd3a20af2e104fbd780020182076ed7d41741392354de6ebc1", "a9ab5f2216858bb56a0a8925fd25fdb20d121c8603d40fdd950457d35d6bfdf9"];
  const streams = ["stdout", "stderr"].map((stream, i) => ({ stream, path: predecessorPaths[4 + i], bytes: raw[predecessorPaths[4 + i]!]!.byteLength,
    sha256: sha256(raw[predecessorPaths[4 + i]!]!) }));
  if (!same(receipt.streams, streams) || streams.some((stream, index) => stream.sha256 !== streamHashes[index]) ||
      receipt.stdoutBytes !== streams[0]!.bytes || receipt.stderrBytes !== streams[1]!.bytes) throw Error("PREDECESSOR_STREAM_IDENTITY_REQUIRED");
  if (!same(classification, { version: "chess-coach.cuda-inert-probe-classification.v1", originalReceipt: predecessorPaths[2], originalReceiptPreserved: true,
    approvedRequestCapture: predecessorPaths[0], approvedRequestSha256, reviewRecord: predecessorPaths[1], reviewRecordSha256: inertReviewSha256,
    outcome: "PASS", exitCode: 0, configurationTrustPassed: true, soleConfigurationDiscoveryPassed: true, namespaceCommandAttempted: true,
    inertNamespaceLaunchEstablished: true, inertCommand: "/usr/bin/true", physicalExecutable: "/usr/bin/gnutrue", fullBuildIsolationQualified: false,
    custodyQualified: false, llvmArchiveDownloaded: false, llvmCodeExecuted: false, cudaCompilationAttempted: false, automaticRetryPerformed: false,
    remainingFullScopeAuthorityDependsOnUnchangedGrantAndFurtherSourceGates: true, trainingReady: false })) throw Error("NARROW_PASS_CLASSIFICATION_REQUIRED");
}

async function readFixed(path: string): Promise<Uint8Array> {
  const handle = await open(resolve(repository, path), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.size <= 0n || before.size > 1024n * 1024n) throw Error("BOUNDED_REGULAR_INPUT_REQUIRED");
    const bytes = Buffer.alloc(Number(before.size) + 1);
    let length = 0;
    while (length < bytes.byteLength) {
      const result = await handle.read(bytes, length, bytes.byteLength - length, length);
      if (result.bytesRead === 0) break;
      length += result.bytesRead;
    }
    const after = await handle.stat({ bigint: true });
    if (BigInt(length) !== before.size || before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size ||
        before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs) throw Error("CONTINUATION_INPUT_CHANGED");
    return bytes.subarray(0, length);
  } finally { await handle.close(); }
}

export async function readContinuationInputs(): Promise<ContinuationInputs> {
  const requestBytes = await readFixed(requestPath), binding = parse(await readFixed(bindingPath));
  const files = Object.fromEntries(await Promise.all(reviewedFiles.map(async path => [path, await readFixed(path)])));
  const predecessorProofs = Object.fromEntries(await Promise.all(predecessorPaths.map(async path => [path, await readFixed(path)])));
  return { requestBytes, binding, evidence: { files, predecessorProofs } };
}

export function acquisitionEnvironment(): Record<string, string> {
  return { ...environment, MISE_OVERRIDE_CONFIG_FILENAMES: "cuda-acquire-mise.toml" };
}
export type AcquisitionMiseStage = Readonly<{ name: "00-trust" | "01-config" | "02-acquire"; argv: string[] }>;
export function acquisitionStagePlan(artifact: ArtifactId): AcquisitionMiseStage[] {
  if (artifact !== "llvm-archive" && artifact !== "llvm-checksums") throw Error("CLOSED_ARTIFACT_REQUIRED");
  return [
    { name: "00-trust", argv: ["/usr/local/bin/mise", "trust", resolve(repository, acquisitionTaskConfiguration)] },
    { name: "01-config", argv: ["/usr/local/bin/mise", "config", "ls", "--json"] },
    { name: "02-acquire", argv: ["/usr/local/bin/mise", "run", "--raw", `cuda:acquire-${artifact}`] },
  ];
}
export function validateAcquisitionMiseDiscovery(bytes: Uint8Array): void {
  if (bytes.byteLength > 65536) throw Error("SOLE_ACQUISITION_CONFIGURATION_REQUIRED");
  const value = parse(bytes);
  if (!Array.isArray(value) || value.length !== 1) throw Error("SOLE_ACQUISITION_CONFIGURATION_REQUIRED");
  const selected = object(value[0]);
  if (selected.path !== resolve(repository, acquisitionTaskConfiguration) ||
      (selected.tools !== undefined && !same(selected.tools, []))) throw Error("SOLE_ACQUISITION_CONFIGURATION_REQUIRED");
}
export type TrustedAcquisitionMiseIO = Readonly<{
  verifyOutsideGate: () => Promise<void>; readTaskConfiguration: () => Promise<Uint8Array>;
  run: (stage: AcquisitionMiseStage) => Promise<{ exitCode: number; stdout: Uint8Array; failure?: string | null }>;
}>;
export async function runAcquisitionMiseStages(artifact: ArtifactId, trusted: TrustedAcquisitionMiseIO) {
  const completedStages: AcquisitionMiseStage["name"][] = [];
  for (const stage of acquisitionStagePlan(artifact)) {
    await trusted.verifyOutsideGate();
    validateAcquisitionTaskConfiguration(await trusted.readTaskConfiguration());
    const result = await trusted.run(stage);
    if (!Number.isInteger(result.exitCode) || result.exitCode < 0 || result.exitCode > 255) throw Error("INVALID_MISE_STAGE_EXIT");
    if (result.exitCode !== 0 || (result.failure !== undefined && result.failure !== null)) return { exitCode: result.exitCode || 1, failedStage: stage.name, completedStages };
    if (stage.name === "01-config") validateAcquisitionMiseDiscovery(result.stdout);
    await trusted.verifyOutsideGate();
    completedStages.push(stage.name);
  }
  return { exitCode: 0, failedStage: null, completedStages };
}
