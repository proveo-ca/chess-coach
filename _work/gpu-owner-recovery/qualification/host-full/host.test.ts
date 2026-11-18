// SPEC: _spec/gpu-full-qualification.puml
import { expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { acceptInner, executeFullHost, fullCreate, testExecutionFacts, type FullIO } from "./host";
import { fullPlan, fullPaths, fullSteps } from "./plan";
import { progressWatchdog } from "./watchdog";

const p = await fullPlan(), paths = fullPaths("/source-only-mock", p), worker = "b".repeat(64), terminal = { Running: false, ExitCode: 0, OOMKilled: false };
function pass() {
  return { version: "chess-coach.gpu-full-driver.v1", runId: p.runId, status: "PASS_GPU_FULL_TESTS_ONLY", failure: null,
    sourceStabilityChecked: true, sourceChanged: false, sourceCheckFailure: null, sourceManifestSha256: p.sourceManifestSha256, artifacts: p.artifacts,
    results: fullSteps(p).map(step => ({ id: step.id, attempted: true, commandInvoked: true, commandResult: { status: "PASS", exitCode: 0, failure: null }, status: "PASS", exitCode: 0, failure: null, argv: [step.executable, step.id, "--exact", "--ignored", "--test-threads=1", "--nocapture", "--color=never"] })),
    qualificationResults: fullSteps(p).map(step => ({ id: step.id, accepted: true, status: "PASS", exitCode: 0, failure: null, stdoutSummaries: ["test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured"] })),
    trainingReady: false, canonicalBothQualified: false, integratedR4Qualified: false, operationalTelemetryQualified: false, fullAssuranceQualified: false, trainingExecuted: false };
}
function fixture() {
  let clock = 0, saved: any = null, abort: (reason: string) => Promise<void> = async () => {};
  const calls: { id: string; argv: string[]; ms: number }[] = [], s = { inner: pass() as any, onRun: async (_id: string) => {}, costs: {} as Record<string, number>, closeError: false, failStop: false, failRemove: false, cid: worker as any };
  const io: FullIO = { now: () => clock,
    run: async (id, argv, ms) => {
      calls.push({ id, argv, ms }); if (id === "worker-create") saved = s.cid; await s.onRun(id); clock += s.costs[id] ?? 5;
      const failed = (id === "worker-stop" && s.failStop) || (id === "worker-remove" && s.failRemove);
      return { status: failed ? "FAIL" : "PASS", exitCode: failed ? 125 : 0, failure: null, stdout: id === "worker-state" ? JSON.stringify(terminal) : "" };
    }, recover: async () => saved, innerReceipt: async () => { if (s.inner === null) throw Error("MOCK_INNER_MISSING"); return s.inner; },
    watch: stop => { abort = stop; return { close: async () => { if (s.closeError) throw Error("MOCK_LATE_JOURNAL_FAILURE"); return { guardComplete: true }; } }; },
  };
  return { s, calls, execute: () => executeFullHost(p, paths, 1000, 1000, io), abort: (reason: string) => abort(reason) };
}
async function retain(name: string, f: ReturnType<typeof fixture>, result: unknown) {
  const base = process.env.HOST_FULL_TEST_EVIDENCE; if (!base) return;
  const directory = resolve(base, name), rel = relative(resolve("_work/gpu-owner-recovery/runs"), directory);
  if (isAbsolute(rel) || rel.startsWith("..") || !rel.includes("source-")) throw Error("REPOSITORY_SOURCE_FIXTURE_REQUIRED");
  await mkdir(directory); const scope = { scope: "SOURCE_ONLY_PURE_MOCK_E2E_NOT_HOST_GPU_EVIDENCE", actualDockerProcesses: 0, actualNativeProcesses: 0, gpuExecuted: false };
  await writeFile(directory + "/receipt.json", JSON.stringify({ ...scope, result }, null, 2) + "\n", { flag: "wx" });
  await writeFile(directory + "/argv.json", JSON.stringify({ ...scope, calls: f.calls }, null, 2) + "\n", { flag: "wx" });
}
const ids = (f: ReturnType<typeof fixture>) => f.calls.map(row => row.id);

test("full packet adds both fresh scratch aliases beneath RO native source", () => {
  const argv = fullCreate(p, paths, 1000, 1000), mounts = argv.filter((_, i) => argv[i - 1] === "--mount");
  for (const flag of ["--runtime=nvidia", "--gpus=device=" + p.selectedUuid, "--cpus=2", "--memory=8g", "--memory-swap=8g", "--network=none", "--pull=never"]) expect(argv).toContain(flag);
  expect(mounts).toHaveLength(10); expect(mounts.filter(s => !s.endsWith(",readonly"))).toEqual([
    `type=bind,source=${paths.inner},target=/evidence/inner`, `type=bind,source=${paths.runs},target=/build/native/_work/gpu-owner-recovery/runs`,
    `type=bind,source=${paths.scratch},target=/scratch`, `type=bind,source=${paths.scratch},target=/build/native/_work/gpu-owner-recovery/scratch`,
  ]);
  expect(mounts).toContain(`type=bind,source=${paths.native},target=/build/native,readonly`);
  expect(argv.join(" ")).not.toMatch(/cargo-home|buildx|docker.sock,target|--privileged|--network=host|--attach/);
  expect(argv.slice(argv.indexOf(p.rustImage) + 1)).toEqual(["--no-env-file", "--no-install", "/evidence/driver.mjs"]);
});
test("pure mock full happy e2e retains six results and five owned operations", async () => {
  const f = fixture(), result = await f.execute(); await retain("happy", f, result);
  expect(result.status).toBe("PASS_HOST_GPU_FULL_ONLY"); expect(ids(f)).toEqual(["worker-create", "worker-start", "worker-logs", "worker-state", "worker-remove"]);
  expect(result.innerReceipt.results).toHaveLength(6); expect(result.trainingReady).toBe(false); expect(result.remainingHostInvocations).toBe(0); expect(result.cleanupFailures).toEqual([]);
});
test("pure mock journal abort stops only the owned work and keeps a failed receipt", async () => {
  const f = fixture(); f.s.inner = null; const g = progressWatchdog(p, () => 0);
  f.s.onRun = async id => { if (id === "worker-logs") {
    const text = ["guard-start", "abort"].map((kind, i) => JSON.stringify({ version: "chess-coach.gpu-full-event.v1", runId: p.runId, sequence: i + 1, kind, reason: "MOCK_HEADROOM" })).join("\n") + "\n";
    try { g.read(text); } catch (error) { await f.abort(String(error)); }
  } };
  const result = await f.execute(); await retain("journal-abort", f, result);
  expect(result.status).toBe("FAIL_HOST_GPU_FULL_ONLY"); expect(result.innerReceipt).toBeNull(); expect(result.failure).toContain("MOCK_HEADROOM");
  expect(ids(f)).toEqual(["worker-create", "worker-start", "worker-logs", "worker-stop", "worker-state", "worker-remove"]);
});
test("pure mock late watchdog drain failure cannot promote apparent six-test PASS", async () => {
  const f = fixture(); f.s.closeError = true; const result = await f.execute(); await retain("late-watchdog-failure", f, result);
  expect(result.status).toBe("FAIL_HOST_GPU_FULL_ONLY"); expect(result.failure).toContain("MOCK_LATE_JOURNAL_FAILURE"); expect(ids(f)).toContain("worker-stop");
});
test("abort during start settles before stop and never starts log-follow", async () => {
  const f = fixture(); f.s.onRun = async id => { if (id === "worker-start") { await f.abort("MOCK_START_PENDING_ABORT"); expect(ids(f)).not.toContain("worker-stop"); } };
  const result = await f.execute(); expect(result.failure).toBe("MOCK_START_PENDING_ABORT"); expect(ids(f)).not.toContain("worker-logs"); expect(ids(f)).toContain("worker-stop");
});
test("failed stop permits one conditional kill and preserves the cleanup failure", async () => {
  const f = fixture(); f.s.inner = null; f.s.failStop = true; const result = await f.execute();
  expect(result.status).toBe("FAIL_HOST_GPU_FULL_ONLY"); expect(ids(f)).toContain("worker-kill"); expect(f.calls.length).toBeLessThanOrEqual(7);
  expect(result.cleanupFailures.length).toBeGreaterThan(0); expect(new Set(ids(f)).size).toBe(f.calls.length);
});
test("removal failure alone prevents full PASS", async () => {
  const f = fixture(); f.s.failRemove = true; expect((await f.execute()).status).toBe("FAIL_HOST_GPU_FULL_ONLY");
});
test("late captured operations cannot borrow cleanup or receipt reserves", async () => {
  for (const [id, duration] of [["worker-create", p.limits.normalOperationsMs], ["worker-remove", p.limits.overallMs - p.limits.receiptReserveMs]] as const) {
    const f = fixture(); f.s.costs[id] = duration; const result = await f.execute(); expect(result.status).toBe("FAIL_HOST_GPU_FULL_ONLY");
    expect(result.results.find(row => row.id === id).supervisorResult).toEqual({ status: "PASS", exitCode: 0, failure: null });
    if (id === "worker-remove") expect(result.cleanupFailures.join("\n")).toContain("HOST_FULL_PHASE_DEADLINE:worker-remove");
    else { expect(result.failure).toBe("HOST_FULL_PHASE_DEADLINE:worker-create"); expect(ids(f)).not.toContain("worker-start"); }
  }
});
test("invalid or absent CIDs never authorize guessed cleanup", async () => {
  for (const cid of [null, "foreign", [worker], "B".repeat(64), "b".repeat(63)]) {
    const f = fixture(); f.s.cid = cid; const result = await f.execute(); expect(result.status).toBe("FAIL_HOST_GPU_FULL_ONLY"); expect(ids(f)).toEqual(["worker-create"]);
  }
});
test("two-test receipts, wrong FD harnesses and false summaries cannot replace full-six evidence", () => {
  const changes = [(r: any) => { r.results.splice(2); r.qualificationResults.splice(2); }, (r: any) => { r.results[2].argv[0] = p.artifacts[1]!.executable; },
    (r: any) => { r.sourceStabilityChecked = false; }, (r: any) => { r.qualificationResults[5].accepted = false; }, (r: any) => { r.artifacts = []; },
    (r: any) => { r.qualificationResults[4].stdoutSummaries = ["test result: ok. 0 passed; 0 failed; 0 ignored;"]; }];
  for (const change of changes) { const r = structuredClone(pass()); change(r); expect(() => acceptInner(p, r)).toThrow(); }
});
test("malformed inner results retain the ledger and GPU attempt fact", async () => {
  const f = fixture(); f.s.inner.results = "ab"; const result = await f.execute(); expect(result.status).toBe("FAIL_HOST_GPU_FULL_ONLY");
  expect(result.gpuExecutionAttempted).toBe(true); expect(result.testsExecuted).toBeNull(); expect(result.results.map(r => r.id)).toEqual(ids(f)); expect(ids(f)).toContain("worker-remove");
});
test("registered attempts do not assert execution before native invocation or an observed exit", async () => {
  for (const row of [{ attempted: true }, { attempted: true, commandInvoked: false }]) {
    const f = fixture(); f.s.inner.results = [row];
    const result = await f.execute(); expect(result.testsExecuted).toBe(false); expect(result.testExecutionAttempted).toBe(false);
  }
  expect(testExecutionFacts({ results: [{ attempted: true, commandInvoked: true }] })).toEqual({ testExecutionAttempted: true, testsExecuted: null });
  expect(testExecutionFacts({ results: [{ commandInvoked: true, commandResult: { exitCode: -1 } }] })).toEqual({ testExecutionAttempted: true, testsExecuted: null });
  expect(testExecutionFacts(pass())).toEqual({ testExecutionAttempted: true, testsExecuted: true });
});
test("runtime retains original helpers, single-count scratch and finalization protection", async () => {
  const source = await readFile(new URL("./runtime.ts", import.meta.url), "utf8");
  expect(source).toContain("import(pathToFileURL(resolve(p.existingHelpers[0]!.path)).href)");
  expect(source).toContain("[paths.workspace, paths.evidence]");
  const entry = source.slice(source.indexOf("export async function runFullHost("));
  expect(entry.indexOf("protectFinalizationSignals()")).toBeLessThan(entry.indexOf("try {"));
  expect(source).toContain("receiptStatusRequiresZeroHostMarker: true"); expect(source.match(/protection\.observed\(\)/g)!.length).toBeGreaterThanOrEqual(3);
  expect(source.indexOf("protection.release()")).toBeGreaterThan(source.indexOf("process.exitCode ="));
});
