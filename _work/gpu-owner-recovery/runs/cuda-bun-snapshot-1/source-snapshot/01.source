// SPEC: _spec/recovery.md
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { environment, repository } from "./provision";
import { acquisitionEnvironment, acquisitionStagePlan, acquisitionTaskConfiguration, approvedRequestSha256, bindingPath, bindingVersion,
  inertReviewSha256, predecessorPaths, readContinuationInputs, reviewedFiles, runAcquisitionMiseStages, sha256,
  validateAcquisitionMiseDiscovery, validateAcquisitionTaskConfiguration, validateContinuation } from "./cuda-continuation";
import type { ContinuationInputs } from "./cuda-continuation";

export const jsonBytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const sourceFiles = Object.fromEntries(await Promise.all(reviewedFiles.map(async path => [path, await readFile(resolve(repository, path))])));
const proofs = Object.fromEntries(await Promise.all(predecessorPaths.map(async path => [path, await readFile(resolve(repository, path))])));
const approvedFixture = JSON.parse(new TextDecoder().decode(proofs[predecessorPaths[0]]!));
const fixtureRequestBytes = jsonBytes({ ...approvedFixture, status: "APPROVED_SEQUENCE_IN_PROGRESS_AFTER_INERT_PROBE_PASS",
  authorization: { ...approvedFixture.authorization, grantStatus: "APPROVED_SEQUENCE_IN_PROGRESS" },
  phase: "INERT_PREFLIGHT_PASSED_REMAINING_PIPELINE_SOURCE_GATES_PENDING",
  historicalSecondAttemptReceipt: "_work/gpu-owner-recovery/runs/cuda-isolation-probe-2/receipt.json",
  historicalSecondAttemptClassification: "_work/gpu-owner-recovery/cuda-isolation-probe-2-classification.json",
  actualAttemptReceipt: predecessorPaths[2], actualAttemptClassification: predecessorPaths[3], acquisitionTaskConfiguration,
  inertProbe: { status: "PASS", receipt: predecessorPaths[2], inertNamespaceLaunchEstablished: true,
    fullBuildIsolationQualified: false, custodyQualified: false, cudaCompilationEstablished: false } });
export function continuationFixture(): ContinuationInputs {
  const evidence = { files: { ...sourceFiles }, predecessorProofs: { ...proofs } }, requestBytes = new Uint8Array(fixtureRequestBytes);
  return { requestBytes, evidence, binding: { version: bindingVersion, staticUnitTestsPassed: true, staticTypesPassed: true,
    adversarialSourceAccepted: true, securitySourceAccepted: true, requestSha256: sha256(requestBytes),
    files: Object.fromEntries(reviewedFiles.map(path => [path, sha256(evidence.files[path]!)])),
    predecessorProofs: Object.fromEntries(predecessorPaths.map(path => [path, sha256(evidence.predecessorProofs[path]!)])) } };
}
const validate = (input: ContinuationInputs) => validateContinuation(input.requestBytes, input.binding, input.evidence);
const withRequest = (change: (request: Record<string, any>) => void): ContinuationInputs => {
  const input = continuationFixture(), request = JSON.parse(new TextDecoder().decode(input.requestBytes));
  change(request);
  const requestBytes = jsonBytes(request);
  return { ...input, requestBytes, binding: { ...(input.binding as object), requestSha256: sha256(requestBytes) } };
};
const changedProof = (index: number, change: (value: Record<string, any>) => void): ContinuationInputs => {
  const input = continuationFixture(), path = predecessorPaths[index]!, value = JSON.parse(new TextDecoder().decode(proofs[path]!));
  change(value);
  const bytes = jsonBytes(value), binding = input.binding as { predecessorProofs: Record<string, string> };
  return { ...input, evidence: { ...input.evidence, predecessorProofs: { ...input.evidence.predecessorProofs, [path]: bytes } },
    binding: { ...binding, predecessorProofs: { ...binding.predecessorProofs, [path]: sha256(bytes) } } };
};

test("continuation accepts only the renewed full grant and authenticated third inert predecessor", () => {
  expect(() => validate(continuationFixture())).not.toThrow();
  expect(sha256(proofs[predecessorPaths[0]]!)).toBe(approvedRequestSha256);
  expect(sha256(proofs[predecessorPaths[1]]!)).toBe(inertReviewSha256);
  expect(bindingPath).toBe("_work/gpu-owner-recovery/cuda-acquire-reviewed.json");
});

test("probe-only, halted, consumed, missing grants and arbitrary progress fields fail closed", () => {
  for (const change of [
    (r: Record<string, any>) => { r.authorization.scope = "REVIEWED_INERT_ISOLATION_PROBE_ONLY"; },
    (r: Record<string, any>) => { r.authorization.grantStatus = "HALTED_AFTER_FIRST_FAILURE"; },
    (r: Record<string, any>) => { r.authorization.grantStatus = "CONSUMED_SUCCESS"; },
    (r: Record<string, any>) => { r.authorization.firstActualFailureStopsSequence = false; },
    (r: Record<string, any>) => { r.authorization.source = "OTHER"; },
    (r: Record<string, any>) => { delete r.authorization; },
    (r: Record<string, any>) => { r.authorityGranted = false; },
    (r: Record<string, any>) => { r.renewedExecutorDecisionRequired = true; },
    (r: Record<string, any>) => { r.status = "CONSUMED_SUCCESS"; },
    (r: Record<string, any>) => { r.phase = "COMPILE"; },
    (r: Record<string, any>) => { r.phase = "LLVM_ARTIFACTS_ACQUIRED_ARCHIVE_AUDIT_SOURCE_GATES_PENDING"; },
    (r: Record<string, any>) => { r.acquisitionResult = { status: "PASS" }; },
    (r: Record<string, any>) => { r.halted = false; },
    (r: Record<string, any>) => { r.inertProbe.custodyQualified = true; },
    (r: Record<string, any>) => { r.historicalSecondAttemptReceipt = "wrong"; },
    (r: Record<string, any>) => { r.acquisitionTaskConfiguration = r.taskConfiguration; },
    (r: Record<string, any>) => { delete r.acquisitionTaskConfiguration; },
  ]) expect(() => validate(withRequest(change))).toThrow();
});

test("the entire base contract, both pinned artifacts, compile targets, limits and denied authorities remain exact", () => {
  for (const key of Object.keys(JSON.parse(new TextDecoder().decode(fixtureRequestBytes)))) {
    if (["authorization", "authorityGranted", "renewedExecutorDecisionRequired"].includes(key)) continue;
    expect(() => validate(withRequest(request => { request[key] = null; }))).toThrow();
    expect(() => validate(withRequest(request => { delete request[key]; }))).toThrow();
  }
  for (const index of [0, 1]) for (const key of ["url", "name", "byteLength", "sha256", "destination"]) {
    expect(() => validate(withRequest(request => { request.artifacts[index][key] = "changed"; }))).toThrow();
  }
  for (const key of ["downloadDeadlineMsPerArtifact", "maximumRedirects", "allowedHttpsHosts", "compileDeadlineMsPerTarget", "automaticRetryAllowed"]) {
    expect(() => validate(withRequest(request => { request.requestedExecutionLimits[key] = null; }))).toThrow();
  }
  expect(() => validate(withRequest(request => { request.compileTargets[0].push("--run"); }))).toThrow();
  expect(() => validate(withRequest(request => { request.authorization.unknown = true; }))).toThrow();
});

test("review flags represent source acceptance and require exact current closure, request and predecessor hashes", () => {
  const input = continuationFixture(), binding = input.binding as Record<string, any>;
  for (const key of ["staticUnitTestsPassed", "staticTypesPassed", "adversarialSourceAccepted", "securitySourceAccepted"]) {
    expect(() => validate({ ...input, binding: { ...binding, [key]: false } })).toThrow("ACQUISITION_SOURCE_ACCEPTANCE_REQUIRED");
    const copy = { ...binding }; delete copy[key];
    expect(() => validate({ ...input, binding: copy })).toThrow();
  }
  for (const bad of [undefined, { ...binding, operationalProof: true }, { ...binding, requestSha256: "0".repeat(64) }]) {
    expect(() => validate({ ...input, binding: bad })).toThrow();
  }
  for (const path of reviewedFiles) {
    expect(() => validate({ ...input, evidence: { ...input.evidence, files: { ...input.evidence.files, [path]: jsonBytes("tampered") } } })).toThrow();
    const files = { ...input.evidence.files }; delete files[path];
    expect(() => validate({ ...input, evidence: { ...input.evidence, files } })).toThrow();
  }
  for (const path of predecessorPaths) {
    expect(() => validate({ ...input, evidence: { ...input.evidence, predecessorProofs: { ...input.evidence.predecessorProofs, [path]: jsonBytes("tampered") } } })).toThrow();
  }
  const extra = { ...input.evidence.files, unknown: jsonBytes("unknown") };
  expect(() => validate({ ...input, evidence: { ...input.evidence, files: extra } })).toThrow();
});

test("new bindings cannot rewrite the original isolation source or minimal configuration", () => {
  for (const path of ["_work/gpu-owner-recovery/cuda-isolation.ts", "_work/gpu-owner-recovery/cuda-isolation.test.ts",
    "_work/gpu-owner-recovery/cuda-mise.toml", "_work/gpu-owner-recovery/provision.ts", "_work/gpu-owner-recovery/mise.toml"]) {
    const input = continuationFixture(), binding = input.binding as { files: Record<string, string> }, bytes = jsonBytes("changed");
    expect(() => validate({ ...input, evidence: { ...input.evidence, files: { ...input.evidence.files, [path]: bytes } },
      binding: { ...binding, files: { ...binding.files, [path]: sha256(bytes) } } })).toThrow();
  }
  const input = continuationFixture(), path = "_work/gpu-owner-recovery/verify.ts", binding = input.binding as { files: Record<string, string> }, bytes = jsonBytes("current helper generation");
  expect(() => validate({ ...input, evidence: { ...input.evidence, files: { ...input.evidence.files, [path]: bytes } },
    binding: { ...binding, files: { ...binding.files, [path]: sha256(bytes) } } })).not.toThrow();
});

test("failed, widened or source-changed predecessor evidence cannot become acquisition authority", () => {
  for (const change of [{ status: "FAIL" }, { exitCode: 1 }, { failure: "TIMEOUT" }, { sourceChanged: true },
    { pinnedRequestSha256: "0".repeat(64) }, { pinnedReviewSha256: "0".repeat(64) }, { oneOutsideDeadlineMs: 60000 },
    { custodyQualified: true }, { llvmArchiveDownloaded: true }, { trainingReady: true }, { streams: [] }, { stdoutBytes: 0 }]) {
    expect(() => validate(changedProof(2, value => Object.assign(value, change)))).toThrow();
  }
  for (const change of [{ outcome: "FAIL" }, { fullBuildIsolationQualified: true }, { custodyQualified: true }, { cudaCompilationAttempted: true },
    { automaticRetryPerformed: true }, { originalReceiptPreserved: false }, { extraAuthority: true }]) {
    expect(() => validate(changedProof(3, value => Object.assign(value, change)))).toThrow();
  }
  expect(() => validate(changedProof(0, value => { value.authorityGranted = true; value.trainingReady = true; }))).toThrow("PINNED_PREDECESSOR_REQUIRED");
  expect(() => validate(changedProof(1, value => { value.requestSha256 = "0".repeat(64); }))).toThrow("PINNED_PREDECESSOR_REQUIRED");
});

const config = () => sourceFiles[acquisitionTaskConfiguration]!;
const discovery = () => jsonBytes([{ path: resolve(repository, acquisitionTaskConfiguration), tools: [] }]);
test("two-task TOML and whole private environment preserve the original configuration without fallback", () => {
  expect(() => validateAcquisitionTaskConfiguration(config())).not.toThrow();
  expect(acquisitionEnvironment()).toEqual({ ...environment, MISE_OVERRIDE_CONFIG_FILENAMES: "cuda-acquire-mise.toml" });
  expect(environment.MISE_OVERRIDE_CONFIG_FILENAMES).toBe("mise.toml");
  const parsed = Bun.TOML.parse(new TextDecoder().decode(config())) as { tasks: Record<string, any> };
  expect(Object.keys(parsed.tasks)).toEqual(["cuda:acquire-llvm-archive", "cuda:acquire-llvm-checksums"]);
  for (const artifact of ["llvm-archive", "llvm-checksums"] as const) {
    expect(parsed.tasks[`cuda:acquire-${artifact}`]).toEqual({ dir: "../..", run: `/usr/local/bin/bun --no-env-file --no-install _work/gpu-owner-recovery/cuda-acquire.ts ${artifact}` });
    expect(acquisitionStagePlan(artifact)).toEqual([
      { name: "00-trust", argv: ["/usr/local/bin/mise", "trust", resolve(repository, acquisitionTaskConfiguration)] },
      { name: "01-config", argv: ["/usr/local/bin/mise", "config", "ls", "--json"] },
      { name: "02-acquire", argv: ["/usr/local/bin/mise", "run", "--raw", `cuda:acquire-${artifact}`] },
    ]);
  }
});

test("Mise consumer gates before trust, demands sole discovery, and stops on first failure", async () => {
  const visited: string[] = [], order: string[] = [];
  const io = { verifyOutsideGate: async () => { order.push("gate"); }, readTaskConfiguration: async () => { order.push("config"); return config(); },
    run: async (stage: { name: string }) => { order.push(stage.name); visited.push(stage.name); return { exitCode: 0, stdout: discovery() }; } };
  expect(await runAcquisitionMiseStages("llvm-archive", io)).toEqual({ exitCode: 0, failedStage: null, completedStages: ["00-trust", "01-config", "02-acquire"] });
  expect(order).toEqual(["gate", "config", "00-trust", "gate", "gate", "config", "01-config", "gate", "gate", "config", "02-acquire", "gate"]);
  for (const failed of ["00-trust", "01-config", "02-acquire"]) {
    visited.length = 0;
    const result = await runAcquisitionMiseStages("llvm-archive", { ...io,
      run: async stage => { visited.push(stage.name); return { exitCode: stage.name === failed ? 7 : 0, stdout: discovery() }; } });
    expect(result.exitCode).toBe(7); expect(visited.at(-1)).toBe(failed);
  }
  visited.length = 0;
  await expect(runAcquisitionMiseStages("llvm-archive", { ...io, verifyOutsideGate: async () => { throw Error("OUTSIDE_HASH_MISMATCH"); } })).rejects.toThrow();
  expect(visited).toEqual([]);
  expect((await runAcquisitionMiseStages("llvm-archive", { ...io, run: async () => ({ exitCode: 0, stdout: discovery(), failure: "BOUND" }) })).exitCode).toBe(1);
});

test("configuration/discovery injection and original-config fallback fail before artifact task", async () => {
  for (const text of ['[tools]\nrust="latest"', '[hooks]\nenter="bad"', '[env]\nSECRET="bad"', 'not TOML',
    new TextDecoder().decode(config()) + '\n[tasks.extra]\nrun="bad"']) {
    expect(() => validateAcquisitionTaskConfiguration(new TextEncoder().encode(text))).toThrow();
  }
  for (const bytes of [new Uint8Array(4097), new Uint8Array([255])]) expect(() => validateAcquisitionTaskConfiguration(bytes)).toThrow();
  for (const bytes of [jsonBytes([]), jsonBytes([{ path: resolve(repository, "_work/gpu-owner-recovery/cuda-mise.toml"), tools: [] }]),
    jsonBytes([{ path: resolve(repository, acquisitionTaskConfiguration), tools: ["rust"] }]), jsonBytes([{}, {}]), jsonBytes({}), new Uint8Array(65537), new Uint8Array([255])]) {
    expect(() => validateAcquisitionMiseDiscovery(bytes)).toThrow();
    const visited: string[] = [];
    await expect(runAcquisitionMiseStages("llvm-archive", { verifyOutsideGate: async () => {}, readTaskConfiguration: async () => config(),
      run: async stage => { visited.push(stage.name); return { exitCode: 0, stdout: bytes }; } })).rejects.toThrow();
    expect(visited).toEqual(["00-trust", "01-config"]);
  }
});

test("the production continuation loader has no path argument and performs reads only", async () => {
  expect(readContinuationInputs.length).toBe(0);
  const source = await readFile(resolve(repository, "_work/gpu-owner-recovery/cuda-continuation.ts"), "utf8");
  for (const pattern of [/\bfetch\s*\(/, /Bun\.spawn/, /process\.env/, /\b(?:mkdir|writeFile|unlink|rm|chmod)\s*\(/, /\brunBounded\s*\(/,
    /\bset(?:Timeout|Interval)\s*\(/, /AbortSignal\.timeout/, /\.\/cuda-isolation["']/]) expect(source).not.toMatch(pattern);
});
