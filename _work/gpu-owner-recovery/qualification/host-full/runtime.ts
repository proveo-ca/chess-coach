// SPEC: _spec/gpu-full-qualification.puml
import { lstat, mkdir, readFile, readdir, statfs, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { protectFinalizationSignals, treeBytes, watchWorkspace } from "../host-build/build";
import { captureDockerResult } from "../host-feasibility/runtime";
import { executeFullHost } from "./host";
import { digest, fullPaths, requireValue, type FullPlan } from "./plan";
import { progressWatchdog } from "./watchdog";

export { captureDockerResult } from "../host-feasibility/runtime";
export function journalWatcher(p: FullPlan, io: { now(): number; text(): Promise<string>; abort(reason: string): Promise<void> }, schedule = {
  every: (run: () => void, ms: number) => setInterval(run, ms), cancel: (handle: ReturnType<typeof setInterval>) => clearInterval(handle),
}) {
  const progress = progressWatchdog(p, io.now);
  let closed = false, pending: Promise<void> | null = null, failure: string | null = null;
  const scan = () => {
    if (closed) return Promise.resolve();
    return pending ??= (async () => {
      try { progress.read(await io.text()); }
      catch (error) { failure ??= error instanceof Error ? error.message : "JOURNAL_WATCHDOG_FAILED"; await io.abort(failure); }
    })().finally(() => { pending = null; });
  };
  const timer = schedule.every(() => { void scan().catch(() => {}); }, p.limits.watchdogPollMs);
  return { scan, close: async () => {
    schedule.cancel(timer);
    try {
      if (pending) await pending;
      await scan(); requireValue(failure === null, failure ?? "JOURNAL_WATCHDOG_FAILED");
      return progress.finish(await io.text());
    } finally { closed = true; }
  } };
}

export async function runFullHost(p: FullPlan, driver: string) {
  const protection = protectFinalizationSignals(), root = resolve(process.cwd()), paths = fullPaths(root, p), captures: unknown[] = [];
  let receipt: any;
  try {
    requireValue(Bun.version === "1.4.0" && Bun.argv.at(-1) === p.grant, "FRESH_PINNED_FULL_HOST_CONTEXT_REQUIRED");
    const startedEpoch = Number(process.env.HOST_FULL_STARTED_MS), elapsed = Date.now() - startedEpoch;
    requireValue(Number.isSafeInteger(startedEpoch) && startedEpoch > 0 && elapsed >= 0 && elapsed < p.limits.normalOperationsMs, "HOST_FULL_START_TIME_REQUIRED");
    const startedAt = performance.now() - elapsed, normalDeadline = startedAt + p.limits.normalOperationsMs;
    const remaining = () => requireValue(performance.now() < normalDeadline, "HOST_FULL_NORMAL_DEADLINE");
    for (const helper of p.existingHelpers) { remaining(); requireValue(digest(await readFile(helper.path)) === helper.sha256, "EXISTING_HOST_HELPER_MISMATCH:" + helper.path); }
    requireValue(digest(await readFile("Cargo.lock")) === "77f674cc26a01f26558fd99c45bdcd5566017be05833fce1d39cae98cda05955", "HOST_REPOSITORY_CONTEXT_REQUIRED");
    const free = await statfs(dirname(paths.workspace));
    requireValue(Number(free.bavail) * Number(free.bsize) >= p.limits.minimumFreeBytes, "INITIAL_FREE_DISK_REQUIRED");
    const bun = await lstat(paths.bun); requireValue(bun.isFile() && bun.size > 0 && bun.size <= p.limits.bunPostCopyBytes && (bun.mode & 0o111) !== 0, "RETAINED_BUN_FILE_ADMISSION_FAILED");
    for (const path of [paths.native, paths.target, paths.context + "/gpu-build/llvm", paths.context + "/gpu-runtime/rootfs/usr/local/cuda",
      paths.native + "/_work/gpu-owner-recovery/runs", paths.native + "/_work/gpu-owner-recovery/scratch"]) {
      remaining(); requireValue((await lstat(path)).isDirectory(), "EXISTING_RUNTIME_DIRECTORY_REQUIRED:" + path);
    }
    await mkdir(paths.workspace); await mkdir(paths.scratch);
    for (const name of ["home", "tmp", "cache", "cuda-cache"]) await mkdir(paths.scratch + "/" + name);
    await mkdir(paths.inner); await mkdir(paths.runs);
    await writeFile(paths.evidence + "/driver.mjs", driver, { flag: "wx" });
    await writeFile(paths.evidence + "/plan.json", JSON.stringify(p) + "\n", { flag: "wx" });
    await writeFile(paths.evidence + "/deadline.json", JSON.stringify({ normalDeadlineEpoch: startedEpoch + p.limits.normalOperationsMs }) + "\n", { flag: "wx" });
    const logicalBytes = async () => {
      let bytes = 0;
      for (const path of [paths.workspace, paths.evidence]) bytes += await treeBytes(path, {
        entries: async path => { remaining(); return readdir(path, { withFileTypes: true }); }, size: async path => { remaining(); return (await lstat(path)).size; },
      });
      remaining(); return bytes;
    };
    requireValue(await logicalBytes() <= p.limits.workspaceSoftBytes, "WORKSPACE_SOFT_LIMIT_OR_FREE_SPACE");
    const { runBounded } = await import(pathToFileURL(resolve(p.existingHelpers[0]!.path)).href);
    const environment = Object.fromEntries(Object.entries(process.env).filter((row): row is [string, string] => row[1] !== undefined)); delete environment.DOCKER_CONTEXT;
    remaining(); requireValue(!protection.observed(), "HOST_FULL_INTERRUPTED_DURING_PREFLIGHT");
    receipt = await executeFullHost(p, paths, process.getuid!(), process.getgid!(), {
      now: () => performance.now(), startedAt,
      run: async (id, argv, ms) => {
        const deadline = performance.now() + ms, directory = paths.evidence + "/" + id; await mkdir(directory);
        const timeout = Math.floor(deadline - performance.now()); requireValue(timeout > 0, "HOST_FULL_DEADLINE");
        const result = await runBounded(argv, directory, timeout, { cwd: root, environment });
        const captured = await captureDockerResult(result, directory);
        captures.push({ id, streams: captured.streams, captureFailures: captured.captureFailures }); return captured;
      },
      recover: async () => { try { return (await readFile(paths.evidence + "/worker.cid", "utf8")).trim(); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; } },
      innerReceipt: async () => JSON.parse(await readFile(paths.inner + "/receipt.json", "utf8")),
      watch: abort => {
        const resources = watchWorkspace(p, { ...paths, cargo: "" }, abort, {
          free: async () => { remaining(); const space = await statfs(paths.workspace); return Number(space.bavail) * Number(space.bsize); }, bytes: logicalBytes,
        });
        const journal = journalWatcher(p, { now: () => performance.now(), abort, text: async () => {
          const path = paths.inner + "/events.ndjson";
          try { requireValue((await lstat(path)).size <= p.limits.journalBytes, "JOURNAL_BYTE_BOUND"); return await readFile(path, "utf8"); }
          catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return ""; throw error; }
        } });
        return { close: async () => {
          let error: unknown;
          try { await resources.close(); } catch (caught) { error = caught; }
          const status = await journal.close(); if (error) throw error; return status;
        } };
      },
    });
  } catch (error) {
    receipt = { status: "FAIL_HOST_GPU_FULL_PREFLIGHT", failure: error instanceof Error ? error.message : "HOST_FULL_FAILED", hostInvocationsConsumed: 1,
      remainingHostInvocations: 0, automaticRetryAuthorized: false, trainingReady: false, testsExecuted: null, gpuExecutionAttempted: false };
  }
  try {
    if (protection.observed()) { receipt.status = "FAIL_HOST_GPU_FULL_ONLY"; receipt.failure ??= "HOST_FULL_INTERRUPTED"; }
    const bytes = Buffer.from(JSON.stringify({ ...receipt, captures, workspace: p.workspace, evidence: p.evidence, requestedResources: p.resources, limits: p.limits,
      retainedInputsReadOnly: true, mutableRetainedCaches: [], receiptStatusRequiresZeroHostMarker: true, finalizationSignalObserved: protection.observed(),
      parentDiagnosticsHaveOnlyPostExitSoftSizeCheck: true, workspaceIsFilesystemQuota: false, dockerWritableLayerIncludedInWorkspaceAccounting: false,
      canonicalBothQualified: false, integratedR4Qualified: false, operationalTelemetryQualified: false, fullAssuranceQualified: false, trainingExecuted: false }, null, 2) + "\n");
    requireValue(bytes.length <= p.limits.hostReceiptBytes, "HOST_FULL_RECEIPT_SIZE_LIMIT"); await writeFile(paths.evidence + "/receipt.json", bytes, { flag: "wx" });
    if (protection.observed()) { receipt.status = "FAIL_HOST_GPU_FULL_ONLY"; receipt.failure ??= "HOST_FULL_INTERRUPTED"; }
    console.log(JSON.stringify({ status: receipt.status, failure: receipt.failure, receipt: p.evidence + "/receipt.json", trainingReady: false }));
    process.exitCode = receipt.status === "PASS_HOST_GPU_FULL_ONLY" ? 0 : 1;
  } finally { protection.release(); }
}
