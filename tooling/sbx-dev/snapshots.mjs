#!/usr/bin/env bun
// SPEC: _spec/tooling/sbx-dev/preparation-workflow.puml
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, fsyncSync, openSync, readSync } from "node:fs";
import * as fs from "node:fs/promises";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { privateDirectory } from "../sbx-smoke/create-debug.mjs";
import { readState, snapshotPaths } from "./stages.mjs";

const INSTALLER = fileURLToPath(new URL("./install-rust.sh", import.meta.url));
const STATE_CAP = 16 * 1024;
const CHUNK = 128 * 1024;
const METADATA = ["dev", "ino", "mode", "nlink", "uid", "gid", "rdev", "size", "blksize", "blocks", "mtimeNs", "ctimeNs", "birthtimeNs"];

function absolute(path) {
  if (typeof path !== "string" || path.length > 4096 || !isAbsolute(path) || path !== resolve(path)
    || [...path].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
    throw new Error("canonical absolute state path required");
  }
  return path;
}

function sameMetadata(before, after) {
  return METADATA.every((field) => before[field] === after[field]);
}

function privateFile(details, mode, size) {
  if (!details.isFile() || details.uid !== BigInt(process.getuid()) || details.nlink !== 1n
    || (details.mode & 0o7777n) !== BigInt(mode) || (size !== undefined && details.size !== BigInt(size))) {
    throw new Error("invalid private snapshot file");
  }
}

function unchangedParent(parent, directory, initial) {
  const current = privateDirectory(directory);
  try {
    const details = fstatSync(current, { bigint: true });
    const anchored = fstatSync(parent, { bigint: true });
    if (["dev", "ino", "mode", "uid", "gid", "nlink"].some((field) => details[field] !== initial[field]
      || anchored[field] !== initial[field])) throw new Error("snapshot parent changed");
  } finally { closeSync(current); }
}

function stateFile(parent, statePath) {
  const fd = openSync(`/proc/self/fd/${parent}/${basename(statePath)}`,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const details = fstatSync(fd, { bigint: true });
    privateFile(details, 0o600);
    if (details.size < 0n || details.size > BigInt(STATE_CAP)) throw new Error("state exceeds cap");
    const buffer = Buffer.alloc(STATE_CAP + 1);
    let size = 0;
    while (size < buffer.length) {
      const count = readSync(fd, buffer, size, buffer.length - size, null);
      if (!count) break;
      size += count;
    }
    if (BigInt(size) !== details.size || !sameMetadata(details, fstatSync(fd, { bigint: true }))) {
      throw new Error("state changed");
    }
    return { details, bytes: buffer.subarray(0, size) };
  } finally { closeSync(fd); }
}

function checkedState(parent, statePath, directory, initial, previous) {
  unchangedParent(parent, directory, initial);
  const state = readState(statePath);
  if (state.completedStage !== "accept-policy" || state.inFlightStage !== "provision"
    || state.status !== "READY" || state.trainingReady !== false || state.policyAcceptance?.consumed !== true) {
    throw new Error("authorized in-flight provision required");
  }
  const captured = stateFile(parent, statePath);
  if (JSON.stringify(JSON.parse(captured.bytes.toString("utf8"))) !== JSON.stringify(state)
    || (previous && (!sameMetadata(previous.details, captured.details) || !previous.bytes.equals(captured.bytes)))) {
    throw new Error("state changed");
  }
  unchangedParent(parent, directory, initial);
  return { state, ...captured };
}

async function copySnapshot(parent, name, sourcePath, approvedHash, cap) {
  const source = await fs.open(sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let destination;
  const path = `/proc/self/fd/${parent}/${name}`;
  try {
    const before = await source.stat({ bigint: true });
    if (!before.isFile() || before.size < 0n || before.size > BigInt(cap)) throw new Error("invalid snapshot source");
    destination = await fs.open(path,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
    await destination.chmod(0o600);
    const created = await destination.stat({ bigint: true });
    privateFile(created, 0o600, 0);
    if (created.dev === before.dev && created.ino === before.ino) throw new Error("snapshot aliases source");
    const hash = createHash("sha256");
    const buffer = Buffer.alloc(CHUNK);
    const expectedSize = Number(before.size);
    let total = 0;
    while (true) {
      const { bytesRead } = await source.read(buffer, 0, Math.min(CHUNK, expectedSize - total + 1), null);
      if (bytesRead === 0) break;
      total += bytesRead;
      if (total > expectedSize) throw new Error("snapshot source grew");
      hash.update(buffer.subarray(0, bytesRead));
      let offset = 0;
      while (offset < bytesRead) {
        const { bytesWritten } = await destination.write(buffer, offset, bytesRead - offset, null);
        if (bytesWritten <= 0) throw new Error("snapshot write failed");
        offset += bytesWritten;
      }
    }
    if (total !== expectedSize || !sameMetadata(before, await source.stat({ bigint: true }))
      || hash.digest("hex") !== approvedHash) throw new Error("snapshot source changed or digest mismatch");
    await destination.chmod(0o400);
    await destination.sync();
    const completed = await destination.stat({ bigint: true });
    privateFile(completed, 0o400, total);
    if (completed.dev !== created.dev || completed.ino !== created.ino
      || !sameMetadata(completed, await fs.lstat(path, { bigint: true }))) throw new Error("snapshot destination changed");
    fsyncSync(parent);
    return completed;
  } finally {
    try { if (destination) await destination.close(); }
    finally { await source.close(); }
  }
}

export async function createSnapshots(statePath) {
  absolute(statePath);
  const directory = dirname(statePath);
  const parent = privateDirectory(directory);
  try {
    const initial = fstatSync(parent, { bigint: true });
    const captured = checkedState(parent, statePath, directory, initial);
    const { state } = captured;
    const paths = snapshotPaths(statePath, state.attemptId);
    const inputs = [["bundle", state.bundlePath, state.bundleSha256, 2 * 1024 ** 3],
      ["installer", INSTALLER, state.installerSha256, 64 * 1024]];
    const completed = [];
    for (const [kind, source, hash, cap] of inputs) {
      if (dirname(paths[kind]) !== directory || paths[kind] !== resolve(paths[kind])) throw new Error("invalid snapshot path");
      checkedState(parent, statePath, directory, initial, captured);
      const name = basename(paths[kind]);
      const details = await copySnapshot(parent, name, source, hash, cap);
      completed.push({ name, details });
      checkedState(parent, statePath, directory, initial, captured);
    }
    for (const { name, details } of completed) {
      const current = await fs.lstat(`/proc/self/fd/${parent}/${name}`, { bigint: true });
      if (!sameMetadata(details, current)) throw new Error("completed snapshot changed");
      privateFile(current, 0o400);
    }
    checkedState(parent, statePath, directory, initial, captured);
    fsyncSync(parent);
    return paths;
  } finally { closeSync(parent); }
}

export async function main(argv) {
  try {
    const { values, tokens } = parseArgs({ args: argv, strict: true, allowPositionals: false, tokens: true,
      options: { state: { type: "string" } } });
    if (tokens.length !== 1 || tokens[0].kind !== "option" || tokens[0].name !== "state" || !values.state) {
      throw new Error("invalid snapshot arguments");
    }
    await createSnapshots(values.state);
    process.stdout.write("SNAPSHOTS=VERIFIED_PRIVATE_INPUTS\n");
    return 0;
  } catch {
    process.stderr.write("STOP\n");
    return 2;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
