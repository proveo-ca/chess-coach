// SPEC: _spec/gpu-qualification.puml
import { expect, test } from "bun:test";
import { constants } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as qualification from "../../../tooling/runtime/qualification";
import { acceptCpuWorker, assertCpuArgv, buildCpuPrograms, cpuApprovalRequest, cpuBuildCommands, cpuHostScripts, cpuManifest, cpuPaths, cpuPlan, cpuSourceDirectory,
  cpuStdoutSummary, cpuWorkerCreate, digest, executeCpuHost, executeCpuWorker, initializeCpuWorker, renderCpuHostCommand, stageCpuSources, validateCpuSourcePacket, validatePlan } from "./cpu-host";
import type { HostIO, StageIO, WorkerIO, WorkerReceipt, WorkerStartupIO } from "./cpu-host";

const manifestBytes = await readFile(cpuPlan.nativeManifestMetadata), inventory = cpuManifest(manifestBytes);
const summary = (count: number, ignored = 0) => `test result: ok. ${count} passed; 0 failed; ${ignored} ignored; 0 measured; 0 filtered out; finished in 0.01s\n`;
const passed = { status: "PASS", exitCode: 0, failure: null };
const cid = "a".repeat(64), otherCid = "b".repeat(64);
function cargoFixture() {
  const rows: Record<string, any[]> = { learning: [], "policy-io": [] };
  const prefix = "/build/native/target-cpu/x86_64-unknown-linux-gnu/release/";
  const add = (owner: string, kind: string, name: string, isTest: boolean) => rows[owner]!.push({ reason: "compiler-artifact",
    package_id: `path+file:///build/native/crates/${owner}#chess-coach-${owner}@0.1.0`, target: { name, kind: [kind] }, profile: { test: isTest }, features: ["default"],
    executable: prefix + (isTest ? `deps/${name}-mock` : name) });
  for (const id of Object.keys(qualification.cpuCoverage)) { const [owner, kind, name] = id.split(":"); add(owner!, kind!, name!, true); }
  for (const name of ["policy-score", "policy-channel", "policy-initialize"]) add("policy-io", "bin", name, false);
  return { rows, logs: () => Object.fromEntries(Object.entries(rows).map(([owner, messages]) => [owner, [...messages, { reason: "build-finished", success: true }].map(row => JSON.stringify(row)).join("\n") + "\n"])) as { learning: string; "policy-io": string } };
}
function workerFixture(options: { buildFail?: boolean; missing?: boolean; duplicate?: boolean; ignored?: boolean; nonzero?: boolean; captureFail?: boolean; sourceChanged?: boolean;
  bootstrapMs?: number; compileMs?: number; lateArtifact?: boolean; lastHarnessLate?: boolean; badVersion?: boolean; missingArtifact?: boolean; lateExecute?: string; largeOutput?: boolean; postcheckFail?: boolean } = {}) {
  let clock = 100, inventoryReads = 0;
  const cargo = cargoFixture(), calls: { id: string; argv: string[]; timeoutMs: number }[] = [], captures = new Map<string, { stdout: string; stderr: string }>();
  if (options.missing) cargo.rows.learning!.pop();
  if (options.duplicate) cargo.rows.learning!.push(cargo.rows.learning![0]);
  const io: WorkerIO = { now: () => clock, startedAt: clock, deadline: clock + cpuPlan.limits.workerMs,
    bootstrap: async check => { clock += options.bootstrapMs ?? 0; check(); return { qualification, staging: { inventory, copiedBytes: manifestBytes.length + 65, copiedFiles: 66, sourceManifestSha256: cpuPlan.sourceManifestSha256 } }; },
    inventory: async () => { inventoryReads++; if (options.postcheckFail && inventoryReads > 1) throw Error("MOCK_SOURCE_CHECK_FAILURE"); return options.sourceChanged && inventoryReads > 1 ? inventory.map((row, i) => i === 0 ? { ...row, sha256: "0".repeat(64) } : row) : inventory; },
    execute: async (id, argv, timeoutMs) => {
      calls.push({ id, argv, timeoutMs }); clock += id.startsWith("cpu-") ? options.compileMs ?? 1 : 1;
      let stdout = "";
      if (id.endsWith("-version")) stdout = id.split("-")[0] + (options.badVersion ? " 1.94.0 (mock)\n" : " 1.95.0 (mock)\n");
      else if (id === "cpu-learning") stdout = cargo.logs().learning;
      else if (id === "cpu-policy") stdout = cargo.logs()["policy-io"];
      else stdout = summary(qualification.cpuCoverage[id]!, options.ignored ? 1 : 0);
      if (options.largeOutput && id === Object.keys(qualification.cpuCoverage)[0]) stdout = "x".repeat(cpuPlan.limits.supervisedStreamBytes - Buffer.byteLength(stdout) - 1) + "\n" + stdout;
      captures.set(id, { stdout, stderr: "" });
      if (options.lastHarnessLate && id === Object.keys(qualification.cpuCoverage).at(-1)) clock += cpuPlan.testLoop.totalMs;
      if (options.lateExecute === id) clock += cpuPlan.limits.workerMs;
      return options.buildFail && id === "cpu-learning" || options.nonzero && id.includes(":") ? { status: "FAIL", exitCode: 7, failure: null } : passed;
    },
    capture: async id => {
      if (options.captureFail && id.includes(":")) throw Error("MOCK_CAPTURE_FAILURE");
      const values = captures.get(id)!;
      return { stdout: values.stdout, streams: Object.entries(values).map(([name, text]) => ({ path: id + "/command." + name, bytes: Buffer.byteLength(text), sha256: digest(Buffer.from(text)) })) };
    },
    artifact: async (executable, check) => {
      if (options.lateArtifact) clock += cpuPlan.limits.workerMs; check();
      return { executable, bytes: options.missingArtifact ? 0 : 64, sha256: digest(Buffer.from("MOCK_EXECUTABLE:" + executable)) };
    },
  };
  return { io, calls, captures, advance: (ms: number) => { clock += ms; } };
}
function hostFixture(inner: WorkerReceipt, options: { createFail?: boolean; invalidCid?: boolean; changedCid?: boolean; stateRunning?: boolean; oom?: boolean; nonzeroState?: boolean;
  stopFail?: boolean; removeFail?: boolean; lateRun?: string; lateReceipt?: boolean; lateClose?: boolean; receiptFail?: boolean; watchReason?: string; heldCleanup?: boolean } = {}) {
  let clock = 100, created = false, recoveries = 0, watcher: ((reason: string) => Promise<void>) | null = null;
  const calls: { id: string; argv: string[]; timeoutMs: number }[] = [];
  let release!: () => void, cleanupReleased = !options.heldCleanup;
  const held = new Promise<void>(resolve => { release = () => { cleanupReleased = true; resolve(); }; });
  const io: HostIO = { now: () => clock, startedAt: clock,
    run: async (id, argv, timeoutMs) => {
      calls.push({ id, argv, timeoutMs }); clock++;
      if (id === "worker-create") created = true;
      if (options.lateRun === id) clock += cpuPlan.limits.normalOperationsMs;
      if (id === "worker-stop" && options.heldCleanup) await held;
      if (id === "worker-start" && options.watchReason) await watcher!(options.watchReason);
      if (id === "worker-create" && options.createFail || id === "worker-stop" && options.stopFail || id === "worker-remove" && options.removeFail) return { status: "FAIL", exitCode: 1, failure: "MOCK_CAPTURE_FAILURE", stdout: "" };
      return { ...passed, stdout: id === "worker-state" ? JSON.stringify({ Running: options.stateRunning ?? false, ExitCode: options.nonzeroState ? 7 : 0, OOMKilled: options.oom ?? false }) : id === "worker-create" ? cid : "" };
    }, recover: async () => { recoveries++; return !created ? null : options.invalidCid ? "not-owned" : options.changedCid && recoveries > 1 ? otherCid : cid; },
    workerReceipt: async () => { if (options.lateReceipt) clock += cpuPlan.limits.normalOperationsMs; if (options.receiptFail) throw Error("MISSING_WORKER_RECEIPT"); return inner; },
    watch: stop => { watcher = stop; return async () => { if (options.lateClose) await stop("MOCK_LATE_RESOURCE_FAILURE"); }; },
  };
  return { io, calls, release, cleanupReleased: () => cleanupReleased, stop: async (reason: string) => { await watcher!(reason); } };
}

test("closed immutable plan grants no HOST, unpack, CPU, GPU, training or publication operations", () => {
  expect(validatePlan()).toBe(cpuPlan); expect(Object.isFrozen(cpuPlan)).toBe(true); expect(Object.isFrozen(cpuPlan.limits)).toBe(true);
  for (const [key, value] of Object.entries(cpuPlan)) if (key.endsWith("Approved") || key.endsWith("Authorized") || key === "trainingReady") expect(value).toBe(false);
  expect(cpuPlan.limits.overallMs).toBe(4020000 + 120000 + 60000);
  expect(cpuPlan.limits.workerMs).toBe(1500000 + 1950000 + 150000);
  expect(Object.entries(cpuPlan.cpuCoverage)).toEqual(Object.entries(qualification.cpuCoverage));
  expect(() => validatePlan({ ...cpuPlan, runId: "replacement" })).toThrow("CLOSED_CPU39_PLAN_REQUIRED");
  expect(() => cpuPaths("/other")).toThrow("FIXED_HOST_ROOT_REQUIRED");
  const request = cpuApprovalRequest({ mock: true });
  expect(request.grantIsIdentityNotAuthority).toBe(true); expect(request.hostExecutionApproved).toBe(false); expect(request.oldGrantsReusable).toBe(false);
  expect(request.requestedOperations).toMatchObject({ nativeSourceCopies: 66, nativeSourceCopyMaximumBytes: 2097152, cargoArchiveUnpackOnlyIntoFreshWritableCargoHome: true });
});

test("two CPU commands exactly match the existing recipe without GPU features, ignored tests or selectors", async () => {
  const recipe = await readFile("tooling/runtime/Dockerfile.gpu-qualification", "utf8");
  const commands = cpuBuildCommands(); expect(commands).toHaveLength(2);
  for (const command of commands) {
    expect(recipe).toContain(command.argv.join(" ") + " > qualification/" + command.id + ".stdout");
    for (const forbidden of ["--features", "--ignored", "--test"]) expect(command.argv).not.toContain(forbidden);
    expect(command.argv).toContain("--tests");
  }
});

test("CPU container has only RO donor source/Bun/index/archive mounts and fresh writable build/home/scratch", () => {
  const command = cpuWorkerCreate(cpuPaths(), 1000, 1001), text = command.join(" ");
  for (const flag of ["--pull=never", "--network=none", "--cpus=2", "--memory=8g", "--memory-swap=8g", "--user=1000:1001"]) expect(command).toContain(flag);
  const mounts = command.filter(arg => arg.startsWith("type=bind,")); expect(mounts).toHaveLength(9);
  for (const target of ["/retained/native", "/usr/local/bin/bun", "/capture/cargo-home/registry/index", "/capture/cargo-home/registry/cache"]) expect(mounts.find(row => row.includes("target=" + target + ","))).toEndWith(",readonly");
  expect(mounts.find(row => row.endsWith("target=/capture/cargo-home"))).toBeDefined();
  for (const forbidden of ["--gpus", "--runtime=nvidia", "target-gpu", "/opt/tracel", "/usr/local/cuda", "registry/src,readonly", "--privileged", "--volume"]) expect(text).not.toContain(forbidden);
  expect(text).toContain("CARGO_TARGET_DIR=/build/native/target-cpu"); expect(text).toContain("RAYON_NUM_THREADS=2"); expect(text).toContain("CARGO_BUILD_JOBS=2");
  expect(() => cpuWorkerCreate(cpuPaths(), -1, 0)).toThrow("NUMERIC_OPERATOR_UID_GID_REQUIRED");
});

function stageFixture(options: { symlink?: boolean; large?: boolean; hashFail?: boolean; late?: boolean } = {}) {
  const copied: { from: string; to: string; flags: number }[] = []; let expired = false;
  const io: StageIO = { check: () => { if (expired) throw Error("MOCK_STAGE_DEADLINE"); },
    stat: async path => ({ isFile: () => !(options.symlink && path.endsWith("Cargo.lock")), size: path.endsWith("source-manifest.json") ? manifestBytes.length : options.large ? 2097152 : 1 }),
    read: async () => manifestBytes, mkdir: async () => {}, copy: async (from, to, flags) => { copied.push({ from, to, flags }); if (options.late) expired = true; },
    hash: async path => options.hashFail ? "0".repeat(64) : path.endsWith("source-manifest.json") ? cpuPlan.sourceManifestSha256 : inventory.find(row => path === "/build/native/" + row.path)!.sha256,
  };
  return { io, copied };
}
test("manifest staging copies exactly native65 plus its manifest with EXCL, without recursive donor discovery", async () => {
  const fixture = stageFixture(), result = await stageCpuSources(fixture.io);
  expect(result.copiedFiles).toBe(66); expect(result.copiedBytes).toBe(manifestBytes.length + 65); expect(result.inventory).toEqual(inventory);
  expect(fixture.copied.map(row => row.from)).toEqual([...inventory.map(row => "/retained/native/" + row.path), "/retained/native/qualification/source-manifest.json"]);
  expect(fixture.copied.every(row => row.flags === constants.COPYFILE_EXCL && !row.from.includes("target-gpu"))).toBe(true);
  expect(() => cpuManifest(Buffer.from("[]"))).toThrow("CPU_NATIVE65_MANIFEST_HASH_REQUIRED");
});
test("staging rejects nonregular files, oversize copies, changed content and late I/O without repair", async () => {
  for (const [options, expected] of [[{ symlink: true }, "STAGING_REGULAR_FILE_REQUIRED"], [{ large: true }, "CPU_SOURCE_COPY_BOUND"], [{ hashFail: true }, "STAGED_SOURCE_HASH_REQUIRED"], [{ late: true }, "MOCK_STAGE_DEADLINE"]] as const) {
    const fixture = stageFixture(options); await expect(stageCpuSources(fixture.io)).rejects.toThrow(expected); expect(fixture.copied.length).toBeLessThan(66);
  }
});

test("MOCK e2e compiles twice, executes all sixteen harnesses/39 tests, records 19 CPU artifacts and removes its owned container", async () => {
  const worker = workerFixture(), inner = await executeCpuWorker(worker.io); expect(inner.status).toBe("PASS_CPU39_TESTS_ONLY"); acceptCpuWorker(inner);
  expect(inner.artifacts).toHaveLength(19); expect(inner.results).toHaveLength(20); expect(inner.results.every(row => row.commandInvoked)).toBe(true);
  const tests = inner.outcome!.results; expect(tests).toHaveLength(16); expect(tests.filter(row => qualification.cpuCoverage[row.id] === 0)).toHaveLength(5);
  expect(tests.reduce((n, row) => n + qualification.cpuCoverage[row.id]!, 0)).toBe(39);
  expect(worker.calls.filter(call => call.id.startsWith("cpu-")).map(call => call.timeoutMs)).toEqual([1500000, 1499999]);
  expect(worker.calls.filter(call => call.id.includes(":")).every(call => call.timeoutMs === 120000 && call.argv.length === 4 && !call.argv.includes("--ignored"))).toBe(true);
  const host = hostFixture(inner), receipt = await executeCpuHost(cpuPaths(), 1000, 1000, host.io);
  expect(receipt.status).toBe("PASS_HOST_CPU39_ONLY"); expect(receipt.hostInvocationsConsumed).toBe(1); expect(receipt.remainingHostInvocations).toBe(0);
  expect(host.calls.map(call => call.id)).toEqual(["worker-create", "worker-start", "worker-logs", "worker-state", "worker-remove"]);
  expect(host.calls.slice(1).every(call => call.argv.at(-1) === cid)).toBe(true); expect(receipt.trainingReady).toBe(false);
  const packet = process.env.CPU_SOURCE_PACKET;
  if (packet) {
    expect(validateCpuSourcePacket(packet)).toBe(packet);
    const captures = [];
    for (const [id, streams] of worker.captures) {
      const directory = packet + "/mock/" + id; await mkdir(directory, { recursive: true });
      for (const [name, text] of Object.entries(streams)) {
        expect(Buffer.byteLength(text)).toBeLessThanOrEqual(4194304); const path = directory + "/command." + name; await writeFile(path, text, { flag: "wx" }); captures.push({ path, bytes: Buffer.byteLength(text), sha256: digest(Buffer.from(text)) });
      }
    }
    await writeFile(packet + "/mock-e2e.json", JSON.stringify({ status: "PASS_MOCK_CPU39_ONLY", actualHostExecuted: false, execution: "ALL_EXEC_INJECTED_MOCKS", tests: 39, harnesses: 16, executables: 19,
      worker: inner, host: receipt, calls: worker.calls, dockerCalls: host.calls, captures, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
  }
});

test("failed compilation stops before the second build or CPU harness and retains its actual failed attempt", async () => {
  const fixture = workerFixture({ buildFail: true }), receipt = await executeCpuWorker(fixture.io);
  expect(receipt.status).toBe("FAIL_CPU39_TESTS_ONLY"); expect(receipt.compilationAttempts).toBe(1); expect(receipt.results.at(-1)).toMatchObject({ id: "cpu-learning", commandInvoked: true, status: "FAIL", exitCode: 7 });
  expect(receipt.phase).toBe("compilation"); expect(receipt.failurePhase).toBe("compilation");
  expect(fixture.calls.some(row => row.id === "cpu-policy" || row.id.includes(":"))).toBe(false); expect(receipt.sourceStabilityChecked).toBe(true);
});
for (const options of [{ missing: true }, { duplicate: true }, { ignored: true }, { nonzero: true }, { captureFail: true }, { sourceChanged: true }, { badVersion: true }, { missingArtifact: true }]) {
  test("CPU mock fails closed and retains partial attempts: " + JSON.stringify(options), async () => {
    const fixture = workerFixture(options), receipt = await executeCpuWorker(fixture.io); expect(receipt.status).toBe("FAIL_CPU39_TESTS_ONLY"); expect(receipt.failure).not.toBeNull();
    expect(() => acceptCpuWorker(receipt)).toThrow("COMPLETE_SUCCESSFUL_CPU39_WORKER_RECEIPT_REQUIRED");
    expect(receipt.results.filter(row => row.id.includes(":"))).toHaveLength(options.sourceChanged ? 16 : options.ignored || options.nonzero || options.captureFail ? 1 : 0);
    if (options.captureFail) expect(receipt.results.at(-1)).toMatchObject({ status: "FAIL", commandInvoked: true, exitCode: 0, failure: "Error: MOCK_CAPTURE_FAILURE" });
    if (options.sourceChanged) expect(receipt.sourceChanged).toBe(true);
  });
}
test("complete CPU budgets cannot omit empty harnesses or borrow cleanup reserve", () => {
  expect(() => qualification.validateLimits(cpuPlan.testLoop, 16)).not.toThrow();
  expect(() => qualification.validateLimits({ ...cpuPlan.testLoop, totalMs: 1949999 }, 16)).toThrow("EXPLICIT_COMPLETE_CAMPAIGN_BUDGET_REQUIRED");
  expect(Object.values(qualification.cpuCoverage).filter(count => count === 0)).toHaveLength(5);
});
test("worker includes startup, enforces aggregate compilation, checks artifact I/O and rejects late successful final harness", async () => {
  for (const options of [{ bootstrapMs: 120001 }, { compileMs: 750000 }, { lateArtifact: true }, { lastHarnessLate: true }]) {
    const fixture = workerFixture(options), receipt = await executeCpuWorker(fixture.io); expect(receipt.status).toBe("FAIL_CPU39_TESTS_ONLY"); expect(receipt.failure).not.toBeNull();
    if (options.bootstrapMs) expect(fixture.calls.filter(row => row.id.startsWith("cpu-"))).toHaveLength(0);
    if (options.compileMs) expect(receipt.failure).toBe("AGGREGATE_CPU_COMPILATION_DEADLINE");
  }
});

test("HOST rejects claimed registration without explicit command invocation and rejects failed terminal state", async () => {
  const inner = await executeCpuWorker(workerFixture().io), forged = structuredClone(inner); forged.results.find(row => row.id.includes(":"))!.commandInvoked = false;
  expect(() => acceptCpuWorker(forged)).toThrow("COMPLETE_SUCCESSFUL_CPU39_WORKER_RECEIPT_REQUIRED");
  for (const options of [{ stateRunning: true }, { oom: true }, { nonzeroState: true }, { receiptFail: true }, { lateReceipt: true }, { lateClose: true }, { removeFail: true }]) {
    const fixture = hostFixture(inner, options), receipt = await executeCpuHost(cpuPaths(), 1000, 1000, fixture.io);
    expect(receipt.status).toBe("FAIL_HOST_CPU39_ONLY"); expect(fixture.calls.length).toBeLessThanOrEqual(7); expect(receipt.hostInvocationsConsumed).toBe(1);
  }
});
test("HOST capture failure recovers its CID file and cleans only that owned container without create retry", async () => {
  const inner = await executeCpuWorker(workerFixture().io), fixture = hostFixture(inner, { createFail: true, stopFail: true });
  const receipt = await executeCpuHost(cpuPaths(), 1000, 1000, fixture.io);
  expect(receipt.status).toBe("FAIL_HOST_CPU39_ONLY"); expect(receipt.cid).toBe(cid); expect(fixture.calls.filter(row => row.id === "worker-create")).toHaveLength(1);
  expect(fixture.calls.map(row => row.id)).toEqual(["worker-create", "worker-stop", "worker-kill", "worker-state", "worker-remove"]);
  expect(fixture.calls.slice(1).every(row => row.argv.at(-1) === cid)).toBe(true);
});
test("HOST invalid or changed CID never becomes an unowned cleanup target", async () => {
  const inner = await executeCpuWorker(workerFixture().io);
  for (const options of [{ invalidCid: true }, { changedCid: true }]) {
    const fixture = hostFixture(inner, options), receipt = await executeCpuHost(cpuPaths(), 1000, 1000, fixture.io); expect(receipt.status).toBe("FAIL_HOST_CPU39_ONLY");
    expect(fixture.calls.some(row => row.argv.includes("not-owned") || row.argv.includes(otherCid))).toBe(false);
    if (options.invalidCid) expect(fixture.calls).toHaveLength(1);
  }
});
test("HOST watch failures consume the attempt and await held owned cleanup before return", async () => {
  const inner = await executeCpuWorker(workerFixture().io), fixture = hostFixture(inner, { watchReason: "MOCK_RESOURCE_FAILURE", heldCleanup: true });
  let returned = false;
  const pending = executeCpuHost(cpuPaths(), 1000, 1000, fixture.io).then(receipt => { returned = true; return receipt; });
  for (let i = 0; i < 30; i++) await Promise.resolve();
  expect(returned).toBe(false); expect(fixture.cleanupReleased()).toBe(false); expect(fixture.calls.some(row => row.id === "worker-stop")).toBe(true);
  fixture.release(); const receipt = await pending; expect(receipt.status).toBe("FAIL_HOST_CPU39_ONLY"); expect(receipt.failure).toBe("MOCK_RESOURCE_FAILURE");
  expect(fixture.calls.filter(row => row.id === "worker-stop")).toHaveLength(1);
});
test("HOST rejects late Docker success rather than extending its whole normal-operation clock", async () => {
  const inner = await executeCpuWorker(workerFixture().io), fixture = hostFixture(inner, { lateRun: "worker-create" });
  const receipt = await executeCpuHost(cpuPaths(), 1000, 1000, fixture.io); expect(receipt.status).toBe("FAIL_HOST_CPU39_ONLY"); expect(receipt.failure).toBe("CPU_HOST_NORMAL_DEADLINE");
  expect(fixture.calls.some(row => row.id === "worker-start")).toBe(false); expect(fixture.calls.filter(row => row.id === "worker-create")).toHaveLength(1);
});
test("rendering builds JS only in memory and keeps bundle evaluation inert until an explicit appended function", async () => {
  const programs = await buildCpuPrograms(), command = renderCpuHostCommand(programs.host);
  expect(programs.bundle).toMatch(/Bun\.argv\[2\]\s*===\s*"--verify-source"/);
  expect(programs.bundle).not.toContain('if (import.meta.main)');
  expect(programs.bundle).not.toContain("await main()");
  expect(programs.driver).toEndWith("await runCpuWorker();\n"); expect(programs.host).toEndWith(");\n");
  expect(command).toContain("HOST_CPU39_STARTED_MS"); expect(command).toContain("4080s"); expect(command).toContain("--kill-after=60s"); expect(command).toContain("HOST_CPU39_EXIT=%s");
  expect(command).toContain("MISE_AUTO_INSTALL false"); expect(command).toContain("core:bun@1.4.0"); expect(command).toContain("core:rust@1.95.0"); expect(command).toContain(cpuPlan.grant);
  expect(command).not.toContain("git checkout"); expect(command).not.toContain("mise install");
});

test("whole Fish bound encloses setup, inner timeout, cleanup and every parent-tail operation", () => {
  const scripts = cpuHostScripts("MOCK_HOST_PROGRAM");
  expect(scripts.outerArgv.slice(0, 7)).toEqual(["timeout", "--signal=KILL", "4200s", "fish", "--no-config", "-c", scripts.parent]);
  expect(scripts.innerArgv.slice(0, 7)).toEqual(["timeout", "--signal=TERM", "--kill-after=60s", "4080s", "fish", "--no-config", "-c"]);
  expect(scripts.innerArgv[7]).toBe(scripts.worker);
  expect(scripts.worker.indexOf("HOST_CPU39_STARTED_MS")).toBeLessThan(scripts.worker.indexOf("command mkdir"));
  expect(scripts.worker.indexOf("command mkdir")).toBeLessThan(scripts.worker.indexOf("MISE_AUTO_INSTALL"));
  expect(scripts.worker).not.toContain("HOST_CPU39_EXIT");
  expect(scripts.parent.match(/HOST_CPU39_EXIT=/g)).toHaveLength(1);
  for (const tail of ["wc -c", "command.exit", "command cat", "receipt.json", "HOST_CPU39_EXIT", "exit $code"]) expect(scripts.parent).toContain(tail);
  expect(scripts.parent).toContain("set -l inner_code $status"); expect(scripts.parent).toContain('$inner_code > "$evidence/command.exit"');
  expect(scripts.worker).toContain('command mkdir -- "$evidence"; or exit 73');
  expect(scripts.parent.indexOf("if test $inner_code -eq 73; exit $inner_code; end")).toBeLessThan(scripts.parent.indexOf("command.exit"));
  expect(scripts.innerTermMs + scripts.innerKillMs).toBe(cpuPlan.limits.normalOperationsMs + cpuPlan.limits.cleanupMs);
  expect(scripts.innerTermMs + scripts.innerKillMs + scripts.receiptReserveMs).toBe(cpuPlan.limits.overallMs);
  expect(scripts.receiptReserveMs).toBe(60000);
});
test("actual argument limits include UTF-8, NUL and nested Fish quote growth", () => {
  expect(assertCpuArgv(["x".repeat(131071)])).toEqual([131072]);
  expect(() => assertCpuArgv(["x".repeat(131072)])).toThrow("CPU_LINUX_ARGUMENT_BYTE_LIMIT");
  expect(() => assertCpuArgv(["é".repeat(65536)])).toThrow("CPU_LINUX_ARGUMENT_BYTE_LIMIT");
  expect(() => assertCpuArgv(["bad\0argument"])).toThrow("CPU_LINUX_ARGUMENT_BYTE_LIMIT");
  const quoteHeavy = "'\\".repeat(15000); expect(assertCpuArgv([quoteHeavy])[0]).toBeLessThan(131072);
  expect(() => cpuHostScripts(quoteHeavy)).toThrow("CPU_LINUX_ARGUMENT_BYTE_LIMIT");
});
test("bounded successor labels and mock packet paths reject aliases, traversal and other roots before writing", () => {
  for (const suffix of ["1", "2", "9", "10", "99"]) {
    const path = cpuSourceDirectory("host-cpu-regression-source-" + suffix); expect(validateCpuSourcePacket(path)).toBe(path);
  }
  for (const suffix of ["0", "01", "100", "-1", "2/../3", "2\n"]) expect(() => cpuSourceDirectory("host-cpu-regression-source-" + suffix)).toThrow("BOUNDED_CPU_SOURCE_LABEL_REQUIRED");
  for (const path of ["/other/host-cpu-regression-source-2", cpuPlan.root + "/_work/gpu-owner-recovery/runs/../runs/host-cpu-regression-source-2", "host-cpu-regression-source-2"])
    expect(() => validateCpuSourcePacket(path)).toThrow("FIXED_CPU_SOURCE_PACKET_ROOT_REQUIRED");
});

function startupFixture(options: { cwd?: string; bun?: string; deadline?: string; readFail?: boolean; initFail?: boolean; readMs?: number } = {}) {
  const fixture = workerFixture(), persisted: WorkerReceipt[] = [];
  let reads = 0, initialized = 0;
  const io: WorkerStartupIO = { now: fixture.io.now, epochNow: () => 1000000, cwd: () => options.cwd ?? "/build/native", bunVersion: () => options.bun ?? "1.4.0",
    readDeadline: async () => { reads++; fixture.advance(options.readMs ?? 0); if (options.readFail) throw Error("MOCK_DEADLINE_READ_FAILED"); return options.deadline ?? JSON.stringify({ normalDeadlineEpoch: 1000000 + cpuPlan.limits.normalOperationsMs }); },
    initialize: async () => { initialized++; if (options.initFail) throw Error("MOCK_INITIALIZATION_FAILED"); const { bootstrap, inventory, execute, capture, artifact } = fixture.io; return { bootstrap, inventory, execute, capture, artifact }; },
    persist: async receipt => { persisted.push(structuredClone(receipt)); },
  };
  return { io, persisted, calls: fixture.calls, reads: () => reads, initialized: () => initialized };
}
test("startup captures context, deadline read/parse/admission and initialization failures as structured receipts", async () => {
  for (const [options, phase] of [[{ cwd: "/wrong" }, "context"], [{ bun: "1.3.0" }, "context"], [{ readFail: true }, "deadline"], [{ deadline: "{" }, "deadline"],
    [{ deadline: "{}" }, "deadline"], [{ deadline: '{"normalDeadlineEpoch":999999}' }, "deadline"], [{ readMs: cpuPlan.limits.workerMs }, "deadline"], [{ initFail: true }, "initialization"]] as const) {
    const fixture = startupFixture(options), receipt = await initializeCpuWorker(fixture.io);
    expect(receipt).toMatchObject({ status: "FAIL_CPU39_TESTS_ONLY", phase, failurePhase: phase, sourceChanged: null, sourceStabilityChecked: false, compilationAttempts: 0 });
    expect(fixture.persisted).toHaveLength(1); expect(fixture.calls).toHaveLength(0); expect(Buffer.byteLength(JSON.stringify(receipt))).toBeLessThan(cpuPlan.limits.hostReceiptBytes);
    if (phase === "context") expect(fixture.reads()).toBe(0);
    if (phase !== "initialization") expect(fixture.initialized()).toBe(0);
  }
  const fixture = startupFixture(), receipt = await initializeCpuWorker(fixture.io); acceptCpuWorker(receipt); expect(fixture.persisted).toHaveLength(1);
});
test("late command success retains its actual zero exit and invocation before the clock failure", async () => {
  const fixture = workerFixture({ lateExecute: "cpu-learning" }), receipt = await executeCpuWorker(fixture.io);
  expect(receipt.status).toBe("FAIL_CPU39_TESTS_ONLY"); expect(receipt.phase).toBe("compilation"); expect(receipt.failure).toContain("CPU_WORKER_PHASE_DEADLINE:compilation");
  expect(receipt.results.at(-1)).toMatchObject({ id: "cpu-learning", commandInvoked: true, status: "FAIL", exitCode: 0 });
  expect(receipt.results.at(-1)!.failure).toContain("CPU_WORKER_PHASE_DEADLINE:compilation"); expect(fixture.calls.some(row => row.id === "cpu-policy")).toBe(false);
});
test("failure phase preserves compilation, artifact and regression origins independently of source postcheck failure", async () => {
  for (const [options, phase] of [[{ buildFail: true }, "compilation"], [{ missingArtifact: true }, "artifacts"], [{ ignored: true }, "cpu-regression"]] as const) {
    const receipt = await executeCpuWorker(workerFixture({ ...options, postcheckFail: true }).io);
    expect(receipt.phase).toBe(phase); expect(receipt.failurePhase).toBe(phase); expect(receipt.sourceCheckFailure).toBe("MOCK_SOURCE_CHECK_FAILURE"); expect(receipt.sourceChanged).toBeNull();
  }
});
test("worker binds exact frozen coverage IDs/counts and order rather than matching only aggregates", async () => {
  for (const changed of ["coverage", "order"]) {
    const fixture = workerFixture(), bootstrap = fixture.io.bootstrap;
    fixture.io.bootstrap = async check => {
      const boot = await bootstrap(check), cpuCoverage = { ...qualification.cpuCoverage };
      const count = cpuCoverage["learning:test:accumulation"]!; delete cpuCoverage["learning:test:accumulation"]; cpuCoverage["learning:test:renamed"] = count;
      return { ...boot, qualification: changed === "coverage" ? { ...qualification, cpuCoverage } : { ...qualification, qualificationPlan: (...args) => qualification.qualificationPlan(...args).reverse() } };
    };
    const receipt = await executeCpuWorker(fixture.io); expect(receipt.status).toBe("FAIL_CPU39_TESTS_ONLY");
    expect(receipt.failure).toBe(changed === "coverage" ? "FROZEN_CPU39_COVERAGE_REQUIRED" : "COMPLETE_CPU39_PLAN_REQUIRED");
  }
});
test("HOST rejects renamed/missing/empty/wrong-count/forged summaries and every attempt/outcome/artifact mismatch", async () => {
  const inner = await executeCpuWorker(workerFixture().io);
  const mutations: ((receipt: WorkerReceipt) => void)[] = [
    receipt => { receipt.results[4]!.id = "learning:lib:renamed"; receipt.outcome!.results[0]!.id = "learning:lib:renamed"; receipt.harnesses[0]!.id = "learning:lib:renamed"; },
    receipt => { receipt.harnesses[0]!.count = 1; receipt.outcome!.results[0]!.expectedCount = 1; receipt.outcome!.results[0]!.stdoutSummaries = ["test result: ok. 1 passed; 0 failed; 0 ignored;"]; },
    receipt => { receipt.results.splice(4, 1); receipt.outcome!.results.shift(); receipt.harnesses.shift(); },
    receipt => { receipt.outcome!.results[0]!.stdoutSummaries = ["test result: ok. 0 passed; 0 failed; 1 ignored;"]; },
    receipt => { receipt.outcome!.results[0]!.summaryCount = 2; },
    receipt => { receipt.outcome!.results.reverse(); },
    receipt => { receipt.results[4]!.id = receipt.results[5]!.id; },
    receipt => { receipt.results[1] = structuredClone(receipt.results[0]!); },
    receipt => { receipt.results[3] = structuredClone(receipt.results[2]!); },
    receipt => { receipt.results[0]!.timeoutMs = 9999; },
    receipt => { receipt.results[2]!.timeoutMs = 1500001; },
    receipt => { receipt.results[4]!.timeoutMs = 119999; },
    receipt => { receipt.results[2]!.commandInvoked = false; },
    receipt => { receipt.results[4]!.argv[0] = receipt.results[5]!.argv[0]!; },
    receipt => { receipt.outcome!.results[0]!.executable = receipt.harnesses[1]!.executable; },
    receipt => { receipt.artifacts[0]!.executable = receipt.artifacts[0]!.executable + "-other"; },
    receipt => { receipt.artifacts[0]!.bytes = 0; },
    receipt => { receipt.llvmExecuted = true; }, receipt => { receipt.gpuExecuted = true; }, receipt => { receipt.trainingExecuted = true; }, receipt => { receipt.trainingReady = true; },
  ];
  for (const mutate of mutations) { const receipt = structuredClone(inner); mutate(receipt); expect(() => acceptCpuWorker(receipt)).toThrow("COMPLETE_SUCCESSFUL_CPU39_WORKER_RECEIPT_REQUIRED"); }
});
test("valid near-4MiB stdout stays in streams while success and failed outcomes/nested HOST receipts remain bounded", async () => {
  for (const ignored of [false, true]) {
    const fixture = workerFixture({ largeOutput: true, ignored }), inner = await executeCpuWorker(fixture.io), first = inner.outcome!.results[0]!;
    expect(inner.status).toBe(ignored ? "FAIL_CPU39_TESTS_ONLY" : "PASS_CPU39_TESTS_ONLY");
    const id = Object.keys(cpuPlan.cpuCoverage)[0]!, capture = fixture.captures.get(id)!, attempt = inner.results.find(row => row.id === id)!;
    expect(Buffer.byteLength(capture.stdout)).toBe(cpuPlan.limits.supervisedStreamBytes);
    expect(attempt.streams![0]).toMatchObject({ bytes: 4194304, sha256: digest(Buffer.from(capture.stdout)) });
    expect(first.stdoutSummaries).toEqual([`test result: ok. 0 passed; 0 failed; ${ignored ? 1 : 0} ignored;`]); expect(first.summaryCount).toBe(1); expect(first).not.toHaveProperty("stdout");
    expect(Buffer.byteLength(JSON.stringify(inner, null, 2) + "\n")).toBeLessThan(cpuPlan.limits.hostReceiptBytes);
    const hostFixtureValue = hostFixture(inner), host = await executeCpuHost(cpuPaths(), 1000, 1000, hostFixtureValue.io);
    const nested = { ...host, plan: cpuPlan, finalizationSignalObserved: false, receiptStatusRequiresZeroHostMarker: true,
      captures: hostFixtureValue.calls.map(row => ({ id: row.id, streams: ["stdout", "stderr"].map(name => ({ path: cpuPaths().evidence + "/" + row.id + "/command." + name, bytes: 4194304, sha256: digest(Buffer.from("MOCK")) })) })) };
    const workerBytes = Buffer.byteLength(JSON.stringify(inner, null, 2) + "\n"), hostBytes = Buffer.byteLength(JSON.stringify(nested, null, 2) + "\n"); expect(hostBytes).toBeLessThan(cpuPlan.limits.hostReceiptBytes);
    expect(host.status).toBe(ignored ? "FAIL_HOST_CPU39_ONLY" : "PASS_HOST_CPU39_ONLY");
    const packet = process.env.CPU_SOURCE_PACKET;
    if (packet && !ignored) {
      validateCpuSourcePacket(packet); const directory = packet + "/mock-large-output"; await mkdir(directory);
      await writeFile(directory + "/command.stdout", capture.stdout, { flag: "wx" }); await writeFile(directory + "/command.stderr", "", { flag: "wx" });
      await writeFile(packet + "/large-output-proof.json", JSON.stringify({ status: "PASS_MOCK_LARGE_STDOUT_ONLY", actualHostExecuted: false, captureBytes: 4194304, workerBytes, hostBytes, host: nested, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
    }
  }
  const enormousSuffix = "test result: ok. 1 passed; 0 failed; 0 ignored;" + "x".repeat(4194000);
  expect(Buffer.byteLength(JSON.stringify(cpuStdoutSummary(enormousSuffix)))).toBeLessThan(256);
});
