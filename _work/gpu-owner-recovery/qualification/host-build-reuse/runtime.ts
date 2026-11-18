// SPEC: _spec/gpu-host-build-reuse.puml
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, statfs, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { protectFinalizationSignals, treeBytes, watchWorkspace } from "../host-build/build";
import { executeReuseBuild } from "./host";
import { reusePaths, type ReusePlan } from "./plan";

export async function runReuseHost(p: ReusePlan, driver: string) {
  const protection = protectFinalizationSignals();
  const root = resolve(process.cwd()), paths = reusePaths(root, p), { evidence, workspace, context } = paths;
  const requireValue = (value: unknown, label: string) => { if (!value) throw Error(label); };
  const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  const captures: unknown[] = [];
  let receipt: any;
  try {
    requireValue(Bun.version === "1.4.0" && Bun.argv.at(-1) === p.grant, "FRESH_PINNED_HOST_BUILD_CONTEXT_REQUIRED");
    const startedEpoch = Number(process.env.HOST_NATIVE_BUILD_STARTED_MS), elapsed = Date.now() - startedEpoch;
    requireValue(Number.isSafeInteger(startedEpoch) && startedEpoch > 0 && elapsed >= 0 && elapsed < p.limits.normalOperationsMs, "HOST_BUILD_START_TIME_REQUIRED");
    const startedAt = performance.now() - elapsed, normalDeadline = startedAt + p.limits.normalOperationsMs;
    const remaining = () => requireValue(performance.now() < normalDeadline, "HOST_BUILD_DEADLINE");
    for (const helper of p.existingHelpers) { remaining(); requireValue(hash(await readFile(helper.path)) === helper.sha256, "EXISTING_HOST_HELPER_MISMATCH:" + helper.path); remaining(); }
    requireValue(hash(await readFile("Cargo.lock")) === "77f674cc26a01f26558fd99c45bdcd5566017be05833fce1d39cae98cda05955", "HOST_REPOSITORY_CONTEXT_REQUIRED");
    remaining();
    const free = await statfs(dirname(workspace)); requireValue(Number(free.bavail) * Number(free.bsize) >= p.limits.minimumFreeBytes, "INITIAL_FREE_DISK_REQUIRED");
    const bun = await lstat(paths.bun);
    requireValue(bun.isFile() && bun.size > 0 && bun.size <= p.limits.bunPostCopyBytes && (bun.mode & 0o111) !== 0, "RETAINED_BUN_FILE_ADMISSION_FAILED");
    for (const path of [paths.cargo, paths.target]) { remaining(); requireValue((await lstat(path)).isDirectory(), "RETAINED_CACHE_DIRECTORY_REQUIRED"); }
    remaining();
    await mkdir(workspace); await mkdir(paths.native); await mkdir(paths.native + "/target-gpu"); await mkdir(evidence + "/native");
    await mkdir(paths.native + "/_work/gpu-owner-recovery/runs/" + p.runId, { recursive: true });
    await writeFile(evidence + "/build-driver.mjs", driver, { flag: "wx" });
    await writeFile(evidence + "/plan.json", JSON.stringify(p) + "\n", { flag: "wx" });
    await writeFile(evidence + "/deadline.json", JSON.stringify({ normalDeadlineEpoch: startedEpoch + p.limits.normalOperationsMs, nativeAcceptanceReserveMs: p.limits.nativeAcceptanceReserveMs }) + "\n", { flag: "wx" });
    const logicalBytes = async () => {
      let bytes = 0;
      for (const path of [workspace, evidence, paths.cargo, paths.target]) {
        remaining();
        bytes += await treeBytes(path, {
          entries: async path => { remaining(); const entries = await readdir(path, { withFileTypes: true }); remaining(); return entries; },
          size: async path => { remaining(); const size = (await lstat(path)).size; remaining(); return size; },
        });
        remaining();
      }
      return bytes;
    };
    requireValue(await logicalBytes() <= p.limits.workspaceSoftBytes, "WORKSPACE_SOFT_LIMIT_OR_FREE_SPACE");
    remaining();
    const { runBounded } = await import(pathToFileURL(resolve(p.existingHelpers[0]!.path)).href);
    const environment = Object.fromEntries(Object.entries(process.env).filter((row): row is [string, string] => row[1] !== undefined)); delete environment.DOCKER_CONTEXT;
    remaining(); requireValue(!protection.observed(), "HOST_BUILD_INTERRUPTED_DURING_PREFLIGHT");
    receipt = await executeReuseBuild(p, paths, process.getuid!(), process.getgid!(), {
      now: () => performance.now(), startedAt, run: async (id, argv, ms) => {
        const deadline = performance.now() + ms, step = evidence + "/" + id; await mkdir(step);
        const timeoutMs = Math.floor(deadline - performance.now()); requireValue(timeoutMs > 0, "HOST_BUILD_DEADLINE");
        const result = await runBounded(argv, step, timeoutMs, { cwd: root, environment });
        const streams = [];
        let stdout = "";
        for (const stream of ["stdout", "stderr"]) {
          const path = step + "/command." + stream, bytes = await readFile(path);
          streams.push({ path, bytes: bytes.length, sha256: hash(bytes) });
          if (stream === "stdout") stdout = bytes.toString();
        }
        captures.push({ id, streams }); return { ...result, stdout };
      }, recover: async () => {
        try { return (await readFile(evidence + "/worker.cid", "utf8")).trim(); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
      }, nativeReceipt: async () => JSON.parse(await readFile(evidence + "/native/receipt.json", "utf8")),
      artifacts: async timeoutMs => {
        const deadline = Math.min(normalDeadline, performance.now() + timeoutMs);
        const artifactRemaining = () => requireValue(performance.now() < deadline, "ARTIFACT_VALIDATION_NORMAL_DEADLINE");
        artifactRemaining();
        const { readArtifacts } = await import(pathToFileURL(context + "/qualification-tools/tooling/runtime/qualification.ts").href);
        artifactRemaining();
        const logs = { learning: await readFile(paths.native + "/qualification/gpu-learning.stdout", "utf8"), "policy-io": await readFile(paths.native + "/qualification/gpu-policy.stdout", "utf8") };
        artifactRemaining();
        const chosen = readArtifacts(logs, "gpu"), artifacts = [];
        artifactRemaining();
        for (const executable of new Set<string>([...Array.from(chosen.artifacts.values()).map((row: any) => row.executable), ...chosen.binaries.values()] as string[])) {
          artifactRemaining();
          const path = paths.target + executable.slice("/build/native/target-gpu".length), s = await lstat(path);
          artifactRemaining(); requireValue(s.isFile() && (s.mode & 0o111) !== 0, "BUILT_EXECUTABLE_FILE_REQUIRED");
          const digest = createHash("sha256");
          for await (const chunk of Bun.file(path).stream()) { artifactRemaining(); digest.update(chunk); artifactRemaining(); }
          artifactRemaining();
          artifacts.push({ executable, path, bytes: s.size, sha256: digest.digest("hex") });
        }
        artifactRemaining(); return artifacts;
      }, watch: stop => watchWorkspace(p, paths, stop, {
        free: async () => { remaining(); const space = await statfs(workspace); remaining(); return Number(space.bavail) * Number(space.bsize); },
        bytes: logicalBytes,
      }).close,
    });
  } catch (error) { receipt = { status: "FAIL_HOST_BUILD_PREFLIGHT", failure: error instanceof Error ? error.message : "HOST_BUILD_FAILED", hostInvocationsConsumed: 1, remainingHostInvocations: 0, automaticRetryAuthorized: false, qualificationImageBuilt: false, gpuDevicesRequested: false, gpuExecuted: false, testsExecuted: false, trainingReady: false }; }
  try {
    if (protection.observed()) { receipt.status = "FAIL_HOST_GPU_NATIVE_BUILD_ONLY"; receipt.failure ??= "HOST_BUILD_INTERRUPTED"; }
    const bytes = Buffer.from(JSON.stringify({ ...receipt, captures, workspace: p.workspace, evidence: p.evidence,
      cachePaths: { bun: paths.bun, cargo: paths.cargo, target: paths.target }, mutableCachePaths: [paths.cargo, paths.target], retainedBunReadOnly: true,
      cacheWritesScope: { cargoHome: paths.cargo, cargoTarget: paths.target, otherRetainedPathsWritable: false },
      receiptStatusRequiresZeroHostMarker: true, workspaceIsFilesystemQuota: false, dockerWritableLayerIncludedInWorkspaceAccounting: false,
      finalizationSignalObserved: protection.observed(), parentDiagnosticsHaveOnlyPostExitSoftSizeCheck: true }, null, 2) + "\n");
    requireValue(bytes.length <= p.limits.hostReceiptBytes, "HOST_BUILD_RECEIPT_SIZE_LIMIT"); await writeFile(evidence + "/receipt.json", bytes, { flag: "wx" });
    if (protection.observed()) { receipt.status = "FAIL_HOST_GPU_NATIVE_BUILD_ONLY"; receipt.failure ??= "HOST_BUILD_INTERRUPTED"; }
    console.log(JSON.stringify({ status: receipt.status, failure: receipt.failure, receipt: p.evidence + "/receipt.json", trainingReady: false }));
    process.exitCode = receipt.status === "PASS_HOST_GPU_NATIVE_BUILD_ONLY" ? 0 : 1;
  } finally { protection.release(); }
}
