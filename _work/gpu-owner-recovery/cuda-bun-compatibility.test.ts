// SPEC: _spec/recovery.md
import { expect, spyOn, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { repository } from "./provision";
import { sha256 } from "./cuda-continuation";
import { reviewedFiles as archiveFiles, predecessorPaths as archiveProofs, validateArchivePlanSnapshot } from "./cuda-archive";
import type { ArchiveNativeClosure, AuditedFile, XZProcess } from "./cuda-archive";
import { buildCompatibilityFixture, compatibilityFixturePath, compatibilityFixturePins } from "./cuda-bun-compatibility-fixture";
import { invokeCompatibility, validateInvocationResult } from "./cuda-bun-compatibility-invoke";
import { approvedCompatibilityRequestSha256, bindingPath, bindingVersion, classifyCompatibilityCase, compatibilityArgv, compatibilityCaseOrder,
  compatibilityCasePlan, compatibilityCasePrograms, compatibilityCLI, compatibilityEnvironment, compatibilityFailureCode, compatibilityLimits,
  compatibilityMarkers, compatibilityPaths, compatibilityStagePlan, compatibilityTaskConfiguration, compatibilityTestOnly, haltedRequestSha256,
  historicalArchiveInputs, launchCompatibilityCase, predecessorPaths, requestPath, reviewedFiles, runCompatibilityMiseStages,
  validateCompatibilityContinuation, validateCompatibilityMiseDiscovery, validateCompatibilityResult, validateCompatibilityTaskConfiguration } from "./cuda-bun-compatibility";
import type { CompatibilityCase, CompatibilityCaseResult, CompatibilityChild, CompatibilityContinuationInputs, CompatibilityDirectories,
  CompatibilityLaunchResult, CompatibilityPlan, TrustedCompatibilityIO } from "./cuda-bun-compatibility";

const base = "_work/gpu-owner-recovery/", oldRoot = `${base}runs/cuda-archive-audit-2/`, readonlyRoot = `${base}runs/cuda-archive-v2-plan-1/`;
const text = (value: string) => new TextEncoder().encode(value), bytes = (value: unknown) => text(JSON.stringify(value));
const json = (value: Uint8Array): any => JSON.parse(new TextDecoder().decode(value));
const copy = <T>(value: T): T => structuredClone(value);
const fixtureBytes = () => text(JSON.stringify(buildCompatibilityFixture(), null, 2) + "\n");
const configuration = text('# SPEC: _spec/recovery.md\n[tasks."cuda:diagnose-bun-root"]\ndir = "../.."\nrun = "/usr/local/bin/bun --no-env-file --no-install _work/gpu-owner-recovery/cuda-bun-compatibility.ts diagnose"\n');
const approvedRequestBytes = text(`{
  "version": "chess-coach.cuda-bun-compatibility-request.v1",
  "status": "APPROVED_SYNTHETIC_DIAGNOSTIC_SOURCE_GATES_PENDING",
  "authorityGranted": true,
  "authorization": {
    "source": "EXECUTOR_SELECTED_SYNTHETIC_DIAGNOSTICS_RECOMMENDED",
    "scope": "PINNED_PRIVATE_BUN_THREE_CASE_SYNTHETIC_DIAGNOSTICS_ONLY",
    "grantStatus": "APPROVED_NOT_EXECUTED",
    "firstUnexpectedActualFailureStopsSequence": true
  },
  "phase": "SYNTHETIC_DIAGNOSTIC_SOURCE_GATES_PENDING",
  "selectedOption": "Synthetic diagnostics (Recommended)",
  "haltedFullRequest": {
    "path": "_work/gpu-owner-recovery/cuda-llvm-request.json",
    "snapshot": "_work/gpu-owner-recovery/runs/cuda-bun-compatibility-1/llvm-request-halted.json",
    "sha256": "e0b54ee82895a3da613e92e764ccd7db2c10f2001e95241543b36f49b6f1cc63",
    "authorityGranted": false
  },
  "caseOrder": ["startup", "parser", "xz"],
  "dependencyChain": "startup -> parser -> xz",
  "limits": {
    "maximumCases": 3,
    "maximumInvocationsPerCase": 1,
    "wholeSuiteDeadlineMs": 30000,
    "stdoutBytesPerCase": 65536,
    "stderrBytesPerCase": 65536,
    "xzDecompressionMemoryBytes": 268435456,
    "automaticRetryAllowed": false,
    "perCaseDeadlineRenewalAllowed": false
  },
  "privateBun": {
    "path": "_work/gpu-owner-recovery/cache/native-audit-bun-1/bun",
    "byteLength": 80761952,
    "sha256": "33d56b070be6a9e3da0ab013038b43d1645d0534ca811ecdba4472599117eb4b",
    "uid": 1000,
    "directoryMode": "0700",
    "executableMode": "0500",
    "captureReceipt": "_work/gpu-owner-recovery/runs/cuda-bun-snapshot-1/capture.json"
  },
  "syntheticFixture": {
    "manifest": "_work/gpu-owner-recovery/fixtures/cuda-bun-compatibility.json",
    "prefix": "tracel-llvm-23.1.0-4",
    "tarBytes": 1536,
    "xzBytes": 1592,
    "regularFileBytes": 0,
    "explicitEntries": 1,
    "sourceOnlyPreparation": true,
    "nativeCompressorInvocationAllowed": false
  },
  "outcomes": [
    "COMPATIBLE",
    "BUN_ABORT_DIAGNOSTIC_OBSERVED",
    "SKIPPED_DEPENDENCY",
    "UNEXPECTED_FAILURE"
  ],
  "knownAbortObservation": {
    "bunVersion": "1.4.0",
    "panicText": "panic(main thread): abort() called",
    "stdoutMustBeEmpty": true,
    "exitMustBeNonzero": true,
    "countsAsCompatibilityPass": false,
    "dependentCasesMustBeSkipped": true
  },
  "isolationPolicy": "UNCHANGED_RESTRICTED_NATIVE_AUDIT_ROOT_WITH_REAL_ARCHIVE_REMOVED",
  "outerBootstrapTrust": "EXISTING_C1_BUN_AND_MISE_BOOTSTRAP_ASSUMPTION_RETAINED_NOT_AUTHENTICATED_BY_GUEST_SNAPSHOT",
  "taskConfiguration": "_work/gpu-owner-recovery/cuda-bun-compatibility-mise.toml",
  "newSourceTestsTypesAndSecurityAdversarialDevopsReviewsRequired": true,
  "independentOutsidePinRequiredBeforeOperationalImportsOrMise": true,
  "realArchiveReadRehashOrMountAuthorized": false,
  "realArchiveRetryAuthorized": false,
  "fullPipelineRenewalAuthorized": false,
  "privateBunRecaptureAuthorized": false,
  "newToolsDownloadsOrRuntimeUpgradesAuthorized": false,
  "nativeHelperCompilationAuthorized": false,
  "workspaceCargoLockBackendOrPrecisionChangesAuthorized": false,
  "isolationRuntimeFlagOrEnvironmentExpansionAuthorized": false,
  "procPidNamespaceSessionNetworkOrDeviceExpansionAuthorized": false,
  "credentialSocketOrParentEscapeExposureAuthorized": false,
  "ptraceAuthorized": false,
  "extractionOrLlvmExecutionAuthorized": false,
  "modelTestBinaryOrGpuExecutionAuthorized": false,
  "hostDockerImageOrProductionOperationsAuthorized": false,
  "crashReportVisitUploadOrPublicationAuthorized": false,
  "trainingAuthorized": false,
  "diagnosticComplete": false,
  "compatibilityPassed": false,
  "archiveAuditPassed": false,
  "trainingReady": false
}
`);
function seal(input: CompatibilityContinuationInputs): CompatibilityContinuationInputs {
  return { ...input, binding: { version: bindingVersion, staticUnitTestsPassed: true, staticTypesPassed: true, adversarialSourceAccepted: true,
    securitySourceAccepted: true, devopsSourceAccepted: true, requestSha256: sha256(input.requestBytes),
    files: Object.fromEntries(reviewedFiles.map(path => [path, sha256(input.evidence.files[path]!)])),
    predecessorProofs: Object.fromEntries(predecessorPaths.map(path => [path, sha256(input.evidence.predecessorProofs[path]!)])) } };
}
async function continuationFixture(): Promise<CompatibilityContinuationInputs> {
  const predecessorProofs = Object.fromEntries(await Promise.all(predecessorPaths.map(async path => [path, new Uint8Array(await readFile(resolve(repository,
    path === compatibilityPaths.haltedRequest ? compatibilityPaths.haltedSnapshot : path)))])));
  const files = Object.fromEntries(reviewedFiles.map(path => [path, text(`fixture source:${path}`)]));
  files[compatibilityTaskConfiguration] = configuration; files[compatibilityFixturePath] = fixtureBytes();
  return seal({ requestBytes: approvedRequestBytes.slice(), binding: null, evidence: { files, predecessorProofs } });
}
function nativeFixture(input: CompatibilityContinuationInputs): ArchiveNativeClosure {
  const plan = json(input.evidence.predecessorProofs[`${readonlyRoot}command.stdout`]!).rootPlan;
  return { files: plan.files.filter((mount: { guest: string }) => !mount.guest.startsWith("/audit/") && !mount.guest.startsWith("/inputs/")), launcher: plan.launcher,
    nativeBinding: "C1_PATH_BIND_AFTER_FD_CLOSE_NOT_ATOMIC_MOUNT_CUSTODY", custodyQualified: false };
}
function file(source: string, content: Uint8Array, mode = 0o100644): AuditedFile {
  return { source, sha256: sha256(content), identity: { device: "fixture-device", inode: source, bytes: content.byteLength, mode, uid: process.getuid!(), links: 1, mtime: "1", ctime: "1" } };
}
const directories: CompatibilityDirectories = Object.fromEntries(["input", "output", "evidence"].map(name => [name,
  { device: "fixture-device", inode: name, mode: 0o40700, uid: process.getuid!() }])) as CompatibilityDirectories;
const success = (name: CompatibilityCase): CompatibilityLaunchResult => ({ stdout: text(compatibilityMarkers[name]), stderr: new Uint8Array(), exitCode: 0, signalCode: null,
  reaped: true, stdoutEOF: true, stderrEOF: true, failure: null });
const crashBanner = (program = compatibilityCasePrograms.startup) => `============================================================
Bun v1.4.0 (34cbb9a40) Linux x64
Linux Kernel v7.0.14 | glibc v2.43
CPU: sse42 popcnt avx avx2 avx512
Args: "/usr/local/bin/bun" "--no-env-file" "--no-install" "-e" ${JSON.stringify(program)}
Features: jsc${" "}

Elapsed: 1ms | User: 0ms | Sys: 8ms
RSS: 24.58 MB | Peak: 8.31 MB | Commit: 24.58 MB | Faults: 0

panic(main thread): abort() called
oh no: Bun has crashed. This indicates a bug in Bun, not your code.

To send a redacted crash report to Bun's team,
please file a GitHub issue using the link below:

 https://bun.report/1.4.0/opaque-retained-not-visited

`;
const abort = (name: CompatibilityCase): CompatibilityLaunchResult => ({ ...success(name), stdout: new Uint8Array(), stderr: text(crashBanner(compatibilityCasePrograms[name])), exitCode: 134 });
async function suiteFixture(overrides: Partial<TrustedCompatibilityIO> = {}) {
  const input = await continuationFixture(), events: string[] = [], roots: CompatibilityPlan[] = [], retained: CompatibilityCaseResult[] = [], publications: Uint8Array[] = [];
  const io: TrustedCompatibilityIO = {
    readContinuation: async () => { events.push("read"); return input; }, nativeClosure: async () => { events.push("native"); return nativeFixture(input); },
    readSource: async path => { events.push(`source:${path}`); return file(resolve(repository, path), input.evidence.files[path]!); },
    claim: async () => { events.push("claim"); return directories; }, prepareFixture: async value => { events.push("prepare"); expect(value.byteLength).toBe(1592);
      expect(sha256(value)).toBe(compatibilityFixturePins.xzSha256); return file(compatibilityPaths.preparedFixture, value, 0o100600); },
    revalidate: async plan => { events.push("gate"); validateArchivePlanSnapshot(plan, validateCompatibilityContinuation(input)); },
    launch: async (plan, name) => { roots.push(plan); events.push(`launch:${name}`); return success(name); },
    retain: async (name, _launch, result) => { events.push(`retain:${name}`); retained.push(result); },
    commit: async value => { events.push("publish"); publications.push(value); }, ...overrides,
  };
  return { input, io, events, roots, retained, publications };
}

test("immutable diagnostic request and exact 33-source/140-proof packet authenticate saved historical code only", async () => {
  expect(approvedRequestBytes.byteLength).toBe(3689); expect(sha256(approvedRequestBytes)).toBe(approvedCompatibilityRequestSha256);
  const input = await continuationFixture(), capture = validateCompatibilityContinuation(input), historical = historicalArchiveInputs(input.evidence.predecessorProofs);
  expect(capture.sha256).toBe("33d56b070be6a9e3da0ab013038b43d1645d0534ca811ecdba4472599117eb4b");
  expect(requestPath).toBe(`${base}cuda-bun-compatibility-request.json`); expect(bindingPath).toBe(`${base}cuda-bun-compatibility-reviewed.json`);
  expect(bindingVersion).toBe("chess-coach.cuda-bun-compatibility-source-review.v1");
  expect(reviewedFiles).toHaveLength(33); expect(new Set(reviewedFiles).size).toBe(33); expect(predecessorPaths).toHaveLength(140); expect(new Set(predecessorPaths).size).toBe(140);
  for (const path of archiveFiles) expect(reviewedFiles).toContain(path);
  for (const path of archiveProofs) expect(predecessorPaths).toContain(path);
  expect(archiveFiles).toEqual(Object.keys(historical.evidence.files));
  archiveFiles.forEach((path, index) => expect(historical.evidence.files[path]).toEqual(input.evidence.predecessorProofs[`${oldRoot}source-snapshot/${String(index).padStart(2, "0")}.source`]));
  expect(historical.evidence.files[`${base}cuda-archive.ts`]).not.toEqual(input.evidence.files[`${base}cuda-archive.ts`]);
  expect(sha256(input.evidence.predecessorProofs[compatibilityPaths.haltedRequest]!)).toBe(haltedRequestSha256);
});
test("raw request pin rejects every phase, bound, denial, full-grant and formatting mutation before effects", async () => {
  const fixture = await suiteFixture();
  const mutations = [(r: any) => { r.phase = "PROBE_ONLY"; }, (r: any) => { r.status = "HALTED"; }, (r: any) => { r.authorityGranted = false; },
    (r: any) => { r.authorization.grantStatus = "CONSUMED_SUCCESS"; }, (r: any) => { r.authorization.scope = "FULL_PIPELINE"; },
    (r: any) => { r.limits.maximumCases = 4; }, (r: any) => { r.limits.maximumInvocationsPerCase = 2; }, (r: any) => { r.limits.wholeSuiteDeadlineMs = 30001; },
    (r: any) => { r.limits.stderrBytesPerCase++; }, (r: any) => { r.limits.stdoutBytesPerCase++; }, (r: any) => { r.limits.xzDecompressionMemoryBytes++; },
    (r: any) => { r.limits.automaticRetryAllowed = true; }, (r: any) => { r.limits.perCaseDeadlineRenewalAllowed = true; },
    (r: any) => { r.caseOrder.reverse(); }, (r: any) => { r.extra = false; },
    ...Object.keys(json(approvedRequestBytes)).filter(key => key.endsWith("Authorized")).map(key => (r: any) => { r[key] = true; })];
  for (const mutate of mutations) {
    const request = json(approvedRequestBytes); mutate(request);
    await expect(compatibilityCLI(["diagnose"], { ...fixture.io, readContinuation: async () => seal({ ...fixture.input, requestBytes: bytes(request) }) })).rejects.toThrow("EXACT_SYNTHETIC_DIAGNOSTIC_REQUEST_REQUIRED");
  }
  expect(fixture.events).toEqual([]);
  expect(() => validateCompatibilityContinuation(seal({ ...fixture.input, requestBytes: text(new TextDecoder().decode(approvedRequestBytes) + " ") }))).toThrow();
});
test("all five source gates, closed membership, byte caps and raw halted request remain mandatory", async () => {
  const input = await continuationFixture();
  for (const key of ["staticUnitTestsPassed", "staticTypesPassed", "adversarialSourceAccepted", "securitySourceAccepted", "devopsSourceAccepted", "version", "requestSha256"]) {
    const bad = copy(input); (bad.binding as any)[key] = false; expect(() => validateCompatibilityContinuation(bad)).toThrow();
  }
  for (const group of ["files", "predecessorProofs"] as const) {
    const paths = group === "files" ? reviewedFiles : predecessorPaths;
    for (const path of paths) {
      const bad = copy(input); delete (bad.evidence[group] as Record<string, Uint8Array>)[path]; expect(() => validateCompatibilityContinuation(bad)).toThrow("COMPATIBILITY_BINDING_MEMBERSHIP_REQUIRED");
    }
    for (const value of [text("changed"), new Uint8Array(1048577)]) {
      const bad = copy(input); (bad.evidence[group] as Record<string, Uint8Array>)[paths[0]!] = value; expect(() => validateCompatibilityContinuation(bad)).toThrow();
    }
    const extra = copy(input); (extra.evidence[group] as Record<string, Uint8Array>)["unexpected/path"] = text("extra"); expect(() => validateCompatibilityContinuation(extra)).toThrow();
  }
  for (const path of [compatibilityPaths.haltedRequest, compatibilityPaths.haltedSnapshot]) {
    const bad = copy(input), request = json(bad.evidence.predecessorProofs[path]!); request.authorityGranted = true;
    (bad.evidence.predecessorProofs as Record<string, Uint8Array>)[path] = bytes(request); expect(() => validateCompatibilityContinuation(seal(bad))).toThrow("UNCHANGED_HALTED_FULL_REQUEST_REQUIRED");
  }
  const fixture = copy(input); (fixture.evidence.files as Record<string, Uint8Array>)[compatibilityFixturePath] = bytes(buildCompatibilityFixture());
  expect(() => validateCompatibilityContinuation(seal(fixture))).toThrow("CUDA_BUN_COMPATIBILITY_FIXTURE_CANONICAL");
});
test("historical failed receipt, old 26-source packet, 97-proof map, raw streams and qualification cannot change", async () => {
  const input = await continuationFixture();
  const paths = [
    `${base}cuda-archive-reviewed-v2.json`, `${oldRoot}source-review.json`, `${oldRoot}approved-request.json`, `${oldRoot}source-snapshot.json`,
    ...archiveFiles.map((_, index) => `${oldRoot}source-snapshot/${String(index).padStart(2, "0")}.source`),
    ...["receipt.json", ".operation", "command.stdout", "command.stderr", "output-state-after-failure.json"].map(path => `${oldRoot}${path}`),
    `${base}cuda-archive-audit-2-classification.json`, ...["receipt.json", "command.stdout", "command.stderr", "approved-request.json", "source-review.json"].map(path => `${readonlyRoot}${path}`),
  ];
  for (const path of paths) {
    const bad = copy(input); (bad.evidence.predecessorProofs as Record<string, Uint8Array>)[path] = text("{}"); expect(() => validateCompatibilityContinuation(seal(bad))).toThrow();
  }
  for (const [path, mutate] of [[`${oldRoot}receipt.json`, (r: any) => { r.failure = ""; }], [`${oldRoot}receipt.json`, (r: any) => { r.status = "PASS"; }],
    [`${oldRoot}receipt.json`, (r: any) => { r.sourceChanged = true; }], [`${oldRoot}receipt.json`, (r: any) => { r.oneOutsideDeadlineMs++; }],
    [`${base}cuda-archive-audit-2-classification.json`, (r: any) => { r.rootCause = "NAMESPACE"; }],
    [`${base}cuda-archive-audit-2-classification.json`, (r: any) => { r.xzLaunchStatus = "PASS"; }],
    [`${readonlyRoot}receipt.json`, (r: any) => { r.privateSnapshotExecuted = true; }]] as const) {
    const bad = copy(input), record = json(bad.evidence.predecessorProofs[path]!); mutate(record);
    (bad.evidence.predecessorProofs as Record<string, Uint8Array>)[path] = bytes(record); expect(() => validateCompatibilityContinuation(seal(bad))).toThrow();
  }
});
test("fixed CLI and parent invocation reject arbitrary arguments before any operational effects", async () => {
  const fixture = await suiteFixture();
  for (const args of [[], ["--help"], ["startup"], ["diagnose", "startup"], ["diagnose", "--case=xz"], ["/bin/sh"]])
    await expect(compatibilityCLI(args, fixture.io)).rejects.toThrow("CLOSED_COMPATIBILITY_CLI_REQUIRED");
  for (const args of [[], ["invoke"], ["invoke", "bad", "bad"], ["diagnose", "a".repeat(64), "b".repeat(64)], ["invoke", "a".repeat(64), "b".repeat(64), "extra"]])
    await expect(invokeCompatibility(args)).rejects.toThrow("CLOSED_DIAGNOSTIC_INVOCATION_REQUIRED");
  expect(fixture.events).toEqual([]);
});
test("all-compatible DI suite launches each fixed case once, shares one stable root and publishes last", async () => {
  const fixture = await suiteFixture(), result = await compatibilityCLI(["diagnose"], fixture.io);
  expect(result.cases.map(item => item.name)).toEqual(["startup", "parser", "xz"]); expect(result.cases.map(item => item.invocations)).toEqual([1, 1, 1]);
  expect(result.cases.every(item => item.outcome === "COMPATIBLE")).toBe(true); expect(result.diagnosticComplete).toBe(true); expect(result.compatibilityPassed).toBe(true);
  expect(result.scope).toBe("DIAGNOSTIC_ONLY"); expect(result.archiveAuditPassed).toBe(false); expect(result.fullPipelineRenewalAuthorized).toBe(false); expect(result.trainingReady).toBe(false);
  expect(fixture.events.slice(-11)).toEqual(["gate", "launch:startup", "retain:startup", "gate", "launch:parser", "retain:parser", "gate", "launch:xz", "retain:xz", "gate", "publish"]);
  expect(fixture.events.filter(value => value === "claim")).toHaveLength(1); expect(fixture.events.filter(value => value === "prepare")).toHaveLength(1);
  expect(fixture.roots.every(root => root === fixture.roots[0])).toBe(true);
  const control = compatibilityCaseOrder.map(name => { const argv = compatibilityArgv(result.rootPlan, name); return argv.slice(0, -1); });
  expect(control[0]).toEqual(control[1]); expect(control[1]).toEqual(control[2]);
  expect(fixture.publications).toHaveLength(1); expect(validateCompatibilityResult(fixture.publications[0]!)).toEqual(result);
});
test("startup, parser and xz Bun aborts complete diagnostics without compatibility or dependent launches", async () => {
  for (const failed of compatibilityCaseOrder) {
    const launched: string[] = [], fixture = await suiteFixture({ launch: async (_plan, name) => { launched.push(name); return name === failed ? abort(name) : success(name); } });
    const result = await compatibilityCLI(["diagnose"], fixture.io), at = compatibilityCaseOrder.indexOf(failed);
    expect(launched).toEqual(compatibilityCaseOrder.slice(0, at + 1)); expect(result.diagnosticComplete).toBe(true); expect(result.compatibilityPassed).toBe(false);
    expect(result.cases.map(item => item.outcome)).toEqual(compatibilityCaseOrder.map((_name, index) => index < at ? "COMPATIBLE" : index === at ? "BUN_ABORT_DIAGNOSTIC_OBSERVED" : "SKIPPED_DEPENDENCY"));
    for (const item of result.cases.slice(at + 1)) { expect(item.invocations).toBe(0); expect(item.launcher).toBeNull(); expect(item.streams).toBeNull(); }
    expect(validateCompatibilityResult(fixture.publications[0]!).compatibilityPassed).toBe(false);
  }
});
test("unexpected failure stops before all later effects, retains failure metadata and never publishes a completion", async () => {
  for (const failed of compatibilityCaseOrder) {
    const launched: string[] = [], fixture = await suiteFixture({ launch: async (_plan, name) => { launched.push(name); return name === failed ? { ...success(name), exitCode: 9 } : success(name); } });
    try { await compatibilityCLI(["diagnose"], fixture.io); throw Error("MISSING_FAILURE"); } catch (error) {
      expect((error as Error).message).toBe("COMPATIBILITY_UNEXPECTED_FAILURE"); const result = (error as any).result;
      expect(result.diagnosticComplete).toBe(false); expect(result.compatibilityPassed).toBe(false); expect(result.status).toBe("FAIL");
      expect(validateCompatibilityResult(bytes(result)).status).toBe("FAIL");
    }
    expect(launched).toEqual(compatibilityCaseOrder.slice(0, compatibilityCaseOrder.indexOf(failed) + 1)); expect(fixture.publications).toEqual([]);
    expect(fixture.retained.at(-1)!.outcome).toBe("UNEXPECTED_FAILURE");
  }
  const fixture = await suiteFixture({ launch: async () => { throw ""; } });
  await expect(compatibilityCLI(["diagnose"], fixture.io)).rejects.toThrow("COMPATIBILITY_UNEXPECTED_FAILURE"); expect(fixture.retained[0]!.reason).toBe(""); expect(fixture.publications).toEqual([]);
});
test("classification requires exact marker, canonical unmixed abort banner, launcher status and complete clean lifecycle", () => {
  expect(classifyCompatibilityCase("startup", success("startup"))).toBe("COMPATIBLE"); expect(classifyCompatibilityCase("startup", abort("startup"))).toBe("BUN_ABORT_DIAGNOSTIC_OBSERVED");
  expect(classifyCompatibilityCase("startup", { ...abort("startup"), exitCode: null, signalCode: "SIGABRT" })).toBe("BUN_ABORT_DIAGNOSTIC_OBSERVED");
  for (const patch of [{ stdout: text("extra\n") }, { stderr: text("warning") }, { failure: "" }, { reaped: false }, { stdoutEOF: false }, { stderrEOF: false },
    { stdoutOverflow: true }, { stderrOverflow: true }, { exitCode: 1 }, { signalCode: "SIGABRT" }, { stdout: new Uint8Array(65537) }])
    expect(classifyCompatibilityCase("startup", { ...success("startup"), ...patch })).toBe("UNEXPECTED_FAILURE");
  for (const patch of [{ exitCode: 0 }, { exitCode: null }, { exitCode: -1 }, { exitCode: 256 }, { signalCode: "unknown" }, { stdout: text("nonempty") },
    { reaped: false }, { stdoutEOF: false }, { stderrEOF: false }, { failure: "" }, { stderrOverflow: true }, { stderr: text("panic(main thread): abort() called\n") },
    { stderr: text("bwrap: setup failed\n" + crashBanner()) }, { stderr: text(crashBanner() + "bwrap: setup failed\n") },
    { stderr: text(crashBanner().replace("Linux x64", "Linux arm64")) }, { stderr: text(crashBanner().replace("Features: jsc", "Features: unknown")) },
    { stderr: text(crashBanner().replace("CPU:", "bwrap: setup error CPU:")) }, { stderr: text(crashBanner().replace('Args: "/usr/local/bin/bun"', 'Args: "/bin/other"')) },
    { stderr: new Uint8Array([255]) }]) expect(classifyCompatibilityCase("startup", { ...abort("startup"), ...patch })).toBe("UNEXPECTED_FAILURE");
});
test("result validation closes ordered dependency states, invocation counts, stream metadata, lifecycle and denied authority", async () => {
  const fixture = await suiteFixture(), result = await compatibilityCLI(["diagnose"], fixture.io);
  const mutations = [(r: any) => { r.version = "other"; }, (r: any) => { r.scope = "ARCHIVE_PASS"; }, (r: any) => { r.diagnosticComplete = false; },
    (r: any) => { r.compatibilityPassed = false; }, (r: any) => { r.cases.reverse(); }, (r: any) => { r.cases.push(r.cases[0]); },
    (r: any) => { r.cases[0].invocations = 2; }, (r: any) => { r.cases[0].outcome = "SKIPPED_DEPENDENCY"; },
    (r: any) => { r.cases[0].launcher.stdoutEOF = false; }, (r: any) => { r.cases[0].launcher.stderrEOF = false; },
    (r: any) => { r.cases[0].launcher.reaped = false; }, (r: any) => { r.cases[0].launcher.failure = ""; },
    (r: any) => { r.cases[0].launcher.stdoutOverflow = true; }, (r: any) => { r.cases[0].launcher.exitCode = 1; },
    (r: any) => { r.cases[0].streams[0].sha256 = "a".repeat(64); }, (r: any) => { r.cases[0].streams[1].path = "elsewhere"; },
    (r: any) => { r.cases[0].streams[1].bytes = 65537; }, (r: any) => { r.cases[0].streams[1].sha256 = "0".repeat(64); },
    (r: any) => { r.rootPlan.outputDirectory = r.rootPlan.evidenceRoot; }, (r: any) => { r.extra = false; },
    (r: any) => { r.cases[0].outcome = ["COMPATIBLE"]; },
    ...["archiveAuditPassed", "fullPipelineRenewalAuthorized", "extractionPerformed", "llvmCodeExecuted", "custodyQualified", "trainingAuthorized", "trainingReady"].map(key => (r: any) => { r[key] = true; })];
  for (const mutate of mutations) { const bad = copy(result); mutate(bad); expect(() => validateCompatibilityResult(bytes(bad))).toThrow(); }
  const abortFixture = await suiteFixture({ launch: async (_plan, name) => abort(name) }), aborted = await compatibilityCLI(["diagnose"], abortFixture.io);
  for (const mutate of [(r: any) => { r.compatibilityPassed = true; }, (r: any) => { r.cases[1].invocations = 1; }, (r: any) => { r.cases[1].streams = []; },
    (r: any) => { r.cases[1].reason = "OTHER"; }, (r: any) => { r.cases[0].launcher.exitCode = 0; }]) {
    const bad = copy(aborted); mutate(bad); expect(() => validateCompatibilityResult(bytes(bad))).toThrow();
  }
});
test("builtin-only outside result validation correlates exact raw streams without post-deadline project imports", async () => {
  for (const failed of [null, ...compatibilityCaseOrder]) {
    const launches: Record<string, Uint8Array> = {};
    const fixture = await suiteFixture({ launch: async (_plan, name) => {
      const result = name === failed ? abort(name) : success(name);
      for (const kind of ["stdout", "stderr"] as const) launches[`${base}runs/cuda-bun-compatibility-1/${name}.${kind}`] = result[kind];
      return result;
    } });
    const result = await compatibilityCLI(["diagnose"], fixture.io);
    expect(validateInvocationResult(fixture.publications[0]!, bytes(fixture.input.binding), approvedCompatibilityRequestSha256, launches, repository))
      .toEqual({ diagnosticComplete: true, compatibilityPassed: failed === null });
    for (const mutate of [(r: any) => { r.cases[0].outcome = [r.cases[0].outcome]; }, (r: any) => { r.archiveAuditPassed = true; },
      (r: any) => { r.sourceReviewCanonicalSha256 = "0".repeat(64); }, (r: any) => { r.cases[0].launcher.stdoutEOF = false; },
      (r: any) => { r.cases[0].streams[1].bytes++; }, (r: any) => { r.compatibilityPassed = !r.compatibilityPassed; },
      (r: any) => { r.cases.reverse(); }, (r: any) => { r.rootPlan.outputDirectory = r.rootPlan.evidenceRoot; }]) {
      const bad = copy(result); mutate(bad);
      expect(() => validateInvocationResult(bytes(bad), bytes(fixture.input.binding), approvedCompatibilityRequestSha256, launches, repository)).toThrow();
    }
    const corrupt = { ...launches, [`${base}runs/cuda-bun-compatibility-1/startup.stderr`]: text("bwrap: setup failed") };
    expect(() => validateInvocationResult(bytes(result), bytes(fixture.input.binding), approvedCompatibilityRequestSha256, corrupt, repository)).toThrow();
  }
  const invokeSource = await readFile(resolve(repository, `${base}cuda-bun-compatibility-invoke.ts`), "utf8");
  expect(invokeSource).not.toContain('await import("./cuda-bun-compatibility")');
  expect(invokeSource).toContain("review.snapshot.requestBytes"); expect(invokeSource).toContain("review.snapshot.files[path]");
});
test("argv fixes the common native closure, private Bun, synthetic-only inputs and one private output without expanded isolation", async () => {
  const fixture = await suiteFixture(), result = await compatibilityCLI(["diagnose"], fixture.io), plan = result.rootPlan, argv = compatibilityArgv(plan, "startup");
  const control = argv.slice(0, argv.indexOf("--"));
  expect(control.slice(0, 10)).toEqual(["/usr/bin/bwrap", "--unshare-user", "--unshare-net", "--die-with-parent", "--clearenv", "--cap-drop", "ALL", "--chdir", "/", "--dir"]);
  expect(control.filter(arg => arg === "--bind")).toHaveLength(1); expect(control.slice(control.indexOf("--bind") + 1, control.indexOf("--bind") + 3)).toEqual([compatibilityPaths.outputDirectory, "/output"]);
  expect(control.slice(control.indexOf("--dev"), control.indexOf("--dev") + 4)).toEqual(["--dev", "/dev", "--remount-ro", "/dev"]); expect(control.slice(-2)).toEqual(["--remount-ro", "/"]);
  for (const forbidden of ["--proc", "--unshare-pid", "--new-session", "--share-net", "/inputs/llvm.tar.xz", "/run", "/etc", "/home", "/dev/dri", "/dev/nvidia0", repository, plan.evidenceRoot]) expect(control).not.toContain(forbidden);
  for (const required of ["/proc", "/audit/cuda-tar.ts", "/inputs/fixture.json", "/inputs/synthetic.tar.xz"]) expect(control).toContain(required);
  expect(argv.slice(-6)).toEqual(["--", "/usr/local/bin/bun", "--no-env-file", "--no-install", "-e", compatibilityCasePrograms.startup]);
  for (const mutate of [(p: any) => { p.files.push({ guest: "/etc/passwd", file: p.files[0].file }); },
    (p: any) => { p.nativeClosure.files.push({ guest: "/usr/lib/x86_64-linux-gnu/unused.so", file: p.nativeClosure.files[0].file }); },
    (p: any) => { p.files.find((m: any) => m.guest === "/inputs/synthetic.tar.xz").file.source = "/real.tar.xz"; },
    (p: any) => { p.outputDirectory = p.evidenceRoot; }, (p: any) => { p.custodyQualified = true; },
    (p: any) => { p.nativeClosure.files.find((m: any) => m.guest === "/usr/local/bin/bun").file.source = "/usr/local/bin/bun"; }]) {
    const bad = copy(plan); mutate(bad); expect(() => compatibilityArgv(bad, "startup")).toThrow();
  }
  expect(() => compatibilityArgv(plan, "other" as CompatibilityCase)).toThrow("FIXED_COMPATIBILITY_CASE_REQUIRED");
});
test("private identity, source hash, prepared fixture and revalidation faults stop before launch or publication", async () => {
  const fixture = await suiteFixture(), native = nativeFixture(fixture.input);
  const changed = copy(native), bun = changed.files.find(mount => mount.guest === "/usr/local/bin/bun")!;
  (bun.file.identity as any).inode = "replacement";
  await expect(compatibilityCLI(["diagnose"], { ...fixture.io, nativeClosure: async () => changed })).rejects.toThrow("PLANNED_BUN_CAPTURE_IDENTITY_REQUIRED"); expect(fixture.events).not.toContain("claim");
  await expect(compatibilityCLI(["diagnose"], { ...fixture.io, readSource: async path => file(resolve(repository, path), text("wrong")) })).rejects.toThrow("EXACT_REVIEWED_COMPATIBILITY_INPUT_REQUIRED");
  expect(fixture.events).not.toContain("claim");
  await expect(compatibilityCLI(["diagnose"], { ...fixture.io, prepareFixture: async value => ({ ...file(compatibilityPaths.preparedFixture, value, 0o100600), sha256: "0".repeat(64) }) })).rejects.toThrow("EXACT_PREPARED_SYNTHETIC_FIXTURE_REQUIRED");
  expect(fixture.events.some(event => event.startsWith("launch:"))).toBe(false);
  for (const failAt of [1, 2, 3, 4]) {
    let gates = 0; const fake = await suiteFixture({ revalidate: async () => { if (++gates === failAt) throw Error("CHANGED_FULL_BINDING_OR_ROOT"); } });
    await expect(compatibilityCLI(["diagnose"], fake.io)).rejects.toThrow("CHANGED_FULL_BINDING_OR_ROOT"); expect(fake.publications).toEqual([]);
    expect(fake.events.filter(event => event.startsWith("launch:"))).toHaveLength(failAt - 1);
  }
});
function processFixture(stdout: Uint8Array[] = [text(compatibilityMarkers.startup)], stderr: Uint8Array[] = [], code = 0) {
  const events: string[] = [];
  const stream = async function* (chunks: Uint8Array[], label: string) { for (const chunk of chunks) { events.push(label); yield chunk; } events.push(`${label}:EOF`); };
  const child: CompatibilityChild = { stdout: stream(stdout, "stdout"), stderr: stream(stderr, "stderr"), exited: Promise.resolve(code).then(value => { events.push("reaped"); return value; }), signalCode: null,
    kill: () => { events.push("kill"); } };
  return { child, events };
}
test("concurrent bounded launcher collection retains prefixes and requires actual reap and both stream EOFs", async () => {
  const normal = processFixture(), result = await compatibilityTestOnly.collectCompatibilityProcess(normal.child);
  expect(classifyCompatibilityCase("startup", result)).toBe("COMPATIBLE"); expect(normal.events).toContain("reaped"); expect(normal.events).toContain("stdout:EOF"); expect(normal.events).toContain("stderr:EOF");
  for (const stream of ["stdout", "stderr"] as const) {
    const fake = processFixture(stream === "stdout" ? [new Uint8Array(65537)] : [], stream === "stderr" ? [new Uint8Array(65537)] : []);
    const observed = await compatibilityTestOnly.collectCompatibilityProcess(fake.child);
    expect(observed[stream].byteLength).toBe(65536); expect(observed.failure).toBe(`${stream.toUpperCase()}_BYTE_LIMIT`); expect(fake.events).toContain("kill");
    expect(observed.reaped).toBe(true); expect(observed.stdoutEOF).toBe(true); expect(observed.stderrEOF).toBe(true); expect(classifyCompatibilityCase("startup", observed)).toBe("UNEXPECTED_FAILURE");
  }
  for (const stream of ["stdout", "stderr"] as const) {
    const fake = processFixture(), child = { ...fake.child, [stream]: (async function* () { throw ""; })() };
    const observed = await compatibilityTestOnly.collectCompatibilityProcess(child); expect(observed.failure).toBe(""); expect(observed[`${stream}EOF`]).toBe(false); expect(observed.reaped).toBe(true);
  }
  const fake = processFixture(); const rejected = await compatibilityTestOnly.collectCompatibilityProcess({ ...fake.child, exited: Promise.reject("") });
  expect(rejected.failure).toBe(""); expect(rejected.reaped).toBe(false); expect(fake.events).toContain("kill");
});
test("launcher kill failure never replaces the first empty stream error or settles before EOF and reap", async () => {
  let releaseExit!: (code: number) => void, releaseStderr!: () => void, killed = 0, settled = false;
  const child: CompatibilityChild = { stdout: (async function* () { throw ""; })(), stderr: (async function* () { await new Promise<void>(resolve => { releaseStderr = resolve; }); })(),
    exited: new Promise(resolve => { releaseExit = resolve; }), signalCode: null, kill: () => { killed++; throw Error("SECONDARY_KILL_ERROR"); } };
  const pending = compatibilityTestOnly.collectCompatibilityProcess(child).then(value => { settled = true; return value; });
  await Promise.resolve(); await Promise.resolve(); expect(killed).toBeGreaterThan(0); expect(settled).toBe(false);
  releaseExit(137); await Promise.resolve(); expect(settled).toBe(false); releaseStderr(); const result = await pending;
  expect(result.failure).toBe(""); expect(result.reaped).toBe(true); expect(result.stderrEOF).toBe(true); expect(result.stdoutEOF).toBe(false);
});
test("default launch adapter passes only fixed argv and the four-variable environment to a replaced Bun.spawn", async () => {
  const fixture = await suiteFixture(), result = await compatibilityCLI(["diagnose"], fixture.io), fake = processFixture(), calls: unknown[][] = [];
  const spawn = spyOn(Bun, "spawn").mockImplementation(((...args: unknown[]) => { calls.push(args); return fake.child; }) as typeof Bun.spawn);
  try {
    const observed = await launchCompatibilityCase(result.rootPlan, "startup"); expect(classifyCompatibilityCase("startup", observed)).toBe("COMPATIBLE");
    expect(calls).toHaveLength(1); expect(calls[0]![0]).toEqual(compatibilityArgv(result.rootPlan, "startup"));
    expect(calls[0]![1]).toEqual({ cwd: "/", env: { PATH: "/usr/local/bin:/usr/bin:/bin", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC" }, stdin: "ignore", stdout: "pipe", stderr: "pipe", detached: false });
  } finally { spawn.mockRestore(); }
  const failure = spyOn(Bun, "spawn").mockImplementation(() => { throw ""; });
  try { const observed = await launchCompatibilityCase(result.rootPlan, "startup"); expect(observed.failure).toBe(""); expect(observed.reaped).toBe(false); } finally { failure.mockRestore(); }
});
test("synthetic XZ helper drains concurrent stderr and awaits EOF plus actual zero exit without a success shortcut", async () => {
  const tar = Buffer.from(buildCompatibilityFixture().tar.base64, "base64"), expected = buildCompatibilityFixture().inventory;
  const consume = async (chunks: AsyncIterable<Uint8Array>) => { for await (const _chunk of chunks) {} return expected; };
  const make = (stdout: Uint8Array[] = [tar], stderr: Uint8Array[] = [], code = 0) => { const fake = processFixture(stdout, stderr, code); return { ...fake, child: { ...fake.child, kill: () => fake.child.kill("SIGKILL") } as XZProcess }; };
  const good = make(); expect(await compatibilityTestOnly.runSyntheticXZAudit(good.child, consume, () => {})).toEqual(expected); expect(good.events).toContain("reaped"); expect(good.events).not.toContain("kill");
  for (const [fake, audit] of [[make([tar], [], 1), consume], [make([tar], [text("warning")]), consume], [make([tar], [new Uint8Array(65537)]), consume],
    [make([new Uint8Array(1537)]), consume], [make([tar]), async () => expected], [make([tar]), async () => { throw ""; }]] as const) {
    let failed = false, retained = 0;
    try { await compatibilityTestOnly.runSyntheticXZAudit(fake.child, audit, value => { retained = value.byteLength; }); } catch { failed = true; }
    expect(failed).toBe(true); expect(retained).toBeLessThanOrEqual(65536); expect(fake.events).toContain("kill"); expect(fake.events).toContain("reaped"); expect(fake.events).toContain("stderr:EOF");
  }
});
test("exclusive claim and staged publication preserve first empty errors and never publish before stream files close", async () => {
  const events: string[] = [];
  const claim = { validate: async () => { events.push("validate"); }, marker: async () => { events.push("marker"); }, directories: async () => { events.push("directories"); return directories; } };
  await compatibilityTestOnly.claimCompatibilityOperation(claim); expect(events).toEqual(["validate", "marker", "directories"]);
  for (const key of ["validate", "marker"] as const) {
    events.length = 0; await expect(compatibilityTestOnly.claimCompatibilityOperation({ ...claim, [key]: async () => { throw Error("NO_REPLAY"); } })).rejects.toThrow("NO_REPLAY"); expect(events).not.toContain("directories");
  }
  for (const failure of [null, "write", "sync", "close"] as const) {
    events.length = 0;
    const stage = { write: async (_value: Uint8Array) => { events.push("write"); if (failure === "write") throw ""; },
      sync: async () => { events.push("sync"); if (failure === "sync") throw ""; }, close: async () => { events.push("close"); if (failure === "close" || failure === "write") throw ""; } };
    try { await compatibilityTestOnly.commitResult(text("result"), { openStage: async () => stage, publish: async () => { events.push("publish"); } }); expect(failure).toBeNull(); }
    catch (error) { expect(error).toBe(""); expect(failure).not.toBeNull(); }
    expect(events).toContain("close"); expect(events.includes("publish")).toBe(failure === null);
  }
  const fixture = await suiteFixture({ retain: async (name, launch, result) => compatibilityTestOnly.retainCase(name, launch, result, async (path, value) => {
    events.push(path);
    await compatibilityTestOnly.writeSyncClose(value, { write: async () => { events.push(`${path}:write`); }, sync: async () => { events.push(`${path}:sync`); },
      close: async () => { events.push(`${path}:close`); if (path.endsWith(".stderr")) throw Error("RAW_STREAM_CLOSE_FAILED"); } });
  }) });
  await expect(compatibilityCLI(["diagnose"], fixture.io)).rejects.toThrow("RAW_STREAM_CLOSE_FAILED"); expect(fixture.publications).toEqual([]);
  expect(fixture.events.filter(value => value.startsWith("launch:"))).toEqual(["launch:startup"]);
  expect(events.some(value => value.endsWith("startup.stderr:close"))).toBe(true); expect(events.some(value => value.endsWith("startup.json"))).toBe(false);
});
test("tasks-only Mise plan uses outside gates before and after each stage and treats empty failure as failure", async () => {
  validateCompatibilityTaskConfiguration(configuration); expect(await readFile(resolve(repository, compatibilityTaskConfiguration), "utf8")).toBe(new TextDecoder().decode(configuration));
  expect(compatibilityEnvironment().MISE_OVERRIDE_CONFIG_FILENAMES).toBe("cuda-bun-compatibility-mise.toml"); expect(compatibilityStagePlan().map(stage => stage.name)).toEqual(["00-trust", "01-config", "02-diagnose"]);
  const discovery = bytes([{ path: resolve(repository, compatibilityTaskConfiguration), tools: [] }]); validateCompatibilityMiseDiscovery(discovery);
  for (const invalid of [text(""), text('[tools]\nbun="latest"'), text(new TextDecoder().decode(configuration) + '\n[env]\nX="1"'), text(new TextDecoder().decode(configuration).replace(" diagnose", " startup"))]) expect(() => validateCompatibilityTaskConfiguration(invalid)).toThrow();
  for (const invalid of [bytes([]), bytes([{}, {}]), bytes([{ path: "/other" }]), bytes([{ path: resolve(repository, compatibilityTaskConfiguration), tools: ["bun"] }])]) expect(() => validateCompatibilityMiseDiscovery(invalid)).toThrow();
  for (const failedStage of [null, "00-trust", "01-config", "02-diagnose"] as const) {
    const events: string[] = [], result = await runCompatibilityMiseStages({ verifyOutsideGate: async () => { events.push("gate"); }, readTaskConfiguration: async () => { events.push("config"); return configuration; },
      run: async stage => { events.push(stage.name); return { exitCode: 0, stdout: discovery, failure: stage.name === failedStage ? "" : null }; } });
    expect(result.failedStage).toBe(failedStage); expect(result.exitCode).toBe(failedStage === null ? 0 : 1);
    const count = failedStage === null ? 3 : compatibilityStagePlan().findIndex(stage => stage.name === failedStage) + 1;
    expect(events.filter(value => value === "gate")).toHaveLength(count * 2); expect(events.at(-1)).toBe("gate");
    expect(result.completedStages).toEqual(compatibilityStagePlan().slice(0, failedStage === null ? 3 : count - 1).map(stage => stage.name));
  }
  let gates = 0;
  try { await runCompatibilityMiseStages({ verifyOutsideGate: async () => { if (++gates === 2) throw Error("SECONDARY_GATE_ERROR"); }, readTaskConfiguration: async () => configuration, run: async () => { throw ""; } }); throw Error("MISSING_FAILURE"); }
  catch (error) { expect(error).toBe(""); expect(gates).toBe(2); }
});
test("fixed case sources contain no original Bun lookup, real archive, helper generation, renewed deadline or operational escape", async () => {
  expect(compatibilityCasePlan().map(item => [item.name, item.invocation, item.dependsOn])).toEqual([["startup", 1, null], ["parser", 1, "startup"], ["xz", 1, "parser"]]);
  expect(compatibilityCasePrograms.startup).not.toMatch(/import|spawn|readFile/); expect(compatibilityCasePrograms.parser).toContain("'/audit/cuda-tar.ts'");
  expect(compatibilityCasePrograms.parser).toContain(buildCompatibilityFixture().tar.base64); expect(compatibilityCasePrograms.parser).not.toMatch(/spawn|readFile/);
  expect(compatibilityCasePrograms.xz).toContain("'/usr/bin/xz','--decompress','--stdout','--threads=1','--memlimit-decompress=256MiB','--','/inputs/synthetic.tar.xz'");
  const source = await readFile(resolve(repository, `${base}cuda-bun-compatibility.ts`), "utf8");
  for (const forbidden of [/prepareArchiveAuditPlan/, /\brunBounded\s*\(/, /\bset(?:Timeout|Interval)\s*\(/, /\bfetch\s*\(/, /process\.env/, /--unshare-pid|--new-session|--proc|ld\.so\.cache/, /\b(?:rm|unlink|rename|copyFile|execFile)\s*\(/]) expect(source).not.toMatch(forbidden);
  expect(source).toContain("constants.O_NOFOLLOW"); expect(source).toContain("constants.O_EXCL"); expect(source).toContain('"result.pending.json"'); expect(source).toContain('"result.json"');
  expect(compatibilityLimits.wholeInvocationMs).toBe(30000); expect(compatibilityLimits.maximumCases).toBe(3);
  expect(compatibilityFailureCode(Error("XZ_EXIT_NONZERO"))).toBe("XZ_EXIT_NONZERO"); expect(compatibilityFailureCode(Error("/private?token=secret"))).toBe("COMPATIBILITY_DIAGNOSTIC_FAILED");
});
