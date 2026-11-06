// SPEC: _spec/tooling/sbx-dev/preparation-workflow.puml
import { afterEach, beforeEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runBounded } from "../../native-ingress/f9-diagnose.mjs";
import { completeProfile } from "../complete-profile.mjs";
import {
  STAGES, completeToolsFailure, completeToolsPlan, downloadArtifact, main, parseCapacity, parseCompleteTools,
  parseGuestReport, parsePreflight, parsePreflightTransport, prepareCompleteTools, readCompleteState, runCompleteStage, runPreflightTrace,
} from "../complete-tools.mjs";

const NAME = "existing-development-box";
const SBX = "/fixture/controller/sbx";
const AUTHORITY = { gate0: "OPEN", f9Qualified: false, trainingReady: false };
const TRANSPORT_MARKER = "DEV_SBX_PREFLIGHT_TRANSPORT_V1\n";
const TRANSPORT = { schema: "dev-sbx-preflight-transport-v1", marker: TRANSPORT_MARKER,
  stdout: "GUEST_PROTOCOL_AND_DIAGNOSTICS", stderr: "OUTER_DIAGNOSTICS", origin: "UNATTRIBUTED" };
const PREFLIGHT_WRAPPER = "exec 2>&1\nset -eu\nprintf 'DEV_SBX_PREFLIGHT_TRANSPORT_V1\\n'\n"
  + 'exec /usr/bin/timeout --kill-after=1s 15s /bin/sh -c "$1" sh\n';
const CAPTURE_FILES = ["02-preflight.stdout.bin", "02-preflight.stderr.bin", "02-preflight.transport.json"];
const SOURCES = ["complete-tools.mjs", "complete-profile.mjs", "complete-archive.mjs", "complete-guest.mjs"];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const df = (free = 32 * 1024 ** 2) => `Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/fixture ${free} 0 ${free} 0% /\n`;
const preflight = () => "DEV_SBX_PREFLIGHT_V1\nOS=Linux\nARCH=x86_64\nGLIBC=glibc 2.35\n"
  + completeProfile.baseTools.map((tool) => `TOOL_${tool}=PRESENT\n`).join("")
  + `WORKSPACE=WRITABLE\nTAR=EXECUTABLE\nXZ=EXECUTABLE\nGNU_TAR=YES\nDF_BEGIN\n${df()}DF_END\nDONE\n`;
const transportedPreflight = (metadata = preflight()) => TRANSPORT_MARKER + metadata;
const result = (stdout, extra = {}) => ({ ok: true, outcome: "EXIT", code: 0, signal: null, stdout, stderr: "", ...extra });
let fixture, run, statePath, dependencies, approvals, calls, requests, reserved, traceDirectory;

beforeEach(() => {
  fixture = mkdtempSync("/tmp/opencode/dev-sbx-tools-fixture-");
  run = mkdtempSync("/tmp/opencode/dev-sbx-tools-");
  statePath = join(run, "attempt.json");
  mkdirSync(join(fixture, "sources"), { mode: 0o700 });
  for (const filename of SOURCES) writeFileSync(join(fixture, "sources", filename), `fixture ${filename}\n`, { mode: 0o600 });
  writeFileSync(join(fixture, "mise.toml"), '[settings]\nauto_install = false\n[tools]\n"core:bun" = "1.4.0"\n"core:rust" = { version = "1.95.0" }\n', { mode: 0o600 });
  approvals = []; calls = []; requests = []; reserved = false;
  traceDirectory = null;
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
      if (argv[3] === "/bin/sh" && argv[5] === PREFLIGHT_WRAPPER && argv[7]?.includes("DEV_SBX_PREFLIGHT_V1")) {
        expectPreflightOperation(argv, bounds);
        expectEmptyCaptures(run, CAPTURE_FILES.slice(0, 2));
        expect(existsSync(join(run, CAPTURE_FILES[2]))).toBe(false);
        return rawResult();
      }
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
  if (traceDirectory) rmSync(traceDirectory, { recursive: true, force: true });
  rmSync(run, { recursive: true, force: true });
  rmSync(fixture, { recursive: true, force: true });
});

function traceOptions(extra = {}) {
  return { tracePreflight: true, sbx: SBX, name: NAME, ...extra };
}

function rawResult(stdout = Buffer.from(transportedPreflight()), stderr = Buffer.alloc(0), extra = {}) {
  return { ok: true, outcome: "EXIT", code: 0, signal: null, elapsedMs: 1,
    bytes: stdout.length + stderr.length, stdout, stderr, ...extra };
}

function expectPreflightOperation(argv, bounds, sbx = SBX) {
  expect(argv).toHaveLength(8);
  expect(argv.slice(0, 7)).toEqual([sbx, "exec", NAME, "/bin/sh", "-c", PREFLIGHT_WRAPPER, "sh"]);
  expect(argv[7]).toContain("printf 'DEV_SBX_PREFLIGHT_V1\\n'");
  expect(argv[7]).not.toContain("SYNTHETIC_CALLER_COMMAND");
  if (bounds) expect(bounds).toEqual({ milliseconds: 25000, cap: 16384, encoding: "buffer" });
}

function expectEmptyCaptures(directory, filenames) {
  for (const filename of filenames) {
    const info = statSync(join(directory, filename));
    expect(info.mode & 0o7777).toBe(0o600);
    expect(info.nlink).toBe(1);
    expect(info.size).toBe(0);
  }
}

function normalCapture() {
  return JSON.parse(readFileSync(join(run, CAPTURE_FILES[2]), "utf8"));
}

function expectNormalCapture(stdout, stderr) {
  expect(readFileSync(join(run, CAPTURE_FILES[0]))).toEqual(stdout);
  expect(readFileSync(join(run, CAPTURE_FILES[1]))).toEqual(stderr);
  for (const filename of CAPTURE_FILES) {
    expect(statSync(join(run, filename)).mode & 0o7777).toBe(0o600);
    expect(statSync(join(run, filename)).nlink).toBe(1);
  }
  const state = readCompleteState(statePath), report = normalCapture();
  expect(report).toMatchObject({ schema: "dev-sbx-preflight-capture-v1", transport: TRANSPORT,
    target: NAME, masterSha256: state.masterSha256, profileSha256: state.profileSha256, result: "STOP", ...AUTHORITY });
  expect(report.transport).toEqual(TRANSPORT);
  expect(report.streams.stdout).toMatchObject({ path: join(run, CAPTURE_FILES[0]), retainedBytes: stdout.length, sha256: sha(stdout) });
  expect(report.streams.stderr).toMatchObject({ path: join(run, CAPTURE_FILES[1]), retainedBytes: stderr.length, sha256: sha(stderr) });
  return report;
}

function traceDependencies(reply = rawResult(), extra = {}) {
  traceDirectory = mkdtempSync("/tmp/opencode/dev-sbx-trace-");
  const runnerSourcePath = join(fixture, "runner-source.mjs");
  writeFileSync(runnerSourcePath, "SYNTHETIC_RUNNER_SOURCE_NOT_EXECUTED\n", { mode: 0o600 });
  return { ...dependencies, runnerSourcePath, createTraceDirectory: () => traceDirectory,
    execute: async (argv, bounds) => {
      expect(existsSync(join(traceDirectory, "intent.json"))).toBe(true);
      expectEmptyCaptures(traceDirectory, ["stdout.bin", "stderr.bin"]);
      expect(existsSync(join(traceDirectory, "report.json"))).toBe(false);
      expectPreflightOperation(argv, bounds);
      calls.push({ argv: [...argv], bounds: { ...bounds } });
      return reply;
    }, ...extra };
}

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

function failureFrom(action) {
  let failure;
  try { action(); } catch (error) { failure = error; }
  expect(failure).toBeDefined();
  expect(failure.message).toBe("DEV_TOOLS_STOP");
  return completeToolsFailure(failure);
}

async function failedPreflight(execute) {
  await start();
  await through("policy");
  const output = [], errors = [];
  const exit = await main(["--state", statePath, "--stage", "preflight"], { ...dependencies, execute,
    output: (value) => output.push(value), error: (value) => errors.push(value) });
  expect(exit).toBe(2);
  expect(output).toEqual([]);
  expect(errors).toHaveLength(2);
  expect(errors[0]).toBe("DEV_TOOLS_STOP; retain attempt files and guest reservation; reconcile in-flight stages; never retry an attempted stage or remove reservations; Gate0=OPEN; f9Qualified=false; trainingReady=false.");
  expect(Buffer.byteLength(errors[1])).toBeLessThanOrEqual(4096);
  const diagnostic = JSON.parse(errors[1]);
  expect(diagnostic).toMatchObject({ schema: "dev-sbx-complete-failure-v1", result: "DEV_TOOLS_STOP",
    stage: "preflight", phase: "EFFECT", ...AUTHORITY });
  expect(readCompleteState(statePath)).toMatchObject({ status: "RECONCILE", inFlightStage: "preflight", nextStage: null });
  expect(existsSync(join(run, "02-preflight.intent.json"))).toBe(true);
  expect(existsSync(join(run, "02-preflight.complete.json"))).toBe(false);
  expect(existsSync(join(run, "receipt.json"))).toBe(false);
  expect(requests).toEqual([]);
  const count = approvals.length;
  await expect(runCompleteStage("preflight", { state: statePath }, dependencies)).rejects.toThrow("DEV_TOOLS_STOP");
  await expect(runCompleteStage("accept-policy", { state: statePath }, dependencies)).rejects.toThrow("DEV_TOOLS_STOP");
  expect(approvals).toHaveLength(count);
  return { diagnostic, errors };
}

test("trace parsing is isolated from preparation state, stages and output overrides", () => {
  expect(parseCompleteTools(["--trace-preflight", "--sbx", SBX, "--name", NAME, "--plan"]))
    .toEqual(traceOptions({ plan: true }));
  for (const argv of [
    ["--trace-preflight", "--name", NAME],
    ["--trace-preflight", "--sbx", SBX, "--name", NAME, "--state", statePath],
    ["--trace-preflight", "--sbx", SBX, "--name", NAME, "--stage", "preflight"],
    ["--trace-preflight", "--sbx", SBX, "--name", NAME, "--trace-preflight"],
    ["--trace-preflight", "--sbx", SBX, "--name", NAME, "--output", "/tmp/PRIVATE"],
  ]) expect(() => parseCompleteTools(argv)).toThrow();
});

test("trace plans require no controller, source, trace directory, state or provider access", async () => {
  const forbidden = () => { throw new Error("UNEXPECTED_ACCESS"); }, output = [];
  expect(await main(["--trace-preflight", "--sbx", "/missing/sbx", "--name", NAME, "--plan"], {
    resolveController: forbidden, createTraceDirectory: forbidden, confirm: forbidden, execute: forbidden,
    sourceDirectory: "/missing", runnerSourcePath: "/missing", output: (value) => output.push(value),
  })).toBe(0);
  const plan = JSON.parse(output[0]);
  expect(plan).toMatchObject({ schema: "dev-sbx-preflight-trace-plan-v2", result: "PLAN_ONLY", transport: TRANSPORT, ...AUTHORITY,
    traceDirectory: "ALLOCATED_AT_EXECUTION", freshApproval: true,
    previewEffects: { subprocesses: false, writes: false, downloads: false, queries: false } });
  expect(plan.operation).toMatchObject({ milliseconds: 25000, cap: 16384 });
  expect(plan.transport).toEqual(TRANSPORT);
  expectPreflightOperation(plan.operation.argv, undefined, "/missing/sbx");
  expect(readdirSync(run)).toEqual([]);
});

test("private trace retains arbitrary outer stderr bytes without treating them as guest protocol", async () => {
  const stderr = Buffer.concat([Buffer.from("SYNTHETIC_STARTED_NOTICE\0\u001b[31m\n"), Buffer.from([0xff, 0x80])]);
  const stdout = Buffer.from(transportedPreflight());
  const deps = traceDependencies(rawResult(stdout, stderr)), output = [];
  expect(await main(["--trace-preflight", "--sbx", SBX, "--name", NAME], {
    ...deps, output: (value) => output.push(value),
  })).toBe(0);
  const report = JSON.parse(output[0]);
  expect(report).toMatchObject({ schema: "dev-sbx-preflight-trace-v2", transport: TRANSPORT,
    traceComplete: true, origin: "UNATTRIBUTED", result: "STOP", ...AUTHORITY,
    stdoutProtocol: { status: "METADATA_CHECKS_MET" },
    preflightGuard: { status: "METADATA_CHECKS_MET", failures: [] } });
  expect(report.transport).toEqual(TRANSPORT);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toEqual({ argv: completeToolsPlan(traceOptions()).operation.argv,
    bounds: { milliseconds: 25000, cap: 16384, encoding: "buffer" } });
  expect(approvals.map(({ stage }) => stage)).toEqual(["trace-preflight"]);
  expect(approvals[0].prompt).toContain("Exactly one fixed sbx exec");
  expect(approvals[0].prompt).toContain(TRANSPORT_MARKER.trimEnd());
  expect(approvals[0].prompt).toContain("GUEST_PROTOCOL_AND_DIAGNOSTICS");
  expect(approvals[0].prompt).toContain("OUTER_DIAGNOSTICS");
  expect(approvals[0].prompt).toContain("UNATTRIBUTED");
  expect(approvals[0].prompt).not.toContain("SYNTHETIC_STARTED_NOTICE");
  expect(JSON.parse(approvals[0].prompt.split("\n").find((line) => line.startsWith("TRANSPORT=")).slice("TRANSPORT=".length))).toEqual(TRANSPORT);
  expect(JSON.parse(approvals[0].prompt.split("\n").find((line) => line.startsWith("OPERATION=")).slice("OPERATION=".length)))
    .toEqual(completeToolsPlan(traceOptions()).operation);
  const intent = JSON.parse(readFileSync(join(traceDirectory, "intent.json"), "utf8"));
  expect(intent).toMatchObject({ schema: "dev-sbx-preflight-trace-intent-v2", transport: TRANSPORT,
    operation: completeToolsPlan(traceOptions()).operation, ...AUTHORITY });
  expect(intent.transport).toEqual(TRANSPORT);
  expect(readFileSync(report.streams.stdout.path)).toEqual(stdout);
  expect(readFileSync(report.streams.stderr.path)).toEqual(stderr);
  expect(report.streams.stderr.sha256).toBe(sha(stderr));
  expect(report.execution).toMatchObject({ commandSucceeded: true, observedBytes: stdout.length + stderr.length,
    retainedBytes: stdout.length + stderr.length, truncated: false });
  expect(statSync(traceDirectory).mode & 0o7777).toBe(0o700);
  expect(readdirSync(traceDirectory).sort()).toEqual(["intent.json", "report.json", "stderr.bin", "stdout.bin"]);
  for (const filename of readdirSync(traceDirectory)) {
    expect(statSync(join(traceDirectory, filename)).mode & 0o7777).toBe(0o600);
    expect(statSync(join(traceDirectory, filename)).nlink).toBe(1);
  }
  expect(JSON.parse(readFileSync(join(traceDirectory, "report.json"), "utf8"))).toEqual(report);
  expect(output.join("\n")).not.toContain("SYNTHETIC_STARTED_NOTICE");
  expect(output.join("\n")).not.toContain("\ufffd");
  expect(readdirSync(run)).toEqual([]);
});

test("trace byte fidelity includes invalid UTF-8 without lossy digest conversion", async () => {
  const stdout = Buffer.from([0xff, 0xfe, 0, 27, 65]), stderr = Buffer.from([0x80, 0, 27, 66]);
  const report = await runPreflightTrace(traceOptions(), traceDependencies(rawResult(stdout, stderr)));
  expect(readFileSync(report.streams.stdout.path)).toEqual(stdout);
  expect(readFileSync(report.streams.stderr.path)).toEqual(stderr);
  expect(report.streams.stdout.sha256).toBe(sha(stdout));
  expect(report.streams.stderr.sha256).toBe(sha(stderr));
  expect(report.stdoutProtocol).toEqual({ status: "INVALID", failures: [{ check: "PROTOCOL", code: "PROTOCOL_INVALID" }] });
  expect(report.preflightGuard.status).toBe("STOP");
});

test.each(["TIMEOUT", "OUTPUT_LIMIT", "INTERRUPTED", "STREAM_ERROR", "INCOMPLETE_STREAM"])("trace retains capped partial bytes after %s", async (outcome) => {
  const stdout = Buffer.alloc(outcome === "OUTPUT_LIMIT" ? 16377 : 32, 255), stderr = Buffer.alloc(7, 0);
  const reply = rawResult(stdout, stderr, { ok: false, outcome, code: null, signal: "SIGKILL",
    bytes: outcome === "OUTPUT_LIMIT" ? 17000 : stdout.length + stderr.length });
  const report = await runPreflightTrace(traceOptions(), traceDependencies(reply));
  expect(readFileSync(report.streams.stdout.path)).toEqual(stdout);
  expect(readFileSync(report.streams.stderr.path)).toEqual(stderr);
  expect(report.execution.truncated).toBe(outcome === "OUTPUT_LIMIT");
  expect(report.execution.retainedBytes).toBe(stdout.length + stderr.length);
  expect(report.stdoutProtocol.status).toBe("NOT_EVALUATED");
  expect(report.preflightGuard).toEqual({ status: "STOP", failures: [{ check: "COMMAND", code: outcome }] });
  expect(calls).toHaveLength(1);
});

test("trace capture success does not declare readiness even with clean complete stdout", async () => {
  const report = await runPreflightTrace(traceOptions(), traceDependencies());
  expect(report.stdoutProtocol.status).toBe("METADATA_CHECKS_MET");
  expect(report.preflightGuard).toEqual({ status: "METADATA_CHECKS_MET", failures: [] });
  expect(report).toMatchObject({ result: "STOP", traceComplete: true, ...AUTHORITY });
});

test.each([
  ["legacy metadata", () => Buffer.from(preflight())],
  ["marker only", () => Buffer.from(TRANSPORT_MARKER)],
  ["CRLF transport marker", () => Buffer.from(TRANSPORT_MARKER.replace("\n", "\r\n") + preflight())],
  ["leading junk", () => Buffer.from(`SYNTHETIC_LEADING_JUNK\n${transportedPreflight()}`)],
  ["leading status", () => Buffer.from(`SYNTHETIC_STARTED_NOTICE\n${transportedPreflight()}`)],
  ["extra guest diagnostic", () => Buffer.from(`${transportedPreflight()}SYNTHETIC_GUEST_DIAGNOSTIC\n`)],
  ["interleaved guest diagnostic", () => Buffer.from(transportedPreflight().replace("OS=Linux\n", "OS=Linux\nSYNTHETIC_GUEST_DIAGNOSTIC\n"))],
  ["duplicate marker", () => Buffer.from(TRANSPORT_MARKER + transportedPreflight())],
  ["trailing marker", () => Buffer.from(transportedPreflight() + TRANSPORT_MARKER)],
  ["byte-zero BOM", () => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(transportedPreflight())])],
  ["metadata BOM", () => Buffer.from(TRANSPORT_MARKER + "\ufeff" + preflight())],
  ["invalid UTF-8", () => Buffer.concat([Buffer.from(transportedPreflight()), Buffer.from([0xff])])],
  ["invalid UTF-8 inside metadata", () => Buffer.concat([Buffer.from(TRANSPORT_MARKER + "DEV_SBX_PREFLIGHT_V1\nOS="), Buffer.from([0xc0, 0xaf]), Buffer.from("\n")])],
  ["invalid UTF-8 in df label", () => {
    const [before, after] = transportedPreflight().split("/dev/fixture");
    return Buffer.concat([Buffer.from(`${before}/dev/`), Buffer.from([0xff]), Buffer.from(after)]);
  }],
])("transport parser and trace reject %s without filtering guest output", async (_label, bytes) => {
  const stdout = bytes();
  expect(failureFrom(() => parsePreflightTransport(stdout)).failures).toEqual([{ check: "PROTOCOL", code: "PROTOCOL_INVALID" }]);
  const report = await runPreflightTrace(traceOptions(), traceDependencies(rawResult(stdout, Buffer.from("SYNTHETIC_OUTER_STATUS\n"))));
  expect(report.stdoutProtocol).toEqual({ status: "INVALID", failures: [{ check: "PROTOCOL", code: "PROTOCOL_INVALID" }] });
  expect(report.preflightGuard).toEqual({ status: "STOP", failures: [{ check: "PROTOCOL", code: "PROTOCOL_INVALID" }] });
  expect(readFileSync(report.streams.stdout.path)).toEqual(stdout);
  expect(report).toMatchObject({ traceComplete: true, result: "STOP", transport: TRANSPORT, ...AUTHORITY });
});

test("transport parser accepts exact 24 GiB metadata without changing legacy metadata shape", () => {
  const metadata = preflight().replace(df(), df(24 * 1024 ** 2));
  expect(parsePreflightTransport(Buffer.from(transportedPreflight(metadata)))).toEqual(parsePreflight(metadata));
  expect(Object.keys(parsePreflight(metadata))).toEqual(["os", "arch", "glibc", "baseTools", "workspaceWritable", "tar", "xz", "gnuTar", "freeKiB"]);
  expect(failureFrom(() => parsePreflightTransport(transportedPreflight())).failures)
    .toEqual([{ check: "PROTOCOL", code: "PROTOCOL_INVALID" }]);
  expect(failureFrom(() => parsePreflight(transportedPreflight())).failures)
    .toEqual([{ check: "PROTOCOL", code: "PROTOCOL_INVALID" }]);
  for (const value of [undefined, null, new Uint8Array(Buffer.from(transportedPreflight())), Buffer.alloc(16385)]) {
    expect(failureFrom(() => parsePreflightTransport(value)).failures).toEqual([{ check: "PROTOCOL", code: "PROTOCOL_INVALID" }]);
  }
});

test("transport metadata failure keeps GUEST_CAPACITY and trace STOP distinct from INVALID", async () => {
  const stdout = Buffer.from(transportedPreflight(preflight().replace(df(), df(24 * 1024 ** 2 - 1))));
  const failures = [{ check: "GUEST_CAPACITY", code: "REQUIREMENT_UNMET", expected: "AT_LEAST_24_GIB_FREE" }];
  expect(failureFrom(() => parsePreflightTransport(stdout)).failures).toEqual(failures);
  const report = await runPreflightTrace(traceOptions(), traceDependencies(rawResult(stdout, Buffer.from("SYNTHETIC_STARTED_NOTICE\n"))));
  expect(report.stdoutProtocol).toEqual({ status: "STOP", failures });
  expect(report.preflightGuard).toEqual({ status: "STOP", failures });
  expect(report.execution.commandSucceeded).toBe(true);
});

test.each(["normal", "trace"])("%s accepts exactly 16 KiB combined raw capture without decoding outer stderr", async (route) => {
  const stdout = Buffer.from(transportedPreflight()), stderr = Buffer.alloc(16384 - stdout.length, 0xff);
  const reply = rawResult(stdout, stderr);
  let report;
  if (route === "trace") report = await runPreflightTrace(traceOptions(), traceDependencies(reply));
  else {
    await start(); await through("policy");
    await runCompleteStage("preflight", { state: statePath }, { ...dependencies, execute: async () => reply });
    report = expectNormalCapture(stdout, stderr);
    expect(readCompleteState(statePath)).toMatchObject({ status: "READY", nextStage: "accept-policy" });
  }
  expect(report.execution).toMatchObject({ commandSucceeded: true, retainedBytes: 16384, observedBytes: 16384, truncated: false });
  expect(report.preflightGuard).toEqual({ status: "METADATA_CHECKS_MET", failures: [] });
  expect(readFileSync(report.streams.stdout.path)).toEqual(stdout);
  expect(readFileSync(report.streams.stderr.path)).toEqual(stderr);
  expect(report.streams.stderr.sha256).toBe(sha(stderr));
  expect(report).toMatchObject({ result: "STOP", transport: TRANSPORT, ...AUTHORITY });
});

test.each([
  [{ ok: false, code: 7 }, "NONZERO_EXIT"],
  [{ ok: false, code: null, signal: "SIGTERM" }, "SIGNAL"],
])("trace command failure takes precedence over transported metadata and outer stderr %#", async (extra, code) => {
  const stdout = Buffer.from(transportedPreflight(preflight().replace(df(), df(1))));
  const stderr = Buffer.from("SYNTHETIC_OUTER_DIAGNOSTIC\n");
  const report = await runPreflightTrace(traceOptions(), traceDependencies(rawResult(stdout, stderr, extra)));
  expect(report.stdoutProtocol).toEqual({ status: "NOT_EVALUATED", failures: [] });
  expect(report.preflightGuard).toEqual({ status: "STOP", failures: [{ check: "COMMAND", code }] });
  expect(readFileSync(report.streams.stdout.path)).toEqual(stdout);
  expect(readFileSync(report.streams.stderr.path)).toEqual(stderr);
});

test.each([
  ["valid synthetic metadata", `printf '%s' '${preflight()}'`, 0, true],
  ["guest stderr despite exit zero", `printf '%s' '${preflight()}'\nprintf 'SYNTHETIC_GUEST_STDERR\\n' >&2\nexit 0`, 0, false],
  ["inner exit 125", "printf 'SYNTHETIC_INNER_FAILURE\\n' >&2\nexit 125", 125, false],
  ["inner exit 127", "printf 'SYNTHETIC_INNER_FAILURE\\n' >&2\nexit 127", 127, false],
])("local owned wrapper redirects %s into the guest protocol stream", async (_label, script, code, valid) => {
  const operation = completeToolsPlan(traceOptions()).operation;
  expectPreflightOperation(operation.argv);
  const argv = operation.argv.slice(3);
  argv[argv.length - 1] = script;
  expect(argv.slice(0, -1)).toEqual(["/bin/sh", "-c", PREFLIGHT_WRAPPER, "sh"]);
  const reply = await runBounded(argv, { milliseconds: operation.milliseconds, cap: operation.cap, encoding: "buffer" });
  expect(reply).toMatchObject({ outcome: "EXIT", code, signal: null, ok: code === 0 });
  expect(reply.stderr).toEqual(Buffer.alloc(0));
  expect(reply.stdout.subarray(0, Buffer.byteLength(TRANSPORT_MARKER))).toEqual(Buffer.from(TRANSPORT_MARKER));
  expect(reply.bytes).toBe(reply.stdout.length);
  if (valid) expect(parsePreflightTransport(reply.stdout)).toEqual(parsePreflight(preflight()));
  else {
    expect(reply.stdout.toString("utf8")).toContain(code === 0 ? "SYNTHETIC_GUEST_STDERR" : "SYNTHETIC_INNER_FAILURE");
    expect(failureFrom(() => parsePreflightTransport(reply.stdout)).failures).toEqual([{ check: "PROTOCOL", code: "PROTOCOL_INVALID" }]);
  }
});

test("fixed transport rejects caller-selected commands in plans and CLI parsing", () => {
  expect(() => completeToolsPlan(traceOptions({ command: "SYNTHETIC_CALLER_COMMAND" }))).toThrow();
  expect(() => completeToolsPlan({ name: NAME, command: "SYNTHETIC_CALLER_COMMAND" })).toThrow();
  expect(() => parseCompleteTools(["--trace-preflight", "--sbx", SBX, "--name", NAME, "--command", "SYNTHETIC_CALLER_COMMAND"])).toThrow();
});

test("trace preserves native negative spawn codes as failed capture metadata", async () => {
  const report = await runPreflightTrace(traceOptions(), traceDependencies(rawResult(Buffer.alloc(0), Buffer.alloc(0), {
    ok: false, outcome: "SPAWN_ERROR", code: -2,
  })));
  expect(report.execution).toMatchObject({ outcome: "SPAWN_ERROR", code: -2, commandSucceeded: false });
  expect(report.stdoutProtocol.status).toBe("NOT_EVALUATED");
  expect(report.preflightGuard.failures).toEqual([{ check: "COMMAND", code: "SPAWN_ERROR" }]);
  expect(report).toMatchObject({ result: "STOP", ...AUTHORITY });
});

test("nonterminal trace refuses before controller resolution or private allocation", async () => {
  const input = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
  const error = Object.getOwnPropertyDescriptor(process.stderr, "isTTY");
  let operations = 0;
  const errors = [];
  Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
  Object.defineProperty(process.stderr, "isTTY", { value: false, configurable: true });
  try {
    expect(await main(["--trace-preflight", "--sbx", SBX, "--name", NAME], {
      resolveController: () => { operations++; return SBX; }, createTraceDirectory: () => { operations++; return run; },
      error: (value) => errors.push(value), output: () => { throw new Error("UNEXPECTED_STDOUT"); },
    })).toBe(2);
    expect(operations).toBe(0);
    expect(JSON.parse(errors[1]).failures).toEqual([{ check: "TTY", code: "TTY_REQUIRED" }]);
    expect(readdirSync(run)).toEqual([]);
  } finally {
    if (input) Object.defineProperty(process.stdin, "isTTY", input); else delete process.stdin.isTTY;
    if (error) Object.defineProperty(process.stderr, "isTTY", error); else delete process.stderr.isTTY;
  }
});

test("declined trace has no intent, raw capture or provider operation", async () => {
  const deps = traceDependencies(rawResult(), { confirm: async () => false });
  await expect(runPreflightTrace(traceOptions(), deps)).rejects.toThrow("DEV_TOOLS_STOP");
  expect(readdirSync(traceDirectory)).toEqual([]);
  expect(calls).toEqual([]);
});

test("trace file collisions refuse without overwrite or replay", async () => {
  const deps = traceDependencies();
  writeFileSync(join(traceDirectory, "intent.json"), "PRIVATE_EXISTING_INTENT\n", { mode: 0o600 });
  await expect(runPreflightTrace(traceOptions(), deps)).rejects.toThrow();
  expect(readFileSync(join(traceDirectory, "intent.json"), "utf8")).toBe("PRIVATE_EXISTING_INTENT\n");
  expect(calls).toEqual([]);
  expect(approvals).toEqual([]);
});

test("trace source drift at consent refuses before intent and invocation", async () => {
  const deps = traceDependencies();
  deps.confirm = async () => { writeFileSync(deps.runnerSourcePath, "PRIVATE_REPLACEMENT_SOURCE\n"); return true; };
  await expect(runPreflightTrace(traceOptions(), deps)).rejects.toThrow();
  expect(readdirSync(traceDirectory)).toEqual([]);
  expect(calls).toEqual([]);
});

test("trace source drift after invocation retains raw captures without a completion report", async () => {
  const stdout = Buffer.from(transportedPreflight()), stderr = Buffer.from("PRIVATE_RETAINED_AFTER_DRIFT\n");
  const deps = traceDependencies();
  deps.execute = async () => {
    writeFileSync(deps.runnerSourcePath, "PRIVATE_CHANGED_RUNNER\n");
    return rawResult(stdout, stderr);
  };
  await expect(runPreflightTrace(traceOptions(), deps)).rejects.toThrow();
  expect(readFileSync(join(traceDirectory, "stdout.bin"))).toEqual(stdout);
  expect(readFileSync(join(traceDirectory, "stderr.bin"))).toEqual(stderr);
  expect(existsSync(join(traceDirectory, "report.json"))).toBe(false);
});

test("trace persistence refuses a swapped directory without writing into its replacement", async () => {
  const deps = traceDependencies();
  const moved = join(fixture, "moved-trace");
  deps.execute = async () => {
    renameSync(traceDirectory, moved);
    mkdirSync(traceDirectory, { mode: 0o700 });
    return rawResult();
  };
  await expect(runPreflightTrace(traceOptions(), deps)).rejects.toThrow();
  expect(readdirSync(traceDirectory)).toEqual([]);
  expect(statSync(join(moved, "stdout.bin")).size).toBe(0);
  expect(existsSync(join(moved, "report.json"))).toBe(false);
});

test("trace persistence refuses symlink replacement without touching the linked file", async () => {
  const deps = traceDependencies();
  const target = join(fixture, "private-target");
  writeFileSync(target, "PRIVATE_UNCHANGED_TARGET\n", { mode: 0o600 });
  deps.execute = async () => {
    unlinkSync(join(traceDirectory, "stdout.bin"));
    symlinkSync(target, join(traceDirectory, "stdout.bin"));
    return rawResult();
  };
  await expect(runPreflightTrace(traceOptions(), deps)).rejects.toThrow();
  expect(readFileSync(target, "utf8")).toBe("PRIVATE_UNCHANGED_TARGET\n");
  expect(existsSync(join(traceDirectory, "report.json"))).toBe(false);
});

test("trace persistence refuses hard-linked capture files before writing bytes", async () => {
  const deps = traceDependencies();
  const alias = join(fixture, "capture-alias");
  deps.execute = async () => {
    linkSync(join(traceDirectory, "stdout.bin"), alias);
    return rawResult();
  };
  await expect(runPreflightTrace(traceOptions(), deps)).rejects.toThrow();
  expect(statSync(alias).size).toBe(0);
  expect(existsSync(join(traceDirectory, "report.json"))).toBe(false);
});

test("trace neither mutates nor continues an existing blocked preparation attempt", async () => {
  await start();
  await expect(runCompleteStage("policy", { state: statePath }, { ...dependencies,
    execute: async () => result("PRIVATE_FAILURE", { ok: false, code: 1 }) })).rejects.toThrow();
  const before = Object.fromEntries(readdirSync(run).map((filename) => [filename, readFileSync(join(run, filename))]));
  const report = await runPreflightTrace(traceOptions(), traceDependencies());
  expect(report.traceComplete).toBe(true);
  expect(Object.fromEntries(readdirSync(run).map((filename) => [filename, readFileSync(join(run, filename))]))).toEqual(before);
  expect(readCompleteState(statePath)).toMatchObject({ status: "RECONCILE", nextStage: null });
});

test.each([
  { outcome: "PRIVATE_OUTCOME" }, { signal: "SIGPRIVATE" }, { stdout: "PRIVATE_STRING_NOT_BYTES" },
  { stderr: "PRIVATE_STRING_NOT_BYTES" }, { stdout: new Uint8Array([65]) },
  { bytes: -1 }, { elapsedMs: Infinity }, { stdout: Buffer.alloc(16385) },
  { stdout: Buffer.alloc(16380), stderr: Buffer.alloc(5) },
  { bytes: 0 },
  { outcome: "TIMEOUT", ok: true }, { code: -2 }, { bytes: Buffer.byteLength(transportedPreflight()) + 1 },
])("malformed trace results remain private and cannot be replayed %#", async (extra) => {
  const reply = { ...rawResult(), ...extra }, deps = traceDependencies(reply), errors = [];
  expect(await main(["--trace-preflight", "--sbx", SBX, "--name", NAME], {
    ...deps, output: () => { throw new Error("UNEXPECTED_STDOUT"); }, error: (value) => errors.push(value),
  })).toBe(2);
  expect(errors.join("\n")).not.toContain("PRIVATE");
  expect(errors[0]).toContain("DEV_TRACE_STOP");
  expect(existsSync(join(traceDirectory, "intent.json"))).toBe(true);
  expect(existsSync(join(traceDirectory, "report.json"))).toBe(false);
  const safeBuffers = Buffer.isBuffer(reply.stdout) && Buffer.isBuffer(reply.stderr)
    && reply.stdout.length + reply.stderr.length <= 16384;
  expect(readFileSync(join(traceDirectory, "stdout.bin"))).toEqual(safeBuffers ? reply.stdout : Buffer.alloc(0));
  expect(readFileSync(join(traceDirectory, "stderr.bin"))).toEqual(safeBuffers ? reply.stderr : Buffer.alloc(0));
  const count = calls.length;
  await expect(runPreflightTrace(traceOptions(), deps)).rejects.toThrow();
  expect(calls).toHaveLength(count);
});

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
  expectPreflightOperation(calls[1].argv, calls[1].bounds);
  expect(calls[1].argv).toEqual(completeToolsPlan(traceOptions()).operation.argv);
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

test("normal preflight accepts synthetic outer startup bytes and requires a new policy approval", async () => {
  await start(); await through("policy");
  const master = readFileSync(statePath);
  const stdout = Buffer.from(transportedPreflight(preflight().replace(df(), df(24 * 1024 ** 2))));
  const stderr = Buffer.concat([Buffer.from(`SYNTHETIC_STARTED_NOTICE ${NAME}\n\0\u001b[31m`), Buffer.from([0xff, 0x80])]);
  const output = [], errors = [];
  let executions = 0;
  expect(await main(["--state", statePath, "--stage", "preflight"], { ...dependencies,
    output: (value) => output.push(value), error: (value) => errors.push(value), execute: async (argv, bounds) => {
      executions++;
      expectPreflightOperation(argv, bounds);
      expect(argv).toEqual(completeToolsPlan(traceOptions()).operation.argv);
      expectEmptyCaptures(run, CAPTURE_FILES.slice(0, 2));
      expect(existsSync(join(run, CAPTURE_FILES[2]))).toBe(false);
      expect(readCompleteState(statePath)).toMatchObject({ status: "RECONCILE", inFlightStage: "preflight" });
      return rawResult(stdout, stderr);
    } })).toBe(0);
  expect(executions).toBe(1);
  expect(errors).toEqual([]);
  expect(output).toHaveLength(1);
  expect(JSON.parse(output[0])).toMatchObject({ schema: "dev-sbx-complete-stage-v1", stage: "preflight", result: "DEV_STAGE_COMPLETE", ...AUTHORITY });
  expect(output.join("\n")).not.toContain("SYNTHETIC_STARTED_NOTICE");
  expect(output.join("\n")).not.toContain("\ufffd");
  const report = expectNormalCapture(stdout, stderr);
  expect(report.execution).toMatchObject({ outcome: "EXIT", code: 0, signal: null, commandSucceeded: true,
    observedBytes: stdout.length + stderr.length, retainedBytes: stdout.length + stderr.length, truncated: false });
  expect(report.stdoutProtocol).toEqual({ status: "METADATA_CHECKS_MET", failures: [] });
  expect(report.preflightGuard).toEqual({ status: "METADATA_CHECKS_MET", failures: [] });
  expect(readFileSync(statePath)).toEqual(master);
  expect(readCompleteState(statePath)).toMatchObject({ nextStage: "accept-policy", completedStage: "preflight", status: "READY", ...AUTHORITY });
  const event = JSON.parse(readFileSync(join(run, "02-preflight.complete.json"), "utf8"));
  expect(Object.keys(event).sort()).toEqual(["schema", "kind", "stage", "masterSha256", "data"].sort());
  expect(event.schema).toBe("dev-sbx-complete-event-v1");
  expect(event.data).toEqual(parsePreflight(preflight().replace(df(), df(24 * 1024 ** 2))));
  expect(approvals.map(({ stage }) => stage)).toEqual(["policy", "preflight"]);
  const approval = approvals.at(-1);
  for (const text of [TRANSPORT_MARKER.trimEnd(), "GUEST_PROTOCOL_AND_DIAGNOSTICS", "OUTER_DIAGNOSTICS", "UNATTRIBUTED", ...CAPTURE_FILES]) {
    expect(approval.prompt).toContain(text);
  }
  expect(approval.prompt).not.toContain("SYNTHETIC_STARTED_NOTICE");
  expect(JSON.parse(approval.prompt.split("\n").find((line) => line.startsWith("TRANSPORT=")).slice("TRANSPORT=".length))).toEqual(TRANSPORT);
  expect(JSON.parse(approval.prompt.split("\n").find((line) => line.startsWith("OPERATION=")).slice("OPERATION=".length)))
    .toEqual(completeToolsPlan(traceOptions()).operation);
  let policyPrompts = 0;
  await expect(runCompleteStage("accept-policy", { state: statePath }, { ...dependencies, confirm: async ({ stage }) => {
    expect(stage).toBe("accept-policy"); policyPrompts++; return false;
  } })).rejects.toThrow("DEV_TOOLS_STOP");
  expect(policyPrompts).toBe(1);
  expect(existsSync(join(run, "03-accept-policy.intent.json"))).toBe(false);
  expect(readCompleteState(statePath).nextStage).toBe("accept-policy");
  await runCompleteStage("accept-policy", { state: statePath }, dependencies);
  expect(approvals.at(-1).stage).toBe("accept-policy");
  expect(readCompleteState(statePath)).toMatchObject({ nextStage: "reserve", ...AUTHORITY });
  expect(calls).toHaveLength(1);
  expect(executions).toBe(1);
  expect(requests).toEqual([]);
  expect(existsSync(join(run, "receipt.json"))).toBe(false);
});

test("low guest capacity plus outer startup status retains normal transport before terminal STOP", async () => {
  const stdout = Buffer.from(transportedPreflight(preflight().replace(df(), df(24 * 1024 ** 2 - 1))));
  const stderr = Buffer.from("SYNTHETIC_STARTED_NOTICE\n");
  let executions = 0;
  const { diagnostic, errors } = await failedPreflight(async (argv, bounds) => {
    executions++;
    expectPreflightOperation(argv, bounds);
    expectEmptyCaptures(run, CAPTURE_FILES.slice(0, 2));
    return rawResult(stdout, stderr);
  });
  const failures = [{ check: "GUEST_CAPACITY", code: "REQUIREMENT_UNMET", expected: "AT_LEAST_24_GIB_FREE" }];
  expect(diagnostic.failures).toEqual(failures);
  expect(executions).toBe(1);
  expect(errors.join("\n")).not.toContain("SYNTHETIC_STARTED_NOTICE");
  expect(errors.join("\n")).not.toContain("UNEXPECTED_STDERR");
  const report = expectNormalCapture(stdout, stderr);
  expect(report.stdoutProtocol).toEqual({ status: "STOP", failures });
  expect(report.preflightGuard).toEqual({ status: "STOP", failures });
  expect(report.execution.commandSucceeded).toBe(true);
});

test("normal preflight rejects guest stderr merged into otherwise valid exit-zero protocol", async () => {
  const stdout = Buffer.from(`${transportedPreflight()}SYNTHETIC_GUEST_STDERR\n`), stderr = Buffer.alloc(0);
  const { diagnostic, errors } = await failedPreflight(async () => rawResult(stdout, stderr));
  const failures = [{ check: "PROTOCOL", code: "PROTOCOL_INVALID" }];
  expect(diagnostic.failures).toEqual(failures);
  const report = expectNormalCapture(stdout, stderr);
  expect(report.stdoutProtocol).toEqual({ status: "INVALID", failures });
  expect(report.preflightGuard).toEqual({ status: "STOP", failures });
  expect(report.execution.commandSucceeded).toBe(true);
  expect(errors.join("\n")).not.toContain("SYNTHETIC_GUEST_STDERR");
});

test.each(["reserve", "host-capacity"])("%s keeps string capture and rejects stderr outside preflight", async (stage) => {
  await start(); await through(stage === "reserve" ? "accept-policy" : "reserve");
  let failure;
  try {
    await runCompleteStage(stage, { state: statePath }, { ...dependencies, execute: async (argv, bounds) => {
      expect(bounds.encoding).toBeUndefined();
      expect(bounds).toEqual({ milliseconds: stage === "reserve" ? 30000 : 10000, cap: 16384 });
      if (stage === "reserve") expect(argv[8]).toContain(".complete-dev-tools-v1");
      else expect(argv).toEqual(["/usr/bin/df", "-Pk", run]);
      return result(stage === "reserve" ? "RESERVED\n" : df(), { stderr: "SYNTHETIC_NONPREFLIGHT_STDERR\n" });
    } });
  } catch (error) { failure = error; }
  expect(failure).toBeDefined();
  expect(completeToolsFailure(failure)).toMatchObject({ stage, phase: "EFFECT",
    failures: [{ check: "COMMAND", code: "UNEXPECTED_STDERR" }] });
  expect(readCompleteState(statePath)).toMatchObject({ status: "RECONCILE", inFlightStage: stage, nextStage: null });
});

test.each(CAPTURE_FILES)("normal preflight refuses %s collision without overwrite or provider execution", async (filename) => {
  await start(); await through("policy");
  const bytes = Buffer.from("SYNTHETIC_EXISTING_CAPTURE\n");
  writeFileSync(join(run, filename), bytes, { mode: 0o600 });
  let executions = 0;
  await expect(runCompleteStage("preflight", { state: statePath }, { ...dependencies,
    execute: async () => { executions++; return rawResult(); } })).rejects.toThrow("DEV_TOOLS_STOP");
  expect(executions).toBe(0);
  expect(readFileSync(join(run, filename))).toEqual(bytes);
  expect(existsSync(join(run, "02-preflight.complete.json"))).toBe(false);
});

test.each(["symlink", "hardlink", "directory"])("normal capture preallocation refuses a %s collision before invocation", async (kind) => {
  await start(); await through("policy");
  const target = join(fixture, "synthetic-collision-target"), capture = join(run, CAPTURE_FILES[0]);
  writeFileSync(target, "SYNTHETIC_UNCHANGED_TARGET\n", { mode: 0o600 });
  if (kind === "symlink") symlinkSync(target, capture);
  else if (kind === "hardlink") linkSync(target, capture);
  else mkdirSync(capture, { mode: 0o700 });
  let executions = 0;
  await expect(runCompleteStage("preflight", { state: statePath }, { ...dependencies,
    execute: async () => { executions++; return rawResult(); } })).rejects.toThrow("DEV_TOOLS_STOP");
  expect(executions).toBe(0);
  expect(readFileSync(target, "utf8")).toBe("SYNTHETIC_UNCHANGED_TARGET\n");
  if (kind === "directory") expect(readdirSync(capture)).toEqual([]);
  expect(existsSync(join(run, "02-preflight.complete.json"))).toBe(false);
});

test.each(CAPTURE_FILES.slice(0, 2))("normal capture refuses symlink replacement of %s without writing its target", async (filename) => {
  await start(); await through("policy");
  const target = join(fixture, "synthetic-symlink-target");
  writeFileSync(target, "SYNTHETIC_UNCHANGED_TARGET\n", { mode: 0o600 });
  let executions = 0;
  await expect(runCompleteStage("preflight", { state: statePath }, { ...dependencies, execute: async () => {
    executions++;
    expectEmptyCaptures(run, CAPTURE_FILES.slice(0, 2));
    unlinkSync(join(run, filename));
    symlinkSync(target, join(run, filename));
    return rawResult();
  } })).rejects.toThrow("DEV_TOOLS_STOP");
  expect(executions).toBe(1);
  expect(readFileSync(target, "utf8")).toBe("SYNTHETIC_UNCHANGED_TARGET\n");
  expect(existsSync(join(run, CAPTURE_FILES[2]))).toBe(false);
  expect(existsSync(join(run, "02-preflight.complete.json"))).toBe(false);
  expect(readCompleteState(statePath)).toMatchObject({ status: "RECONCILE", inFlightStage: "preflight", nextStage: null });
});

test.each(CAPTURE_FILES.slice(0, 2))("normal capture refuses hard-linking %s before retaining bytes", async (filename) => {
  await start(); await through("policy");
  const alias = join(fixture, "synthetic-capture-alias");
  await expect(runCompleteStage("preflight", { state: statePath }, { ...dependencies, execute: async () => {
    expectEmptyCaptures(run, CAPTURE_FILES.slice(0, 2));
    linkSync(join(run, filename), alias);
    return rawResult(undefined, Buffer.from("SYNTHETIC_OUTER_NOTICE\n"));
  } })).rejects.toThrow("DEV_TOOLS_STOP");
  expect(statSync(alias).size).toBe(0);
  expect(existsSync(join(run, CAPTURE_FILES[2]))).toBe(false);
  expect(existsSync(join(run, "02-preflight.complete.json"))).toBe(false);
});

test("normal capture refuses an attempt-directory swap before writing into either directory", async () => {
  await start(); await through("policy");
  const moved = join(fixture, "synthetic-moved-attempt");
  let executions = 0;
  await expect(runCompleteStage("preflight", { state: statePath }, { ...dependencies, execute: async () => {
    executions++;
    expectEmptyCaptures(run, CAPTURE_FILES.slice(0, 2));
    renameSync(run, moved);
    mkdirSync(run, { mode: 0o700 });
    return rawResult();
  } })).rejects.toThrow("DEV_TOOLS_STOP");
  expect(executions).toBe(1);
  expect(readdirSync(run)).toEqual([]);
  expectEmptyCaptures(moved, CAPTURE_FILES.slice(0, 2));
  expect(existsSync(join(moved, CAPTURE_FILES[2]))).toBe(false);
  expect(existsSync(join(moved, "02-preflight.complete.json"))).toBe(false);
  expect(existsSync(join(moved, "02-preflight.intent.json"))).toBe(true);
});

test("normal transport report collision after invocation retains raw files but cannot complete an event", async () => {
  await start(); await through("policy");
  const stdout = Buffer.from(transportedPreflight()), stderr = Buffer.from("SYNTHETIC_OUTER_NOTICE\n");
  await expect(runCompleteStage("preflight", { state: statePath }, { ...dependencies, execute: async () => {
    writeFileSync(join(run, CAPTURE_FILES[2]), "SYNTHETIC_EXISTING_REPORT\n", { mode: 0o600 });
    return rawResult(stdout, stderr);
  } })).rejects.toThrow("DEV_TOOLS_STOP");
  expect(readFileSync(join(run, CAPTURE_FILES[0]))).toEqual(stdout);
  expect(readFileSync(join(run, CAPTURE_FILES[1]))).toEqual(stderr);
  expect(readFileSync(join(run, CAPTURE_FILES[2]), "utf8")).toBe("SYNTHETIC_EXISTING_REPORT\n");
  expect(existsSync(join(run, "02-preflight.complete.json"))).toBe(false);
  expect(readCompleteState(statePath)).toMatchObject({ status: "RECONCILE", inFlightStage: "preflight", nextStage: null });
});

test("normal sidecar names never authorize preparation events and other sidecar names stay forbidden", async () => {
  await start(); await through("policy");
  const state = readCompleteState(statePath);
  writeFileSync(join(run, CAPTURE_FILES[0]), Buffer.from(transportedPreflight()), { mode: 0o600 });
  writeFileSync(join(run, CAPTURE_FILES[1]), "SYNTHETIC_OUTER_NOTICE\n", { mode: 0o600 });
  const forged = { schema: "dev-sbx-complete-event-v1", kind: "complete", stage: "preflight",
    masterSha256: state.masterSha256, data: parsePreflight(preflight()) };
  writeFileSync(join(run, CAPTURE_FILES[2]), JSON.stringify(forged), { mode: 0o600 });
  expect(readCompleteState(statePath)).toMatchObject({ status: "READY", completedStage: "policy", nextStage: "preflight" });
  expect(readCompleteState(statePath).events.map(({ stage }) => stage)).toEqual(["policy"]);
  const extra = join(run, "02-preflight.arbitrary-report.json");
  writeFileSync(extra, JSON.stringify(forged), { mode: 0o600 });
  expect(() => readCompleteState(statePath)).toThrow();
  unlinkSync(extra);
  writeFileSync(join(run, "03-accept-policy.complete.json"), JSON.stringify({ ...forged, stage: "accept-policy",
    data: { policySha256: state.events[0].data.policySha256, preflightSha256: sha(JSON.stringify(forged)) } }), { mode: 0o600 });
  expect(() => readCompleteState(statePath)).toThrow();
  expect(calls).toHaveLength(1);
  expect(requests).toEqual([]);
});

test("source drift during approval refuses before intent and before provider effects", async () => {
  await start();
  const confirm = async () => { writeFileSync(join(fixture, "sources", "complete-profile.mjs"), "changed fixture\n"); return true; };
  let failure;
  try { await runCompleteStage("policy", { state: statePath, stage: "policy" }, { ...dependencies, confirm }); }
  catch (error) { failure = error; }
  expect(completeToolsFailure(failure)).toMatchObject({ stage: "policy", phase: "POST_APPROVAL",
    failures: [{ check: "SOURCE_BINDINGS", code: "BINDING_INVALID" }], ...AUTHORITY });
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

test.each([
  ["OS=Linux", "OS=Darwin", "OS", "Linux"],
  ["ARCH=x86_64", "ARCH=aarch64", "ARCH", "x86_64"],
  ["GLIBC=glibc 2.35", "GLIBC=glibc 2.17", "GLIBC", "GLIBC_AT_LEAST_2_18"],
  ...completeProfile.baseTools.map((tool) => [`TOOL_${tool}=PRESENT`, `TOOL_${tool}=MISSING`, `TOOL_${tool}`, "PRESENT"]),
  ["WORKSPACE=WRITABLE", "WORKSPACE=UNAVAILABLE", "WORKSPACE", "WRITABLE"],
  ["TAR=EXECUTABLE", "TAR=MISSING", "TAR", "EXECUTABLE"],
  ["XZ=EXECUTABLE", "XZ=MISSING", "XZ", "EXECUTABLE"],
  ["GNU_TAR=YES", "GNU_TAR=NO", "GNU_TAR", "YES"],
  [df(), df(24 * 1024 ** 2 - 1), "GUEST_CAPACITY", "AT_LEAST_24_GIB_FREE"],
])("complete preflight protocol identifies the exact unmet requirement: %s", (from, to, check, expected) => {
  const report = failureFrom(() => parsePreflight(preflight().replace(from, to)));
  expect(report.failures).toEqual([{ check, code: "REQUIREMENT_UNMET", expected }]);
  expect(report).toMatchObject({ result: "DEV_TOOLS_STOP", ...AUTHORITY });
});

test("complete protocol reports combined unmet checks in fixed order without observed values", () => {
  let stdout = preflight().replace("OS=Linux", "OS=PRIVATE_OS").replace("ARCH=x86_64", "ARCH=PRIVATE_ARCH")
    .replace("GLIBC=glibc 2.35", "GLIBC=glibc 2.17").replace("WORKSPACE=WRITABLE", "WORKSPACE=UNAVAILABLE")
    .replace("TAR=EXECUTABLE", "TAR=MISSING").replace("XZ=EXECUTABLE", "XZ=MISSING").replace("GNU_TAR=YES", "GNU_TAR=NO")
    .replace(df(), df(24 * 1024 ** 2 - 1).replace("/dev/fixture", "/dev/PRIVATE_DISK"));
  for (const tool of completeProfile.baseTools) stdout = stdout.replace(`TOOL_${tool}=PRESENT`, `TOOL_${tool}=MISSING`);
  const report = failureFrom(() => parsePreflight(stdout));
  expect(report.failures.map(({ check }) => check)).toEqual(["OS", "ARCH", "GLIBC",
    ...completeProfile.baseTools.map((tool) => `TOOL_${tool}`), "WORKSPACE", "TAR", "XZ", "GNU_TAR", "GUEST_CAPACITY"]);
  expect(JSON.stringify(report)).not.toContain("PRIVATE");
  expect(JSON.stringify(report)).not.toContain(String(24 * 1024 ** 2 - 1));
});

test.each([
  (stdout) => stdout.replace("DEV_SBX_PREFLIGHT_V1", "PRIVATE_HEADER"),
  (stdout) => stdout.replace("XZ=MISSING", "XZ=PRIVATE_VALUE"),
  (stdout) => stdout.replace("TOOL_node=PRESENT", "TOOL_node=PRESENT\nTOOL_node=PRESENT"),
  (stdout) => stdout.replace("TAR=EXECUTABLE\nXZ=MISSING", "XZ=MISSING\nTAR=EXECUTABLE"),
  (stdout) => stdout.replace("Filesystem 1024-blocks", "Filesystem Size"),
  (stdout) => stdout.replace("DF_END\n", ""),
  (stdout) => stdout.replace("DONE\n", ""),
  (stdout) => stdout.slice(0, -1),
  (stdout) => `${stdout}PRIVATE_EXTRA\n`,
  (stdout) => stdout.replace("GLIBC=glibc 2.35", "GLIBC=PRIVATE_LIBC"),
])("malformed protocol never fabricates unmet checks from partial observations %#", (mutate) => {
  const stdout = preflight().replace("XZ=EXECUTABLE", "XZ=MISSING").replace(df(), df(1));
  const report = failureFrom(() => parsePreflight(mutate(stdout)));
  expect(report.failures).toEqual([{ check: "PROTOCOL", code: "PROTOCOL_INVALID" }]);
  expect(JSON.stringify(report)).not.toContain("PRIVATE");
});

test("host and guest free-space failures print fixed floors, not measured paths or values", () => {
  const report = failureFrom(() => parseCapacity(df(10 * 1024 ** 2 - 1), 10 * 1024 ** 2));
  expect(report.failures).toEqual([{ check: "HOST_CAPACITY", code: "REQUIREMENT_UNMET", expected: "AT_LEAST_10_GIB_FREE" }]);
  expect(JSON.stringify(report)).not.toContain(String(10 * 1024 ** 2 - 1));
  for (const minimum of [undefined, NaN, Infinity, -1, 0.5]) {
    expect(failureFrom(() => parseCapacity(df(), minimum)).failures).toEqual([{ check: "ARGUMENTS", code: "INVALID_ARGUMENTS" }]);
  }
});

test("CLI appends actionable preflight JSON while preserving the fixed stderr line and empty stdout", async () => {
  const stdout = Buffer.from(transportedPreflight(preflight().replace("XZ=EXECUTABLE", "XZ=MISSING")));
  const { diagnostic, errors } = await failedPreflight(async () => rawResult(stdout));
  expect(diagnostic.failures).toEqual([{ check: "XZ", code: "REQUIREMENT_UNMET", expected: "EXECUTABLE" }]);
  expect(errors.join("\n")).not.toContain(NAME);
  expect(errors.join("\n")).not.toContain(statePath);
});

test.each([
  [{ outcome: "TIMEOUT", ok: false, code: null }, "TIMEOUT"],
  [{ outcome: "OUTPUT_LIMIT", ok: false, code: null, bytes: 16385 }, "OUTPUT_LIMIT"],
  [{ outcome: "INTERRUPTED", ok: false, code: null }, "INTERRUPTED"],
  [{ outcome: "SPAWN_ERROR", ok: false, code: null }, "SPAWN_ERROR"],
  [{ outcome: "SPAWN_ERROR", ok: false, code: -2 }, "SPAWN_ERROR"],
  [{ outcome: "SPAWN_ERROR", ok: false, code: -13 }, "SPAWN_ERROR"],
  [{ outcome: "STREAM_ERROR", ok: false, code: null }, "STREAM_ERROR"],
  [{ outcome: "INCOMPLETE_STREAM", ok: false, code: null }, "INCOMPLETE_STREAM"],
  [{ code: 7, ok: false }, "NONZERO_EXIT"],
  [{ code: null, signal: "SIGKILL", ok: false }, "SIGNAL"],
  [{ stdout: Buffer.alloc(16385) }, "EXECUTOR_RESULT_INVALID"],
  [{ stdout: Buffer.alloc(16380), stderr: Buffer.alloc(5) }, "EXECUTOR_RESULT_INVALID"],
  [{ stdout: "PRIVATE_STRING_NOT_BYTES" }, "EXECUTOR_RESULT_INVALID"],
  [{ stderr: "PRIVATE_STRING_NOT_BYTES" }, "EXECUTOR_RESULT_INVALID"],
  [{ stdout: new Uint8Array([65]) }, "EXECUTOR_RESULT_INVALID"],
  [{ outcome: "PRIVATE_OUTCOME" }, "EXECUTOR_RESULT_INVALID"],
  [{ code: undefined }, "EXECUTOR_RESULT_INVALID"],
  [{ code: -1 }, "EXECUTOR_RESULT_INVALID"],
  [{ signal: "PRIVATE_SIGNAL" }, "EXECUTOR_RESULT_INVALID"],
  [{ bytes: Infinity }, "EXECUTOR_RESULT_INVALID"],
  [{ bytes: -1 }, "EXECUTOR_RESULT_INVALID"],
  [{ bytes: 0 }, "EXECUTOR_RESULT_INVALID"],
  [{ elapsedMs: Infinity }, "EXECUTOR_RESULT_INVALID"],
  [{ bytes: 16384 }, "EXECUTOR_RESULT_INVALID"],
  [{ bytes: 16385 }, "EXECUTOR_RESULT_INVALID"],
  [{ ok: false }, "EXECUTOR_RESULT_INVALID"],
  [{ outcome: "TIMEOUT", ok: true }, "EXECUTOR_RESULT_INVALID"],
])("executor failure emits a fixed category without parsing partial output %#", async (extra, code) => {
  const stdout = Buffer.from(transportedPreflight(preflight().replace(df(), df(1))));
  const stderr = Buffer.from("PRIVATE_SYNTHETIC_OUTER_DIAGNOSTIC\n");
  const reply = rawResult(stdout, stderr, extra);
  const { diagnostic, errors } = await failedPreflight(async () => reply);
  expect(diagnostic.failures).toEqual([{ check: "COMMAND", code }]);
  expect(errors.join("\n")).not.toContain("PRIVATE");
  expect(errors.join("\n")).not.toContain("SIGKILL");
  const safeBuffers = Buffer.isBuffer(reply.stdout) && Buffer.isBuffer(reply.stderr)
    && reply.stdout.length + reply.stderr.length <= 16384;
  expect(readFileSync(join(run, CAPTURE_FILES[0]))).toEqual(safeBuffers ? stdout : Buffer.alloc(0));
  expect(readFileSync(join(run, CAPTURE_FILES[1]))).toEqual(safeBuffers ? stderr : Buffer.alloc(0));
  if (code === "EXECUTOR_RESULT_INVALID") expect(existsSync(join(run, CAPTURE_FILES[2]))).toBe(false);
  else {
    const report = expectNormalCapture(stdout, stderr);
    expect(report.stdoutProtocol).toEqual({ status: "NOT_EVALUATED", failures: [] });
    expect(report.preflightGuard).toEqual({ status: "STOP", failures: [{ check: "COMMAND", code }] });
    expect(report.execution.commandSucceeded).toBe(false);
  }
});

test("forged exception properties and hostile getters cannot inject diagnostics", async () => {
  const error = Object.assign(new Error("PRIVATE_EXCEPTION\u001b[31m https://user:PRIVATE_TOKEN@example.invalid/?secret=x"),
    { code: "TIMEOUT", check: "OS", phase: "EFFECT", stage: "preflight", expected: "PRIVATE_EXPECTED", cause: "PRIVATE_CAUSE" });
  const untrusted = completeToolsFailure(error);
  expect(untrusted.failures).toEqual([{ check: "INTERNAL", code: "INTERNAL_ERROR" }]);
  expect(JSON.stringify(untrusted)).not.toContain("PRIVATE");
  const hostile = new Proxy(error, { get() { throw new Error("PRIVATE_GETTER"); } });
  expect(completeToolsFailure(hostile)).toEqual(untrusted);
  const { diagnostic, errors } = await failedPreflight(async () => { throw error; });
  expect(diagnostic.failures).toEqual([{ check: "COMMAND", code: "INTERNAL_ERROR" }]);
  expect(errors.join("\n")).not.toContain("PRIVATE");
  expect(errors.join("\n")).not.toContain("https:");
});

test("formatted diagnostic copies do not mutate the private error registry", () => {
  let error;
  try { parsePreflight(preflight().replace("XZ=EXECUTABLE", "XZ=MISSING")); } catch (failure) { error = failure; }
  const first = completeToolsFailure(error);
  first.failures[0].expected = "PRIVATE_MUTATION";
  expect(completeToolsFailure(error).failures[0].expected).toBe("EXECUTABLE");
});

test("invalid CLI arguments produce only a fixed argument diagnostic", async () => {
  const errors = [], output = [];
  expect(await main(["--name", "PRIVATE_NAME\n", "--plan"], { ...dependencies,
    error: (value) => errors.push(value), output: (value) => output.push(value) })).toBe(2);
  expect(output).toEqual([]);
  expect(JSON.parse(errors[1])).toMatchObject({ stage: "CLI", phase: "ARGUMENTS",
    failures: [{ check: "ARGUMENTS", code: "INVALID_ARGUMENTS" }], ...AUTHORITY });
  expect(errors.join("\n")).not.toContain("PRIVATE");
  expect(readdirSync(run)).toEqual([]);
  expect(calls).toEqual([]);
});

test("controller drift after approval reports the binding boundary before intent", async () => {
  await start();
  let controller = SBX;
  let failure;
  try {
    await runCompleteStage("policy", { state: statePath }, { ...dependencies, resolveController: () => controller,
      confirm: async () => { controller = "/PRIVATE_CONTROLLER"; return true; } });
  } catch (error) { failure = error; }
  expect(completeToolsFailure(failure)).toMatchObject({ stage: "policy", phase: "POST_APPROVAL",
    failures: [{ check: "CONTROLLER_BINDINGS", code: "BINDING_INVALID" }] });
  expect(calls).toEqual([]);
  expect(existsSync(join(run, "01-policy.intent.json"))).toBe(false);
  expect(JSON.stringify(completeToolsFailure(failure))).not.toContain("PRIVATE");
});

test("changed source bindings refuse old synthetic state without attempting or migrating it", async () => {
  await start();
  const before = readFileSync(statePath), errors = [];
  writeFileSync(join(fixture, "sources/complete-tools.mjs"), "PRIVATE_NEW_REVISION\n");
  expect(await main(["--state", statePath, "--stage", "policy"], { ...dependencies,
    error: (value) => errors.push(value), output: () => { throw new Error("UNEXPECTED_STDOUT"); } })).toBe(2);
  expect(JSON.parse(errors[1])).toMatchObject({ stage: "policy", phase: "PRE_APPROVAL",
    failures: [{ check: "SOURCE_BINDINGS", code: "BINDING_INVALID" }] });
  expect(readFileSync(statePath).equals(before)).toBe(true);
  expect(existsSync(join(run, "01-policy.intent.json"))).toBe(false);
  expect(approvals).toEqual([]);
  expect(calls).toEqual([]);
});

test("an intent-write collision reports uncertainty without claiming guest execution", async () => {
  await start();
  const errors = [];
  let resolutions = 0;
  expect(await main(["--state", statePath, "--stage", "policy"], { ...dependencies,
    resolveController: () => {
      if (++resolutions === 2) mkdirSync(join(run, "01-policy.intent.json"), { mode: 0o700 });
      return SBX;
    }, error: (value) => errors.push(value), output: () => { throw new Error("UNEXPECTED_STDOUT"); } })).toBe(2);
  expect(JSON.parse(errors[1])).toMatchObject({ stage: "policy", phase: "INTENT_WRITE",
    failures: [{ check: "INTENT", code: "INTENT_WRITE_UNCERTAIN" }] });
  expect(calls).toEqual([]);
  expect(existsSync(join(run, "01-policy.complete.json"))).toBe(false);
  expect(() => readCompleteState(statePath)).toThrow();
});

test("post-effect source drift reports finalization without claiming a guest prerequisite failure", async () => {
  await start(); await through("policy");
  const errors = [], output = [];
  const stdout = Buffer.from(transportedPreflight()), stderr = Buffer.from("SYNTHETIC_RETAINED_AFTER_SOURCE_DRIFT\n");
  let executions = 0;
  expect(await main(["--state", statePath, "--stage", "preflight"], { ...dependencies,
    execute: async () => {
      executions++;
      writeFileSync(join(fixture, "sources/complete-tools.mjs"), "PRIVATE_SOURCE_DRIFT\n");
      return rawResult(stdout, stderr);
    }, error: (value) => errors.push(value), output: (value) => output.push(value) })).toBe(2);
  const report = JSON.parse(errors[1]);
  expect(report).toMatchObject({ stage: "preflight", phase: "FINALIZATION",
    failures: [{ check: "SOURCE_BINDINGS", code: "BINDING_INVALID" }] });
  expect(output).toEqual([]);
  expect(existsSync(join(run, "02-preflight.intent.json"))).toBe(true);
  expect(existsSync(join(run, "02-preflight.complete.json"))).toBe(false);
  expect(readFileSync(join(run, CAPTURE_FILES[0]))).toEqual(stdout);
  expect(readFileSync(join(run, CAPTURE_FILES[1]))).toEqual(stderr);
  expect(executions).toBe(1);
  const count = approvals.length;
  await expect(runCompleteStage("preflight", { state: statePath }, dependencies)).rejects.toThrow("DEV_TOOLS_STOP");
  await expect(runCompleteStage("accept-policy", { state: statePath }, dependencies)).rejects.toThrow("DEV_TOOLS_STOP");
  expect(approvals).toHaveLength(count);
  expect(readCompleteState(statePath).status).toBe("RECONCILE");
  expect(errors.join("\n")).not.toContain("PRIVATE");
});
