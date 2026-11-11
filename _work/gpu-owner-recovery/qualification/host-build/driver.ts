// SPEC: _spec/gpu-host-build.puml
import { constants } from "node:fs";
import { copyFile, lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import type plan from "./plan.json";

type Plan = typeof plan;
const requireValue = (value: unknown, label: string) => { if (!value) throw Error(label); };
export function nativeCommands() {
  return [
    { id: "rustc-version", argv: ["rustc", "--version"], version: /^rustc 1\.95\.0 / },
    { id: "cargo-version", argv: ["cargo", "--version"], version: /^cargo 1\.95\.0 / },
    { id: "llvm-version", argv: ["/opt/tracel-data/tracel/tracel-llvm-23.1.0-4/bin/llvm-config", "--version"], version: /^23\.1\.0\s*$/ },
    ...[["gpu-learning", "chess-coach-learning", "finite_difference"], ["gpu-policy", "chess-coach-policy-io", "gpu"]].map(([id, pkg, target]) => ({ id: id!, argv: ["cargo", "test", "--release", "--target", "x86_64-unknown-linux-gnu", "--locked", "--offline", "--jobs", "2", "-p", pkg!, "--features", "gpu-prepared-llvm", "--test", target!, "--no-run", "--message-format=json"], version: null })),
  ];
}

export async function stageTree(source: string, destination: string, budget: { bytes: number; files: number }, p: Plan, remaining: () => number) {
  remaining(); await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    remaining(); const from = source + "/" + entry.name, to = destination + "/" + entry.name;
    if (entry.isDirectory()) await stageTree(from, to, budget, p, remaining);
    else {
      const stat = await lstat(from); requireValue(stat.isFile(), "STAGING_REGULAR_FILE_REQUIRED");
      budget.bytes += stat.size; budget.files++;
      requireValue(budget.bytes <= p.limits.stagingBytes && budget.files <= p.limits.stagingFiles, "STAGING_BUDGET");
      await copyFile(from, to, constants.COPYFILE_EXCL);
    }
  }
}

export async function recordNativeCommand(command: ReturnType<typeof nativeCommands>[number], attempts: any[], io: {
  execute(): Promise<Record<string, any>>;
  capture(stream: string): Promise<{ path: string; bytes: number; sha256: string; text: string }>;
  mirror(stream: string, source: string): Promise<void>;
}) {
  const attempt = { id: command.id, argv: command.argv, attempted: true, status: "STARTED", streams: [] as unknown[], captureFailures: [] as string[], canonicalCopyFailures: [] as string[] };
  attempts.push(attempt);
  let result: Record<string, any>;
  try { result = await io.execute(); Object.assign(attempt, result); }
  catch (error) { Object.assign(attempt, { status: "FAIL", failure: String(error) }); throw error; }
  let stdout = "";
  for (const stream of ["stdout", "stderr"]) {
    let captured: Awaited<ReturnType<typeof io.capture>>;
    try {
      captured = await io.capture(stream); const { text, ...metadata } = captured; attempt.streams.push(metadata);
      if (stream === "stdout") stdout = text;
    } catch (error) { attempt.captureFailures.push(stream + ":" + String(error)); continue; }
    if (!command.version) {
      try { await io.mirror(stream, captured.path); }
      catch (error) { attempt.canonicalCopyFailures.push(stream + ":" + String(error)); }
    }
  }
  requireValue(result.status === "PASS" && result.exitCode === 0 && result.failure === null, "NATIVE_COMMAND_FAILED:" + command.id);
  requireValue(attempt.captureFailures.length === 0 && attempt.canonicalCopyFailures.length === 0, "NATIVE_CAPTURE_OR_COPY_FAILED:" + command.id);
  if (command.version) requireValue(command.version.test(stdout), "NATIVE_VERSION_MISMATCH:" + command.id);
}

export async function recheckNativeSource(initial: unknown, read: (() => Promise<unknown>) | null, remaining: () => number) {
  if (initial === null || read === null) return { sourceChanged: null, sourceStabilityChecked: false, sourceCheckFailure: "INITIAL_INVENTORY_UNAVAILABLE" };
  try {
    remaining(); const after = await read(); remaining();
    return { sourceChanged: JSON.stringify(initial) !== JSON.stringify(after), sourceStabilityChecked: true, sourceCheckFailure: null };
  } catch (error) { return { sourceChanged: null, sourceStabilityChecked: false, sourceCheckFailure: String(error) }; }
}

export async function runNativeBuild(p: Plan) {
  const root = "/build/native", directory = root + "/_work/gpu-owner-recovery/runs/" + p.runId;
  const started = performance.now();
  let deadline = started;
  const remaining = () => { const ms = Math.floor(deadline - performance.now() - 30000); requireValue(ms > 0, "NATIVE_BUILD_DEADLINE"); return ms; };
  const budget = { bytes: 0, files: 0 }, results: unknown[] = [];
  let stage = "startup", failure: string | null = null, compilationAttempts = 0;
  let inventory: unknown = null, inventoryReader: (() => Promise<unknown>) | null = null;
  const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  await mkdir(directory, { recursive: true });
  try {
    const hostDeadline = JSON.parse(await readFile("/evidence/deadline.json", "utf8")).normalDeadlineEpoch;
    requireValue(Number.isSafeInteger(hostDeadline) && hostDeadline > Date.now(), "NATIVE_HOST_DEADLINE_REQUIRED");
    deadline = Math.min(started + p.limits.nativeWorkMs, performance.now() + hostDeadline - Date.now());
    requireValue(process.cwd() === root && Bun.version === "1.4.0", "NATIVE_BUN_CONTEXT_REQUIRED");
    stage = "staging";
    for (const [source, target] of [["/received/current-native", root], ["/received/qualification-tools", root], ["/received/cargo-home", "/capture/cargo-home"]]) await stageTree(source!, target!, budget, p, remaining);
    for (const path of ["home", "tmp"]) await mkdir(root + "/_work/gpu-owner-recovery/scratch/" + path, { recursive: true });
    const { runBounded } = await import(pathToFileURL(root + "/_work/gpu-owner-recovery/verify.ts").href);
    const { sourceInventory } = await import(pathToFileURL(root + "/tooling/runtime/qualification.ts").href);
    inventoryReader = () => sourceInventory(root);
    const sourceBytes = await readFile(root + "/qualification/source-manifest.json");
    inventory = await sourceInventory(root);
    requireValue(hash(sourceBytes) === p.sourceManifestSha256 && JSON.stringify(JSON.parse(sourceBytes.toString())) === JSON.stringify(inventory), "NATIVE_SOURCE_GENERATION_REQUIRED");
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
  } catch (error) { failure = error instanceof Error ? error.message : "NATIVE_BUILD_FAILED"; }
  const sourceCheck = await recheckNativeSource(inventory, inventoryReader, remaining);
  if (sourceCheck.sourceChanged !== false || !sourceCheck.sourceStabilityChecked) failure ??= sourceCheck.sourceChanged ? "NATIVE_SOURCE_CHANGED" : "NATIVE_SOURCE_STABILITY_UNCHECKED";
  if (failure === null) stage = "complete";
  const receipt = { status: failure === null ? "PASS_NATIVE_COMPILATION_ONLY" : "FAIL_NATIVE_COMPILATION_ONLY", failure, stage, bunVersion: Bun.version, staging: budget, compilationAttempts, results, ...sourceCheck,
    sourceManifestSha256: p.sourceManifestSha256, elapsedMs: performance.now() - started, qualificationImageBuilt: false, testsExecuted: false, gpuExecuted: false, trainingReady: false };
  await writeFile(directory + "/receipt.json", JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: receipt.status, failure, stage, receipt: directory + "/receipt.json", trainingReady: false }));
  process.exitCode = failure === null ? 0 : 1;
}
