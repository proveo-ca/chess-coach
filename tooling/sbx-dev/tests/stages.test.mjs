// SPEC: _spec/tooling/sbx-dev/preparation-workflow.puml
import { afterEach, beforeEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync, closeSync, existsSync, linkSync, mkdirSync, mkdtempSync, openSync,
  readFileSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { guestInstallScript, readState, runStage, snapshotPaths } from "../stages.mjs";
import { requirements } from "../../native-ingress/f9-requirements.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ENTRY = join(ROOT, "stages.mjs");
const INSTALLER = join(ROOT, "install-rust.sh");
const DIAGNOSTIC = resolve(ROOT, "../native-ingress/f9-diagnose.mjs");
const SNAPSHOTS = join(ROOT, "snapshots.mjs");
const NAME = `devrust-${"ab".repeat(12)}`;
const SHA = "a".repeat(64);
const ORDER = ["validate", "create", "policy", "accept-policy", "provision", "install", "diagnose"];
let root, statePath, sbx, bundle, bin, originalPath, calls, approvals, override;

function result(stdout = "", values = {}) {
  return { ok: true, code: 0, signal: null, stdout, stderr: "", outcome: "EXIT", ...values };
}

function report(values = {}) {
  return {
    schema: "f9-live-diagnostic-v1", scope: "DEVELOPMENT_RECONNAISSANCE_ONLY", target: NAME,
    diagnosticComplete: true, liveGuestObserved: true, f9Qualified: false, trainingReady: false, result: "STOP",
    probes: Object.fromEntries(["PREFLIGHT", "VM_LOOKUP", "POLICY_READBACK", "GUEST_EXEC"].map((id) => [id, { status: "PASS" }])),
    requirements: requirements.map((item) => ({ ...item, status: "BLOCKED", execution: "NOT_RUN", verifier: null })),
    ...values,
  };
}

function defaultResult(argv) {
  if (argv[0] === join(bin, "bun") && argv[3] === DIAGNOSTIC) return result(JSON.stringify(report()), { ok: false, code: 2 });
  if (argv[0] === join(bin, "bun") && argv[3] === join(ROOT, "check-bundle.mjs")) return result("BUNDLE=HASH_AND_LAYOUT_OK\n");
  if (argv[0] === join(bin, "bun") && argv[3] === SNAPSHOTS) {
    return readState(statePath).installerSha256 === createHash("sha256").update(readFileSync(INSTALLER)).digest("hex")
      ? result("SNAPSHOTS=VERIFIED_PRIVATE_INPUTS\n") : result("", { ok: false, code: 2 });
  }
  if (argv[0] === "/usr/bin/bash") return result(`ATTEMPT_NAME=${NAME}\nDEV_CREATED_NAME=${NAME}\nRESULT=DEV_ONLY_CREATED\n`);
  if (argv[0] === sbx && argv[1] === "policy") return result("PRIVATE_POLICY_FIXTURE\n");
  if (argv[0] === sbx && argv[1] === "cp") return result();
  if (argv[0] === sbx && argv[1] === "exec") return result("release: 1.95.0\ncargo 1.95.0 (fixture)\nRESULT=DEV_ONLY_RUST_1_95_SEEDED\n");
  throw new Error("unexpected fake command");
}

async function execute(argv, bounds) {
  const state = existsSync(statePath) ? readState(statePath) : null;
  calls.push({ argv: [...argv], bounds: { ...bounds }, state });
  return override ? await override(argv, bounds, state) : defaultResult(argv);
}

async function confirm(context) {
  approvals.push(context);
  return true;
}

function stage(action, dependencies = {}) {
  return runStage(action, { state: statePath, ...(action === "validate" ? { sbx, bundle, sha256: SHA } : {}) },
    { execute, confirm, ...dependencies });
}

async function through(action) {
  let state;
  for (const step of ORDER.slice(0, ORDER.indexOf(action) + 1)) state = await stage(step);
  return state;
}

function mutateState(change) {
  const state = readState(statePath);
  change(state);
  writeFileSync(statePath, `${JSON.stringify(state)}\n`, { mode: 0o600 });
}

function noAdditionalCalls(before) {
  expect(calls).toHaveLength(before);
}

beforeEach(() => {
  root = mkdtempSync("/tmp/opencode/sbx-stages-");
  chmodSync(root, 0o700);
  statePath = join(root, "workflow.json");
  sbx = join(root, "fake-sbx");
  bundle = join(root, "fixture.tar");
  bin = join(root, "bin");
  mkdirSync(bin, { mode: 0o700 });
  for (const path of [sbx, join(bin, "bun")]) {
    writeFileSync(path, "#!/bin/sh\nexit 99\n", { mode: 0o700 });
  }
  writeFileSync(bundle, "fake archive checked only by injected bounded validator\n");
  originalPath = process.env.PATH;
  process.env.PATH = bin;
  calls = [];
  approvals = [];
  override = null;
});

afterEach(() => {
  process.env.PATH = originalPath;
  rmSync(root, { recursive: true, force: true });
});

test("ordered stages pin private state, ask separately, and finish dev-only at verified F9 STOP", async () => {
  const state = await through("diagnose");
  expect(approvals.map(({ action }) => action)).toEqual(ORDER);
  expect(state).toEqual(readState(statePath));
  expect(state.schema).toBe("dev-sbx-workflow-v1");
  expect(state.attemptId).toMatch(/^[a-f0-9]{16}$/);
  expect(state.completedStage).toBe("diagnose");
  expect(state.status).toBe("READY");
  expect(state.inFlightStage).toBeNull();
  expect(state.trainingReady).toBe(false);
  expect(state.policyAcceptance.consumed).toBe(true);
  expect(state.installerSha256).toBe(createHash("sha256").update(readFileSync(INSTALLER)).digest("hex"));
  for (const path of [statePath, state.policyPath, state.reportPath]) expect(statSync(path).mode & 0o7777).toBe(0o600);
  expect(statSync(statePath).size).toBeLessThanOrEqual(16384);
  expect(JSON.parse(readFileSync(state.reportPath, "utf8"))).toEqual(report());
  expect(readFileSync(statePath, "utf8")).not.toContain("PRIVATE_POLICY_FIXTURE");
  const [validate, create, policy, snapshots, revalidate, archiveCopy, installerCopy, install, diagnose] = calls;
  const paths = snapshotPaths(statePath, state.attemptId);
  expect(validate.argv).toEqual([join(bin, "bun"), "--no-env-file", "--no-install", join(ROOT, "check-bundle.mjs"), bundle, SHA]);
  expect(validate.bounds).toEqual({ milliseconds: 60000, cap: 16384, graceMilliseconds: 1000 });
  expect(validate.state).toBeNull();
  expect(create.argv).toEqual(["/usr/bin/bash", "-p", join(ROOT, "create.sh"), "--sbx", sbx]);
  expect(create.bounds).toEqual({ milliseconds: 120000, cap: 16384 });
  expect(policy.argv).toEqual([sbx, "policy", "ls", "--wide", NAME]);
  expect(policy.bounds).toEqual({ milliseconds: 10000, cap: 65536 });
  expect(snapshots.argv).toEqual([join(bin, "bun"), "--no-env-file", "--no-install", SNAPSHOTS, "--state", statePath]);
  expect(snapshots.bounds).toEqual({ milliseconds: 60000, cap: 16384 });
  expect(revalidate.argv).toEqual([...validate.argv.slice(0, 4), paths.bundle, SHA]);
  expect(archiveCopy.argv).toEqual([sbx, "cp", paths.bundle, `${NAME}:/home/agent/workspace/devrust-tools-${state.attemptId}.tar`]);
  expect(archiveCopy.bounds).toEqual({ milliseconds: 90000, cap: 16384 });
  expect(installerCopy.argv).toEqual([sbx, "cp", paths.installer, `${NAME}:/home/agent/workspace/install-rust-${state.attemptId}.sh`]);
  expect(installerCopy.bounds).toEqual({ milliseconds: 45000, cap: 16384 });
  expect(install.argv).toEqual([sbx, "exec", NAME, "/usr/bin/timeout", "--kill-after=2s", "120s", "/bin/sh", "-c", guestInstallScript, "sh", state.guestInstallerPath, state.installerSha256, SHA, state.attemptId]);
  expect(install.bounds).toEqual({ milliseconds: 130000, cap: 16384 });
  expect(diagnose.argv).toEqual([join(bin, "bun"), "--no-env-file", "--no-install", DIAGNOSTIC, "--sbx", sbx, "--name", NAME, "--confirm-dev-diagnostic"]);
  expect(diagnose.bounds).toEqual({ milliseconds: 60000, cap: 131072, graceMilliseconds: 1000 });
  expect(approvals.at(-1).prompt).toContain(`bun --no-env-file --no-install ${DIAGNOSTIC}`);
  expect(approvals.at(-1).prompt).toContain("original helper exit 2");
  expect(approvals.at(-1).prompt).not.toContain("mise run");
  for (const call of calls.slice(1)) {
    expect(call.state.inFlightStage).not.toBeNull();
    expect(call.state.status).toBe("READY");
    expect(call.state.trainingReady).toBe(false);
  }
  for (const call of [snapshots, revalidate, archiveCopy, installerCopy]) {
    expect(call.state.completedStage).toBe("accept-policy");
    expect(call.state.inFlightStage).toBe("provision");
    expect(call.state.policyAcceptance.consumed).toBe(true);
  }
  expect(calls.some(({ argv }) => argv.includes("rm"))).toBe(false);
});

test("provision only copies after policy acceptance and never executes the installer", async () => {
  await through("create");
  let before = calls.length;
  await expect(stage("provision")).rejects.toThrow("stage order");
  noAdditionalCalls(before);
  await stage("policy");
  before = calls.length;
  await expect(stage("provision")).rejects.toThrow("stage order");
  noAdditionalCalls(before);
  await stage("accept-policy");
  noAdditionalCalls(before);
  await stage("provision");
  expect(calls.slice(before).map(({ argv }) => argv[1])).toEqual(["--no-env-file", "--no-env-file", "cp", "cp"]);
  expect(readState(statePath).completedStage).toBe("provision");
});

test("operator acceptance remains distinct and fresh from policy retrieval", async () => {
  await through("policy");
  const before = calls.length;
  await expect(stage("accept-policy", { confirm: async (context) => {
    expect(context.action).toBe("accept-policy");
    expect(context.prompt).toContain(readState(statePath).policySha256);
    expect(context.prompt).toContain(readState(statePath).policyPath);
    expect(context.prompt).toContain("not reusable network-enforcement proof");
    return false;
  } })).rejects.toThrow("approval refused");
  expect(readState(statePath).policyAcceptance).toBeNull();
  expect(readState(statePath).completedStage).toBe("policy");
  noAdditionalCalls(before);
});

test("repeat and skipped stages refuse before confirmation or commands", async () => {
  await through("create");
  const before = calls.length;
  const prompts = approvals.length;
  for (const action of ["validate", "create", "accept-policy", "provision", "install", "diagnose", "reset", "resume", "rm"]) {
    await expect(stage(action)).rejects.toThrow();
  }
  noAdditionalCalls(before);
  expect(approvals).toHaveLength(prompts);
});

test("state creation is exclusive and atomic updates leave the previous inode unchanged", async () => {
  const initial = await stage("validate");
  const fd = openSync(statePath, "r");
  try {
    await stage("create");
    expect(JSON.parse(readFileSync(fd, "utf8"))).toEqual(initial);
    expect(readState(statePath).completedStage).toBe("create");
  } finally { closeSync(fd); }
  const before = calls.length;
  await expect(stage("validate")).rejects.toThrow("already exists");
  noAdditionalCalls(before);
});

test.each([0o644, 0o400, 0o660, 0o1600])("state read refuses file mode %s", async (mode) => {
  await stage("validate");
  chmodSync(statePath, mode);
  expect(() => readState(statePath)).toThrow("private file");
  const before = calls.length;
  await expect(stage("create")).rejects.toThrow();
  noAdditionalCalls(before);
});

test("state read refuses symlinks and hard links", async () => {
  await stage("validate");
  const retained = join(root, "retained.json");
  renameSync(statePath, retained);
  symlinkSync(retained, statePath);
  expect(() => readState(statePath)).toThrow();
  rmSync(statePath);
  linkSync(retained, statePath);
  expect(() => readState(statePath)).toThrow("private file");
});

test("state read requires canonical absolute path and private nonsymlink parent", async () => {
  await stage("validate");
  for (const path of ["workflow.json", `${root}/./workflow.json`, `${root}/../${root.split("/").at(-1)}/workflow.json`]) {
    expect(() => readState(path)).toThrow("canonical absolute");
  }
  chmodSync(root, 0o755);
  expect(() => readState(statePath)).toThrow("private and user-owned");
  chmodSync(root, 0o700);
  const alias = join(root, "alias");
  symlinkSync(bin, alias);
  expect(() => readState(join(alias, "workflow.json"))).toThrow();
});

test("state read refuses oversized, malformed, and nonregular files", async () => {
  await stage("validate");
  writeFileSync(statePath, " ".repeat(16385));
  expect(() => readState(statePath)).toThrow("private file");
  writeFileSync(statePath, "{bad-json");
  expect(() => readState(statePath)).toThrow();
  rmSync(statePath);
  mkdirSync(statePath, { mode: 0o600 });
  expect(() => readState(statePath)).toThrow("private file");
});

test("canonical paths reject every ASCII control character before filesystem or command access", async () => {
  for (const code of [...Array(32).keys(), 127]) {
    const path = `${statePath}${String.fromCharCode(code)}`;
    expect(() => readState(path)).toThrow("canonical absolute path required");
    await expect(runStage("validate", { state: path, sbx, bundle, sha256: SHA }, { execute, confirm })).rejects.toThrow("canonical absolute path required");
  }
  expect(approvals).toEqual([]);
  expect(calls).toEqual([]);
});

test.each([
  ["schema", (state) => { state.schema = "wrong"; }],
  ["training readiness", (state) => { state.trainingReady = true; }],
  ["extra raw payload", (state) => { state.raw = "secret"; }],
  ["guest archive", (state) => { state.guestArchivePath = "/home/agent/workspace/devrust-tools.tar"; }],
  ["guest installer", (state) => { state.guestInstallerPath = "/tmp/install.sh"; }],
  ["name", (state) => { state.createdName = "production"; }],
  ["digest", (state) => { state.bundleSha256 = "ABC"; }],
  ["digest type", (state) => { state.bundleSha256 = [SHA]; }],
  ["installer digest type", (state) => { state.installerSha256 = [state.installerSha256]; }],
  ["attempt", (state) => { state.attemptId = ".."; }],
  ["attempt type", (state) => { state.attemptId = [state.attemptId]; }],
  ["completed phase", (state) => { state.completedStage = "install"; }],
  ["inflight phase", (state) => { state.inFlightStage = "install"; }],
  ["status", (state) => { state.status = "RECONCILE"; }],
])("tampered %s refuses without commands", async (_label, change) => {
  await stage("validate");
  mutateState(change);
  const before = calls.length;
  expect(() => readState(statePath)).toThrow();
  await expect(stage("create")).rejects.toThrow();
  noAdditionalCalls(before);
});

test("existing in-flight state cannot resume even when status remains READY", async () => {
  await stage("validate");
  mutateState((state) => { state.inFlightStage = "create"; });
  const before = calls.length;
  await expect(stage("create")).rejects.toThrow("no retry or resume");
  noAdditionalCalls(before);
});

test("invalid executable inputs refuse before approval", async () => {
  const alias = join(root, "alias-sbx");
  symlinkSync(sbx, alias);
  for (const value of [alias, root, "fake-sbx", `${root}/./fake-sbx`]) {
    await expect(runStage("validate", { state: statePath, sbx: value, bundle, sha256: SHA }, { execute, confirm })).rejects.toThrow();
  }
  chmodSync(sbx, 0o600);
  await expect(stage("validate")).rejects.toThrow();
  expect(approvals).toEqual([]);
  expect(calls).toEqual([]);
  expect(existsSync(statePath)).toBe(false);
});

test("failed bounded bundle validation never creates state or runs a sandbox command", async () => {
  override = () => result("", { ok: false, code: 2 });
  await expect(stage("validate")).rejects.toThrow();
  expect(existsSync(statePath)).toBe(false);
  expect(calls).toHaveLength(1);
  expect(calls[0].argv[0]).toBe(join(bin, "bun"));
});

test.each(["EXIT", "TIMEOUT", "OUTPUT_LIMIT", "INTERRUPTED"])("ambiguous creation %s saves attempted name and refuses all retries", async (outcome) => {
  await stage("validate");
  override = () => result(`ATTEMPT_NAME=${NAME}\n`, { ok: false, code: outcome === "EXIT" ? 2 : null, outcome });
  await expect(stage("create")).rejects.toThrow("reconcile");
  expect(readState(statePath)).toMatchObject({ completedStage: "validate", inFlightStage: "create", status: "RECONCILE", createdName: NAME });
  const before = calls.length;
  for (const action of ORDER) await expect(stage(action)).rejects.toThrow();
  noAdditionalCalls(before);
});

test.each([
  `ATTEMPT_NAME=${NAME}\nDEV_CREATED_NAME=${NAME}\nDEV_CREATED_NAME=${NAME}\nRESULT=DEV_ONLY_CREATED\n`,
  `ATTEMPT_NAME=${NAME}\nDEV_CREATED_NAME=${NAME}\nRESULT=DEV_ONLY_CREATED\nRESULT=DEV_ONLY_CREATED\n`,
  `ATTEMPT_NAME=${NAME}\nRESULT=DEV_ONLY_CREATED\n`,
  `ATTEMPT_NAME=${NAME}\nDEV_CREATED_NAME=${NAME}\nRESULT=NOT_CREATED\n`,
])("unconfirmed creation marker refuses and preserves one known attempt: %s", async (stdout) => {
  await stage("validate");
  override = () => result(stdout);
  await expect(stage("create")).rejects.toThrow("reconcile");
  expect(readState(statePath).createdName).toBe(NAME);
  expect(readState(statePath).status).toBe("RECONCILE");
});

test("a thrown executor failure persists unknown-name create reconciliation", async () => {
  await stage("validate");
  override = () => { throw new Error("PRIVATE_CLI_FAILURE"); };
  await expect(stage("create")).rejects.toThrow("reconcile");
  expect(readState(statePath).createdName).toBeNull();
  expect(readFileSync(statePath, "utf8")).not.toContain("PRIVATE_CLI_FAILURE");
});

test.each(["", " \n"])("empty policy %j cannot advance", async (stdout) => {
  await through("create");
  override = () => result(stdout);
  await expect(stage("policy")).rejects.toThrow("reconcile");
  expect(readState(statePath)).toMatchObject({ completedStage: "create", inFlightStage: "policy", status: "RECONCILE", policyPath: null });
});

test("retained policy is exclusive and never overwritten", async () => {
  const state = await through("create");
  const policyPath = `${statePath}.${state.attemptId}.policy.txt`;
  writeFileSync(policyPath, "EXISTING_PRIVATE_POLICY", { mode: 0o600 });
  await expect(stage("policy")).rejects.toThrow("reconcile");
  expect(readFileSync(policyPath, "utf8")).toBe("EXISTING_PRIVATE_POLICY");
  expect(readState(statePath).status).toBe("RECONCILE");
});

test.each(["accept-policy", "provision"])("changed policy digest blocks %s before approval or copy", async (action) => {
  const state = await through(action === "provision" ? "accept-policy" : "policy");
  writeFileSync(state.policyPath, "CHANGED_POLICY");
  const before = calls.length;
  const prompts = approvals.length;
  await expect(stage(action)).rejects.toThrow("digest mismatch");
  noAdditionalCalls(before);
  expect(approvals).toHaveLength(prompts);
});

test("policy is checked again after the human acceptance prompt", async () => {
  const state = await through("policy");
  const before = calls.length;
  await expect(stage("accept-policy", { confirm: async () => {
    writeFileSync(state.policyPath, "CHANGED_DURING_APPROVAL");
    return true;
  } })).rejects.toThrow("digest mismatch");
  noAdditionalCalls(before);
  expect(readState(statePath).policyAcceptance).toBeNull();
});

test.each([
  ["attemptId", "f".repeat(16)], ["createdName", `devrust-${"cd".repeat(12)}`],
  ["policySha256", "b".repeat(64)], ["policyPath", "/tmp/other-policy"], ["consumed", true],
])("tampered policy acknowledgement %s cannot provision", async (key, value) => {
  await through("accept-policy");
  mutateState((state) => { state.policyAcceptance[key] = value; });
  const before = calls.length;
  await expect(stage("provision")).rejects.toThrow();
  noAdditionalCalls(before);
});

test("bundle is revalidated after consuming acceptance and before the first copy", async () => {
  await through("accept-policy");
  const before = calls.length;
  override = (argv, _bounds, state) => {
    expect(state.policyAcceptance.consumed).toBe(true);
    expect(state.inFlightStage).toBe("provision");
    if (argv[3] === SNAPSHOTS) return defaultResult(argv);
    return result("", { ok: false, code: 2 });
  };
  await expect(stage("provision")).rejects.toThrow("reconcile");
  expect(calls.slice(before)).toHaveLength(2);
  expect(calls[before + 1].argv[0]).toBe(join(bin, "bun"));
  expect(readState(statePath)).toMatchObject({ completedStage: "accept-policy", inFlightStage: "provision", status: "RECONCILE", policyAcceptance: { consumed: true } });
});

test("changed installer digest blocks all copies after acceptance consumption", async () => {
  await through("accept-policy");
  mutateState((state) => { state.installerSha256 = "0".repeat(64); });
  const before = calls.length;
  await expect(stage("provision")).rejects.toThrow("reconcile");
  expect(calls.slice(before)).toHaveLength(1);
  expect(readState(statePath).policyAcceptance.consumed).toBe(true);
  expect(readState(statePath).status).toBe("RECONCILE");
});

test.each([1, 2])("failed copy %s consumes acceptance and cannot retry, install or remove", async (whichCopy) => {
  await through("accept-policy");
  let copies = 0;
  override = (argv) => {
    if (argv[1] === "cp" && ++copies === whichCopy) return result("", { ok: false, code: 2 });
    return defaultResult(argv);
  };
  await expect(stage("provision")).rejects.toThrow("reconcile");
  expect(copies).toBe(whichCopy);
  expect(readState(statePath)).toMatchObject({ completedStage: "accept-policy", status: "RECONCILE", policyAcceptance: { consumed: true } });
  const before = calls.length;
  for (const action of ["provision", "install", "accept-policy", "rm"]) await expect(stage(action)).rejects.toThrow();
  noAdditionalCalls(before);
  expect(calls.some(({ argv }) => argv.includes("exec"))).toBe(false);
});

test.each([
  result("RESULT=DEV_ONLY_RUST_1_95_SEEDED\n", { ok: false, code: 2 }),
  result("RESULT=DEV_ONLY_RUST_1_95_SEEDED\n", { ok: false, outcome: "TIMEOUT", code: null }),
  result("release: 1.95.0\n"),
  result("RESULT=DEV_ONLY_RUST_1_95_SEEDED\nRESULT=DEV_ONLY_RUST_1_95_SEEDED\n"),
])("install requires exit zero and one exact seeding marker: %j", async (value) => {
  await through("provision");
  override = () => value;
  await expect(stage("install")).rejects.toThrow("reconcile");
  expect(readState(statePath)).toMatchObject({ completedStage: "provision", inFlightStage: "install", status: "RECONCILE" });
});

test.each([
  ["arbitrary exit two", "not a report", {}],
  ["prefixed JSON", `banner\n${JSON.stringify(report())}`, {}],
  ["wrong schema", report({ schema: "other" }), {}],
  ["wrong target", report({ target: `devrust-${"cd".repeat(12)}` }), {}],
  ["wrong scope", report({ scope: "QUALIFICATION" }), {}],
  ["incomplete", report({ diagnosticComplete: false }), {}],
  ["no live guest", report({ liveGuestObserved: false }), {}],
  ["qualified", report({ f9Qualified: true }), {}],
  ["training ready", report({ trainingReady: true }), {}],
  ["not STOP", report({ result: "PASS" }), {}],
  ["empty probes", report({ probes: {} }), {}],
  ["missing probe", report({ probes: { PREFLIGHT: { status: "PASS" } } }), {}],
  ["failed probe", report({ probes: { ...report().probes, GUEST_EXEC: { status: "FAIL" } } }), {}],
  ["extra probe", report({ probes: { ...report().probes, EXTRA: { status: "PASS" } } }), {}],
  ["missing catalogue", report({ requirements: undefined }), {}],
  ["empty catalogue", report({ requirements: [] }), {}],
  ["reordered catalogue", report({ requirements: report().requirements.toReversed() }), {}],
  ["manufactured gate PASS", report({ requirements: report().requirements.map((item, index) => index === 0 ? { ...item, status: "PASS" } : item) }), {}],
  ["substituted contract", report({ requirements: report().requirements.map((item, index) => index === 0 ? { ...item, source: "other" } : item) }), {}],
  ["exit zero", report(), { ok: true, code: 0 }],
  ["timeout", report(), { outcome: "TIMEOUT", code: null }],
  ["signal", report(), { signal: "SIGTERM" }],
])("diagnostic rejects %s rather than accepting arbitrary STOP/exit two", async (_label, body, metadata) => {
  await through("install");
  override = () => result(typeof body === "string" ? body : JSON.stringify(body), { ok: false, code: 2, ...metadata });
  await expect(stage("diagnose")).rejects.toThrow("reconcile");
  expect(readState(statePath)).toMatchObject({ completedStage: "install", inFlightStage: "diagnose", status: "RECONCILE", reportPath: null, trainingReady: false });
});

test("diagnose invokes the underlying Bun helper without requiring mise on PATH", async () => {
  await through("install");
  expect(existsSync(join(bin, "mise"))).toBe(false);
  await stage("diagnose");
  expect(calls.at(-1).argv.slice(0, 4)).toEqual([join(bin, "bun"), "--no-env-file", "--no-install", DIAGNOSTIC]);
  expect(readState(statePath).completedStage).toBe("diagnose");
});

test("missing PATH Bun fails closed after recording diagnose in-flight", async () => {
  await through("install");
  rmSync(join(bin, "bun"));
  const before = calls.length;
  await expect(stage("diagnose")).rejects.toThrow("reconcile");
  noAdditionalCalls(before);
  expect(readState(statePath).inFlightStage).toBe("diagnose");
  expect(readState(statePath).status).toBe("RECONCILE");
});

test("combined stdout/stderr cap remains enforced for injected results", async () => {
  await through("create");
  override = () => result("x".repeat(40000), { stderr: "y".repeat(30000) });
  await expect(stage("policy")).rejects.toThrow("reconcile");
  expect(readState(statePath).status).toBe("RECONCILE");
  expect(readState(statePath).policyPath).toBeNull();
});

test("default confirmation refuses non-TTY before local validation or remote operations", async () => {
  const input = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
  try {
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    await expect(runStage("validate", { state: statePath, sbx, bundle, sha256: SHA }, { execute })).rejects.toThrow("approval refused");
    expect(calls).toEqual([]);
    expect(existsSync(statePath)).toBe(false);
    const initial = await stage("validate");
    const before = calls.length;
    await expect(runStage("create", { state: statePath }, { execute })).rejects.toThrow("approval refused");
    noAdditionalCalls(before);
    expect(readState(statePath)).toEqual(initial);
    expect(readState(statePath).inFlightStage).toBeNull();
  } finally {
    if (input) Object.defineProperty(process.stdin, "isTTY", input); else delete process.stdin.isTTY;
  }
  expect(Object.getOwnPropertyDescriptor(process.stdin, "isTTY")).toEqual(input);
});

test("terminal input with redirected prompt output cannot authorize a stage", async () => {
  const input = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
  const output = Object.getOwnPropertyDescriptor(process.stderr, "isTTY");
  Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
  Object.defineProperty(process.stderr, "isTTY", { value: false, configurable: true });
  try {
    await expect(runStage("validate", { state: statePath, sbx, bundle, sha256: SHA }, { execute })).rejects.toThrow("approval refused");
    expect(calls).toEqual([]);
    expect(existsSync(statePath)).toBe(false);
  } finally {
    if (input) Object.defineProperty(process.stdin, "isTTY", input); else delete process.stdin.isTTY;
    if (output) Object.defineProperty(process.stderr, "isTTY", output); else delete process.stderr.isTTY;
  }
});

test.each([true, false])("guest wrapper executes only an installer matching its approved digest: %s", (matching) => {
  const installer = join(root, "guest-installer.sh"), marker = join(root, "executed");
  const content = 'printf "%s:%s" "$1" "$2" > "$FIXTURE_CAPTURE"\n';
  writeFileSync(installer, content, { mode: 0o600 });
  const hash = createHash("sha256").update(content).digest("hex");
  const child = spawnSync("/bin/sh", ["-c", guestInstallScript, "sh", installer, matching ? hash : "0".repeat(64), SHA, "0123456789abcdef"], {
    env: { ...process.env, FIXTURE_CAPTURE: marker }, encoding: "utf8", timeout: 5000,
  });
  expect(child.status).toBe(matching ? 0 : 1);
  expect(existsSync(marker)).toBe(matching);
  if (matching) expect(readFileSync(marker, "utf8")).toBe(`${SHA}:0123456789abcdef`);
});

test.each([false, undefined, "approve", "yes", 1])("only injected boolean true can authorize a stage: %j", async (approval) => {
  await expect(stage("validate", { confirm: async () => approval })).rejects.toThrow("approval refused");
  expect(calls).toEqual([]);
  expect(existsSync(statePath)).toBe(false);
});

test("confirmation cannot mutate the engine state through its context", async () => {
  await stage("validate");
  await stage("create", { confirm: async ({ state }) => {
    state.sbxPath = "/wrong/sbx";
    state.attemptId = "0".repeat(16);
    return true;
  } });
  expect(readState(statePath).sbxPath).toBe(sbx);
  expect(calls.at(-1).argv.at(-1)).toBe(sbx);
});

test("on-disk state changes during approval refuse before the remote operation", async () => {
  await stage("validate");
  const before = calls.length;
  await expect(stage("create", { confirm: async () => {
    mutateState((state) => { state.bundleSha256 = "b".repeat(64); });
    return true;
  } })).rejects.toThrow("state changed during approval");
  noAdditionalCalls(before);
  expect(readState(statePath).inFlightStage).toBeNull();
  expect(readState(statePath).bundleSha256).toBe("b".repeat(64));
});

test("exclusive stage lock prevents concurrent approvals and duplicate operations", async () => {
  await stage("validate");
  let release;
  const pending = stage("create", { confirm: () => new Promise((resolve) => { release = resolve; }) });
  expect(release).toBeFunction();
  const before = calls.length;
  await expect(stage("create")).rejects.toThrow();
  noAdditionalCalls(before);
  release(true);
  await pending;
  expect(calls).toHaveLength(before + 1);
});

test("CLI piped approval and confirmation-bypass flags refuse without running fake tools", () => {
  for (const extra of [[], ["--yes"], ["--confirm"], ["--state", statePath]]) {
    const child = spawnSync(process.execPath, ["--no-env-file", "--no-install", ENTRY, "validate", "--state", statePath,
      "--sbx", sbx, "--bundle", bundle, "--sha256", SHA, ...extra], {
      input: "approve\n", encoding: "utf8", timeout: 5000, env: { ...process.env, PATH: bin },
    });
    expect(child.status).toBe(2);
    expect(child.stdout).toBe("");
    expect(child.stderr).toContain("RESULT=DEV_ONLY_STOP");
    expect(child.stderr).not.toContain("exit 99");
    expect(existsSync(statePath)).toBe(false);
  }
});

test.each([undefined, "0123456789abcdef"])("guest installer preserves one-arg archive and selects optional attempt archive: %s", (attempt) => {
  const capture = join(root, "sha-input");
  writeFileSync(join(bin, "sha256sum"), "#!/bin/sh\nIFS= read -r line\nprintf '%s\\n' \"$line\" > \"$FIXTURE_CAPTURE\"\nexit 9\n", { mode: 0o700 });
  const child = spawnSync("/bin/sh", [INSTALLER, SHA, ...(attempt ? [attempt] : [])], {
    env: { ...process.env, PATH: bin, FIXTURE_CAPTURE: capture }, encoding: "utf8", timeout: 5000,
  });
  expect(child.status).toBe(9);
  expect(readFileSync(capture, "utf8")).toBe(`${SHA}  /home/agent/workspace/devrust-tools${attempt ? `-${attempt}` : ""}.tar\n`);
});

test.each([[], ["a"], ["g".repeat(64)], [SHA, "short"], [SHA, "G".repeat(16)], [SHA, "0".repeat(16), "extra"]].map((args) => ({ args })))(
  "guest installer rejects invalid arguments before any external command: %j", ({ args }) => {
    const child = spawnSync("/bin/sh", [INSTALLER, ...args], { env: { ...process.env, PATH: bin }, encoding: "utf8", timeout: 5000 });
    expect(child.status).toBe(2);
    expect(child.stderr).not.toContain("not found");
  },
);

test("guest installer explicitly rejects dangling symlink target and keeps fixed Rust/Cargo version checks", () => {
  const source = readFileSync(INSTALLER, "utf8");
  expect(source).toContain('test ! -e "$target" && test ! -L "$target"');
  expect(source).toContain("release: 1.95.0");
  expect(source).toContain("host: x86_64-unknown-linux-gnu");
  expect(source).toContain("^cargo 1\\.95\\.0[ (]");
  expect(source).toContain("RESULT=DEV_ONLY_RUST_1_95_SEEDED");
});
