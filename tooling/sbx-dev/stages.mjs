#!/usr/bin/env bun
// SPEC: _spec/tooling/sbx-dev/preparation-workflow.puml
import { createHash, randomBytes } from "node:crypto";
import {
  accessSync, closeSync, constants, fchmodSync, fstatSync, fsyncSync, lstatSync,
  openSync, readSync, realpathSync, renameSync, unlinkSync, writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { privateDirectory } from "../sbx-smoke/create-debug.mjs";
import { runBounded } from "../native-ingress/f9-diagnose.mjs";
import { requirements } from "../native-ingress/f9-requirements.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const INSTALLER = join(ROOT, "install-rust.sh");
const SNAPSHOTS = join(ROOT, "snapshots.mjs");
const DIAGNOSTIC = resolve(ROOT, "../native-ingress/f9-diagnose.mjs");
const ACTIONS = ["validate", "create", "policy", "accept-policy", "provision", "install", "diagnose"];
const DIGEST = /^[0-9a-f]{64}$/;
const ATTEMPT = /^[0-9a-f]{16}$/;
const NAME = /^devrust-[0-9a-f]{24}$/;
const STATE_CAP = 16 * 1024;
const STATE_KEYS = [
  "schema", "sbxPath", "bundlePath", "bundleSha256", "installerSha256", "attemptId",
  "createdName", "guestArchivePath", "guestInstallerPath", "completedStage", "inFlightStage",
  "status", "trainingReady", "policyPath", "policySha256", "policyAcceptance", "reportPath", "reportSha256",
];

export const guestInstallScript = `set -eu
PATH=/usr/bin:/bin
export PATH
test "$#" -eq 4
exec 3<"$1"
test -f /proc/self/fd/3
printf '%s  /proc/self/fd/3\\n' "$2" | sha256sum -c - >/dev/null
exec /bin/sh /proc/self/fd/3 "$3" "$4"
`;

function matches(pattern, value) {
  return typeof value === "string" && pattern.test(value);
}

function absolute(path) {
  if (typeof path !== "string" || path.length > 4096 || !isAbsolute(path)
    || path !== resolve(path) || [...path].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
    throw new Error("canonical absolute path required");
  }
  return path;
}

function executable(path) {
  absolute(path);
  const details = lstatSync(path);
  if (!details.isFile() || details.isSymbolicLink()) throw new Error("regular executable required");
  accessSync(path, constants.X_OK);
  return path;
}

function resolveExecutable(name) {
  for (const directory of (process.env.PATH ?? "").split(":")) {
    if (!isAbsolute(directory)) continue;
    try { return executable(realpathSync(join(directory, name))); } catch {}
  }
  throw new Error("required local executable unavailable");
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readFile(parent, name, cap, privateFile = true) {
  const fd = openSync(`/proc/self/fd/${parent}/${name}`, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const details = fstatSync(fd);
    if (!details.isFile() || details.size > cap || (privateFile
      && (details.uid !== process.getuid() || (details.mode & 0o7777) !== 0o600 || details.nlink !== 1))) {
      throw new Error("invalid private file");
    }
    const bytes = Buffer.alloc(cap + 1);
    let size = 0;
    while (size < bytes.length) {
      const count = readSync(fd, bytes, size, bytes.length - size, null);
      if (!count) break;
      size += count;
    }
    const after = fstatSync(fd);
    if (size > cap || size !== details.size || after.size !== details.size || after.mtimeMs !== details.mtimeMs) {
      throw new Error("file changed or exceeded cap");
    }
    return bytes.subarray(0, size);
  } finally { closeSync(fd); }
}

function installerDigest() {
  const directory = openSync(ROOT, constants.O_RDONLY | constants.O_DIRECTORY);
  try { return digest(readFile(directory, "install-rust.sh", 64 * 1024, false)); }
  finally { closeSync(directory); }
}

function artifactPath(statePath, attemptId, kind) {
  return `${statePath}.${attemptId}.${kind}`;
}

export function snapshotPaths(statePath, attemptId) {
  absolute(statePath);
  if (!matches(ATTEMPT, attemptId)) throw new Error("invalid snapshot attempt");
  return {
    bundle: artifactPath(statePath, attemptId, "bundle.snapshot.tar"),
    installer: artifactPath(statePath, attemptId, "installer.snapshot.sh"),
  };
}

function validateState(state, statePath) {
  if (!state || typeof state !== "object" || Array.isArray(state)
    || Object.keys(state).length !== STATE_KEYS.length || STATE_KEYS.some((key) => !Object.hasOwn(state, key))
    || state.schema !== "dev-sbx-workflow-v1" || !matches(ATTEMPT, state.attemptId)
    || !matches(DIGEST, state.bundleSha256) || !matches(DIGEST, state.installerSha256)
    || !ACTIONS.includes(state.completedStage) || !["READY", "RECONCILE"].includes(state.status)
    || state.trainingReady !== false) throw new Error("invalid workflow state");
  absolute(state.sbxPath);
  absolute(state.bundlePath);
  const phase = ACTIONS.indexOf(state.completedStage);
  if (state.guestArchivePath !== `/home/agent/workspace/devrust-tools-${state.attemptId}.tar`
    || state.guestInstallerPath !== `/home/agent/workspace/install-rust-${state.attemptId}.sh`
    || (state.inFlightStage !== null && state.inFlightStage !== ACTIONS[phase + 1])
    || (state.status === "RECONCILE" && state.inFlightStage === null)
    || (state.createdName !== null && !matches(NAME, state.createdName))
    || (phase >= 1 && state.createdName === null)
    || (phase === 0 && state.inFlightStage !== "create" && state.createdName !== null)) {
    throw new Error("invalid workflow binding");
  }
  if ((state.policyPath === null) !== (state.policySha256 === null)
    || (state.policyPath !== null && (state.policyPath !== artifactPath(statePath, state.attemptId, "policy.txt")
      || !matches(DIGEST, state.policySha256)))
    || (phase >= 2 && state.policyPath === null)) throw new Error("invalid policy binding");
  const acceptance = state.policyAcceptance;
  if (acceptance !== null && (!acceptance || typeof acceptance !== "object" || Array.isArray(acceptance)
    || Object.keys(acceptance).sort().join(",") !== "attemptId,consumed,createdName,policyPath,policySha256"
    || acceptance.attemptId !== state.attemptId || acceptance.createdName !== state.createdName
    || acceptance.policyPath !== state.policyPath || acceptance.policySha256 !== state.policySha256
    || typeof acceptance.consumed !== "boolean" || state.policyPath === null)) {
    throw new Error("invalid policy acknowledgement");
  }
  if ((phase >= 3 && acceptance === null) || (phase < 3 && acceptance !== null)
    || (phase === 3 && acceptance?.consumed !== (state.inFlightStage === "provision"))
    || (phase >= 4 && acceptance?.consumed !== true)) throw new Error("invalid policy consumption");
  if ((state.reportPath === null) !== (state.reportSha256 === null)
    || (state.reportPath !== null && (state.reportPath !== artifactPath(statePath, state.attemptId, "report.json")
      || !matches(DIGEST, state.reportSha256)))
    || (phase === 6 && state.reportPath === null)) throw new Error("invalid report binding");
  return state;
}

function readFrom(parent, statePath) {
  return validateState(JSON.parse(readFile(parent, basename(statePath), STATE_CAP).toString("utf8")), statePath);
}

export function readState(statePath) {
  absolute(statePath);
  const parent = privateDirectory(dirname(statePath));
  try { return readFrom(parent, statePath); }
  finally { closeSync(parent); }
}

function exclusiveFile(parent, name, bytes) {
  const fd = openSync(`/proc/self/fd/${parent}/${name}`,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    fchmodSync(fd, 0o600);
    writeFileSync(fd, bytes);
    fsyncSync(fd);
  } finally { closeSync(fd); }
}

function save(parent, statePath, state, initial = false) {
  validateState(state, statePath);
  const bytes = Buffer.from(`${JSON.stringify(state, null, 2)}\n`);
  if (bytes.length > STATE_CAP) throw new Error("workflow state exceeds cap");
  if (initial) exclusiveFile(parent, basename(statePath), bytes);
  else {
    const temporary = `${basename(statePath)}.${randomBytes(8).toString("hex")}.tmp`;
    exclusiveFile(parent, temporary, bytes);
    try {
      renameSync(`/proc/self/fd/${parent}/${temporary}`, `/proc/self/fd/${parent}/${basename(statePath)}`);
    } catch (error) {
      unlinkSync(`/proc/self/fd/${parent}/${temporary}`);
      throw error;
    }
  }
  fsyncSync(parent);
}

async function confirmTTY({ prompt }) {
  if (!process.stdin.isTTY || !process.stderr.isTTY) return false;
  return new Promise((resolveConfirmation) => {
    const terminal = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
    let finished = false;
    const finish = (accepted) => {
      if (finished) return;
      finished = true;
      process.off("SIGINT", interrupted);
      process.off("SIGTERM", interrupted);
      terminal.close();
      resolveConfirmation(accepted);
    };
    const interrupted = () => finish(false);
    process.on("SIGINT", interrupted);
    process.on("SIGTERM", interrupted);
    terminal.once("SIGINT", interrupted);
    terminal.once("close", interrupted);
    terminal.once("line", (line) => finish(line === "approve"));
    process.stderr.write(`${prompt}\nType approve to authorize this stage only: `);
  });
}

function scope(action, state, statePath) {
  const common = `STAGE=${action}\nSTATE_PATH=${statePath}\nATTEMPT=${state.attemptId}\nSBX=${state.sbxPath}\nNAME=${state.createdName ?? "new random devrust-[0-9a-f]{24} name generated by create.sh"}\nWork deadlines exclude <=2s reaping; validator/diagnostic supervisors also allow <=1s cooperative cancellation.`;
  const details = {
    validate: `Read pinned local archive ${state.bundlePath} (SHA256=${state.bundleSha256}, <=2GiB; layout/hash validation <=60s, output<=16KiB). Read fixed installer ${INSTALLER} (<=64KiB). Create exclusive private state. No sandbox operations.`,
    create: `Run /usr/bin/bash -p ${join(ROOT, "create.sh")} --sbx ${state.sbxPath}. Scope: ls/create/ls; new dev-only shell; --pull never --skills off --deny-network ** --cpus 2 --memory 4g. Host<=120s, combined output<=16KiB. No existing sandbox mutation.`,
    policy: `Read sbx policy ls --wide for this name only. Host<=10s, combined output<=64KiB. Retain exclusive private policy listing ${artifactPath(statePath, state.attemptId, "policy.txt")}; do not interpret it as enforcement proof.`,
    "accept-policy": `Read retained policy ${state.policyPath}\nPOLICY_SHA256=${state.policySha256}\nReview that file before accepting. This distinct acknowledgement binds this attempt/name/digest only; it is not reusable network-enforcement proof. No sbx command.`,
    provision: `Consume the one-attempt policy acknowledgement. Snapshot ${state.bundlePath} (<=2GiB, SHA256=${state.bundleSha256}) and fixed installer ${INSTALLER} (<=64KiB, SHA256=${state.installerSha256}) into exclusive private files (host<=60s, output<=16KiB). Retain readonly verified snapshots; extra disk<=2GiB+64KiB. Revalidate snapshot archive layout (<=60s, output<=16KiB). Copy exactly:\n${snapshotPaths(statePath, state.attemptId).bundle} -> ${state.createdName}:${state.guestArchivePath} (host<=90s)\n${snapshotPaths(statePath, state.attemptId).installer} -> ${state.createdName}:${state.guestInstallerPath} (host<=45s)\nCombined output<=16KiB per copy. NO guest exec. No retry after partial copy.`,
    install: `Run sbx exec ${state.createdName} /usr/bin/timeout --kill-after=2s 120s with a fixed /bin/sh verifier. Open ${state.guestInstallerPath} once; verify installer SHA256=${state.installerSha256} through /proc/self/fd/3; execute that same descriptor with archive SHA256=${state.bundleSha256} and attempt ${state.attemptId}. Host<=130s, combined output<=16KiB. Verify and extract ${state.guestArchivePath} only to /home/agent/workspace/devrust-tools; refuse existing/symlink target; check Rust/Cargo 1.95. No download/build/test.`,
    diagnose: `Run bun --no-env-file --no-install ${DIAGNOSTIC} --sbx ${state.sbxPath} --name ${state.createdName} --confirm-dev-diagnostic. Separate live diagnostic only: listing, policy readback, bounded guest capability probe. Host deadline<=60s, combined output<=128KiB. Cancellation sends TERM for cooperative child cleanup, then KILL after<=1s, with <=2s reap allowance. Accept original helper exit 2 only with a complete structured F9 STOP report. Retain exclusive private report ${artifactPath(statePath, state.attemptId, "report.json")}. F9 remains STOP; trainingReady=false.`,
  };
  return `${common}\n${details[action]}`;
}

async function approved(action, state, statePath, confirm) {
  if (await confirm({ action, state: structuredClone(state), statePath, prompt: scope(action, state, statePath) }) !== true) {
    throw new Error("operator approval refused");
  }
}

async function executeChecked(execute, argv, bounds, expectedCode = 0) {
  const result = await execute(argv, bounds);
  if (!result || typeof result.stdout !== "string" || typeof result.stderr !== "string"
    || Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr) > bounds.cap) {
    throw new Error("invalid or oversized bounded result");
  }
  if (result.outcome !== "EXIT" || result.signal !== null || result.code !== expectedCode
    || (expectedCode === 0 && result.ok !== true)) {
    const error = new Error("bounded operation failed; reconcile required");
    error.result = result;
    throw error;
  }
  return result;
}

async function checkPinnedBundle(state, execute) {
  const result = await executeChecked(execute, [resolveExecutable("bun"), "--no-env-file", "--no-install",
    join(ROOT, "check-bundle.mjs"), state.bundlePath, state.bundleSha256], { milliseconds: 60000, cap: 16384, graceMilliseconds: 1000 });
  if (result.stdout.trim() !== "BUNDLE=HASH_AND_LAYOUT_OK") throw new Error("bundle validation marker missing");
}

function policyFile(parent, state) {
  if (digest(readFile(parent, basename(state.policyPath), 65536)) !== state.policySha256) {
    throw new Error("retained policy digest mismatch");
  }
}

function createName(stdout, strict = true) {
  const lines = stdout.split("\n");
  const created = lines.filter((line) => line.startsWith("DEV_CREATED_NAME="));
  const attempts = lines.filter((line) => line.startsWith("ATTEMPT_NAME="));
  const results = lines.filter((line) => line.startsWith("RESULT="));
  const name = created[0]?.slice("DEV_CREATED_NAME=".length);
  if (strict) {
    if (created.length !== 1 || !NAME.test(name ?? "") || results.length !== 1 || results[0] !== "RESULT=DEV_ONLY_CREATED"
      || attempts.length > 1 || (attempts.length === 1 && attempts[0] !== `ATTEMPT_NAME=${name}`)) {
      throw new Error("creation result not uniquely confirmed");
    }
    return name;
  }
  const candidates = [...created.map((line) => line.slice("DEV_CREATED_NAME=".length)),
    ...attempts.map((line) => line.slice("ATTEMPT_NAME=".length))];
  return candidates.length > 0 && candidates.every((candidate) => NAME.test(candidate) && candidate === candidates[0])
    ? candidates[0] : null;
}

function diagnosticReport(stdout, state) {
  const report = JSON.parse(stdout);
  const probes = ["PREFLIGHT", "VM_LOOKUP", "POLICY_READBACK", "GUEST_EXEC"];
  if (!report || report.schema !== "f9-live-diagnostic-v1" || report.scope !== "DEVELOPMENT_RECONNAISSANCE_ONLY"
    || report.target !== state.createdName || report.diagnosticComplete !== true || report.liveGuestObserved !== true
    || report.f9Qualified !== false || report.trainingReady !== false || report.result !== "STOP"
    || !report.probes || Object.keys(report.probes).length !== probes.length
    || probes.some((probe) => report.probes[probe]?.status !== "PASS")
    || !Array.isArray(report.requirements) || report.requirements.length !== requirements.length
    || requirements.some((expected, index) => {
      const actual = report.requirements[index];
      return actual?.id !== expected.id || actual.source !== expected.source || actual.nextStep !== expected.nextStep
        || actual.status !== "BLOCKED" || actual.execution !== "NOT_RUN" || actual.verifier !== null;
    })) throw new Error("diagnostic STOP report not verified");
  return report;
}

export async function runStage(action, options, dependencies = {}) {
  if (!ACTIONS.includes(action)) throw new Error("unknown workflow stage");
  const statePath = absolute(options?.state ?? options?.statePath);
  const execute = dependencies.execute ?? runBounded;
  const confirm = dependencies.confirm ?? confirmTTY;
  const parent = privateDirectory(dirname(statePath));
  const lock = `${basename(statePath)}.lock`;
  let locked = false;
  try {
    exclusiveFile(parent, lock, Buffer.alloc(0));
    locked = true;
    if (action === "validate") {
      let exists = false;
      try {
        lstatSync(`/proc/self/fd/${parent}/${basename(statePath)}`);
        exists = true;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (exists) throw new Error("workflow state already exists");
      const state = {
        schema: "dev-sbx-workflow-v1", sbxPath: executable(options.sbx), bundlePath: absolute(options.bundle),
        bundleSha256: options.sha256, installerSha256: "0".repeat(64), attemptId: randomBytes(8).toString("hex"),
        createdName: null, guestArchivePath: "", guestInstallerPath: "", completedStage: "validate",
        inFlightStage: null, status: "READY", trainingReady: false,
        policyPath: null, policySha256: null, policyAcceptance: null, reportPath: null, reportSha256: null,
      };
      if (!matches(DIGEST, state.bundleSha256)) throw new Error("pinned lowercase SHA256 required");
      state.guestArchivePath = `/home/agent/workspace/devrust-tools-${state.attemptId}.tar`;
      state.guestInstallerPath = `/home/agent/workspace/install-rust-${state.attemptId}.sh`;
      await approved(action, state, statePath, confirm);
      await checkPinnedBundle(state, execute);
      state.installerSha256 = installerDigest();
      save(parent, statePath, state, true);
      return state;
    }
    const state = readFrom(parent, statePath);
    if (state.status !== "READY" || state.inFlightStage !== null
      || state.completedStage !== ACTIONS[ACTIONS.indexOf(action) - 1]) throw new Error("stage order refused; no retry or resume");
    executable(state.sbxPath);
    if (action === "accept-policy" || action === "provision") policyFile(parent, state);
    await approved(action, state, statePath, confirm);
    if (JSON.stringify(readFrom(parent, statePath)) !== JSON.stringify(state)) throw new Error("state changed during approval");
    if (action === "accept-policy") {
      policyFile(parent, state);
      state.policyAcceptance = {
        attemptId: state.attemptId, createdName: state.createdName,
        policyPath: state.policyPath, policySha256: state.policySha256, consumed: false,
      };
      state.completedStage = action;
      save(parent, statePath, state);
      return state;
    }
    state.inFlightStage = action;
    if (action === "provision") state.policyAcceptance.consumed = true;
    save(parent, statePath, state);
    let observedCreate = "";
    try {
      if (action === "create") {
        const result = await executeChecked(execute, ["/usr/bin/bash", "-p", join(ROOT, "create.sh"), "--sbx", state.sbxPath],
          { milliseconds: 120000, cap: 16384 });
        observedCreate = result.stdout;
        state.createdName = createName(result.stdout);
      } else if (action === "policy") {
        const result = await executeChecked(execute, [state.sbxPath, "policy", "ls", "--wide", state.createdName],
          { milliseconds: 10000, cap: 65536 });
        if (!result.stdout.trim()) throw new Error("empty policy listing");
        state.policyPath = artifactPath(statePath, state.attemptId, "policy.txt");
        exclusiveFile(parent, basename(state.policyPath), result.stdout);
        state.policySha256 = digest(result.stdout);
      } else if (action === "provision") {
        policyFile(parent, state);
        const snapshots = snapshotPaths(statePath, state.attemptId);
        const snapshot = await executeChecked(execute, [resolveExecutable("bun"), "--no-env-file", "--no-install",
          SNAPSHOTS, "--state", statePath], { milliseconds: 60000, cap: 16384 });
        if (snapshot.stdout !== "SNAPSHOTS=VERIFIED_PRIVATE_INPUTS\n") throw new Error("snapshot verification marker missing");
        await checkPinnedBundle({ ...state, bundlePath: snapshots.bundle }, execute);
        await executeChecked(execute, [state.sbxPath, "cp", snapshots.bundle, `${state.createdName}:${state.guestArchivePath}`],
          { milliseconds: 90000, cap: 16384 });
        await executeChecked(execute, [state.sbxPath, "cp", snapshots.installer, `${state.createdName}:${state.guestInstallerPath}`],
          { milliseconds: 45000, cap: 16384 });
      } else if (action === "install") {
        const result = await executeChecked(execute, [state.sbxPath, "exec", state.createdName,
          "/usr/bin/timeout", "--kill-after=2s", "120s", "/bin/sh", "-c", guestInstallScript, "sh",
          state.guestInstallerPath, state.installerSha256, state.bundleSha256, state.attemptId],
        { milliseconds: 130000, cap: 16384 });
        if (result.stdout.split("\n").filter((line) => line.startsWith("RESULT=")).join("\n")
          !== "RESULT=DEV_ONLY_RUST_1_95_SEEDED") throw new Error("installation marker missing");
      } else if (action === "diagnose") {
        const result = await executeChecked(execute, [resolveExecutable("bun"), "--no-env-file", "--no-install", DIAGNOSTIC,
          "--sbx", state.sbxPath, "--name", state.createdName, "--confirm-dev-diagnostic"],
        { milliseconds: 60000, cap: 131072, graceMilliseconds: 1000 }, 2);
        diagnosticReport(result.stdout, state);
        state.reportPath = artifactPath(statePath, state.attemptId, "report.json");
        exclusiveFile(parent, basename(state.reportPath), result.stdout);
        state.reportSha256 = digest(result.stdout);
      }
      state.completedStage = action;
      state.inFlightStage = null;
      save(parent, statePath, state);
      return state;
    } catch (error) {
      if (action === "create") state.createdName = createName(error.result?.stdout ?? observedCreate, false);
      state.status = "RECONCILE";
      state.inFlightStage = action;
      state.completedStage = ACTIONS[ACTIONS.indexOf(action) - 1];
      if (state.policyPath !== null && state.policySha256 === null) state.policyPath = null;
      if (state.reportPath !== null && state.reportSha256 === null) state.reportPath = null;
      save(parent, statePath, state);
      throw new Error("stage failed; reconcile without retry, resume, reset or removal");
    }
  } finally {
    try { if (locked) unlinkSync(`/proc/self/fd/${parent}/${lock}`); }
    finally { closeSync(parent); }
  }
}

async function main(argv) {
  const action = argv[0];
  try {
    const { values } = parseArgs({ args: argv.slice(1), strict: true, allowPositionals: false, options: {
      state: { type: "string" }, sbx: { type: "string" }, bundle: { type: "string" }, sha256: { type: "string" },
    } });
    const flags = argv.slice(1).filter((value) => value.startsWith("--")).map((value) => value.split("=")[0]);
    if (new Set(flags).size !== flags.length || !values.state || !ACTIONS.includes(action)
      || (action === "validate" ? Object.keys(values).length !== 4 : Object.keys(values).length !== 1)) {
      throw new Error("invalid stage arguments");
    }
    const state = await runStage(action, values);
    console.log(`STAGE=${action}\nSTATE_PATH=${values.state}`);
    if (state.createdName) console.log(`DEV_CREATED_NAME=${state.createdName}`);
    if (state.policyPath) console.log(`POLICY_PRIVATE_FILE=${state.policyPath}`);
    if (state.reportPath) console.log(`REPORT_PRIVATE_FILE=${state.reportPath}`);
    console.log(`RESULT=${action === "diagnose" ? "DEV_ONLY_DIAGNOSTIC_COMPLETE_F9_STOP" : "DEV_ONLY_STAGE_COMPLETE"}\nTRAINING_READY=false`);
    return 0;
  } catch {
    console.error(`STAGE=${ACTIONS.includes(action) ? action : "INVALID"}\nRESULT=DEV_ONLY_STOP\nTRAINING_READY=false`);
    return 2;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
