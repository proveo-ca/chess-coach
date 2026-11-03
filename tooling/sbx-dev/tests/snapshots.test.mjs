// SPEC: _spec/tooling/sbx-dev/preparation-workflow.puml
import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync, constants, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  renameSync, rmSync, statSync, symlinkSync, truncateSync, writeFileSync,
} from "node:fs";
import * as fs from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSnapshots, main } from "../snapshots.mjs";
import { readState, snapshotPaths } from "../stages.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ENTRY = join(ROOT, "snapshots.mjs");
const INSTALLER = join(ROOT, "install-rust.sh");
const ATTEMPT = "0123456789abcdef";
const NAME = `devrust-${"ab".repeat(12)}`;
const actualOpen = fs.open;
let root, statePath, bundle, state, paths, cleanup;

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function save() {
  writeFileSync(statePath, `${JSON.stringify(state)}\n`, { mode: 0o600 });
}

function interceptSource(path, onOpen) {
  return spyOn(fs, "open").mockImplementation(async (...args) => {
    const handle = await actualOpen(...args);
    if (args[0] === path) await onOpen(handle, args);
    return handle;
  });
}

function changeDuringRead(path, change) {
  let changed = false;
  interceptSource(path, (handle) => {
    const read = handle.read.bind(handle);
    spyOn(handle, "read").mockImplementation(async (...args) => {
      const result = await read(...args);
      if (!changed && result.bytesRead > 0) {
        changed = true;
        change();
      }
      return result;
    });
  });
  return () => changed;
}

function cli(args) {
  return spawnSync(process.execPath, ["--no-env-file", "--no-install", ENTRY, ...args],
    { encoding: "utf8", timeout: 10000, env: { PATH: "/nonexistent", HOME: root } });
}

beforeEach(() => {
  root = mkdtempSync("/tmp/opencode/sbx-snapshots-");
  chmodSync(root, 0o700);
  cleanup = [root];
  statePath = join(root, "workflow.json");
  bundle = join(root, "fixture.tar");
  mkdirSync(join(root, "sysroot"), { mode: 0o700 });
  writeFileSync(join(root, "sysroot", "fixture.txt"), "offline fake sysroot\n", { mode: 0o600 });
  writeFileSync(bundle, Buffer.alloc(3 * 128 * 1024 + 17, 0x61), { mode: 0o600 });
  const sbxPath = join(root, "fake-sbx");
  writeFileSync(sbxPath, "#!/bin/sh\nexit 99\n", { mode: 0o700 });
  const policyPath = `${statePath}.${ATTEMPT}.policy.txt`;
  const policy = "OFFLINE_POLICY_FIXTURE\n";
  writeFileSync(policyPath, policy, { mode: 0o600 });
  state = {
    schema: "dev-sbx-workflow-v1", sbxPath, bundlePath: bundle,
    bundleSha256: digest(readFileSync(bundle)), installerSha256: digest(readFileSync(INSTALLER)), attemptId: ATTEMPT,
    createdName: NAME, guestArchivePath: `/home/agent/workspace/devrust-tools-${ATTEMPT}.tar`,
    guestInstallerPath: `/home/agent/workspace/install-rust-${ATTEMPT}.sh`, completedStage: "accept-policy",
    inFlightStage: "provision", status: "READY", trainingReady: false, policyPath,
    policySha256: digest(policy), policyAcceptance: {
      attemptId: ATTEMPT, createdName: NAME, policyPath, policySha256: digest(policy), consumed: true,
    }, reportPath: null, reportSha256: null,
  };
  save();
  paths = snapshotPaths(statePath, ATTEMPT);
});

afterEach(() => {
  mock.restore();
  for (const path of cleanup) rmSync(path, { recursive: true, force: true });
});

test("creates distinct private read-only snapshots with the approved bytes without changing state", async () => {
  const initial = readFileSync(statePath);
  expect(readState(statePath)).toEqual(state);
  expect(await createSnapshots(statePath)).toEqual(paths);
  for (const [path, source] of [[paths.bundle, bundle], [paths.installer, INSTALLER]]) {
    expect(readFileSync(path)).toEqual(readFileSync(source));
    const details = lstatSync(path);
    expect(details.isFile()).toBe(true);
    expect(details.mode & 0o7777).toBe(0o400);
    expect(details.uid).toBe(process.getuid());
    expect(details.nlink).toBe(1);
    expect(details.ino).not.toBe(statSync(source).ino);
  }
  expect(statSync(root).mode & 0o7777).toBe(0o700);
  expect(readFileSync(statePath)).toEqual(initial);
});

test("uses nofollow/nonblock source opens and bounded asynchronous reads and writes", async () => {
  const reads = [], writes = [], sources = [];
  spyOn(fs, "open").mockImplementation(async (...args) => {
    const handle = await actualOpen(...args);
    if (args[0] === bundle || args[0] === INSTALLER) {
      sources.push(args);
      const read = handle.read.bind(handle);
      spyOn(handle, "read").mockImplementation((...values) => {
        reads.push(values[2]);
        return read(...values);
      });
    } else {
      expect(args[1] & constants.O_EXCL).toBe(constants.O_EXCL);
      expect(args[1] & constants.O_NOFOLLOW).toBe(constants.O_NOFOLLOW);
      expect(args[2]).toBe(0o600);
      const write = handle.write.bind(handle);
      spyOn(handle, "write").mockImplementation((...values) => {
        writes.push(values[2]);
        return write(...values);
      });
    }
    return handle;
  });
  await createSnapshots(statePath);
  expect(sources.map(([path]) => path)).toEqual([bundle, INSTALLER]);
  for (const [, flags] of sources) {
    expect(flags & constants.O_NOFOLLOW).toBe(constants.O_NOFOLLOW);
    expect(flags & constants.O_NONBLOCK).toBe(constants.O_NONBLOCK);
  }
  expect(reads.length).toBeGreaterThan(3);
  expect(writes.length).toBeGreaterThan(3);
  for (const size of [...reads, ...writes]) expect(size).toBeLessThanOrEqual(128 * 1024);
});

test("handles partial asynchronous writes without losing approved bytes", async () => {
  spyOn(fs, "open").mockImplementation(async (...args) => {
    const handle = await actualOpen(...args);
    if (args[1] & constants.O_EXCL) {
      const write = handle.write.bind(handle);
      spyOn(handle, "write").mockImplementation((buffer, offset, length, position) =>
        write(buffer, offset, Math.min(length, 997), position));
    }
    return handle;
  });
  await createSnapshots(statePath);
  expect(readFileSync(paths.bundle)).toEqual(readFileSync(bundle));
});

test.each(["bundle", "installer"])("never overwrites an existing %s snapshot and retains earlier files", async (kind) => {
  writeFileSync(paths[kind], "EXISTING_PRIVATE_INPUT", { mode: 0o600 });
  await expect(createSnapshots(statePath)).rejects.toThrow();
  expect(readFileSync(paths[kind], "utf8")).toBe("EXISTING_PRIVATE_INPUT");
  expect(existsSync(paths.bundle)).toBe(true);
  if (kind === "bundle") expect(existsSync(paths.installer)).toBe(false);
  else expect(statSync(paths.bundle).mode & 0o7777).toBe(0o400);
});

test("completed snapshots cannot be reused", async () => {
  await createSnapshots(statePath);
  const before = statSync(paths.bundle, { bigint: true });
  await expect(createSnapshots(statePath)).rejects.toThrow();
  expect(statSync(paths.bundle, { bigint: true })).toEqual(before);
});

test("retains a partial snapshot and refuses a second attempt after a write failure", async () => {
  let failed = false;
  spyOn(fs, "open").mockImplementation(async (...args) => {
    const handle = await actualOpen(...args);
    if (args[1] & constants.O_EXCL) {
      const write = handle.write.bind(handle);
      spyOn(handle, "write").mockImplementation(async (...values) => {
        if (failed) throw new Error("OFFLINE_WRITE_FAILURE");
        failed = true;
        return write(values[0], values[1], 1, values[3]);
      });
    }
    return handle;
  });
  await expect(createSnapshots(statePath)).rejects.toThrow();
  expect(statSync(paths.bundle).size).toBe(1);
  expect(statSync(paths.bundle).mode & 0o7777).toBe(0o600);
  mock.restore();
  await expect(createSnapshots(statePath)).rejects.toThrow();
  expect(statSync(paths.bundle).size).toBe(1);
  expect(existsSync(paths.installer)).toBe(false);
});

test.each(["bundleSha256", "installerSha256"])("rejects a mismatched %s and retains snapshots", async (field) => {
  state[field] = "0".repeat(64);
  save();
  await expect(createSnapshots(statePath)).rejects.toThrow();
  expect(existsSync(paths.bundle)).toBe(true);
  const failed = field === "bundleSha256" ? paths.bundle : paths.installer;
  expect(statSync(failed).mode & 0o7777).toBe(0o600);
  expect(readFileSync(failed)).toEqual(readFileSync(field === "bundleSha256" ? bundle : INSTALLER));
});

test.each(["symlink", "directory", "fifo"])("refuses a %s bundle source without blocking", async (kind) => {
  rmSync(bundle);
  if (kind === "symlink") symlinkSync(INSTALLER, bundle);
  if (kind === "directory") mkdirSync(bundle, { mode: 0o700 });
  if (kind === "fifo") {
    const result = spawnSync("/usr/bin/mkfifo", [bundle], { timeout: 1000 });
    expect(result.status).toBe(0);
  }
  await expect(createSnapshots(statePath)).rejects.toThrow();
  expect(existsSync(paths.bundle)).toBe(false);
});

test("rejects a sparse source beyond the archive cap before destination creation", async () => {
  truncateSync(bundle, 2 * 1024 ** 3 + 1);
  await expect(createSnapshots(statePath)).rejects.toThrow();
  expect(existsSync(paths.bundle)).toBe(false);
});

test("enforces the fixed installer cap using an offline intercepted source", async () => {
  const oversized = join(root, "oversized-installer");
  writeFileSync(oversized, Buffer.alloc(64 * 1024 + 1));
  spyOn(fs, "open").mockImplementation((path, ...args) => actualOpen(path === INSTALLER ? oversized : path, ...args));
  await expect(createSnapshots(statePath)).rejects.toThrow();
  expect(statSync(paths.bundle).mode & 0o7777).toBe(0o400);
  expect(existsSync(paths.installer)).toBe(false);
});

test("copies the opened approved inode when the source pathname is replaced after open", async () => {
  const approved = readFileSync(bundle);
  const retained = join(root, "opened-source");
  interceptSource(bundle, () => {
    renameSync(bundle, retained);
    writeFileSync(bundle, "UNAPPROVED_REPLACEMENT", { mode: 0o600 });
  });
  await createSnapshots(statePath);
  expect(readFileSync(paths.bundle)).toEqual(approved);
  expect(readFileSync(paths.bundle)).not.toEqual(readFileSync(bundle));
});

test("allows a hard-linked source but creates a distinct single-link destination", async () => {
  linkSync(bundle, join(root, "source-alias"));
  await createSnapshots(statePath);
  expect(statSync(bundle).nlink).toBe(2);
  expect(statSync(paths.bundle).nlink).toBe(1);
  expect(statSync(paths.bundle).ino).not.toBe(statSync(bundle).ino);
});

test.each(["mode", "same-bytes", "content", "shrink", "grow"])("rejects source inode mutation: %s", async (kind) => {
  const original = readFileSync(bundle);
  const changed = changeDuringRead(bundle, () => {
    if (kind === "mode") chmodSync(bundle, 0o640);
    if (kind === "same-bytes") writeFileSync(bundle, original);
    if (kind === "content") writeFileSync(bundle, Buffer.alloc(original.length, 0x62));
    if (kind === "shrink") truncateSync(bundle, 1);
    if (kind === "grow") truncateSync(bundle, original.length + 1);
  });
  await expect(createSnapshots(statePath)).rejects.toThrow();
  expect(changed()).toBe(true);
  expect(existsSync(paths.bundle)).toBe(true);
  expect(existsSync(paths.installer)).toBe(false);
});

test.each(["symlink", "hardlink"])("refuses a pre-existing %s destination without modifying its target", async (kind) => {
  const target = join(root, "existing-target");
  writeFileSync(target, "RETAIN_THIS_INPUT", { mode: 0o600 });
  if (kind === "symlink") symlinkSync(target, paths.bundle);
  else linkSync(target, paths.bundle);
  await expect(createSnapshots(statePath)).rejects.toThrow();
  expect(readFileSync(target, "utf8")).toBe("RETAIN_THIS_INPUT");
});

test("rejects destination hard-link creation during copying", async () => {
  const changed = changeDuringRead(bundle, () => linkSync(paths.bundle, join(root, "snapshot-alias")));
  await expect(createSnapshots(statePath)).rejects.toThrow();
  expect(changed()).toBe(true);
  expect(statSync(paths.bundle).nlink).toBe(2);
});

test.each([
  ["not in flight", (value) => { value.inFlightStage = null; value.policyAcceptance.consumed = false; }],
  ["not consumed", (value) => { value.policyAcceptance.consumed = false; }],
  ["reconciliation", (value) => { value.status = "RECONCILE"; }],
  ["wrong phase", (value) => { value.completedStage = "provision"; value.inFlightStage = "install"; }],
  ["training ready", (value) => { value.trainingReady = true; }],
  ["unbound acceptance", (value) => { value.policyAcceptance.attemptId = "f".repeat(16); }],
  ["unknown key", (value) => { value.untrusted = true; }],
])("refuses state with %s before snapshot creation", async (_label, change) => {
  change(state);
  save();
  await expect(createSnapshots(statePath)).rejects.toThrow();
  expect(existsSync(paths.bundle)).toBe(false);
  expect(existsSync(paths.installer)).toBe(false);
});

test.each(["rewrite", "replace", "phase"])("rejects state %s during copying and retains evidence", async (kind) => {
  const changed = changeDuringRead(bundle, () => {
    if (kind === "replace") renameSync(statePath, join(root, "previous-state"));
    if (kind === "phase") state.status = "RECONCILE";
    save();
  });
  await expect(createSnapshots(statePath)).rejects.toThrow();
  expect(changed()).toBe(true);
  expect(existsSync(paths.bundle)).toBe(true);
  expect(existsSync(paths.installer)).toBe(false);
});

test("rejects a changed absolute parent while retaining files in the anchored directory", async () => {
  const moved = `${root}-moved`;
  cleanup.push(moved);
  const changed = changeDuringRead(bundle, () => {
    renameSync(root, moved);
    mkdirSync(root, { mode: 0o700 });
    save();
  });
  await expect(createSnapshots(statePath)).rejects.toThrow();
  expect(changed()).toBe(true);
  expect(existsSync(paths.bundle)).toBe(false);
  expect(existsSync(join(moved, paths.bundle.slice(root.length + 1)))).toBe(true);
});

test.each([0o755, 0o770, 0o1700])("rejects a non-private parent mode %s", async (mode) => {
  chmodSync(root, mode);
  await expect(createSnapshots(statePath)).rejects.toThrow();
  expect(existsSync(paths.bundle)).toBe(false);
});

test("refuses a symlink parent chain", async () => {
  const alias = join(root, "alias");
  symlinkSync(root, alias);
  await expect(createSnapshots(join(alias, "workflow.json"))).rejects.toThrow();
  expect(existsSync(paths.bundle)).toBe(false);
});

test.each(["symlink", "hardlink", "public", "malformed"])("refuses %s state", async (kind) => {
  if (kind === "public") chmodSync(statePath, 0o644);
  else if (kind === "malformed") writeFileSync(statePath, "{not-json");
  else {
    const retained = join(root, "retained-state");
    renameSync(statePath, retained);
    if (kind === "symlink") symlinkSync(retained, statePath);
    else linkSync(retained, statePath);
  }
  await expect(createSnapshots(statePath)).rejects.toThrow();
  expect(existsSync(paths.bundle)).toBe(false);
});

test("CLI returns the exact success marker and cannot overwrite completed snapshots", () => {
  const success = cli(["--state", statePath]);
  expect(success.status).toBe(0);
  expect(success.stdout).toBe("SNAPSHOTS=VERIFIED_PRIVATE_INPUTS\n");
  expect(success.stderr).toBe("");
  const before = readFileSync(paths.bundle);
  const repeat = cli(["--state", statePath]);
  expect(repeat.status).toBe(2);
  expect(repeat.stdout).toBe("");
  expect(repeat.stderr).toBe("STOP\n");
  expect(readFileSync(paths.bundle)).toEqual(before);
});

test("CLI rejects missing, duplicate, unknown, positional, and noncanonical arguments without host paths", () => {
  for (const args of [[], ["--state"], ["--state", statePath, "--state", statePath],
    [`--state=${statePath}`, `--state=${statePath}`], ["--unknown", statePath], [statePath],
    ["--state", "workflow.json"], ["--state", `${root}/./workflow.json`], ["--state", `${statePath}\n`]]) {
    const stopped = cli(args);
    expect(stopped.status).toBe(2);
    expect(stopped.stdout).toBe("");
    expect(stopped.stderr).toBe("STOP\n");
  }
  expect(existsSync(paths.bundle)).toBe(false);
});

test("CLI requires a valid authorized in-flight state", () => {
  state.inFlightStage = null;
  state.policyAcceptance.consumed = false;
  save();
  const stopped = cli(["--state", statePath]);
  expect(stopped.status).toBe(2);
  expect(stopped.stdout).toBe("");
  expect(stopped.stderr).toBe("STOP\n");
  expect(existsSync(paths.bundle)).toBe(false);
});

test("main rejects every ASCII path control character without filesystem access", async () => {
  const stdout = spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderr = spyOn(process.stderr, "write").mockImplementation(() => true);
  for (const code of [...Array(32).keys(), 127]) {
    expect(await main(["--state", `${statePath}${String.fromCharCode(code)}`])).toBe(2);
  }
  expect(stdout).not.toHaveBeenCalled();
  expect(stderr).toHaveBeenCalledTimes(33);
  for (const args of stderr.mock.calls) expect(args).toEqual(["STOP\n"]);
  expect(existsSync(paths.bundle)).toBe(false);
});

test("importing the helper performs no snapshot or CLI operations", () => {
  const result = spawnSync(process.execPath, ["--no-env-file", "--no-install", "-e", `await import(${JSON.stringify(ENTRY)})`],
    { encoding: "utf8", timeout: 10000, env: { PATH: "/nonexistent", HOME: root } });
  expect(result.status).toBe(0);
  expect(result.stdout).toBe("");
  expect(result.stderr).toBe("");
  expect(existsSync(paths.bundle)).toBe(false);
});
