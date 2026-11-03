#!/usr/bin/env bun
// SPEC: _spec/tooling/sbx-dev/preparation-workflow.puml
import { createHash } from "node:crypto";
import {
  accessSync, closeSync, constants, fchmodSync, fstatSync, fsyncSync, lstatSync,
  openSync, read, readSync, realpathSync, write, writeFileSync,
} from "node:fs";
import { opendir } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { runBounded } from "../native-ingress/f9-diagnose.mjs";
import { privateDirectory } from "../sbx-smoke/create-debug.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const VALIDATOR = join(ROOT, "tooling/sbx-dev/check-bundle.mjs");
const HOST = "x86_64-unknown-linux-gnu";
const BUNDLE = "rust-tools.tar";
const INTENT = `${BUNDLE}.intent`;
const SCHEMA = "dev-sbx-acquired-tools-v1";
const KEYS = ["schema", "bunVersion", "rustVersion", "host", "bundlePath", "sha256"];
const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const MANIFEST_CAP = 8192;
const ARCHIVE_CAP = 2 * 1024 ** 3;
const EXPANDED_CAP = 4 * 1024 ** 3;
const MEMBER_CAP = 20000;
const PACK_MS = 120000;
const NOTICES = ["LICENSE-APACHE", "LICENSE-MIT", "COPYRIGHT"];
const readAsync = promisify(read);
const writeAsync = promisify(write);

function absolute(path) {
  if (typeof path !== "string" || path.length > 4096 || !isAbsolute(path) || path !== resolve(path)
    || [...path].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error("canonical absolute path required");
  return path;
}

function manifestLocation(path) {
  absolute(path);
  if ([BUNDLE, INTENT].includes(basename(path))) throw new Error("reserved acquisition path");
  return path;
}

function unchanged(before, after) {
  return ["dev", "ino", "size", "mtimeMs", "ctimeMs", "mode", "uid", "nlink"].every((key) => before[key] === after[key]);
}

function privateFile(details, cap) {
  if (!details.isFile() || details.uid !== process.getuid() || details.nlink !== 1
    || (details.mode & 0o7777) !== 0o600 || details.size > cap) throw new Error("invalid private file");
}

function boundedFile(path, cap, privateOnly = false) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const details = fstatSync(fd);
    if (!details.isFile() || details.size > cap) throw new Error("invalid or oversized file");
    if (privateOnly) privateFile(details, cap);
    const bytes = Buffer.alloc(cap + 1);
    let size = 0;
    while (size < bytes.length) {
      const count = readSync(fd, bytes, size, bytes.length - size, null);
      if (!count) break;
      size += count;
    }
    if (size !== details.size || size > cap || !unchanged(details, fstatSync(fd))) throw new Error("file changed or exceeded cap");
    return bytes.subarray(0, size);
  } finally { closeSync(fd); }
}

export function toolPins() {
  const config = Bun.TOML.parse(boundedFile(join(ROOT, "mise.toml"), 65536).toString("utf8"));
  const toolchain = Bun.TOML.parse(boundedFile(join(ROOT, "rust-toolchain.toml"), 65536).toString("utf8"));
  const bun = config.tools?.["core:bun"];
  const rust = config.tools?.["core:rust"]?.version;
  if (typeof bun !== "string" || typeof rust !== "string" || bun.length > 64 || rust.length > 64
    || !SEMVER.test(bun) || !SEMVER.test(rust) || rust !== "1.95.0" || rust !== toolchain.toolchain?.channel) {
    throw new Error("exact Bun/Rust mise pins and matching Rust 1.95.0 toolchain required");
  }
  return { bun, rust };
}

function anchored(parent, path) {
  const details = fstatSync(parent);
  if (details.uid !== process.getuid() || (details.mode & 0o7777) !== 0o700
    || realpathSync(`/proc/self/fd/${parent}`) !== dirname(path)) throw new Error("acquisition directory changed or is not private");
  return `/proc/self/fd/${parent}`;
}

function validateManifest(value, path, pins) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== KEYS.length
    || KEYS.some((key) => !Object.hasOwn(value, key)) || value.schema !== SCHEMA
    || value.bunVersion !== pins.bun || value.rustVersion !== pins.rust || value.host !== HOST
    || value.bundlePath !== join(dirname(path), BUNDLE) || typeof value.sha256 !== "string"
    || !/^[0-9a-f]{64}$/.test(value.sha256)) throw new Error("invalid acquired tools manifest");
  return value;
}

export function readAcquiredTools(manifestPath) {
  manifestLocation(manifestPath);
  const parent = privateDirectory(dirname(manifestPath));
  try {
    const base = anchored(parent, manifestPath);
    const value = validateManifest(JSON.parse(boundedFile(join(base, basename(manifestPath)), MANIFEST_CAP, true).toString("utf8")),
      manifestPath, toolPins());
    const fd = openSync(join(base, BUNDLE), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try { privateFile(fstatSync(fd), ARCHIVE_CAP); }
    finally { closeSync(fd); }
    anchored(parent, manifestPath);
    return value;
  } finally { closeSync(parent); }
}

function absent(parent, name) {
  try { lstatSync(`/proc/self/fd/${parent}/${name}`); }
  catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  throw new Error("acquisition artifact already exists; no retry or overwrite");
}

function exclusive(parent, name, flags = constants.O_WRONLY) {
  const fd = openSync(`/proc/self/fd/${parent}/${name}`, flags | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { fchmodSync(fd, 0o600); }
  catch (error) { closeSync(fd); throw error; }
  return fd;
}

function record(parent, name, value) {
  const bytes = Buffer.from(`${JSON.stringify(value)}\n`);
  if (bytes.length > MANIFEST_CAP) throw new Error("acquisition record exceeds cap");
  const fd = exclusive(parent, name);
  try { writeFileSync(fd, bytes); fsyncSync(fd); }
  finally { closeSync(fd); }
  fsyncSync(parent);
}

function miseExecutable() {
  for (const directory of (process.env.PATH ?? "").split(":")) {
    if (!isAbsolute(directory)) continue;
    try {
      const path = absolute(realpathSync(join(directory, "mise")));
      if (!lstatSync(path).isFile()) continue;
      accessSync(path, constants.X_OK);
      return path;
    } catch {}
  }
  throw new Error("existing mise executable required on PATH");
}

async function confirmTTY({ prompt }) {
  if (!process.stdin.isTTY || !process.stderr.isTTY) return false;
  return new Promise((accept) => {
    const terminal = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
    let finished = false;
    const finish = (approved) => {
      if (finished) return;
      finished = true;
      process.off("SIGINT", interrupted);
      process.off("SIGTERM", interrupted);
      terminal.close();
      accept(approved);
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

async function checked(execute, argv, bounds) {
  const result = await execute(argv, bounds);
  if (!result || result.ok !== true || result.outcome !== "EXIT" || result.code !== 0 || result.signal !== null
    || typeof result.stdout !== "string" || typeof result.stderr !== "string"
    || Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr) > bounds.cap) throw new Error("bounded acquisition command failed");
  return result;
}

function rustVersion(stdout, version) {
  const lines = stdout.split("\n");
  const releases = lines.filter((line) => line.startsWith("release:"));
  const hosts = lines.filter((line) => line.startsWith("host:"));
  if (!lines[0]?.startsWith(`rustc ${version} `) || releases.length !== 1 || releases[0] !== `release: ${version}`
    || hosts.length !== 1 || hosts[0] !== `host: ${HOST}`) throw new Error("selected Rust release or host mismatch");
}

function openDirectory(path) {
  let fd = openSync("/", constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    for (const component of path.split("/").slice(1)) {
      if (!component) continue;
      const next = openSync(`/proc/self/fd/${fd}/${component}`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      closeSync(fd);
      fd = next;
    }
    return fd;
  } catch (error) { closeSync(fd); throw error; }
}

function memberName(name) {
  if (name.length > 256 || !name.split("/").every((part) => /^[A-Za-z0-9_.+-]+$/.test(part) && part !== "." && part !== "..")) {
    throw new Error("unsafe bundle member name");
  }
}

function tarHeader(name, details) {
  memberName(name);
  let short = name, prefix = "";
  if (name.length > 100) {
    let slash = name.lastIndexOf("/");
    while (slash > 155) slash = name.lastIndexOf("/", slash - 1);
    if (slash < 1 || name.length - slash - 1 > 100) throw new Error("bundle member cannot fit ustar path fields");
    prefix = name.slice(0, slash);
    short = name.slice(slash + 1);
  }
  const header = Buffer.alloc(512);
  const octal = (value, offset, length) => {
    const digits = value.toString(8);
    if (digits.length >= length) throw new Error("ustar numeric field exceeds cap");
    header.write(`${digits.padStart(length - 1, "0")}\0`, offset, length, "ascii");
  };
  header.write(short, 0, 100, "ascii");
  octal(details.mode & 0o777, 100, 8);
  octal(0, 108, 8);
  octal(0, 116, 8);
  octal(details.isDirectory() ? 0 : details.size, 124, 12);
  octal(0, 136, 12);
  header.fill(32, 148, 156);
  header[156] = details.isDirectory() ? 53 : 48;
  header.write("ustar\0", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  header.write(prefix, 345, 155, "ascii");
  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");
  return header;
}

function sourceFile(root, sysroot, name) {
  if (realpathSync(`/proc/self/fd/${root}`) !== sysroot) throw new Error("selected sysroot changed");
  const canonical = realpathSync(`/proc/self/fd/${root}/${name}`);
  const local = relative(sysroot, canonical);
  if (!local || local === ".." || local.startsWith(`..${sep}`) || isAbsolute(local)) throw new Error("sysroot symlink escapes selected root or cycles");
  const parts = local.split(sep);
  let parent = openSync(`/proc/self/fd/${root}`, constants.O_RDONLY | constants.O_DIRECTORY);
  try {
    for (const part of parts.slice(0, -1)) {
      const next = openSync(`/proc/self/fd/${parent}/${part}`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      closeSync(parent);
      parent = next;
    }
    const path = `/proc/self/fd/${parent}/${parts.at(-1)}`;
    const before = lstatSync(path);
    if (!before.isFile() && !before.isDirectory()) throw new Error("unsupported sysroot special file");
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    if (!unchanged(before, fstatSync(fd))) { closeSync(fd); throw new Error("sysroot entry changed"); }
    return { fd, details: before, canonical };
  } finally { closeSync(parent); }
}

async function packTools(parent, manifestPath, sysroot) {
  const deadline = performance.now() + PACK_MS;
  const checkTime = () => {
    if (performance.now() >= deadline) throw new Error("acquisition packaging deadline exceeded");
  };
  const root = openDirectory(sysroot);
  let output;
  let archived = 0, expanded = 0, members = 0;
  const buffer = Buffer.alloc(128 * 1024);
  const emit = async (bytes) => {
    checkTime();
    if (archived + bytes.length > ARCHIVE_CAP) throw new Error("archive exceeds 2 GiB cap");
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesWritten } = await writeAsync(output, bytes, offset, bytes.length - offset, archived);
      if (!bytesWritten) throw new Error("archive write made no progress");
      offset += bytesWritten;
      archived += bytesWritten;
      checkTime();
    }
  };
  const visit = async (name, ancestors, recurse = true) => {
    checkTime();
    memberName(name);
    if (++members > MEMBER_CAP) throw new Error("bundle exceeds 20000 member cap");
    const { fd, details, canonical } = sourceFile(root, sysroot, name);
    try {
      if (["bin", "lib"].includes(name) && !details.isDirectory()) throw new Error("selected bin/lib must be directories");
      if (["bin/rustc", "bin/cargo"].includes(name) && (!details.isFile() || !(details.mode & 0o111))) {
        throw new Error("selected Rust tools must be executable regular files");
      }
      if (NOTICES.some((leaf) => name === leaf || name === `share/doc/rust/${leaf}`) && !details.isFile()) {
        throw new Error("selected notice must be a regular file");
      }
      if (details.isDirectory() && ancestors.has(canonical)) throw new Error("sysroot directory cycle");
      const size = details.isDirectory() ? 0 : details.size;
      expanded += size;
      if (!Number.isSafeInteger(size) || expanded > EXPANDED_CAP) throw new Error("expanded bundle exceeds 4 GiB cap");
      const padding = (512 - size % 512) % 512;
      if (archived + 512 + size + padding + 1024 > ARCHIVE_CAP) throw new Error("archive exceeds 2 GiB cap");
      await emit(tarHeader(name, details));
      if (details.isDirectory()) {
        if (recurse) {
          const next = new Set(ancestors).add(canonical);
          const directory = await opendir(`/proc/self/fd/${fd}`);
          for await (const entry of directory) await visit(`${name}/${entry.name}`, next);
        }
      } else {
        let position = 0;
        while (position < size) {
          checkTime();
          const { bytesRead } = await readAsync(fd, buffer, 0, Math.min(buffer.length, size - position), position);
          if (!bytesRead) throw new Error("sysroot file truncated");
          await emit(buffer.subarray(0, bytesRead));
          position += bytesRead;
        }
        if (padding) await emit(Buffer.alloc(padding));
      }
      if (!unchanged(details, fstatSync(fd))) throw new Error("sysroot entry changed while packaging");
    } finally { closeSync(fd); }
  };
  try {
    anchored(parent, manifestPath);
    output = exclusive(parent, BUNDLE, constants.O_RDWR);
    await visit("bin", new Set([sysroot]), false);
    await visit("bin/rustc", new Set([sysroot]));
    await visit("bin/cargo", new Set([sysroot]));
    await visit("lib", new Set([sysroot]));
    for (const prefix of ["", "share/doc/rust/"]) {
      let parentsAdded = false;
      for (const leaf of NOTICES) {
        const name = `${prefix}${leaf}`;
        try { lstatSync(`/proc/self/fd/${root}/${name}`); }
        catch (error) {
          if (error.code === "ENOENT") continue;
          throw error;
        }
        if (prefix && !parentsAdded) {
          for (const directory of ["share", "share/doc", "share/doc/rust"]) await visit(directory, new Set([sysroot]), false);
          parentsAdded = true;
        }
        await visit(name, new Set([sysroot]), false);
      }
    }
    await emit(Buffer.alloc(1024));
    fsyncSync(output);
    const details = fstatSync(output);
    privateFile(details, ARCHIVE_CAP);
    if (details.size !== archived) throw new Error("archive size changed");
    const hash = createHash("sha256");
    let position = 0;
    while (position < archived) {
      checkTime();
      const { bytesRead } = await readAsync(output, buffer, 0, Math.min(buffer.length, archived - position), position);
      if (!bytesRead) throw new Error("archive truncated during hashing");
      hash.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }
    if (!unchanged(details, fstatSync(output))) throw new Error("archive changed during hashing");
    const sha256 = hash.digest("hex");
    anchored(parent, manifestPath);
    checkTime();
    const validation = await checked(runBounded, [process.execPath, "--no-env-file", "--no-install", VALIDATOR,
      join(dirname(manifestPath), BUNDLE), sha256], { milliseconds: Math.max(1, Math.floor(deadline - performance.now())), cap: 16384, graceMilliseconds: 1000 });
    if (validation.stdout !== "BUNDLE=HASH_AND_LAYOUT_OK\n" || validation.stderr) throw new Error("bundle validation marker missing");
    if (!unchanged(details, fstatSync(output)) || !unchanged(details, lstatSync(`/proc/self/fd/${parent}/${BUNDLE}`))) {
      throw new Error("archive changed during validation");
    }
    checkTime();
    return sha256;
  } finally {
    if (output !== undefined) closeSync(output);
    closeSync(root);
  }
}

export async function acquireTools(manifestPath, { confirm = confirmTTY, execute = runBounded, platform = process.platform, arch = process.arch } = {}) {
  if (platform !== "linux" || arch !== "x64") throw new Error("acquisition requires Linux x64 host");
  manifestLocation(manifestPath);
  const pins = toolPins();
  const parent = privateDirectory(dirname(manifestPath));
  try {
    for (const name of [INTENT, BUNDLE, basename(manifestPath)]) absent(parent, name);
    const mise = miseExecutable();
    const prompt = `STAGE=acquire\nBUN_VERSION=${pins.bun}\nRUST_VERSION=${pins.rust}\nMANIFEST_PATH=${manifestPath}\n`
      + `Approve online host downloads and mise cache/tool installation writes using ${mise} install --jobs 1 core:rust@${pins.rust} (<=600s, output<=64KiB).\n`
      + `Read the selected Rust ${pins.rust} sysroot only: bin/rustc, bin/cargo, lib/ (including internal dependencies), and optional LICENSE-APACHE/LICENSE-MIT/COPYRIGHT leaves at the root or share/doc/rust/. Resolve Rust version/host, sysroot, and Cargo version with three bounded mise exec calls (<=30s, output<=16KiB each).\n`
      + `Create exclusive private intent, bundle and manifest inside ${dirname(manifestPath)}. Stream packaging/hash/layout work budget <=120s, archive<=2GiB, expanded<=4GiB, members<=20000. Subprocess reaping may add <=2s; the validator supervisor also allows <=1s cooperative cancellation. No guest operations or retries. The computed hash provides byte integrity, not independent F9 provenance.`;
    if (await confirm({ action: "acquire", manifestPath, pins: { ...pins }, prompt }) !== true) throw new Error("operator approval refused");
    if (JSON.stringify(toolPins()) !== JSON.stringify(pins)) throw new Error("tool pins changed during approval");
    anchored(parent, manifestPath);
    for (const name of [INTENT, BUNDLE, basename(manifestPath)]) absent(parent, name);
    record(parent, INTENT, { schema: "dev-sbx-acquisition-intent-v1", manifestPath, ...pins, host: HOST });
    await checked(execute, [mise, "install", "--jobs", "1", `core:rust@${pins.rust}`], { milliseconds: 600000, cap: 65536 });
    const version = await checked(execute, [mise, "exec", `core:rust@${pins.rust}`, "--", "rustc", "-vV"], { milliseconds: 30000, cap: 16384 });
    if (version.stderr) throw new Error("unexpected version diagnostic");
    rustVersion(version.stdout, pins.rust);
    const selected = await checked(execute, [mise, "exec", `core:rust@${pins.rust}`, "--", "rustc", "--print", "sysroot"], { milliseconds: 30000, cap: 16384 });
    if (selected.stderr) throw new Error("unexpected sysroot diagnostic");
    const sysroot = absolute(selected.stdout.endsWith("\n") ? selected.stdout.slice(0, -1) : selected.stdout);
    if (realpathSync(sysroot) !== sysroot || !lstatSync(sysroot).isDirectory()) throw new Error("canonical selected sysroot required");
    const cargo = await checked(execute, [mise, "exec", `core:rust@${pins.rust}`, "--", "cargo", "--version"], { milliseconds: 30000, cap: 16384 });
    const cargoVersion = /^cargo ([0-9]+\.[0-9]+\.[0-9]+)(?: \([^\r\n]*\))?\n?$/.exec(cargo.stdout);
    if (cargo.stderr || cargoVersion?.[1] !== pins.rust) throw new Error("selected Cargo release mismatch");
    const sha256 = await packTools(parent, manifestPath, sysroot);
    const manifest = validateManifest({ schema: SCHEMA, bunVersion: pins.bun, rustVersion: pins.rust, host: HOST,
      bundlePath: join(dirname(manifestPath), BUNDLE), sha256 }, manifestPath, toolPins());
    anchored(parent, manifestPath);
    record(parent, basename(manifestPath), manifest);
    return manifest;
  } finally { closeSync(parent); }
}

export async function main(argv) {
  try {
    let manifestPath;
    if (argv.length === 2 && argv[0] === "--manifest") manifestPath = argv[1];
    else if (argv.length === 1 && argv[0].startsWith("--manifest=")) manifestPath = argv[0].slice("--manifest=".length);
    else throw new Error("invalid acquisition arguments");
    manifestLocation(manifestPath);
    const pins = toolPins();
    console.log(`STAGE=acquire\nBUN_VERSION=${pins.bun}\nRUST_VERSION=${pins.rust}\nMANIFEST_PATH=${manifestPath}`);
    await acquireTools(manifestPath);
    return 0;
  } catch {
    console.error("STOP: acquire failed; retain private artifacts and reconcile before a new attempt.");
    return 2;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
