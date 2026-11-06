// SPEC: _spec/tooling/sbx-dev/preparation-workflow.puml
import { afterEach, beforeEach, expect, test } from "bun:test";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { completionExplanation, composePreparation, main, parsePreparation, preparationPlan } from "../prepare.mjs";
import { readState, snapshotPaths } from "../stages.mjs";

const here = new URL("../", import.meta.url).pathname;
const order = ["validate", "create-stage", "policy", "accept-policy", "provision", "install", "diagnose"].map((stage) => `dev:sbx:${stage}`);
const tools = ["tar", "sha256sum", "timeout", "gpgv", "patch", "make", "clang", "ld.bfd", "readelf", "node", "rustc", "cargo", "zig"];
const originalPath = process.env.PATH ?? "";
const originalScript = locatePtyBackend(originalPath);
const PTY_TIMEOUT_MS = 5000, PTY_REAP_MS = 2000, PTY_OUTPUT_CAP = 65536;
const retainedFixtures = new Map();
let root, bin, mise, sbx, options, env, previousEnv, messages;

function locatePtyBackend(path) {
  const backend = Bun.which("script", { PATH: path });
  return typeof backend === "string" && backend.startsWith("/") ? backend : null;
}

function cleanupFixture(fixtureRoot, { retained = retainedFixtures, remove = rmSync, announce = console.error } = {}) {
  if (retained.has(fixtureRoot)) {
    announce(`PTY_FIXTURE_RETAINED ${JSON.stringify({ root: fixtureRoot, ...retained.get(fixtureRoot) })}`);
    return false;
  }
  remove(fixtureRoot, { recursive: true, force: true });
  return true;
}

async function runPty(command, answer, {
  backend = originalScript, environment = env, fixtureRoot = root, spawnChild = spawn,
  signalGroup = (pid, signal) => process.kill(pid, signal), schedule = setTimeout, cancel = clearTimeout,
  preserveFixture = (metadata) => retainedFixtures.set(fixtureRoot, metadata),
} = {}) {
  if (typeof backend !== "string" || !backend.startsWith("/")) {
    throw new Error("PTY_PREREQUISITE_MISSING: existing util-linux-compatible script required; actual PTY test not run");
  }
  return new Promise((resolve, reject) => {
    const output = { stdout: [], stderr: [] };
    let child, ownedPid = null, spawned = false, closed = false, launchFailed = false, settled = false;
    let failure = null, timeout, reap, signalled = false, signalError = null, replied = false;
    let bytes = 0, observedBytes = 0, code = null, signal = null;
    const text = (name) => {
      const prefix = Buffer.concat(output[name]);
      const encoded = Buffer.from(prefix.toString("utf8"));
      return new TextDecoder("utf-8", { ignoreBOM: true }).decode(encoded.subarray(0, prefix.length), { stream: true });
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      if (timeout !== undefined) cancel(timeout);
      if (reap !== undefined) cancel(reap);
      const metadata = {
        root: fixtureRoot, backend, ownedPid, spawned, closeObserved: closed,
        cleanupCertain: launchFailed || (closed && !signalled), descendants: "NOT_VERIFIED",
        signalled, signalError, code, signal, bytes, observedBytes, replied,
        stdout: text("stdout"), stderr: text("stderr"),
      };
      if (failure) {
        failure.pty = metadata;
        if (!metadata.cleanupCertain) preserveFixture(metadata);
        reject(failure);
      } else resolve(metadata);
    };
    const stopLauncher = () => {
      if (ownedPid === null || signalled || closed) return;
      signalled = true;
      try { signalGroup(-ownedPid, "SIGKILL"); }
      catch (error) { signalError = error.code ?? "SIGNAL_FAILED"; }
    };
    const fail = (error) => {
      if (settled || failure) return;
      failure = error;
      if (timeout !== undefined) cancel(timeout);
      if (closed || launchFailed) { finish(); return; }
      reap = schedule(() => {
        child?.stdin?.destroy();
        child?.stdout?.destroy();
        child?.stderr?.destroy();
        child?.unref?.();
        finish();
      }, PTY_REAP_MS);
      stopLauncher();
    };
    const collect = (name, chunk) => {
      if (settled || failure) return;
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const prefix = data.subarray(0, PTY_OUTPUT_CAP - bytes);
      if (prefix.length) { output[name].push(Buffer.from(prefix)); bytes += prefix.length; }
      observedBytes += data.length;
      if (observedBytes > PTY_OUTPUT_CAP) {
        fail(new Error("PTY_OUTPUT_LIMIT: combined stdout/stderr exceeded 65536 bytes"));
        return;
      }
      if (name === "stdout" && !replied && text("stdout").includes("Type approve")) {
        replied = true;
        try {
          child.stdin.write(`${answer}\n`, (error) => {
            if (error) fail(new Error("PTY_STDIN_WRITE_FAILED", { cause: error }));
          });
        } catch (error) { fail(new Error("PTY_STDIN_WRITE_FAILED", { cause: error })); }
      }
    };
    try {
      child = spawnChild(backend, ["-q", "-e", "-c", command, "/dev/null"], {
        env: { ...environment, SHELL: "/bin/sh" }, detached: true, stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error) {
      launchFailed = true;
      fail(error);
      return;
    }
    child.once("spawn", () => {
      if (settled) return;
      spawned = true;
      if (!Number.isSafeInteger(child.pid) || child.pid <= 1 || child.pid > 2147483647) {
        fail(new Error("PTY_LAUNCH_PID_INVALID: no owned positive launcher PID"));
        return;
      }
      ownedPid = child.pid;
      if (failure) stopLauncher();
    });
    child.on("error", (error) => {
      if (!spawned) launchFailed = true;
      fail(error);
    });
    child.once("close", (exitCode, exitSignal) => {
      closed = true;
      code = exitCode;
      signal = exitSignal;
      if (!failure && !replied) {
        fail(new Error("PTY_BACKEND_UNSUPPORTED: -q -e -c did not deliver the stage approval prompt"));
      } else finish();
    });
    child.stdin.on("error", (error) => fail(new Error("PTY_STDIN_WRITE_FAILED", { cause: error })));
    for (const name of ["stdout", "stderr"]) {
      child[name].on("data", (chunk) => collect(name, chunk));
      child[name].on("error", fail);
    }
    timeout = schedule(() => fail(new Error("PTY_TIMEOUT: pseudo-terminal exceeded 5000ms")), PTY_TIMEOUT_MS);
  });
}

function fakePty() {
  const events = (fields = {}) => {
    const listeners = new Map();
    return {
      ...fields,
      on(name, listener) {
        const entries = listeners.get(name) ?? [];
        entries.push({ listener, once: false }); listeners.set(name, entries);
        return this;
      },
      once(name, listener) {
        this.on(name, listener); listeners.get(name).at(-1).once = true;
        return this;
      },
      emit(name, ...args) {
        const entries = listeners.get(name) ?? [];
        for (const entry of [...entries]) {
          if (entry.once) entries.splice(entries.indexOf(entry), 1);
          entry.listener(...args);
        }
      },
      destroy() { this.destroyed = true; },
    };
  };
  const writes = [], signals = [], launches = [], retained = [], scheduled = [], timers = new Map();
  const child = events({ pid: 4321, unref() { this.unreferenced = true; } });
  child.stdout = events(); child.stderr = events();
  child.stdin = events({ write(value, callback) { writes.push(value); callback?.(); return true; } });
  return {
    child, writes, signals, launches, retained, scheduled, timers,
    run(extra = {}) {
      return runPty("fixture command", "approve", {
        backend: "/fixture/script", environment: env,
        spawnChild: (...args) => { launches.push(args); return child; },
        signalGroup: (...args) => signals.push(args),
        schedule: (callback, milliseconds) => {
          const timer = { callback, milliseconds }; timers.set(timer, timer); scheduled.push(milliseconds);
          return timer;
        },
        cancel: (timer) => timers.delete(timer),
        preserveFixture: (metadata) => retained.push(metadata),
        ...extra,
      });
    },
    fire(milliseconds) {
      const timer = [...timers.values()].find((entry) => entry.milliseconds === milliseconds);
      if (!timer) throw new Error(`missing fixture timer: ${milliseconds}`);
      timers.delete(timer); timer.callback();
    },
  };
}

function wrapper(path, code) {
  const module = path + ".mjs";
  writeFileSync(module, code);
  writeFileSync(path, `#!/bin/sh\nexec '${process.execPath}' --no-env-file --no-install '${module}' "$@"\n`, { mode: 0o755 });
}

beforeEach(() => {
  root = mkdtempSync("/tmp/opencode/preparation-tests-");
  chmodSync(root, 0o700);
  bin = join(root, "bin"); mkdirSync(bin);
  mise = join(bin, "mise"); sbx = join(bin, "sbx");
  wrapper(mise, `
import { appendFileSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { runStage } from ${JSON.stringify(join(here, "stages.mjs"))};
import { toolPins } from ${JSON.stringify(join(here, "acquire-tools.mjs"))};
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
const root = process.env.PREP_TEST_ROOT;
const args = process.argv.slice(2);
if (args[0] !== 'run' || args[1] !== '--raw' || args[3] !== '--') process.exit(98);
if (existsSync(root + '/active-child')) process.exit(97);
writeFileSync(root + '/active-child', args[2]);
appendFileSync(root + '/mise-calls', JSON.stringify(args) + '\\n');
const actions = {'dev:sbx:validate':'validate','dev:sbx:create-stage':'create','dev:sbx:policy':'policy','dev:sbx:accept-policy':'accept-policy','dev:sbx:provision':'provision','dev:sbx:install':'install','dev:sbx:diagnose':'diagnose'};
try {
  const {values} = parseArgs({args:args.slice(4),options:{state:{type:'string'},sbx:{type:'string'},bundle:{type:'string'},sha256:{type:'string'},manifest:{type:'string'}}});
  if(args[2] === 'dev:sbx:acquire') {
    appendFileSync(root+'/approvals','acquire\\n');
    if(process.env.PREP_TEST_DECLINE === 'acquire') throw Error('declined fixture acquisition');
    const pins = toolPins(), data = 'automatic acquisition fixture, not a real Rust download';
    const bundlePath = join(dirname(values.manifest), 'rust-tools.tar');
    writeFileSync(bundlePath,data,{mode:0o600});
    writeFileSync(values.manifest,JSON.stringify({schema:'dev-sbx-acquired-tools-v1',bunVersion:pins.bun,rustVersion:pins.rust,host:'x86_64-unknown-linux-gnu',bundlePath,sha256:createHash('sha256').update(data).digest('hex')}),{mode:0o600});
  } else await runStage(actions[args[2]], values, {confirm: async ({action}) => {
    appendFileSync(root + '/approvals', action + '\\n');
    return action !== process.env.PREP_TEST_DECLINE;
  }});
} catch { process.exitCode = 2; }
finally { unlinkSync(root + '/active-child'); }
`);
  wrapper(sbx, `
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
const root=process.env.PREP_TEST_ROOT, args=process.argv.slice(2);
appendFileSync(root+'/sbx-calls',JSON.stringify(args)+'\\n');
const name=root+'/name';
if(args[0]==='ls') { if(existsSync(name)) console.log(readFileSync(name,'utf8')); }
else if(args[0]==='create') { writeFileSync(name,args[2]); if(process.env.PREP_TEST_FAIL==='create') process.exit(1); }
else if(args[0]==='policy') console.log('PRIVATE_POLICY_TEST_DATA');
else if(args[0]==='cp') {
  if(process.env.PREP_TEST_FAIL==='copy') process.exit(1);
  if(args[1].endsWith('.bundle.snapshot.tar') && process.env.PREP_TEST_MUTATE_BUNDLE) writeFileSync(process.env.PREP_TEST_MUTATE_BUNDLE,'UNAPPROVED_REPLACEMENT_AFTER_VALIDATION');
}
else if(args[0]==='exec') {
  if(args.includes('-c') && args.some((value) => value.includes('F9_GUEST_CAPABILITIES_V1'))) process.stdout.write(${JSON.stringify(["F9_GUEST_CAPABILITIES_V1", "UID=10001", "FD_SOFT=1024", "WORKSPACE=WRITABLE", ...tools.map((tool) => `TOOL_${tool}=MISSING`), "SEEDED_RUST=EXECUTABLES_PRESENT", "GUEST_DONE=YES", ""].join("\n"))});
  else console.log('RESULT=DEV_ONLY_RUST_1_95_SEEDED');
} else process.exit(96);
`);
  const bun = join(bin, "bun");
  writeFileSync(bun, `#!/bin/sh\nif test "$3" = '${join(here, "check-bundle.mjs")}'; then\n  printf 'BUNDLE=HASH_AND_LAYOUT_OK\\n'\nelse\n  exec '${process.execPath}' "$@"\nfi\n`, { mode: 0o755 });
  options = { sbx, bundle: join(root, "tools.tar"), sha256: "a".repeat(64) };
  writeFileSync(options.bundle, "fixture validator deliberately mocked; no actual toolchain");
  options.sha256 = createHash("sha256").update(readFileSync(options.bundle)).digest("hex");
  previousEnv = { PATH: process.env.PATH, PREP_TEST_ROOT: process.env.PREP_TEST_ROOT, PREP_TEST_DECLINE: process.env.PREP_TEST_DECLINE, PREP_TEST_FAIL: process.env.PREP_TEST_FAIL, PREP_TEST_MUTATE_BUNDLE: process.env.PREP_TEST_MUTATE_BUNDLE };
  env = { ...process.env, PATH: `${bin}:/usr/bin:/bin`, PREP_TEST_ROOT: root };
  Object.assign(process.env, { PATH: env.PATH, PREP_TEST_ROOT: root });
  delete process.env.PREP_TEST_DECLINE; delete process.env.PREP_TEST_FAIL; delete process.env.PREP_TEST_MUTATE_BUNDLE;
  messages = [];
});
afterEach(() => {
  for (const [key, value] of Object.entries(previousEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  cleanupFixture(root);
});

function compose(extra = {}, input = options) {
  return composePreparation(input, {
    mise,
    createRunDirectory: () => { const dir = join(root, "run"); mkdirSync(dir, { mode: 0o700 }); return dir; },
    announce: (message) => messages.push(message), ...extra,
  });
}
function calls(file) { return existsSync(join(root, file)) ? readFileSync(join(root, file), "utf8").trim().split("\n").map(JSON.parse) : []; }

test("parent invokes real fake-mise child processes sequentially and carries the generated name", async () => {
  const report = await compose();
  expect(calls("mise-calls").map((args) => args[2])).toEqual(order);
  const statePaths = calls("mise-calls").map((args) => args[5]);
  expect(new Set(statePaths).size).toBe(1);
  const state = readState(report.statePath);
  expect(state.completedStage).toBe("diagnose");
  expect(report.createdName).toMatch(/^devrust-[0-9a-f]{24}$/);
  expect(report.createdName).toBe(readFileSync(join(root, "name"), "utf8"));
  expect(readFileSync(join(root, "approvals"), "utf8").trim().split("\n")).toEqual(["validate", "create", "policy", "accept-policy", "provision", "install", "diagnose"]);
  expect(report.developmentPrepared).toBe(true);
  expect(report.diagnosticComplete).toBe(true);
  expect(report.result).toBe("STOP"); expect(report.trainingReady).toBe(false);
  expect(calls("sbx-calls").filter(([command]) => command === "cp")).toHaveLength(2);
  expect(calls("sbx-calls").some(([command]) => ["rm", "reset", "run", "auth"].includes(command))).toBe(false);
  expect(messages.join("\n")).not.toContain("PRIVATE_POLICY_TEST_DATA");
});

test("successful parent CLI keeps its receipt and exit two while explaining completion only on stderr", async () => {
  const stdout = [], stderr = [], writes = [];
  const input = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
  Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
  let report;
  try {
    const code = await main([], {
      compose: async () => { report = await compose(); return report; },
      output: (text) => { stdout.push(text); writes.push("stdout"); },
      explain: (text) => { stderr.push(text); writes.push("stderr"); },
    });
    expect(code).toBe(2);
    expect(stdout).toHaveLength(1);
    expect(JSON.parse(stdout[0])).toEqual(report);
    expect(stderr).toEqual([completionExplanation]);
    expect(writes).toEqual(["stdout", "stderr"]);
    expect(stderr[0]).toContain("DEVELOPMENT_SETUP_COMPLETE");
    expect(stderr[0]).toContain("F9_NOT_ASSESSED");
    expect(stderr[0]).toContain("exit 2 is intentional");
    expect(stderr[0]).toContain("offline explainer exits 0 for successful presentation only");
    expect(report.trainingReady).toBe(false);
  } finally {
    if (input) Object.defineProperty(process.stdin, "isTTY", input); else delete process.stdin.isTTY;
  }
});

test.each(["plan", "failure", "non-terminal"])("%s never prints the parent completion explanation", async (mode) => {
  const stdout = [], stderr = [];
  const input = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
  Object.defineProperty(process.stdin, "isTTY", { value: mode !== "non-terminal", configurable: true });
  let invoked = false;
  try {
    const code = await main(mode === "plan" ? ["--plan"] : [], {
      compose: async () => { invoked = true; throw new Error("fixture stage stopped"); },
      output: (text) => stdout.push(text), explain: (text) => stderr.push(text),
    });
    expect(code).toBe(mode === "plan" ? 0 : 2);
    expect(invoked).toBe(mode === "failure");
    expect([...stdout, ...stderr].join("\n")).not.toContain("DEVELOPMENT_SETUP_COMPLETE");
    expect([...stdout, ...stderr].join("\n")).not.toContain("exit 2 is intentional");
    expect(calls("mise-calls")).toEqual([]);
    expect(calls("sbx-calls")).toEqual([]);
  } finally {
    if (input) Object.defineProperty(process.stdin, "isTTY", input); else delete process.stdin.isTTY;
  }
});

test("default path acquires pinned tools and passes generated archive/hash before creation", async () => {
  const report = await compose({}, {});
  expect(calls("mise-calls").map((args) => args[2])).toEqual(["dev:sbx:acquire", ...order]);
  const state = readState(report.statePath);
  expect(state.sbxPath).toBe(sbx);
  expect(state.bundlePath).toBe(join(root, "run/rust-tools.tar"));
  expect(state.bundleSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(report.diagnosticComplete).toBe(true);
  expect(report.trainingReady).toBe(false);
  expect(readFileSync(join(root, "approvals"), "utf8").split("\n")[0]).toBe("acquire");
});

test("declined acquisition prevents validation and every sandbox operation", async () => {
  process.env.PREP_TEST_DECLINE = "acquire";
  await expect(compose({}, { sbx })).rejects.toThrow("child task");
  expect(calls("mise-calls").map((args) => args[2])).toEqual(["dev:sbx:acquire"]);
  expect(calls("sbx-calls")).toEqual([]);
});

test("replacing the original after validation cannot redirect snapshot transfer bytes", async () => {
  process.env.PREP_TEST_MUTATE_BUNDLE = options.bundle;
  const report = await compose();
  const state = readState(report.statePath), paths = snapshotPaths(report.statePath, state.attemptId);
  const copies = calls("sbx-calls").filter(([command]) => command === "cp");
  expect(copies.map((args) => args[1])).toEqual([paths.bundle, paths.installer]);
  expect(createHash("sha256").update(readFileSync(paths.bundle)).digest("hex")).toBe(options.sha256);
  expect(createHash("sha256").update(readFileSync(options.bundle)).digest("hex")).not.toBe(options.sha256);
  expect(report.developmentPrepared).toBe(true);
});

test.each(["create", "policy", "accept-policy", "provision", "install", "diagnose"])("declining %s prevents all later tasks", async (action) => {
  process.env.PREP_TEST_DECLINE = action;
  await expect(compose()).rejects.toThrow("child task");
  const actions = ["validate", "create", "policy", "accept-policy", "provision", "install", "diagnose"];
  expect(calls("mise-calls")).toHaveLength(actions.indexOf(action) + 1);
  expect(existsSync(join(root, "run/state.json"))).toBe(true);
});

test.each(["create", "copy"])("ambiguous %s retains state without retry or installation", async (operation) => {
  process.env.PREP_TEST_FAIL = operation;
  await expect(compose()).rejects.toThrow("child task");
  const state = readState(join(root, "run/state.json"));
  expect(state.status).toBe("RECONCILE");
  expect(state.createdName).toMatch(/^devrust-/);
  expect(calls("sbx-calls").some(([command]) => command === "exec")).toBe(false);
});

test("syntax-only plan needs neither installed tools nor input files", () => {
  const input = parsePreparation(["--sbx", "/missing/sbx", "--bundle", "/missing/tools.tar", "--sha256", "b".repeat(64), "--plan"]);
  const plan = preparationPlan(input);
  expect(plan.tasks.map((task) => task.task)).toEqual(order);
  const result = spawnSync(process.execPath, ["--no-env-file", "--no-install", join(here, "prepare.mjs"), "--sbx", input.sbx, "--bundle", input.bundle, "--sha256", input.sha256, "--plan"], { env, encoding: "utf8" });
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout).mode).toBe("PLAN_ONLY");
  expect(calls("mise-calls")).toEqual([]); expect(calls("sbx-calls")).toEqual([]);
});

test("default command needs no archive, checksum or sandbox-name inputs", () => {
  const options = parsePreparation(["--plan"]);
  const plan = preparationPlan(options);
  expect(plan.tasks[0].task).toBe("dev:sbx:acquire");
  expect(plan.inputs.tools).toEqual({ bun: "1.4.0", rust: "1.95.0" });
  expect(plan.previewEffects).toEqual({ subprocesses: false, writes: false, downloads: false, installs: false });
  expect(() => parsePreparation(["--bundle", "/missing/archive"])).toThrow();
  expect(() => parsePreparation(["--sha256", "a".repeat(64)])).toThrow();
  const child = spawnSync(process.execPath, ["--no-env-file", "--no-install", join(here, "prepare.mjs"), "--plan"], { env, encoding: "utf8" });
  expect(child.status).toBe(0);
  expect(calls("mise-calls")).toEqual([]);
});

test("piped approvals and unknown options cannot start preparation", () => {
  for (const extra of [[], ["--yes"], ["--name", "CREATED_NAME"]]) {
    const result = spawnSync(process.execPath, ["--no-env-file", "--no-install", join(here, "prepare.mjs"), "--sbx", sbx, "--bundle", options.bundle, "--sha256", options.sha256, ...extra], { input: "approve\napprove\n", env, encoding: "utf8" });
    expect(result.status).toBe(2); expect(calls("mise-calls")).toEqual([]); expect(calls("sbx-calls")).toEqual([]);
  }
});

test("mise tasks use distinct children, raw terminal access and explicit Bun isolation flags", () => {
  const config = Bun.TOML.parse(readFileSync(new URL("../../../mise.toml", import.meta.url), "utf8"));
  for (const task of ["dev:sbx:prepare", "dev:sbx:acquire", ...order]) {
    expect(config.tasks[task].raw).toBe(true);
    expect(config.tasks[task].raw_args).toBe(true);
    expect(config.tasks[task].depends).toBeUndefined();
    expect(config.tasks[task].run).toContain("bun --no-env-file --no-install");
  }
  expect(config.tools["core:bun"]).toBe("1.4.0");
  expect(config.tools["core:rust"].version).toBe("1.95.0");
  expect(config.settings.auto_install).toBe(false);
});

test("PTY backend resolution captures an existing nonstandard PATH before fixture changes", async () => {
  const hostBin = join(root, "original-host-bin"); mkdirSync(hostBin);
  const backend = join(hostBin, "script");
  writeFileSync(backend, "#!/bin/sh\nexit 2\n", { mode: 0o700 });
  const captured = locatePtyBackend(hostBin);
  expect(captured).toBe(backend);
  process.env.PATH = bin;
  const fixture = fakePty(), pending = fixture.run({ backend: captured });
  fixture.child.emit("spawn");
  fixture.child.stdout.emit("data", Buffer.from("Type approve"));
  fixture.child.emit("close", 0, null);
  expect((await pending).backend).toBe(backend);
  expect(fixture.launches[0][0]).toBe(backend);
  expect(fixture.launches[0][1]).toEqual(["-q", "-e", "-c", "fixture command", "/dev/null"]);
  expect(fixture.launches[0][2].detached).toBe(true);
  expect(fixture.signals).toEqual([]);
});

test("missing PTY prerequisite fails explicitly without spawning or signalling", async () => {
  const fixture = fakePty();
  const backend = locatePtyBackend(join(root, "missing-host-bin"));
  expect(backend).toBeNull();
  await expect(fixture.run({ backend })).rejects.toThrow("PTY_PREREQUISITE_MISSING: existing util-linux-compatible script required; actual PTY test not run");
  expect(fixture.launches).toEqual([]);
  expect(fixture.signals).toEqual([]);
  expect(fixture.timers.size).toBe(0);
});

test("unsupported PTY backend fails explicitly with bounded stderr and no reply or signal", async () => {
  const fixture = fakePty(), pending = fixture.run().catch((error) => error);
  fixture.child.emit("spawn");
  fixture.child.stderr.emit("data", Buffer.from("script: unsupported option -e\n"));
  fixture.child.emit("close", 1, null);
  const error = await pending;
  expect(error.message).toContain("PTY_BACKEND_UNSUPPORTED: -q -e -c");
  expect(error.pty.stderr).toBe("script: unsupported option -e\n");
  expect(error.pty.closeObserved).toBe(true);
  expect(fixture.writes).toEqual([]);
  expect(fixture.signals).toEqual([]);
  expect(fixture.retained).toEqual([]);
  expect(fixture.timers.size).toBe(0);
});

test.each([undefined, 0, 1, -1, NaN, 1.5])("PTY launcher refuses invalid owned PID %s without signalling", async (pid) => {
  const fixture = fakePty(); fixture.child.pid = pid;
  const pending = fixture.run().catch((error) => error);
  fixture.child.emit("spawn");
  fixture.child.emit("close", 1, null);
  const error = await pending;
  expect(error.message).toContain("PTY_LAUNCH_PID_INVALID");
  expect(error.pty.ownedPid).toBeNull();
  expect(fixture.signals).toEqual([]);
  expect(fixture.timers.size).toBe(0);
});

test("PTY spawn failure preserves its reason and never owns a pre-spawn PID", async () => {
  const fixture = fakePty(), failure = new Error("fixture spawn failure");
  const pending = fixture.run().catch((error) => error);
  fixture.child.emit("error", failure);
  fixture.child.emit("error", new Error("later fixture error"));
  const error = await pending;
  expect(error).toBe(failure);
  expect(error.pty.ownedPid).toBeNull();
  expect(error.pty.cleanupCertain).toBe(true);
  expect(fixture.signals).toEqual([]);
  expect(fixture.retained).toEqual([]);
  expect(fixture.timers.size).toBe(0);
});

test("PTY prompt split across chunks receives exactly one reply", async () => {
  const fixture = fakePty(), pending = fixture.run();
  fixture.child.emit("spawn");
  fixture.child.stdout.emit("data", Buffer.from("Type app"));
  expect(fixture.writes).toEqual([]);
  fixture.child.stdout.emit("data", Buffer.from("rove to authorize: "));
  fixture.child.stdout.emit("data", Buffer.from("Type approve again"));
  fixture.child.stderr.emit("data", Buffer.from("stderr prefix"));
  fixture.child.emit("close", 0, null);
  const result = await pending;
  expect(fixture.writes).toEqual(["approve\n"]);
  expect(result.stdout).toBe("Type approve to authorize: Type approve again");
  expect(result.stderr).toBe("stderr prefix");
  expect(result.bytes).toBe(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr));
  expect(fixture.timers.size).toBe(0);
});

test("PTY timeout signals only its owned launcher group and preserves the first failure through close", async () => {
  const fixture = fakePty(), pending = fixture.run().catch((error) => error);
  fixture.child.emit("spawn");
  fixture.fire(PTY_TIMEOUT_MS);
  fixture.child.emit("error", new Error("later child failure"));
  fixture.child.stdin.emit("error", new Error("later stdin failure"));
  expect(fixture.signals).toEqual([[-4321, "SIGKILL"]]);
  expect(fixture.scheduled).toEqual([5000, 2000]);
  fixture.child.emit("close", null, "SIGKILL");
  const error = await pending;
  expect(error.message).toBe("PTY_TIMEOUT: pseudo-terminal exceeded 5000ms");
  expect(error.pty.closeObserved).toBe(true);
  expect(error.pty.cleanupCertain).toBe(false);
  expect(error.pty.descendants).toBe("NOT_VERIFIED");
  expect(fixture.retained).toEqual([error.pty]);
  expect(fixture.timers.size).toBe(0);
});

test("PTY signal failure cannot replace the timeout reason or imply cleanup certainty", async () => {
  const fixture = fakePty();
  const pending = fixture.run({ signalGroup: (...args) => {
    fixture.signals.push(args);
    throw Object.assign(new Error("fixture signal failure"), { code: "ESRCH" });
  } }).catch((error) => error);
  fixture.child.emit("spawn");
  fixture.fire(PTY_TIMEOUT_MS);
  fixture.child.emit("close", null, "SIGKILL");
  const error = await pending;
  expect(error.message).toBe("PTY_TIMEOUT: pseudo-terminal exceeded 5000ms");
  expect(error.pty.signalError).toBe("ESRCH");
  expect(error.pty.cleanupCertain).toBe(false);
  expect(fixture.signals).toEqual([[-4321, "SIGKILL"]]);
  expect(fixture.retained).toEqual([error.pty]);
  expect(fixture.timers.size).toBe(0);
});

test("PTY missing close settles once after bounded reap and retains the known fixture root", async () => {
  const fixture = fakePty(); let settlements = 0;
  const pending = fixture.run().then(() => { settlements++; return null; }, (error) => { settlements++; return error; });
  fixture.child.emit("spawn");
  fixture.fire(PTY_TIMEOUT_MS);
  await Promise.resolve();
  expect(settlements).toBe(0);
  fixture.fire(PTY_REAP_MS);
  const error = await pending;
  expect(error.message).toContain("PTY_TIMEOUT");
  expect(error.pty.closeObserved).toBe(false);
  expect(error.pty.root).toBe(root);
  expect(fixture.child.stdin.destroyed).toBe(true);
  expect(fixture.child.stdout.destroyed).toBe(true);
  expect(fixture.child.stderr.destroyed).toBe(true);
  expect(fixture.child.unreferenced).toBe(true);
  fixture.child.emit("close", null, "SIGKILL");
  fixture.child.emit("error", new Error("late child error"));
  expect(settlements).toBe(1);
  expect(fixture.signals).toEqual([[-4321, "SIGKILL"]]);
  expect(fixture.retained).toEqual([error.pty]);
  expect(fixture.timers.size).toBe(0);
});

test("PTY combined output cap counts multibyte stdout and stderr in bytes", async () => {
  const fixture = fakePty(), pending = fixture.run().catch((error) => error);
  fixture.child.emit("spawn");
  fixture.child.stdout.emit("data", Buffer.from("é".repeat(16384)));
  fixture.child.stderr.emit("data", Buffer.from("é".repeat(20000)));
  fixture.child.stdout.emit("data", Buffer.alloc(PTY_OUTPUT_CAP));
  fixture.child.emit("close", null, "SIGKILL");
  const error = await pending;
  expect(error.message).toContain("PTY_OUTPUT_LIMIT");
  expect(error.pty.bytes).toBe(65536);
  expect(error.pty.observedBytes).toBe(72768);
  expect(Buffer.byteLength(error.pty.stdout) + Buffer.byteLength(error.pty.stderr)).toBe(65536);
  expect(error.pty.stdout).toBe("é".repeat(16384));
  expect(error.pty.stderr).toBe("é".repeat(16384));
  expect(fixture.signals).toEqual([[-4321, "SIGKILL"]]);
  expect(fixture.retained).toHaveLength(1);
  expect(fixture.timers.size).toBe(0);
});

test("PTY malformed UTF-8 diagnostics cannot expand beyond the retained byte cap", async () => {
  const fixture = fakePty(), pending = fixture.run().catch((error) => error);
  fixture.child.emit("spawn");
  fixture.child.stderr.emit("data", Buffer.alloc(PTY_OUTPUT_CAP + 1, 0xff));
  fixture.child.emit("close", null, "SIGKILL");
  const error = await pending;
  expect(error.message).toContain("PTY_OUTPUT_LIMIT");
  expect(error.pty.bytes).toBe(65536);
  expect(error.pty.observedBytes).toBe(65537);
  expect(Buffer.byteLength(error.pty.stdout) + Buffer.byteLength(error.pty.stderr)).toBeLessThanOrEqual(65536);
  expect(fixture.signals).toEqual([[-4321, "SIGKILL"]]);
  expect(fixture.timers.size).toBe(0);
});

test.each(["throw", "callback", "event"])("PTY stdin %s failure stops the launcher and preserves the write cause", async (mode) => {
  const fixture = fakePty(), cause = new Error("fixture stdin failure");
  if (mode !== "event") fixture.child.stdin.write = (value, callback) => {
    fixture.writes.push(value);
    if (mode === "throw") throw cause;
    callback(cause); return false;
  };
  const pending = fixture.run().catch((error) => error);
  fixture.child.emit("spawn");
  fixture.child.stdout.emit("data", Buffer.from("Type approve"));
  if (mode === "event") fixture.child.stdin.emit("error", cause);
  fixture.child.stdout.emit("data", Buffer.from("Type approve again"));
  fixture.child.emit("close", null, "SIGKILL");
  const error = await pending;
  expect(error.message).toBe("PTY_STDIN_WRITE_FAILED");
  expect(error.cause).toBe(cause);
  expect(fixture.writes).toEqual(["approve\n"]);
  expect(fixture.signals).toEqual([[-4321, "SIGKILL"]]);
  expect(fixture.retained).toHaveLength(1);
  expect(fixture.timers.size).toBe(0);
});

test("PTY cleanup uncertainty preserves its fixture and announces known root metadata", () => {
  const retained = new Map([[root, { ownedPid: 4321, closeObserved: false, descendants: "NOT_VERIFIED" }]]);
  const removals = [], announcements = [];
  const cleanup = { retained, remove: (...args) => removals.push(args), announce: (text) => announcements.push(text) };
  expect(cleanupFixture(root, cleanup)).toBe(false);
  expect(removals).toEqual([]);
  expect(existsSync(root)).toBe(true);
  expect(JSON.parse(announcements[0].slice("PTY_FIXTURE_RETAINED ".length))).toEqual({
    root, ownedPid: 4321, closeObserved: false, descendants: "NOT_VERIFIED",
  });
  retained.delete(root);
  expect(cleanupFixture(root, cleanup)).toBe(true);
  expect(removals).toEqual([[root, { recursive: true, force: true }]]);
});

test.each(["approve", "decline"])("actual pseudo-terminal %s exercises the stage approval boundary", async (answer) => {
  const stateDir = join(root, "tty"); mkdirSync(stateDir, { mode: 0o700 });
  const state = join(stateDir, "state.json");
  const command = [process.execPath, "--no-env-file", "--no-install", join(here, "stages.mjs"), "validate", "--state", state, "--sbx", sbx, "--bundle", options.bundle, "--sha256", options.sha256].map((argument) => `'${argument.replaceAll("'", "'\\''")}'`).join(" ");
  const result = await runPty(command, answer);
  expect(result.code).toBe(answer === "approve" ? 0 : 2);
  expect(result.replied).toBe(true);
  expect(result.closeObserved).toBe(true);
  expect(existsSync(state)).toBe(answer === "approve");
  expect(calls("sbx-calls")).toEqual([]);
}, 10000);
