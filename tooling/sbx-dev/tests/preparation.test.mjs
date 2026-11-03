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
let root, bin, mise, sbx, options, env, previousEnv, messages;

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
  rmSync(root, { recursive: true, force: true });
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

test.each(["approve", "decline"])("actual pseudo-terminal %s exercises the stage approval boundary", async (answer) => {
  const stateDir = join(root, "tty"); mkdirSync(stateDir, { mode: 0o700 });
  const state = join(stateDir, "state.json");
  const command = [process.execPath, "--no-env-file", "--no-install", join(here, "stages.mjs"), "validate", "--state", state, "--sbx", sbx, "--bundle", options.bundle, "--sha256", options.sha256].map((argument) => `'${argument}'`).join(" ");
  const result = await new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/script", ["-q", "-e", "-c", command, "/dev/null"], { env: { ...env, SHELL: "/bin/sh" }, detached: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", replied = false;
    const timer = setTimeout(() => { process.kill(-child.pid, "SIGKILL"); reject(new Error("pseudo-terminal test timeout")); }, 5000);
    child.stdout.on("data", (chunk) => { stdout += chunk; if (!replied && stdout.includes("Type approve")) { replied = true; child.stdin.write(answer + "\n"); } });
    child.stderr.on("data", () => {});
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code) => { clearTimeout(timer); resolve({ code, stdout }); });
  });
  expect(result.code).toBe(answer === "approve" ? 0 : 2);
  expect(existsSync(state)).toBe(answer === "approve");
  expect(calls("sbx-calls")).toEqual([]);
});
