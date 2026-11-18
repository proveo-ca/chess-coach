// SPEC: _spec/gpu-host-build-reuse.puml
import { beforeAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import base from "../host-build/plan.json";
import { afterWrite, beforeWrite, nativePath } from "../policy-record-fix/correction";
import { correctionProof, reusePaths, reusePlan, type ReusePlan } from "./plan";
import selection from "./selection.json";

type Source = { path: string; sha256: string };
type Proof = { status: string; sourceChanged: boolean; sources: Source[]; generation: { path: string; sha256: string; nativeInputs: number; changedPaths: string[]; previousManifestSha256: string } };
const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const proofDirectory = "_work/gpu-owner-recovery/runs/host-gpu-policy-record-correction-source-2";
const correctedManifestSha256 = "7e0aa13c178a77e01526d7fa02189c404c1ce3b44666914665cb9ca63a3521ec";
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const read = (path: string) => readFile(resolve(repository, path), "utf8");
let p: ReusePlan, proof: Proof, proofUtf8: string;

beforeAll(async () => {
  p = await reusePlan();
  proofUtf8 = await read(correctionProof);
  proof = JSON.parse(proofUtf8);
});

test("the independent plan binds the unchanged PASS source-2 proof and all 291 repository source hashes", async () => {
  expect(correctionProof).toBe(proofDirectory + "/receipt.json");
  expect(proof.status).toBe("PASS_POLICY_RECORD_SOURCE_CORRECTION_ONLY");
  expect(proof.sourceChanged).toBe(false);
  expect(proof.sources).toHaveLength(291);
  expect(new Set(proof.sources.map(row => row.path)).size).toBe(291);
  expect(p.correctionProof).toEqual({ path: correctionProof, sha256: hash(proofUtf8) });
  for (const row of proof.sources) {
    expect(isAbsolute(row.path)).toBe(false);
    expect(row.path.split("/")).not.toContain("..");
    expect(row.path).not.toMatch(/(?:^|\/)(?:cache|payload|archives?)(?:\/|$)/);
    expect(hash(await readFile(resolve(repository, row.path)))).toBe(row.sha256);
  }
  expect(await reusePlan()).toEqual(p);
});

test("the bound UTF-8 overlay changes only gpu.rs record dereferencing within the same native65 membership", async () => {
  const prepared = JSON.parse(await read("_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/preparation.json"));
  const before: Source[] = prepared.nativeSourceInventory, after: Source[] = JSON.parse(p.correctedManifest.utf8);
  const previous = await read(proofDirectory + "/baseline-source/command.stdout"), current = await read(nativePath);
  expect(before).toHaveLength(65); expect(after).toHaveLength(65);
  expect(new Set(after.map(row => row.path)).size).toBe(65);
  expect(after.map(row => row.path)).toEqual(before.map(row => row.path));
  expect(before.filter((row, index) => row.sha256 !== after[index]!.sha256).map(row => row.path)).toEqual([nativePath]);
  expect(before.filter((row, index) => row.sha256 === after[index]!.sha256)).toHaveLength(64);
  expect(current).toBe(previous.replace(beforeWrite, afterWrite));
  const lines = previous.split("\n"), changed = lines.flatMap((line, index) => line === current.split("\n")[index] ? [] : [index + 1]);
  expect(changed).toEqual([345]);
  expect(lines[344]!.trim()).toBe(beforeWrite);
  expect(current.split("\n")[344]!.trim()).toBe(afterWrite);
  expect(p.overlay).toEqual({ path: nativePath, previousSha256: hash(previous), correctedSha256: hash(current), correctedUtf8: current });
  expect(p.overlay.previousSha256).toBe(before.find(row => row.path === nativePath)!.sha256);
  expect(p.overlay.correctedSha256).toBe(after.find(row => row.path === nativePath)!.sha256);
  expect(p.correctedManifest.utf8).toBe(await read(proof.generation.path));
  expect(hash(p.correctedManifest.utf8)).toBe(correctedManifestSha256);
  expect(p.correctedManifest.sha256).toBe(correctedManifestSha256);
  expect(p.sourceManifestSha256).toBe(correctedManifestSha256);
  expect(p.previousSourceManifestSha256).toBe(base.sourceManifestSha256);
  expect(proof.generation).toEqual({ path: proofDirectory + "/native-source-manifest.json", sha256: correctedManifestSha256,
    nativeInputs: 65, changedPaths: [nativePath], previousManifestSha256: base.sourceManifestSha256 });
});

test("reuse preserves the pinned images, tools, operator resources and offline baseline inputs", () => {
  for (const key of ["context", "engine", "rustImage", "bunImage", "existingHelpers", "cudaBindingTrial", "resources", "helperDownloads"] as const) expect(p[key]).toEqual(base[key]);
  expect(p.existingHelpers).toEqual([
    { path: "_work/gpu-owner-recovery/verify.ts", sha256: "9831b75035a5d832c6d86608b7d561821ee1a4c6dec8d2a7ecd31fbca55d5f58" },
    { path: "_work/gpu-owner-recovery/command-supervisor.ts", sha256: "88e56077c3bcddf722f81081a0cb7c6f94d1da106add486dbf13a92d165fb9c6" },
  ]);
  expect(p.resources).toEqual({ cpus: 2, memoryBytes: 8589934592, memoryPlusSwapBytes: 8589934592, cargoJobs: 2, rayonThreads: 2, uidGid: "CURRENT_OPERATOR_NUMERIC_UID_GID" });
  expect(p.engine).toBe("unix:///var/run/docker.sock");
  expect(p.cudaBindingTrial).toBe("13000");
  expect(p.helperDownloads).toBe(0);
});

test("only the three exact retained caches resolve into independent fresh workspace and evidence paths", () => {
  const root = "/SOURCE_ONLY_MOCK_NOT_HOST_EVIDENCE/repository", paths = reusePaths(root, p);
  expect(p.retained).toEqual({ bun: base.workspace + "/bun", cargo: base.workspace + "/cargo-home", target: base.workspace + "/native/target-gpu" });
  expect(p.workspace).toBe("_work/gpu-owner-recovery/cache/host-gpu-native-build-2");
  expect(p.evidence).toBe("_work/gpu-owner-recovery/runs/host-gpu-native-build-2");
  expect(paths).toEqual({ context: resolve(root, base.context), workspace: resolve(root, p.workspace), evidence: resolve(root, p.evidence),
    native: resolve(root, p.workspace, "native"), bun: resolve(root, p.retained.bun), cargo: resolve(root, p.retained.cargo), target: resolve(root, p.retained.target) });
  expect(new Set(Object.values(paths)).size).toBe(7);
  expect([paths.workspace, paths.native, paths.evidence]).not.toContain(resolve(root, base.workspace));
  expect(Object.values(paths)).not.toContain(resolve(root, base.evidence));
  expect(Object.values(paths)).not.toContain(resolve(root, base.workspace, "native"));
});

test("the closed seven-operation budget removes donor creation and Bun copying without adding compilation attempts", () => {
  expect(p.maximums).toEqual({ ...base.maximums, donorCreates: 0, donorStarts: 0, bunCopies: 0, containerRemovals: 1, dockerOperations: 7 });
  expect(p.maximums.workerCreates).toBe(1); expect(p.maximums.workerStarts).toBe(1);
  expect(p.maximums.workerLogFollows).toBe(1); expect(p.maximums.terminalInspections).toBe(1);
  expect(p.maximums.cargoCompilations).toBe(2);
  expect(p.maximums.workerCreates + p.maximums.workerStarts + p.maximums.workerLogFollows + p.maximums.terminalInspections
    + p.maximums.workerStops + p.maximums.workerKills + p.maximums.containerRemovals).toBe(7);
});

test("deadlines retain 4020+120+60 seconds and reserve native acceptance within the 112-MiB stream budget", () => {
  const mib = 1024 * 1024;
  expect(p.limits).toEqual({ ...base.limits, nativeAcceptanceReserveMs: 120000, hostDockerStreamsBytes: 56 * mib });
  expect(p.limits.normalOperationsMs).toBe(4020000); expect(p.limits.cleanupMs).toBe(120000); expect(p.limits.receiptReserveMs).toBe(60000);
  expect(p.limits.normalOperationsMs + p.limits.cleanupMs + p.limits.receiptReserveMs).toBe(4200000);
  expect(p.limits.overallMs).toBe(4200000); expect(p.limits.nativeWorkMs).toBe(3600000);
  expect(p.limits.nativeAcceptanceReserveMs).toBe(120000);
  expect(p.limits.nativeStreamsBytes).toBe(40 * mib); expect(p.limits.canonicalLogCopiesBytes).toBe(16 * mib);
  expect(p.limits.hostDockerStreamsBytes + p.limits.nativeStreamsBytes + p.limits.canonicalLogCopiesBytes).toBe(112 * mib);
});

test("source preparation selection grants no cache write, staging, host, publication, retry, GPU or training authority", () => {
  expect(selection.status).toBe("REUSE_CACHE_SELECTED_FOR_SOURCE_PREPARATION_ONLY");
  expect(selection.sourcePreparationSelected).toBe(true);
  for (const [key, value] of Object.entries(selection)) if (/Authorized$|trainingReady$/.test(key)) expect(value).toBe(false);
  expect(p.status).toBe("DRAFT_SOURCE_ONLY_HOST_APPROVAL_REQUIRED");
  expect(p.runId).toBe("host-gpu-native-build-2"); expect(p.grant).toBe("--approved-host-gpu-native-build-2");
  expect(p.grant).not.toBe(base.grant); expect(p.version).not.toBe(base.version);
  expect(p.method).toBe("OWNED_CONTAINER_NATIVE_BUILD_ONLY_RETAINED_CARGO_AND_TARGET_CACHES");
  for (const [key, value] of Object.entries(p)) if (/Authorized$|Approved$|trainingReady$|sourcePublicationRequired$/.test(key)) expect(value).toBe(false);
  expect(p.cacheWritesAuthorized).toBe(false); expect(p.hostExecutionApproved).toBe(false);
  expect(p.stagingAndNativeCompilationApproved).toBe(false); expect(p.automaticRetryAuthorized).toBe(false);
});
