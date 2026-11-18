// SPEC: _spec/gpu-host-build-reuse.puml
import { constants } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { nativeCommands, recordNativeCommand, recheckNativeSource, stageTree } from "../host-build/driver";
import { assertNativeGenerationDelta, assertRecordSliceCorrection, nativePath } from "../policy-record-fix/correction";
import type { ReusePlan } from "./plan";

const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: unknown, reason: string) => { if (!value) throw Error(reason); };
type Inventory = { path: string; sha256: string }[];
export type OverlayIO = { read(path: string): Promise<Uint8Array>; write(path: string, text: string): Promise<void>; inventory(): Promise<Inventory> };
export async function applyRecordOverlay(p: ReusePlan, io: OverlayIO) {
  const manifestPath = "/build/native/qualification/source-manifest.json", sourcePath = "/build/native/" + nativePath;
  check(p.overlay.path === nativePath, "ONLY_GPU_RECORD_OVERLAY_ALLOWED");
  const previousBytes = await io.read(manifestPath), before = await io.inventory();
  check(hash(previousBytes) === p.previousSourceManifestSha256 && JSON.stringify(JSON.parse(Buffer.from(previousBytes).toString())) === JSON.stringify(before), "ORIGINAL_STAGED_NATIVE_GENERATION_REQUIRED");
  const beforeText = Buffer.from(await io.read(sourcePath)).toString("utf8");
  check(hash(Buffer.from(beforeText)) === p.overlay.previousSha256, "ORIGINAL_GPU_RECORD_SOURCE_REQUIRED");
  check(hash(Buffer.from(p.overlay.correctedUtf8)) === p.overlay.correctedSha256 && hash(Buffer.from(p.correctedManifest.utf8)) === p.correctedManifest.sha256 && p.correctedManifest.sha256 === p.sourceManifestSha256, "BOUND_CORRECTED_SOURCE_AND_MANIFEST_REQUIRED");
  assertRecordSliceCorrection(beforeText, p.overlay.correctedUtf8);
  const expected: Inventory = JSON.parse(p.correctedManifest.utf8);
  assertNativeGenerationDelta(before, expected);
  check(expected.find(row => row.path === nativePath)?.sha256 === p.overlay.correctedSha256, "OVERLAY_MATCHES_MANIFEST_REQUIRED");
  await io.write(sourcePath, p.overlay.correctedUtf8);
  await io.write(manifestPath, p.correctedManifest.utf8);
  const after = await io.inventory();
  check(JSON.stringify(after) === JSON.stringify(expected) && hash(await io.read(manifestPath)) === p.sourceManifestSha256, "CORRECTED_STAGED_NATIVE_GENERATION_REQUIRED");
  assertNativeGenerationDelta(before, after);
  return after;
}

export async function runReuseNative(p: ReusePlan) {
  const root = "/build/native", directory = root + "/_work/gpu-owner-recovery/runs/" + p.runId, started = performance.now();
  let deadline = started;
  const remaining = () => { const ms = Math.floor(deadline - performance.now() - 30000); check(ms > 0, "NATIVE_BUILD_DEADLINE"); return ms; };
  const staging = { bytes: 0, files: 0 }, results: unknown[] = [];
  let failure: string | null = null, stage = "startup", compilationAttempts = 0, inventory: Inventory | null = null, readInventory: (() => Promise<Inventory>) | null = null;
  await mkdir(directory, { recursive: true });
  try {
    check(process.cwd() === root && Bun.version === "1.4.0" && p.runId === "host-gpu-native-build-2", "REUSED_NATIVE_BUN_CONTEXT_REQUIRED");
    const normalDeadlineEpoch = JSON.parse(await readFile("/evidence/deadline.json", "utf8")).normalDeadlineEpoch;
    check(Number.isSafeInteger(normalDeadlineEpoch) && normalDeadlineEpoch - p.limits.nativeAcceptanceReserveMs > Date.now(), "NATIVE_HOST_ACCEPTANCE_RESERVE_REQUIRED");
    deadline = Math.min(started + p.limits.nativeWorkMs, performance.now() + normalDeadlineEpoch - p.limits.nativeAcceptanceReserveMs - Date.now());
    stage = "staging";
    for (const source of ["/received/current-native", "/received/qualification-tools"]) await stageTree(source, root, staging, p, remaining);
    for (const name of ["home", "tmp"]) await mkdir(root + "/_work/gpu-owner-recovery/scratch/" + name, { recursive: true });
    const { runBounded } = await import(pathToFileURL(root + "/_work/gpu-owner-recovery/verify.ts").href);
    const { sourceInventory } = await import(pathToFileURL(root + "/tooling/runtime/qualification.ts").href);
    readInventory = () => sourceInventory(root);
    stage = "source-overlay";
    inventory = await applyRecordOverlay(p, { read: path => readFile(path), write: (path, text) => writeFile(path, text, { flag: "w" }), inventory: readInventory });
    const environment = Object.fromEntries(Object.entries(process.env).filter((row): row is [string, string] => row[1] !== undefined));
    for (const command of nativeCommands()) {
      stage = command.version ? "version-guard" : "compilation";
      const step = directory + "/" + command.id; await mkdir(step);
      const ms = Math.min(remaining(), command.version ? 10000 : p.limits.nativeWorkMs);
      if (!command.version) compilationAttempts++;
      await recordNativeCommand(command, results, { execute: () => runBounded(command.argv, step, ms, { cwd: root, environment }),
        capture: async stream => { const path = step + "/command." + stream, bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes), text: stream === "stdout" ? bytes.toString() : "" }; },
        mirror: (stream, source) => copyFile(source, root + "/qualification/" + command.id + "." + stream, constants.COPYFILE_EXCL),
      });
    }
    remaining();
  } catch (error) { failure = error instanceof Error ? error.message : String(error); }
  const sourceCheck = await recheckNativeSource(inventory, readInventory, remaining);
  if (sourceCheck.sourceChanged !== false || !sourceCheck.sourceStabilityChecked) failure ??= sourceCheck.sourceChanged ? "NATIVE_SOURCE_CHANGED" : "NATIVE_SOURCE_STABILITY_UNCHECKED";
  if (failure === null) stage = "complete";
  const receipt = { status: failure === null ? "PASS_NATIVE_COMPILATION_ONLY" : "FAIL_NATIVE_COMPILATION_ONLY", failure, stage, bunVersion: Bun.version, staging, compilationAttempts, results,
    ...sourceCheck, sourceManifestSha256: p.sourceManifestSha256, previousSourceManifestSha256: p.previousSourceManifestSha256,
    retainedCachesWritable: true, copiedCargoCache: false, elapsedMs: performance.now() - started, qualificationImageBuilt: false, testsExecuted: false, gpuExecuted: false, trainingReady: false };
  await writeFile(directory + "/receipt.json", JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: receipt.status, failure, receipt: directory + "/receipt.json", trainingReady: false }));
  process.exitCode = failure === null ? 0 : 1;
}
