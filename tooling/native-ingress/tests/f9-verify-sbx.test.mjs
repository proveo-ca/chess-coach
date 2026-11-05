// SPEC: _spec/tooling/native-ingress/f9-diagnostic.puml
import { afterEach, beforeEach, expect, test } from "bun:test";
import fs from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { buildVerificationPlan, guestTools, guestVerificationScript, profiledGuestVerificationScript, parseGuestVerification, parseVerificationArgs, verifySbx } from "../f9-verify-sbx.mjs";

const script = new URL("../f9-verify-sbx.mjs", import.meta.url).pathname;
const options = { sbx: "/approved/sbx", name: "devrust-example", repo: "/approved/repo", report: "/approved/report.json", mode: "EXECUTE" };
const args = (mode = "--confirm-dev-verification", selected = options) => ["--sbx", selected.sbx, "--name", selected.name, "--repo", selected.repo, "--report", selected.report, mode];
const protocol = (missing = [], result = missing.length ? "TOOLS_MISSING" : "EXPLAIN_SUCCEEDED") => [
  "F9_SBX_EXPLAIN_V1", ...guestTools.map((tool) => `TOOL_${tool}=${missing.includes(tool) ? "MISSING" : "PRESENT"}`), `RESULT=${result}`, "",
].join("\n");
const completed = (stdout = protocol(), code = 0) => ({ ok: code === 0, outcome: "EXIT", code, signal: null, stdout, stderr: "", bytes: Buffer.byteLength(stdout) });
let root, sbx, calls;

beforeEach(() => {
  root = fs.mkdtempSync("/tmp/opencode/f9-verify-sbx-");
  sbx = join(root, "sbx");
  calls = join(root, "calls.json");
  fs.writeFileSync(sbx, `#!${process.execPath}
import fs from "node:fs";
fs.writeFileSync(process.env.SBX_TEST_CALLS, JSON.stringify(process.argv.slice(2)), { flag: "wx" });
const mode = process.env.SBX_TEST_MODE;
if (mode === "overflow") process.stdout.write("x".repeat(70000));
else process.stdout.write(process.env.SBX_TEST_PROTOCOL);
if (mode === "stderr") process.stderr.write("PRIVATE_PROVIDER_ERROR\\u001b[31m");
process.exitCode = Number(process.env.SBX_TEST_EXIT ?? 0);
`, { mode: 0o700 });
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function invoke({ argv = args("--confirm-dev-verification", { ...options, sbx }), output = protocol(), code = 0, mode = "" } = {}) {
  const result = spawnSync(process.execPath, ["--no-env-file", "--no-install", script, ...argv], {
    env: { ...process.env, PATH: "/nonexistent", SBX_TEST_CALLS: calls, SBX_TEST_PROTOCOL: output, SBX_TEST_EXIT: String(code), SBX_TEST_MODE: mode },
    stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", timeout: 7000, maxBuffer: 128 * 1024,
  });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.stderr).toBe("");
  return { ...result, report: JSON.parse(result.stdout) };
}

test("explicit arguments preserve quoted paths as values rather than shell source", () => {
  const selected = { ...options, repo: "/approved/it's a repo;$(touch bad)", report: "/approved/a report.json" };
  expect(parseVerificationArgs(args("--confirm-dev-verification", selected))).toEqual(selected);
  const plan = buildVerificationPlan(selected);
  expect(plan.argv).toEqual([selected.sbx, "exec", selected.name, "/usr/bin/timeout", "--kill-after=1s", "25s", "/bin/sh", "-c", guestVerificationScript, "sh", selected.repo, selected.report]);
  expect(plan).toMatchObject({ milliseconds: 35000, cap: 65536, graceMilliseconds: 1000 });
  expect(guestVerificationScript).not.toContain(selected.repo);
});

test("plan mode makes no metadata checks, provider calls or executable discovery", async () => {
  const forbidden = () => { throw new Error("PLAN_PERFORMED_EFFECT"); };
  const report = await verifySbx(args("--plan"), { inspect: forbidden, execute: forbidden });
  expect(report.result).toBe("PLAN_ONLY");
  expect(report.plan).toEqual(buildVerificationPlan(options));
  expect(report).toMatchObject({ gate0: "OPEN", f9Qualified: false, trainingReady: false, tools: null, explanationSucceeded: false });
  const result = invoke({ argv: args("--plan") });
  expect(result.status).toBe(0);
  expect(result.report.result).toBe("PLAN_ONLY");
  expect(fs.existsSync(calls)).toBe(false);
});

test("complete-tool context is an explicit positional root without changing the legacy plan", async () => {
  const toolRoot = "/home/agent/workspace/devtools-0123456789abcdef";
  const argv = [...args("--plan"), "--tool-root", toolRoot];
  const parsed = parseVerificationArgs(argv);
  expect(parsed.toolRoot).toBe(toolRoot);
  expect(buildVerificationPlan(parsed).argv.slice(-3)).toEqual([options.repo, options.report, toolRoot]);
  expect(buildVerificationPlan(parsed).argv).toContain(profiledGuestVerificationScript);
  expect(profiledGuestVerificationScript).toContain('HOME="$3/home"');
  expect(profiledGuestVerificationScript).toContain('MISE_DATA_DIR="$3/mise-data"');
  expect(guestVerificationScript).not.toContain("MISE_DATA_DIR");
  const report = await verifySbx(argv, { inspect: () => { throw new Error("UNEXPECTED_INSPECTION"); } });
  expect(report.result).toBe("PLAN_ONLY");
  expect(report.guestToolRoot).toBe(toolRoot);
  expect(report.gate0).toBe("OPEN");
});

test.each(["/tmp/tools", "/home/agent/workspace/devrust-tools", "/home/agent/workspace/devtools-ABCDEF0123456789", "/home/agent/workspace/devtools-0123456789abcdef/", "/home/agent/workspace/devtools-0123456789abcdef/../other"])("unregistered tool-root shape refuses: %s", async (toolRoot) => {
  const report = await verifySbx([...args("--plan"), "--tool-root", toolRoot]);
  expect(report.result).toBe("STOP");
  expect(report.error).toBe("INVALID_ARGUMENTS");
});

test.each([
  [], args().slice(0, -1), [...args(), "--plan"], [...args(), "--unknown"], [...args(), "positional"],
  [...args(), "--name", "other"], [...args(), "--sbx=/other"], args("--plan=true"),
  ...["sbx", "repo", "report"].flatMap((key) => ["relative", "/bad//path", "/bad/../path", "/bad/path/", "/bad\npath", "/bad\u009bpath", "/"].map((value) => args("--plan", { ...options, [key]: value }))),
  ...["-bad", "a/b", "a b", "a\n", "a".repeat(65)].map((name) => args("--plan", { ...options, name })),
].map((argv) => [argv]))("invalid or ambiguous CLI arguments refuse before inspection: %j", async (argv) => {
  let inspected = false;
  const report = await verifySbx(argv, { inspect: () => { inspected = true; }, execute: () => { throw new Error("UNEXPECTED_EXECUTION"); } });
  expect(report.result).toBe("STOP");
  expect(report.error).toBe("INVALID_ARGUMENTS");
  expect(inspected).toBe(false);
});

test("exactly fifteen ordered tool observations and one result form the complete protocol", () => {
  expect(guestTools).toHaveLength(15);
  expect(new Set(guestTools).size).toBe(15);
  expect(guestTools).toContain("mise");
  expect(guestTools).toContain("bun");
  expect(parseGuestVerification(protocol())).toEqual({ tools: Object.fromEntries(guestTools.map((tool) => [tool, "PRESENT"])), missing: [], result: "EXPLAIN_SUCCEEDED" });
  expect(parseGuestVerification(protocol(["rustc", "cargo"])).missing).toEqual(["rustc", "cargo"]);
});

test.each([
  "", protocol().trimEnd(), protocol().replaceAll("\n", "\r\n"),
  protocol().replace("TOOL_clang=PRESENT\n", ""),
  protocol().replace("TOOL_clang=PRESENT", "TOOL_cargo=PRESENT"),
  protocol().replace("TOOL_clang=PRESENT", "TOOL_clang=UNKNOWN"),
  protocol().replace("TOOL_mise=PRESENT\nTOOL_bun=PRESENT", "TOOL_bun=PRESENT\nTOOL_mise=PRESENT"),
  `${protocol()}f9Qualified=true\n`, protocol(["zig"], "EXPLAIN_SUCCEEDED"), protocol([], "TOOLS_MISSING"),
])("malformed, duplicate, reordered or self-promoting guest protocol refuses", (output) => {
  expect(() => parseGuestVerification(output)).toThrow("MALFORMED_PROTOCOL");
});

test("one bounded provider success is development-only and never closes Gate0", async () => {
  const invocations = [];
  const report = await verifySbx(args(), { inspect: () => {}, execute: async (...invocation) => { invocations.push(invocation); return completed(); } });
  const plan = buildVerificationPlan(options);
  expect(invocations).toEqual([[plan.argv, { milliseconds: 35000, cap: 65536, graceMilliseconds: 1000 }]]);
  expect(report).toMatchObject({ result: "PASS", allToolsAvailable: true, explanationSucceeded: true, gate0: "OPEN", f9Qualified: false, trainingReady: false });
});

test.each(["TOOLS_MISSING", "REPO_UNAVAILABLE", "EXPLAIN_FAILED"])("completed %s is a refusal without retry or fallback", async (outcome) => {
  let count = 0;
  const output = protocol(outcome === "TOOLS_MISSING" ? ["clang"] : [], outcome);
  const report = await verifySbx(args(), { inspect: () => {}, execute: async () => { count++; return completed(output, 2); } });
  expect(count).toBe(1);
  expect(report.result).toBe("STOP");
  expect(report.error).toBe(outcome);
  expect(report.explanationSucceeded).toBe(false);
});

test.each([
  { outcome: "TIMEOUT", code: null, signal: "SIGKILL", ok: false },
  { outcome: "INTERRUPTED", code: null, signal: "SIGTERM", ok: false },
  { outcome: "SPAWN_ERROR", code: null, ok: false },
  { code: 2, ok: false }, { code: null, ok: true }, { ok: false },
  { stderr: "PRIVATE_PROVIDER_ERROR\u001b[31m" }, { stdout: "PRIVATE_MALFORMED\u001b[31m" },
  { bytes: 65537 }, { stdout: "x".repeat(65537) },
])("failed, ambiguous or oversized execution never publishes a PASS", async (change) => {
  let count = 0;
  const report = await verifySbx(args(), { inspect: () => {}, execute: async () => { count++; return { ...completed(), ...change }; } });
  expect(count).toBe(1);
  expect(report).toMatchObject({ result: "STOP", explanationSucceeded: false, gate0: "OPEN", f9Qualified: false, trainingReady: false });
  expect(JSON.stringify(report)).not.toContain("PRIVATE");
  expect(JSON.stringify(report)).not.toContain("\u001b");
});

test("black-box fake provider receives only the frozen exec plan", () => {
  const result = invoke();
  expect(result.status).toBe(0);
  expect(result.report.result).toBe("PASS");
  expect(result.report.gate0).toBe("OPEN");
  expect(JSON.parse(fs.readFileSync(calls, "utf8"))).toEqual(buildVerificationPlan({ ...options, sbx }).argv.slice(1));
});

test("black-box missing guest tool is reported without leaking provider diagnostics", () => {
  const result = invoke({ output: protocol(["zig"]), code: 2 });
  expect(result.status).toBe(2);
  expect(result.report.missingTools).toEqual(["zig"]);
  expect(result.report.error).toBe("TOOLS_MISSING");
});

test.each(["stderr", "overflow"])("black-box %s refuses and withholds raw output", (mode) => {
  const result = invoke({ mode });
  expect(result.status).toBe(2);
  expect(result.report.result).toBe("STOP");
  expect(result.stdout).not.toContain("PRIVATE");
  expect(result.stdout).not.toContain("x".repeat(100));
});

test("missing, directory, nonexecutable and symlink host controllers refuse before spawn", async () => {
  const link = join(root, "link");
  const plain = join(root, "plain");
  fs.symlinkSync(sbx, link);
  fs.writeFileSync(plain, "not executable", { mode: 0o600 });
  for (const path of [join(root, "absent"), root, plain, link]) {
    let executed = false;
    const report = await verifySbx(args("--confirm-dev-verification", { ...options, sbx: path }), { execute: async () => { executed = true; return completed(); } });
    expect(report.error).toBe("INVALID_EXECUTABLE");
    expect(report.result).toBe("STOP");
    expect(executed).toBe(false);
  }
});

function guestFixture({ missing = [], exit = 0, profiled = false } = {}) {
  const toolRoot = join(root, "scoped-tools");
  const bin = profiled ? join(toolRoot, "rust/bin") : join(root, "bin");
  const repo = join(root, "repo with space and 'quote");
  const invocation = join(root, "mise-invocation.json");
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(repo);
  for (const tool of guestTools) {
    if (missing.includes(tool)) continue;
    fs.writeFileSync(join(bin, tool), tool === "mise" ? `#!${process.execPath}
import fs from "node:fs";
fs.writeFileSync(${JSON.stringify(invocation)}, JSON.stringify({ argv: process.argv.slice(2), autoInstall: process.env.MISE_AUTO_INSTALL, cwd: process.cwd()${profiled ? ", home: process.env.HOME, miseData: process.env.MISE_DATA_DIR" : ""} }), { flag: "wx" });
console.log("PRIVATE_TASK_OUTPUT\\u001b[31m RESULT=FORGED");
console.error("PRIVATE_TASK_ERROR");
process.exitCode = ${exit};
` : "#!/bin/sh\nexit 93\n", { mode: 0o700 });
  }
  const report = "/approved/report with 'quote.json";
  const result = spawnSync("/bin/sh", ["-c", profiled ? profiledGuestVerificationScript : guestVerificationScript, "sh", repo, report, ...(profiled ? [toolRoot] : [])], {
    env: { PATH: profiled ? "/nonexistent" : bin }, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", timeout: 5000,
  });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.stderr).toBe("");
  return { result, repo, report, invocation, toolRoot };
}

test("fixed guest script uses positional paths, disables auto-install and hides task output", () => {
  const { result, repo, report, invocation } = guestFixture();
  expect(result.status).toBe(0);
  expect(parseGuestVerification(result.stdout).result).toBe("EXPLAIN_SUCCEEDED");
  expect(JSON.parse(fs.readFileSync(invocation, "utf8"))).toEqual({ argv: ["run", "f9:explain", "--report", report], autoInstall: "false", cwd: repo });
  expect(result.stdout).not.toContain("PRIVATE");
  expect(result.stdout).not.toContain("FORGED");
});

test("fixed guest script reports all missing tools and never invokes mise", () => {
  const { result, invocation } = guestFixture({ missing: ["clang", "zig"] });
  expect(result.status).toBe(2);
  expect(parseGuestVerification(result.stdout).missing).toEqual(["clang", "zig"]);
  expect(fs.existsSync(invocation)).toBe(false);
});

test("profiled guest script scopes tool PATH, HOME and mise data to one invocation", () => {
  const { result, invocation, toolRoot } = guestFixture({ profiled: true });
  expect(result.status).toBe(0);
  expect(parseGuestVerification(result.stdout).result).toBe("EXPLAIN_SUCCEEDED");
  expect(JSON.parse(fs.readFileSync(invocation, "utf8"))).toMatchObject({ autoInstall: "false", home: `${toolRoot}/home`, miseData: `${toolRoot}/mise-data` });
  expect(result.stdout).not.toContain("PRIVATE");
});

test("fixed guest script preserves a nonzero explainer as failure rather than a PASS marker", () => {
  const { result, invocation } = guestFixture({ exit: 2 });
  expect(result.status).toBe(2);
  expect(parseGuestVerification(result.stdout).result).toBe("EXPLAIN_FAILED");
  expect(fs.existsSync(invocation)).toBe(true);
});

test("mise verification wiring has no acquisition, prerequisite or setup dependencies", () => {
  const config = Bun.TOML.parse(fs.readFileSync(new URL("../../../mise.toml", import.meta.url), "utf8"));
  const task = config.tasks["f9:verify-sbx"];
  expect(task.run).toBe("bun --no-env-file --no-install tooling/native-ingress/f9-verify-sbx.mjs");
  expect(task.raw_args).toBe(true);
  for (const key of ["depends", "depends_post", "tools", "env"]) expect(task[key]).toBeUndefined();
  expect(config.tasks["f9:explain"].run).toBe("bun --no-env-file --no-install tooling/native-ingress/f9-explain.mjs");
  expect(config.settings.auto_install).toBe(false);
});
