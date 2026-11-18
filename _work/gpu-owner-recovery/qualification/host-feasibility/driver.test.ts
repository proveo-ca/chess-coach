// SPEC: _spec/gpu-feasibility.puml
import { expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import * as frozen from "../../../../tooling/runtime/qualification";
import { digest, feasibilityPaths, feasibilityPlan } from "./plan";
import type { FeasibilityPlan } from "./plan";
import { executeFeasibility, feasibilityEnvironment } from "./driver";
import type { FeasibilityDriverIO } from "./driver";
import type { DriverEvent } from "./guard";
import { executeFeasibilityHost } from "./host";
import { progressWatchdog } from "./watchdog";

const p = await feasibilityPlan();
const manifestBytes = await readFile("_work/gpu-owner-recovery/runs/host-gpu-policy-record-correction-source-2/native-source-manifest.json");
const manifest = JSON.parse(manifestBytes.toString());
const helperBytes = new Map<string, Uint8Array>(await Promise.all(p.existingHelpers.map(async helper => [`/build/native/${helper.path}`, await readFile(helper.path)] as const)));
const qualificationBytes = await readFile("tooling/runtime/qualification.ts");
const pass = { status: "PASS" as const, exitCode: 0, failure: null, stdoutBytes: 0, stderrBytes: 0 };
const summary = "test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out\n";
const csv = (free = 3072) => `${p.selectedUuid}, ${free}, 8192\n`;

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function flush() { for (let index = 0; index < 80; index++) await Promise.resolve(); }
class Clock {
  time = 0;
  private next = 0;
  private timers = new Map<number, { at: number; callback: () => void }>();
  now = () => this.time;
  schedule = (delay: number, callback: () => void) => {
    const id = ++this.next;
    this.timers.set(id, { at: this.time + delay, callback });
    return () => { this.timers.delete(id); };
  };
  async advance(time: number) {
    await flush();
    for (;;) {
      const due = [...this.timers.entries()].filter(([, timer]) => timer.at <= time).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      this.time = due[1].at; this.timers.delete(due[0]); due[1].callback(); await flush();
    }
    this.time = time; await flush();
  }
  count() { return this.timers.size; }
}
type Reply = { stdout: string; stderr?: string; result?: typeof pass | { status: "FAIL"; exitCode: number; failure: string | null; stdoutBytes: number; stderrBytes: number } };
function harness(plan: FeasibilityPlan = p) {
  const clock = new Clock(), events: DriverEvent[] = [], order: string[] = [], commands: { argv: string[]; timeout: number; directory: string; environment: Record<string, string> }[] = [];
  const captures = new Map<string, Uint8Array>(), paths = plan.artifacts.map(binding => binding.executable);
  const executable = (name: string) => paths.find(path => path.split("/").at(-1)!.startsWith(name))!;
  const artifact = (owner: string, name: string, kind: string, isTest: boolean, path: string) => ({ reason: "compiler-artifact",
    package_id: `path+file:///build/native/crates/${owner}#chess-coach-${owner}@0.1.0`, features: ["gpu-cuda", "gpu-prepared-llvm"],
    executable: path, target: { name, kind: [kind] }, profile: { test: isTest } });
  const logs = {
    learning: [artifact("learning", "finite_difference", "test", true, executable("finite_difference-")), { reason: "build-finished", success: true }],
    policy: [artifact("policy-io", "gpu", "test", true, executable("gpu-")), ...["policy-score", "policy-channel", "policy-initialize"]
      .map(name => artifact("policy-io", name, "bin", false, executable(name))), { reason: "build-finished", success: true }],
  };
  let queryCount = 0, testCount = 0, inventoryCount = 0, activeWrites = 0, maxWrites = 0;
  const hooks = {
    query: async (_index: number): Promise<Reply> => ({ stdout: csv() }),
    test: async (_index: number): Promise<Reply> => ({ stdout: summary }),
    append: async (_event: DriverEvent) => {},
    inventory: async (_index: number) => structuredClone(manifest),
    capture: async (_path: string) => {},
    hash: async (_path: string) => {},
  };
  const io: FeasibilityDriverIO = {
    now: clock.now, budgetMs: plan.limits.nativeWorkMs, schedule: clock.schedule,
    async readFile(path) {
      order.push(`read:${path}`);
      if (path === "/build/native/qualification/source-manifest.json") return manifestBytes;
      if (helperBytes.has(path)) return helperBytes.get(path)!;
      if (path === "/build/native/tooling/runtime/qualification.ts") return qualificationBytes;
      if (path === "/build/native/qualification/gpu-learning.stdout") return Buffer.from(logs.learning.map(row => JSON.stringify(row)).join("\n"));
      if (path === "/build/native/qualification/gpu-policy.stdout") return Buffer.from(logs.policy.map(row => JSON.stringify(row)).join("\n"));
      throw Error("UNEXPECTED_MOCK_READ:" + path);
    },
    async hashExecutable(path, _expected, check) {
      check(); order.push(`hash:${path}`); await hooks.hash(path); check();
      const binding = plan.artifacts.find(entry => entry.executable === path)!;
      return { bytes: binding.bytes, sha256: binding.sha256 };
    },
    async loadQualification() {
      order.push("load:qualification");
      return { ...frozen, async sourceInventory(root) {
        expect(root).toBe("/build/native"); order.push("inventory"); return hooks.inventory(++inventoryCount);
      } };
    },
    async createCaptureDirectory(path) { order.push(`mkdir:${path}`); },
    async runCommand(argv, directory, timeout, environment) {
      commands.push({ argv: [...argv], directory, timeout, environment }); order.push(`execute:${argv[0]}`);
      const reply = argv[0] === "nvidia-smi" ? await hooks.query(++queryCount) : await hooks.test(++testCount);
      captures.set(`${directory}/command.stdout`, Buffer.from(reply.stdout));
      captures.set(`${directory}/command.stderr`, Buffer.from(reply.stderr ?? ""));
      return { ...pass, stdoutBytes: Buffer.byteLength(reply.stdout), stderrBytes: Buffer.byteLength(reply.stderr ?? ""), ...reply.result };
    },
    async readCapture(path) { await hooks.capture(path); const bytes = captures.get(path); if (!bytes) throw Error("MISSING_MOCK_CAPTURE"); return bytes; },
    async appendJournal(line) {
      activeWrites++; maxWrites = Math.max(maxWrites, activeWrites);
      try { const event = JSON.parse(line); await hooks.append(event); events.push(event); order.push(`event:${event.kind}:${event.id ?? ""}`); }
      finally { activeWrites--; }
    },
  };
  return { io, hooks, clock, events, order, commands, captures, maxWrites: () => maxWrites };
}

test("pure mocked pair validates five artifacts and 65 sources before GPU commands", async () => {
  expect(digest(manifestBytes)).toBe(p.sourceManifestSha256);
  const h = harness(), receipt = await executeFeasibility(p, h.io);
  expect(receipt.status).toBe("PASS_GPU_FEASIBILITY_TESTS_ONLY");
  expect(receipt.results).toHaveLength(2); expect(receipt.artifacts).toHaveLength(5);
  expect(receipt.qualificationResults.map(result => [result.id, result.accepted])).toEqual([
    ["cuda_f64_nonzero_native_scores_round_trip", true], ["cuda_f64_direct_sgd_changes_policy_parameters", true],
  ]);
  expect(receipt.sourceStabilityChecked).toBe(true); expect(receipt.sourceChanged).toBe(false);
  expect(h.order.slice(0, 5).every(entry => entry.startsWith("hash:"))).toBe(true);
  expect(h.order.indexOf("inventory")).toBeLessThan(h.order.indexOf("execute:nvidia-smi"));
  for (const attempt of receipt.results) {
    expect(attempt.argv).toEqual([p.artifacts.find(binding => /\/gpu-/.test(binding.executable))!.executable, attempt.id,
      "--exact", "--ignored", "--test-threads=1", "--nocapture", "--color=never"]);
    expect(h.order.indexOf(`event:attempt-start:${attempt.id}`)).toBeLessThan(h.order.indexOf(`mkdir:${attempt.captureDirectory}`));
    expect(attempt.streams).toHaveLength(2);
  }
  expect(h.events.map(event => event.kind)).toEqual(["guard-start", "sample", "attempt-start", "attempt-finish", "attempt-start", "attempt-finish", "done"]);
  expect(h.events.map(event => event.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(h.events[1]).toMatchObject({ uuid: p.selectedUuid, freeBytes: 3221225472, totalBytes: 8589934592, queryStartedMs: 0 });
  expect(receipt.telemetry.queries[0]!.streams![0]!.sha256).toBe(digest(Buffer.from(csv())));
  expect(receipt.trainingReady || receipt.fullAssuranceQualified || receipt.operationalTelemetryQualified || receipt.canonicalBothQualified || receipt.integratedR4Qualified || receipt.trainingExecuted).toBe(false);
  expect(h.maxWrites()).toBe(1); expect(h.clock.count()).toBe(0);
});

test("explicit child environment preserves only inherited LD_LIBRARY_PATH", () => {
  const env = feasibilityEnvironment(p, "/container/driver/lib");
  expect(env).toEqual({ HOME: "/scratch/home", TMPDIR: "/scratch/tmp", CUDA_CACHE_PATH: "/scratch/cuda-cache", XDG_CACHE_HOME: "/scratch/cache",
    XDG_DATA_HOME: "/opt/tracel-data", CUDA_PATH: "/usr/local/cuda", CUDA_VISIBLE_DEVICES: "0", NVIDIA_VISIBLE_DEVICES: p.selectedUuid,
    RAYON_NUM_THREADS: "2", RUST_TEST_THREADS: "1", PATH: "/usr/local/nvidia/bin:/usr/local/bin:/usr/bin:/bin", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC", LD_LIBRARY_PATH: "/container/driver/lib" });
  expect(feasibilityEnvironment(p)).not.toHaveProperty("LD_LIBRARY_PATH");
});

test("receipt keeps bounded summaries and hashes full raw native captures", async () => {
  const h = harness(), stdout = "native diagnostic\n".repeat(8192) + summary;
  h.hooks.test = async () => ({ stdout });
  const receipt = await executeFeasibility(p, h.io);
  expect(receipt.status).toBe("PASS_GPU_FEASIBILITY_TESTS_ONLY");
  expect(JSON.stringify(receipt).length).toBeLessThan(50000);
  expect(receipt.results[0]!.streams![0]).toMatchObject({ bytes: Buffer.byteLength(stdout), sha256: digest(Buffer.from(stdout)) });
  expect(receipt.qualificationResults[0]!.stdoutSummaries).toEqual([summary.trim()]);
});

test("requires one passing test summary rather than empty, filtered or duplicate success", async () => {
  for (const stdout of ["", summary.replace("1 passed", "0 passed"), summary.replace("0 ignored", "1 ignored"), summary + summary]) {
    const h = harness(); h.hooks.test = async () => ({ stdout });
    const receipt = await executeFeasibility(p, h.io);
    expect(receipt.status).toBe("FAIL_GPU_FEASIBILITY_TESTS_ONLY"); expect(receipt.results).toHaveLength(1);
    expect(h.events.some(event => event.kind === "done")).toBe(false);
  }
});

test("artifact or preflight deadline failure invokes no GPU or test operation and leaves source unknown", async () => {
  for (const failure of ["hash", "deadline"]) {
    const h = harness();
    h.hooks.hash = async () => { if (failure === "hash") throw Error("HASH_FAILURE"); h.clock.time = 120000; };
    const receipt = await executeFeasibility(p, h.io);
    expect(receipt.status).toBe("FAIL_GPU_FEASIBILITY_TESTS_ONLY"); expect(h.commands).toHaveLength(0);
    expect(receipt.sourceStabilityChecked).toBe(false); expect(receipt.sourceChanged).toBeNull();
  }
});

test("source inventory and parsed artifact path mismatch cannot start telemetry", async () => {
  const h = harness(); h.hooks.inventory = async () => [];
  expect((await executeFeasibility(p, h.io)).status).toBe("FAIL_GPU_FEASIBILITY_TESTS_ONLY"); expect(h.commands).toHaveLength(0);
  const other = harness(), read = other.io.readFile;
  other.io.readFile = async path => path.endsWith("gpu-learning.stdout")
    ? Buffer.from(Buffer.from(await read(path)).toString().replace("finite_difference-f3db0ac172c2e4d6", "finite_difference-other")) : read(path);
  expect((await executeFeasibility(p, other.io)).failure).toContain("FIVE_PARSED_ARTIFACT_PATHS_REQUIRED"); expect(other.commands).toHaveLength(0);
});

test("low headroom aborts while native test remains pending and blocks the second test", async () => {
  const h = harness(), native = deferred<Reply>();
  h.hooks.test = () => native.promise;
  h.hooks.query = async index => ({ stdout: csv(index === 1 ? 3072 : 2047) });
  let settled = false;
  const execution = executeFeasibility(p, h.io).then(receipt => { settled = true; return receipt; });
  await flush(); expect(h.commands).toHaveLength(2);
  await h.clock.advance(2000);
  expect(h.events.find(event => event.kind === "abort")!.reason).toContain("TELEMETRY_RUNNING_HEADROOM");
  expect(settled).toBe(false); expect(h.commands.filter(command => command.argv[0] !== "nvidia-smi")).toHaveLength(1);
  native.resolve({ stdout: summary });
  const receipt = await execution;
  expect(receipt.status).toBe("FAIL_GPU_FEASIBILITY_TESTS_ONLY"); expect(receipt.results).toHaveLength(1);
  expect(h.events.some(event => event.kind === "done")).toBe(false);
});

test("query deadline latches without pretending to cancel either pending operation", async () => {
  const h = harness(), native = deferred<Reply>(), query = deferred<Reply>();
  h.hooks.test = () => native.promise;
  h.hooks.query = index => index === 1 ? Promise.resolve({ stdout: csv() }) : query.promise;
  let settled = false;
  const execution = executeFeasibility(p, h.io).then(receipt => { settled = true; return receipt; });
  await flush(); await h.clock.advance(3001);
  expect(h.events.find(event => event.kind === "abort")!.reason).toContain("TELEMETRY_QUERY_DEADLINE");
  expect(settled).toBe(false);
  native.resolve({ stdout: summary }); await flush(); expect(settled).toBe(false);
  query.resolve({ stdout: csv() });
  expect((await execution).status).toBe("FAIL_GPU_FEASIBILITY_TESTS_ONLY");
  expect(h.commands.filter(command => command.argv[0] === "nvidia-smi")).toHaveLength(2);
});

test("failed query keeps raw stderr and admits no tests", async () => {
  const h = harness(); h.hooks.query = async () => ({ stdout: "", stderr: "query unavailable", result: { ...pass, status: "FAIL", exitCode: 9, failure: "QUERY_FAILURE" } });
  const receipt = await executeFeasibility(p, h.io);
  expect(receipt.failure).toContain("QUERY_FAILURE"); expect(receipt.results).toHaveLength(0);
  expect(receipt.telemetry.queries[0]!.streams![1]!.sha256).toBe(digest(Buffer.from("query unavailable")));
});

test("serialized journal failure and byte overflow never produce PASS", async () => {
  const h = harness(), gate = deferred<void>();
  h.hooks.append = event => event.kind === "sample" ? gate.promise : Promise.resolve();
  const execution = executeFeasibility(p, h.io);
  await flush(); expect(h.commands).toHaveLength(1); expect(h.maxWrites()).toBe(1);
  gate.reject(Error("JOURNAL_WRITE_FAILURE"));
  const receipt = await execution;
  expect(receipt.status).toBe("FAIL_GPU_FEASIBILITY_TESTS_ONLY"); expect(receipt.results).toHaveLength(0);
  expect(h.events.some(event => event.kind === "done")).toBe(false); expect(h.maxWrites()).toBe(1);
  const small = structuredClone(p); small.limits.journalBytes = 10;
  const overflow = harness(small), failed = await executeFeasibility(small, overflow.io);
  expect(failed.failure).toContain("JOURNAL_BYTE_BOUND"); expect(overflow.commands).toHaveLength(0);
});

test("capture failure retains primary native failure and the available partial stream", async () => {
  const h = harness();
  h.hooks.test = async () => ({ stdout: "partial native output", stderr: "partial error", result: { ...pass, status: "FAIL", exitCode: 6, failure: "PRIMARY_NATIVE_FAILURE" } });
  h.hooks.capture = async path => { if (path.includes("cuda_f64_") && path.endsWith("stderr")) throw Error("CAPTURE_FAILURE"); };
  const receipt = await executeFeasibility(p, h.io);
  expect(receipt.results[0]!.failure).toBe("PRIMARY_NATIVE_FAILURE");
  expect(receipt.results[0]!.exitCode).toBe(6); expect(receipt.results[0]!.streams).toHaveLength(1);
  expect(receipt.results[0]!.captureFailures![0]).toContain("CAPTURE_FAILURE");
  expect(h.events.some(event => event.kind === "done")).toBe(false);
});

test("guard drain failure after two apparent PASS results prevents done", async () => {
  const h = harness(), query = deferred<Reply>(), postcheck = deferred<void>();
  h.hooks.query = index => index === 1 ? Promise.resolve({ stdout: csv() }) : query.promise;
  h.hooks.test = async index => { if (index === 2) await h.clock.advance(2000); return { stdout: summary }; };
  h.hooks.inventory = async index => { if (index === 2) postcheck.resolve(); return structuredClone(manifest); };
  let settled = false;
  const execution = executeFeasibility(p, h.io).then(receipt => { settled = true; return receipt; });
  await postcheck.promise; await flush();
  expect(h.events.filter(event => event.kind === "attempt-finish")).toHaveLength(2);
  expect(settled).toBe(false); expect(h.events.some(event => event.kind === "done")).toBe(false);
  query.resolve({ stdout: "malformed" });
  const receipt = await execution;
  expect(receipt.qualificationResults.every(result => result.accepted)).toBe(true);
  expect(receipt.status).toBe("FAIL_GPU_FEASIBILITY_TESTS_ONLY"); expect(h.clock.count()).toBe(0);
});

test("source postcheck error stays unknown and source mutation blocks done", async () => {
  for (const mode of ["error", "changed"]) {
    const h = harness(); h.hooks.inventory = async index => {
      if (index === 1) return structuredClone(manifest);
      if (mode === "error") throw Error("SOURCE_CHECK_UNAVAILABLE");
      return manifest.slice(1);
    };
    const receipt = await executeFeasibility(p, h.io);
    expect(receipt.status).toBe("FAIL_GPU_FEASIBILITY_TESTS_ONLY"); expect(h.events.some(event => event.kind === "done")).toBe(false);
    expect(receipt.sourceStabilityChecked).toBe(mode === "changed"); expect(receipt.sourceChanged).toBe(mode === "changed" ? true : null);
  }
});

test("finalization deadline aborts a pending source postcheck without inventing cancellation", async () => {
  const h = harness(), postcheck = deferred<typeof manifest>(), entered = deferred<void>();
  h.hooks.inventory = index => { if (index === 1) return Promise.resolve(structuredClone(manifest)); entered.resolve(); return postcheck.promise; };
  let settled = false;
  const execution = executeFeasibility(p, h.io).then(receipt => { settled = true; return receipt; });
  await entered.promise;
  await h.clock.advance(20000);
  expect(h.events.find(event => event.kind === "abort")!.reason).toContain("DRIVER_DEADLINE");
  expect(settled).toBe(false);
  postcheck.resolve(structuredClone(manifest));
  const receipt = await execution;
  expect(receipt.status).toBe("FAIL_GPU_FEASIBILITY_TESTS_ONLY"); expect(receipt.sourceChanged).toBeNull();
  expect(h.events.some(event => event.kind === "done")).toBe(false);
});

test("source-only import leaves container adapter inert and has no project GPU or build operations", async () => {
  const source = await readFile(new URL("./driver.ts", import.meta.url), "utf8");
  expect(source).not.toContain("import.meta.main");
  expect(source).toContain('Bun.version === "1.4.0" && process.cwd() === "/build/native"');
  expect(source).toContain('const originalHelperPath = "/build/native/_work/gpu-owner-recovery/verify.ts"');
  expect(source).toContain('const originalQualificationPath = "/build/native/tooling/runtime/qualification.ts"');
  const h = harness(); await executeFeasibility(p, h.io);
  expect(h.commands.every(command => command.argv[0] === "nvidia-smi" || p.artifacts.some(binding => binding.executable === command.argv[0]))).toBe(true);
  expect(h.commands.every(command => command.directory.startsWith(`/build/native/_work/gpu-owner-recovery/runs/${p.runId}/`))).toBe(true);
});

test("connected pure mock driver journal abort reaches owned HOST stop while a test is pending", async () => {
  const h = harness(), native = deferred<Reply>(), calls: { id: string; argv: string[] }[] = [], owned = "d".repeat(64);
  let saved: string | null = null, inner: Awaited<ReturnType<typeof executeFeasibility>> | null = null, journal = "";
  let abort: (reason: string) => Promise<void> = async () => {};
  const monitor = progressWatchdog(p, h.clock.now), append = h.io.appendJournal;
  h.io.appendJournal = async line => {
    await append(line); journal += line;
    try { monitor.read(journal); } catch (error) { await abort(String(error)); }
  };
  h.hooks.test = () => native.promise;
  h.hooks.query = async index => ({ stdout: csv(index === 1 ? 3072 : 2047) });
  const outer = await executeFeasibilityHost(p, feasibilityPaths("/source-only-mock", p), 1000, 1000, {
    now: h.clock.now, recover: async () => saved, innerReceipt: async () => inner,
    watch: request => { abort = request; return { close: async () => ({ guardComplete: false }) }; },
    run: async (id, argv) => {
      calls.push({ id, argv });
      if (id === "worker-create") saved = owned;
      if (id === "worker-stop") native.resolve({ stdout: "MOCK_OWNED_CONTAINER_TERMINATED", result: { ...pass, status: "FAIL", exitCode: 137, failure: "MOCK_OWNED_STOP" } });
      if (id === "worker-logs") {
        const executing = executeFeasibility(p, h.io); await flush(); await h.clock.advance(2000); inner = await executing;
      }
      return { status: "PASS", exitCode: 0, failure: null, stdout: id === "worker-state" ? JSON.stringify({ Running: false, ExitCode: 137, OOMKilled: false }) : "" };
    },
  });
  expect(outer.status).toBe("FAIL_HOST_GPU_FEASIBILITY_ONLY"); expect(outer.failure).toContain("TELEMETRY_RUNNING_HEADROOM");
  expect(calls.map(row => row.id)).toEqual(["worker-create", "worker-start", "worker-logs", "worker-stop", "worker-state", "worker-remove"]);
  expect(h.commands.filter(row => row.argv[0] !== "nvidia-smi")).toHaveLength(1); expect(outer.innerReceipt.status).toBe("FAIL_GPU_FEASIBILITY_TESTS_ONLY");
  for (const row of calls.filter(row => row.id !== "worker-create")) expect(row.argv.at(-1)).toBe(owned);
  const base = process.env.HOST_FEASIBILITY_TEST_EVIDENCE;
  if (base) {
    const directory = resolve(base, "connected-driver-watchdog"), scope = "SOURCE_ONLY_PURE_MOCK_E2E_NOT_HOST_GPU_EVIDENCE", name = relative(resolve("_work/gpu-owner-recovery/runs"), directory);
    if (isAbsolute(name) || name.startsWith("..") || !name.includes("source-")) throw Error("REPOSITORY_SOURCE_FIXTURE_REQUIRED");
    await mkdir(directory);
    await writeFile(directory + "/receipt.json", JSON.stringify({ scope, actualDockerProcesses: 0, actualNativeProcesses: 0, gpuExecuted: false, result: outer }, null, 2) + "\n", { flag: "wx" });
    await writeFile(directory + "/events.ndjson", journal, { flag: "wx" });
    await writeFile(directory + "/argv.json", JSON.stringify({ scope, actualDockerProcesses: 0, actualNativeProcesses: 0, gpuExecuted: false, calls }, null, 2) + "\n", { flag: "wx" });
  }
});
