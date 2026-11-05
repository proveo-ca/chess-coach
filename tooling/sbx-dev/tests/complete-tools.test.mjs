// SPEC: _spec/tooling/sbx-dev/preparation-workflow.puml
import { afterEach, beforeEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { completeProfile } from "../complete-profile.mjs";
import {
  STAGES, completeToolsPlan, downloadArtifact, main, parseCapacity, parseCompleteTools,
  parseGuestReport, parsePreflight, prepareCompleteTools, readCompleteState, runCompleteStage,
} from "../complete-tools.mjs";

const NAME = "existing-development-box";
const SBX = "/fixture/controller/sbx";
const AUTHORITY = { gate0: "OPEN", f9Qualified: false, trainingReady: false };
const SOURCES = ["complete-tools.mjs", "complete-profile.mjs", "complete-archive.mjs", "complete-guest.mjs"];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const df = (free = 32 * 1024 ** 2) => `Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/fixture ${free} 0 ${free} 0% /\n`;
const preflight = () => "DEV_SBX_PREFLIGHT_V1\nOS=Linux\nARCH=x86_64\nGLIBC=glibc 2.35\n"
  + completeProfile.baseTools.map((tool) => `TOOL_${tool}=PRESENT\n`).join("")
  + `WORKSPACE=WRITABLE\nTAR=EXECUTABLE\nXZ=EXECUTABLE\nGNU_TAR=YES\nDF_BEGIN\n${df()}DF_END\nDONE\n`;
const result = (stdout, extra = {}) => ({ ok: true, outcome: "EXIT", code: 0, signal: null, stdout, stderr: "", ...extra });
let fixture, run, statePath, dependencies, approvals, calls, requests, reserved;

beforeEach(() => {
  fixture = mkdtempSync("/tmp/opencode/dev-sbx-tools-fixture-");
  run = mkdtempSync("/tmp/opencode/dev-sbx-tools-");
  statePath = join(run, "attempt.json");
  mkdirSync(join(fixture, "sources"), { mode: 0o700 });
  for (const filename of SOURCES) writeFileSync(join(fixture, "sources", filename), `fixture ${filename}\n`, { mode: 0o600 });
  writeFileSync(join(fixture, "mise.toml"), '[settings]\nauto_install = false\n[tools]\n"core:bun" = "1.4.0"\n"core:rust" = { version = "1.95.0" }\n', { mode: 0o600 });
  approvals = []; calls = []; requests = []; reserved = false;
  dependencies = {
    sourceDirectory: join(fixture, "sources"), projectDirectory: fixture,
    createDirectory: () => run, resolveController: (path) => path ?? SBX, announce: () => {},
    confirm: async (context) => { approvals.push(context); return true; },
    execute: async (argv, bounds) => {
      const state = readCompleteState(statePath);
      expect(state.status).toBe("RECONCILE");
      expect(state.inFlightStage).toBe(approvals.at(-1).stage);
      expect(argv.includes("create")).toBe(false);
      calls.push({ argv: [...argv], bounds: { ...bounds } });
      if (argv[1] === "policy") return result("PRIVATE_POLICY_NOT_FOR_STDOUT\n");
      if (argv[0] === "/usr/bin/df") return result(df());
      if (argv[8]?.includes("DEV_SBX_PREFLIGHT_V1")) return result(preflight());
      if (argv[8]?.includes(".complete-dev-tools-v1")) {
        if (reserved) return result("PRIVATE_EXISTING_MARKER", { ok: false, code: 1 });
        reserved = true;
        return result("RESERVED\n");
      }
      throw new Error("unexpected fixture operation");
    },
    fetch: async (url, options) => {
      requests.push({ url, options });
      expect(readCompleteState(statePath).inFlightStage).toBe("acquire");
      return new Response("fixture", { headers: { "content-length": "7" } });
    },
  };
});

afterEach(() => {
  rmSync(run, { recursive: true, force: true });
  rmSync(fixture, { recursive: true, force: true });
});

async function start() {
  await expect(prepareCompleteTools({ name: NAME }, { ...dependencies, confirm: async () => false })).rejects.toThrow();
  expect(readCompleteState(statePath).nextStage).toBe("policy");
}

async function through(stage) {
  for (const current of STAGES.slice(0, STAGES.indexOf(stage) + 1)) {
    await runCompleteStage(current, { state: statePath, stage: current }, dependencies);
  }
}

function seedThroughAcquireOrCopy(includeCopy = true) {
  const state = readCompleteState(statePath), masterSha256 = sha(readFileSync(statePath));
  const acquired = { artifacts: completeProfile.artifacts.map((artifact) => ({ id: artifact.id, bytes: artifact.bytes ?? 1,
    sha256: artifact.sha256 })), bootstrap: { bytes: 4, sha256: sha(Buffer.from([127, 69, 76, 70])) } };
  let preflightSha;
  const files = [...completeProfile.artifacts.map((artifact, index) => ({
    name: `${artifact.id}.${artifact.format}`, bytes: acquired.artifacts[index].bytes, sha256: artifact.sha256,
  })), { name: "bun-bootstrap", ...acquired.bootstrap }, ...SOURCES.slice(1).map((filename) => ({
    name: filename, bytes: statSync(join(fixture, "sources", filename)).size, sha256: state.sourceBindings[filename],
  }))];
  writeFileSync(join(run, "policy.txt"), "fixture policy\n", { mode: 0o600 });
  const values = [
    { policySha256: sha("fixture policy\n"), bytes: Buffer.byteLength("fixture policy\n") }, parsePreflight(preflight()), null,
    { reserved: true }, { freeKiB: 32 * 1024 ** 2 }, acquired, { files },
  ];
  for (const [index, stage] of STAGES.slice(0, includeCopy ? 7 : 6).entries()) {
    if (stage === "accept-policy") values[index] = { policySha256: values[0].policySha256, preflightSha256: preflightSha };
    for (const kind of ["intent", "complete"]) {
      const bytes = `${JSON.stringify({ schema: "dev-sbx-complete-event-v1", kind, stage, masterSha256, data: kind === "intent" ? {} : values[index] })}\n`;
      writeFileSync(join(run, `${String(index + 1).padStart(2, "0")}-${stage}.${kind}.json`), bytes, { mode: 0o600 });
      if (stage === "preflight" && kind === "complete") preflightSha = sha(bytes);
    }
  }
  return readCompleteState(statePath);
}

function guestResult(action, state, extra = {}) {
  return { schema: "dev-sbx-complete-guest-v1", action, root: state.guestToolRoot,
    profileSha256: state.profileSha256, result: "PASS", ...AUTHORITY,
    data: action === "verify" ? { allToolsAvailable: true } : {}, ...extra };
}

test("parser accepts only explicit new targets or one next-stage selector", () => {
  expect(parseCompleteTools(["--name", NAME, "--plan"])).toEqual({ name: NAME, plan: true });
  expect(parseCompleteTools(["--state", statePath, "--stage", "copy", "--plan"])).toEqual({ state: statePath, stage: "copy", plan: true });
  expect(parseCompleteTools(["--name", NAME, "--sbx", SBX])).toEqual({ name: NAME, sbx: SBX });
  for (const argv of [[], ["--yes"], ["--name", NAME, "--yes"], [NAME], ["--name", "../box"],
    ["--name", "x\n"], ["--name", "x".repeat(65)], ["--name", NAME, "--name", NAME],
    ["--name", NAME, "--plan", "--plan"], ["--name", NAME, "--sbx", "/tmp/../bin/sbx"],
    ["--state", statePath], ["--stage", "policy"], ["--state", statePath, "--stage", "reset"],
    ["--state", statePath, "--stage", "policy", "--name", NAME], ["--state", "/tmp/attempt.json", "--stage", "policy"]]) {
    expect(() => parseCompleteTools(argv)).toThrow();
  }
});

test("complete-tools mise wiring stays independent of legacy tasks and pins", () => {
  const config = Bun.TOML.parse(readFileSync(new URL("../../../mise.toml", import.meta.url), "utf8"));
  expect(config.tasks["dev:sbx:prepare-tools"]).toMatchObject({ raw: true, raw_args: true,
    run: "bun --no-env-file --no-install tooling/sbx-dev/complete-tools.mjs" });
  expect(config.tasks["dev:sbx:prepare-tools"].depends).toBeUndefined();
  expect(config.tasks["dev:sbx:prepare"].run).toBe("bun --no-env-file --no-install tooling/sbx-dev/prepare.mjs");
  expect(config.tools["core:bun"]).toBe("1.4.0");
  expect(config.tools["core:rust"].version).toBe("1.95.0");
  expect(config.settings.auto_install).toBe(false);
});

test("lexical plans perform no controller resolution, source reads, queries, writes or downloads", async () => {
  const forbidden = () => { throw new Error("forbidden operation"); }, output = [];
  const deps = { resolveController: forbidden, createDirectory: forbidden, execute: forbidden, fetch: forbidden,
    confirm: forbidden, sourceDirectory: "/missing", projectDirectory: "/missing", output: (value) => output.push(value) };
  expect(await main(["--name", NAME, "--sbx", "/missing/sbx", "--plan"], deps)).toBe(0);
  expect(JSON.parse(output[0])).toEqual(completeToolsPlan({ name: NAME, sbx: "/missing/sbx", plan: true }));
  expect(JSON.parse(output[0])).toMatchObject({ result: "PLAN_ONLY", ...AUTHORITY,
    previewEffects: { subprocesses: false, writes: false, downloads: false, queries: false } });
  expect(readdirSync(run)).toEqual([]);
});

test("nonterminal CLI refuses before resolving a controller or allocating an attempt", async () => {
  const input = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
  const error = Object.getOwnPropertyDescriptor(process.stderr, "isTTY");
  let operations = 0;
  Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
  Object.defineProperty(process.stderr, "isTTY", { value: false, configurable: true });
  try {
    expect(await main(["--name", NAME], { resolveController: () => { operations += 1; return SBX; },
      createDirectory: () => { operations += 1; return run; }, error: () => {}, output: () => {} })).toBe(2);
    expect(operations).toBe(0);
  } finally {
    if (input) Object.defineProperty(process.stdin, "isTTY", input); else delete process.stdin.isTTY;
    if (error) Object.defineProperty(process.stderr, "isTTY", error); else delete process.stderr.isTTY;
  }
});

test("refusal retains only bookkeeping and leaves the unattempted next stage available", async () => {
  await start();
  expect(readdirSync(run)).toEqual(["attempt.json"]);
  expect(statSync(statePath).mode & 0o7777).toBe(0o600);
  const state = readCompleteState(statePath);
  expect(state).toMatchObject({ schema: "dev-sbx-complete-workflow-v1", name: NAME, sbxPath: SBX,
    status: "READY", completedStage: null, inFlightStage: null, ...AUTHORITY });
  expect(state.profileSha256).toBe(sha(JSON.stringify(completeProfile)));
  expect(state.guestToolRoot).toBe(`/home/agent/workspace/devtools-${state.attemptId}`);
  expect(Object.keys(state.sourceBindings)).toEqual(SOURCES);
  await runCompleteStage("policy", { state: statePath, stage: "policy" }, dependencies);
  expect(readCompleteState(statePath).nextStage).toBe("preflight");
  expect(calls[0]).toEqual({ argv: [SBX, "policy", "ls", "--wide", NAME], bounds: { milliseconds: 10000, cap: 65536 } });
  expect(approvals[0].prompt).not.toContain("PRIVATE_POLICY_NOT_FOR_STDOUT");
  for (const artifact of completeProfile.artifacts) {
    expect(approvals[0].prompt).toContain(artifact.url);
    expect(approvals[0].prompt).toContain(artifact.sha256);
  }
});

test("the first five stages require separate approvals and preserve all earlier event files", async () => {
  await start();
  const master = readFileSync(statePath);
  await through("host-capacity");
  expect(approvals.map(({ stage }) => stage)).toEqual(STAGES.slice(0, 5));
  expect(calls).toHaveLength(4);
  expect(calls[1].bounds).toEqual({ milliseconds: 25000, cap: 16384 });
  expect(calls[1].argv.slice(0, 8)).toEqual([SBX, "exec", NAME, "/usr/bin/timeout", "--kill-after=1s", "15s", "/bin/sh", "-c"]);
  expect(calls[2].bounds).toEqual({ milliseconds: 30000, cap: 16384 });
  expect(calls[2].argv[8]).toContain('chmod 400 "$1/.reservation"');
  expect(calls[3].argv).toEqual(["/usr/bin/df", "-Pk", run]);
  expect(readFileSync(statePath).equals(master)).toBe(true);
  expect(readCompleteState(statePath)).toMatchObject({ nextStage: "acquire", status: "READY", ...AUTHORITY });
  for (let index = 0; index < 5; index += 1) {
    for (const kind of ["intent", "complete"]) expect(statSync(join(run, `${String(index + 1).padStart(2, "0")}-${STAGES[index]}.${kind}.json`)).mode & 0o7777).toBe(0o600);
  }
  await expect(runCompleteStage("policy", { state: statePath, stage: "policy" }, dependencies)).rejects.toThrow();
  expect(calls).toHaveLength(4);
});

test("source drift during approval refuses before intent and before provider effects", async () => {
  await start();
  const confirm = async () => { writeFileSync(join(fixture, "sources", "complete-profile.mjs"), "changed fixture\n"); return true; };
  await expect(runCompleteStage("policy", { state: statePath, stage: "policy" }, { ...dependencies, confirm })).rejects.toThrow();
  expect(calls).toEqual([]);
  expect(existsSync(join(run, "01-policy.intent.json"))).toBe(false);
  expect(readCompleteState(statePath).nextStage).toBe("policy");
});

test("pin drift refuses without a provider call or automatic profile substitution", async () => {
  writeFileSync(join(fixture, "mise.toml"), '[tools]\n"core:bun" = "latest"\n');
  await expect(prepareCompleteTools({ name: NAME }, dependencies)).rejects.toThrow();
  expect(calls).toEqual([]); expect(approvals).toEqual([]); expect(readdirSync(run)).toEqual([]);
});

test("policy acknowledgement rehashes retained policy after the fresh prompt", async () => {
  await start(); await through("preflight");
  const count = calls.length;
  await expect(runCompleteStage("accept-policy", { state: statePath, stage: "accept-policy" }, { ...dependencies,
    confirm: async () => { writeFileSync(join(run, "policy.txt"), "changed policy\n"); return true; } })).rejects.toThrow();
  expect(calls).toHaveLength(count);
  expect(existsSync(join(run, "03-accept-policy.intent.json"))).toBe(false);
});

test("failed intent is terminal across repeated and later stage requests", async () => {
  await start();
  await expect(runCompleteStage("policy", { state: statePath, stage: "policy" }, { ...dependencies,
    execute: async () => result("PRIVATE_PROVIDER_FAILURE", { ok: false, code: 9 }) })).rejects.toThrow("DEV_TOOLS_STOP");
  expect(readCompleteState(statePath)).toMatchObject({ status: "RECONCILE", inFlightStage: "policy", nextStage: null });
  const count = approvals.length;
  for (const stage of ["policy", "preflight", "verify"]) await expect(runCompleteStage(stage, { state: statePath, stage }, dependencies)).rejects.toThrow();
  expect(approvals).toHaveLength(count);
  expect(existsSync(join(run, "01-policy.complete.json"))).toBe(false);
});

test("guest marker refuses a new host attempt without removing the original reservation", async () => {
  await start(); await through("reserve");
  const original = run;
  run = mkdtempSync("/tmp/opencode/dev-sbx-tools-"); statePath = join(run, "attempt.json");
  try {
    await start(); await through("accept-policy");
    await expect(runCompleteStage("reserve", { state: statePath, stage: "reserve" }, dependencies)).rejects.toThrow();
    expect(readCompleteState(statePath).status).toBe("RECONCILE");
    expect(calls.at(-1).argv[8]).toContain("mkdir -m 700 \"$marker\"");
    expect(calls.at(-1).argv[8]).not.toContain("rm ");
  } finally { rmSync(original, { recursive: true, force: true }); }
});

test("acquisition stays pinned, retains failure artifacts and never copies after a failed download", async () => {
  await start(); await through("host-capacity");
  await expect(runCompleteStage("acquire", { state: statePath, stage: "acquire" }, dependencies)).rejects.toThrow();
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe(completeProfile.artifacts[0].url);
  expect(requests[0].options).toMatchObject({ method: "GET", redirect: "manual" });
  expect(existsSync(join(run, "bun.zip"))).toBe(true);
  expect(readCompleteState(statePath).status).toBe("RECONCILE");
  await expect(runCompleteStage("copy", { state: statePath, stage: "copy" }, dependencies)).rejects.toThrow();
  expect(calls.some(({ argv }) => argv[1] === "cp")).toBe(false);
});

test("copy failure retains its intent and snapshots directory without executing a guest helper", async () => {
  await start(); seedThroughAcquireOrCopy(false);
  writeFileSync(join(run, "bun.zip"), "tiny fixture, not an archive", { mode: 0o400 });
  await expect(runCompleteStage("copy", { state: statePath }, dependencies)).rejects.toThrow();
  expect(approvals.at(-1).prompt.split(" -> ")).toHaveLength(10);
  expect(approvals.at(-1).prompt).not.toContain(`${NAME}:/home/agent/workspace/complete-tools.mjs`);
  expect(existsSync(join(run, "snapshots"))).toBe(true);
  expect(readCompleteState(statePath)).toMatchObject({ status: "RECONCILE", inFlightStage: "copy" });
  await expect(runCompleteStage("inspect", { state: statePath }, dependencies)).rejects.toThrow();
  expect(calls).toEqual([]);
});

test("inspect install and verify each execute one exact hash-bound helper and seal only a narrow receipt", async () => {
  await start(); seedThroughAcquireOrCopy();
  const output = [], execute = async (argv, bounds) => {
    const state = readCompleteState(statePath), action = argv.at(-1);
    expect(state.inFlightStage).toBe(action);
    expect(approvals.at(-1).stage).toBe(action);
    expect(argv.slice(0, 8)).toEqual([SBX, "exec", NAME, "/usr/bin/timeout", "--kill-after=2s", "1200s", "/bin/sh", "-c"]);
    expect(argv[8]).toContain("exec 3<");
    expect(argv[8]).toContain("chmod 500 /proc/self/fd/3");
    expect(argv[8]).toContain("exec /proc/self/fd/3 --no-env-file --no-install");
    expect(argv[8]).not.toContain("install.sh");
    expect(argv.slice(10)).toEqual([state.guestToolRoot, state.profileSha256,
      state.events.find(({ stage }) => stage === "acquire").data.bootstrap.sha256,
      ...SOURCES.slice(1).map((filename) => state.sourceBindings[filename]), action]);
    expect(bounds).toEqual({ milliseconds: 1210000, cap: 65536, graceMilliseconds: 1000 });
    calls.push({ argv, bounds });
    return result(JSON.stringify(guestResult(action, state)));
  };
  for (const stage of ["inspect", "install"]) await runCompleteStage(stage, { state: statePath }, { ...dependencies, execute });
  expect(await main(["--state", statePath, "--stage", "verify"], { ...dependencies, execute, output: (value) => output.push(value) })).toBe(0);
  expect(approvals.map(({ stage }) => stage)).toEqual(["inspect", "install", "verify"]);
  expect(calls).toHaveLength(3);
  expect(JSON.parse(output[0])).toMatchObject({ developmentToolsPrepared: true, explanation: "NOT_RUN",
    statePath, target: NAME, ...AUTHORITY, result: "DEV_TOOLS_READY" });
  expect(statSync(join(run, "receipt.json")).mode & 0o7777).toBe(0o400);
  expect(readCompleteState(statePath)).toMatchObject({ completedStage: "verify", nextStage: null, ...AUTHORITY });
  await expect(runCompleteStage("verify", { state: statePath }, dependencies)).rejects.toThrow();
});

test("guest stderr or mismatched report context retains intent without promoting readiness", async () => {
  await start(); seedThroughAcquireOrCopy();
  const execute = async () => result(JSON.stringify(guestResult("inspect", readCompleteState(statePath))), { stderr: "PRIVATE_GUEST_ERROR" });
  await expect(runCompleteStage("inspect", { state: statePath }, { ...dependencies, execute })).rejects.toThrow("DEV_TOOLS_STOP");
  expect(readCompleteState(statePath)).toMatchObject({ status: "RECONCILE", inFlightStage: "inspect" });
  expect(existsSync(join(run, "receipt.json"))).toBe(false);
});

test("preflight accepts only the fixed Linux/x86_64/GNU metadata protocol and resource floor", () => {
  expect(parsePreflight(preflight())).toMatchObject({ os: "Linux", arch: "x86_64", glibc: "2.35", freeKiB: 32 * 1024 ** 2 });
  for (const output of [preflight().replace("OS=Linux", "OS=Darwin"), preflight().replace("ARCH=x86_64", "ARCH=aarch64"),
    preflight().replace("glibc 2.35", "glibc 2.17"), preflight().replace("glibc 2.35", "musl 1.2"),
    preflight().replace("TOOL_node=PRESENT", "TOOL_node=MISSING"), preflight().replace("GNU_TAR=YES", "GNU_TAR=NO"),
    preflight().replace("XZ=EXECUTABLE", "XZ=MISSING"), preflight().replace("WORKSPACE=WRITABLE", "WORKSPACE=NO"),
    preflight().replace(df(), df(24 * 1024 ** 2 - 1)), preflight() + "EXTRA\n", preflight().replace("DONE", "DONE\0")]) {
    expect(() => parsePreflight(output)).toThrow();
  }
  expect(parseCapacity(df(10 * 1024 ** 2), 10 * 1024 ** 2)).toEqual({ freeKiB: 10 * 1024 ** 2 });
  expect(() => parseCapacity(df(10 * 1024 ** 2 - 1), 10 * 1024 ** 2)).toThrow();
});

function fixtureArtifact(bytes = Buffer.from("fixture body")) {
  return { id: "fixture", version: "1", url: "https://example.invalid/artifact", sha256: sha(bytes), bytes: bytes.length };
}

function response(bytes, headers = {}) {
  return new Response(new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }), { headers });
}

test("standalone download fixtures stream, validate and seal without weakening public profiles", async () => {
  const bytes = Buffer.from("fixture body"), artifact = fixtureArtifact(bytes), observed = [];
  const output = await downloadArtifact(artifact, join(run, "fixture-download"), { fetch: async (url, options) => {
    observed.push({ url, options }); return response(bytes, { "content-length": String(bytes.length) });
  } });
  expect(output).toEqual({ bytes: bytes.length, sha256: sha(bytes) });
  expect(statSync(join(run, "fixture-download")).mode & 0o7777).toBe(0o400);
  expect(observed[0].options.method).toBe("GET");
  expect(observed[0].options.redirect).toBe("manual");
  expect(completeProfile.artifacts[0].bytes).toBe(36697583);
});

test("download rejects wrong digest, size and caps while retaining exclusive partial files", async () => {
  const bytes = Buffer.from("fixture body");
  const cases = [
    { artifact: { ...fixtureArtifact(bytes), sha256: "a".repeat(64) } },
    { artifact: { ...fixtureArtifact(bytes), bytes: bytes.length + 1 } },
    { artifact: fixtureArtifact(bytes), limits: { archiveBytes: bytes.length - 1, totalArchiveBytes: 100 } },
    { artifact: { ...fixtureArtifact(bytes), bytes: null }, remainingBytes: bytes.length - 1 },
    { artifact: fixtureArtifact(bytes), headers: { "content-length": "1" } },
  ];
  for (const [index, item] of cases.entries()) {
    const destination = join(run, `failed-${index}`);
    await expect(downloadArtifact(item.artifact, destination, { ...item, fetch: async () => response(bytes, item.headers) })).rejects.toThrow("DEV_TOOLS_STOP");
    expect(existsSync(destination)).toBe(true);
    expect(statSync(destination).mode & 0o7777).toBe(0o600);
  }
});

test("download permits only bounded explicit HTTPS redirects and never stores signed locations", async () => {
  const bytes = Buffer.from("fixture body"), artifact = fixtureArtifact(bytes), requested = [];
  await downloadArtifact(artifact, join(run, "redirect-ok"), { fetch: async (url) => {
    requested.push(url);
    return requested.length === 1 ? new Response(null, { status: 302,
      headers: { location: "https://release-assets.githubusercontent.com/file?secret=SIGNED" } }) : response(bytes);
  } });
  expect(requested).toHaveLength(2);
  expect(readFileSync(join(run, "redirect-ok")).equals(bytes)).toBe(true);
  for (const [index, location] of ["http://example.invalid/file", "https://evil.invalid/file", "https://example.invalid:444/file", "https://user:pass@example.invalid/file"].entries()) {
    let requests = 0;
    await expect(downloadArtifact(artifact, join(run, `redirect-bad-${index}`), { fetch: async () => {
      requests += 1; return new Response(null, { status: 302, headers: { location } });
    } })).rejects.toThrow("DEV_TOOLS_STOP");
    expect(requests).toBe(1);
  }
  let redirects = 0;
  await expect(downloadArtifact(artifact, join(run, "redirect-limit"), { fetch: async () => {
    redirects += 1; return new Response(null, { status: 302, headers: { location: "/again" } });
  } })).rejects.toThrow();
  expect(redirects).toBe(4);
});

test("expired acquisition deadlines cause no fetch and no retry", async () => {
  let requests = 0;
  await expect(downloadArtifact(fixtureArtifact(), join(run, "expired"), { deadline: 1, now: () => 2,
    fetch: async () => { requests += 1; return response(Buffer.from("fixture body")); } })).rejects.toThrow();
  expect(requests).toBe(0);
});

test("guest reports require exact action/root/profile and never forward extra authority or private data", () => {
  const state = { guestToolRoot: "/home/agent/workspace/devtools-0123456789abcdef", profileSha256: sha(JSON.stringify(completeProfile)) };
  const report = { schema: "dev-sbx-complete-guest-v1", action: "verify", root: state.guestToolRoot,
    profileSha256: state.profileSha256, result: "PASS", ...AUTHORITY,
    data: { allToolsAvailable: true, versions: { bun: "1.4.0" }, privateExtra: "PRIVATE_GUEST_TEXT" } };
  const parsed = parseGuestReport(JSON.stringify(report), "verify", state);
  expect(parsed.data).toEqual({ allToolsAvailable: true });
  expect(JSON.stringify(parsed)).not.toContain("PRIVATE_GUEST_TEXT");
  for (const changed of [{ ...report, action: "install" }, { ...report, root: "/tmp/alias" },
    { ...report, profileSha256: "a".repeat(64) }, { ...report, gate0: "CLOSED" }, { ...report, f9Qualified: true },
    { ...report, profileSha256: undefined, profileSha: state.profileSha256 },
    { ...report, trainingReady: true }, { ...report, result: "STOP" }, { ...report, extra: true },
    { ...report, data: {} }, { ...report, data: { allToolsAvailable: true, nested: { trainingReady: true } } }]) {
    expect(() => parseGuestReport(JSON.stringify(changed), "verify", state)).toThrow();
  }
});

test("invalid state/event bindings refuse instead of choosing another source or attempt", async () => {
  await start();
  const raw = readFileSync(statePath, "utf8"), master = JSON.parse(raw);
  for (const replacement of [{ ...master, profileSha256: "a".repeat(64) }, { ...master, guestToolRoot: "/tmp/root" },
    { ...master, trainingReady: true }, { ...master, sourceBindings: {} }, { ...master, unexpected: true }]) {
    writeFileSync(statePath, JSON.stringify(replacement));
    expect(() => readCompleteState(statePath)).toThrow();
  }
  writeFileSync(statePath, raw);
  writeFileSync(join(run, "02-preflight.intent.json"), JSON.stringify({ schema: "dev-sbx-complete-event-v1",
    kind: "intent", stage: "preflight", masterSha256: sha(raw), data: {} }), { mode: 0o600 });
  expect(() => readCompleteState(statePath)).toThrow();
  expect(calls).toEqual([]);
});

test("CLI withholds provider errors and never claims readiness after a failed stage", async () => {
  const output = [], errors = [];
  expect(await main(["--name", NAME], { ...dependencies, output: (value) => output.push(value), error: (value) => errors.push(value),
    execute: async () => { throw new Error("PRIVATE_PROVIDER_SECRET signed-location"); } })).toBe(2);
  expect(output).toEqual([]);
  expect(errors.join("\n")).not.toContain("PRIVATE_PROVIDER_SECRET");
  expect(errors.join("\n")).not.toContain("signed-location");
  expect(errors.join("\n")).toContain("Gate0=OPEN");
  expect(errors.join("\n")).not.toContain("DEV_TOOLS_READY");
});
