// SPEC: _spec/gpu-input-transfer.puml
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, open, type FileHandle } from "node:fs/promises";
import { join, posix, resolve, sep } from "node:path";
import type { Readable } from "node:stream";

export type ArchiveMember = {
  name: string;
  kind: "file" | "directory" | "symlink" | "hardlink" | "other";
  size: number;
};

const BITCODE_LIMIT = 2 * 1024 * 1024;
const LICENSE_LIMIT = 1024 * 1024;
const LIST_LIMIT = 2 * 1024 * 1024;
const STDERR_LIMIT = 256 * 1024;
const LICENSE_NAME = /^(?:license|eula)(?:\.[^/]+)?$/i;
const LIST_LINE = /^([-dlhbcp?sVM][rwxstST-]{9}) +[0-9]+\/[0-9]+ +([0-9]+) +[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01]) +(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])? (.+)$/;

function safeName(name: string, kind: ArchiveMember["kind"]): string {
  if (!name || name.startsWith("/") || /[\x00-\x1f\x7f-\x9f\\]/.test(name)) {
    throw new Error("Unsafe archive member name");
  }
  if (name.endsWith("/") && kind !== "directory") {
    throw new Error("Non-directory archive member has a trailing slash");
  }
  const normalized = name.replace(/^\.\//, "").replace(/\/$/, "");
  if ((normalized === "" || normalized === ".") && kind === "directory") return ".";
  if (!normalized || normalized.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Unsafe archive member path");
  }
  return normalized;
}

export function parseTarListing(text: string): ArchiveMember[] {
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  const names = new Set<string>();
  return lines.map((line) => {
    if (/[\x00-\x1f\x7f-\x9f\\]/.test(line)) {
      throw new Error("Unsupported escaping or control character in tar listing");
    }
    const match = LIST_LINE.exec(line);
    if (!match) throw new Error("Unexpected GNU tar listing format");
    const mode = match[1]!;
    const sizeText = match[2]!;
    const description = match[3]!;
    const size = Number(sizeText);
    if (!Number.isSafeInteger(size) || size < 0) throw new Error("Invalid archive member size");
    const kind: ArchiveMember["kind"] = mode[0] === "-" ? "file"
      : mode[0] === "d" ? "directory"
      : mode[0] === "l" ? "symlink"
      : mode[0] === "h" ? "hardlink"
      : "other";
    let name = description;
    const separator = kind === "symlink" ? " -> " : kind === "hardlink" ? " link to " : null;
    if (separator !== null) {
      const parts = description.split(separator);
      if (parts.length !== 2 || !parts[1]) throw new Error("Unexpected tar link listing format");
      name = parts[0]!;
    }
    const key = safeName(name, kind);
    if (names.has(key)) throw new Error("Duplicate archive member name");
    names.add(key);
    return { name, kind, size };
  });
}

function requireRegularSize(member: ArchiveMember, maximum: number): void {
  safeName(member.name, member.kind);
  if (member.kind !== "file") throw new Error("Selected archive member must be a regular file");
  if (!Number.isSafeInteger(member.size) || member.size <= 0 || member.size > maximum) {
    throw new Error("Selected archive member size exceeds its positive byte limit");
  }
}

export function selectLibdevice(members: ArchiveMember[]): { bitcode: ArchiveMember; licenses: ArchiveMember[] } {
  const bitcodes = members.filter((member) => posix.basename(member.name) === "libdevice.10.bc");
  if (bitcodes.length !== 1) throw new Error("Expected exactly one libdevice.10.bc archive member");
  const bitcode = bitcodes[0]!;
  requireRegularSize(bitcode, BITCODE_LIMIT);
  const licenses = members.filter((member) => LICENSE_NAME.test(posix.basename(member.name)));
  if (licenses.length === 0) throw new Error("Archive contains no vendor LICENSE or EULA member");
  let licenseBytes = 0;
  for (const license of licenses) {
    requireRegularSize(license, LICENSE_LIMIT);
    licenseBytes += license.size;
    if (licenseBytes > LICENSE_LIMIT) throw new Error("Vendor licenses exceed their total byte limit");
  }
  return { bitcode, licenses };
}

async function copyBounded(
  source: Readable,
  destination: FileHandle,
  maximum: number,
  label: string,
  stop: () => void,
  consume?: (chunk: Buffer) => void,
): Promise<number> {
  let bytes = 0;
  for await (const value of source) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    const overflow = chunk.length > maximum - bytes;
    if (overflow) stop();
    const retained = chunk.subarray(0, maximum - bytes);
    let offset = 0;
    while (offset < retained.length) {
      const written = await destination.write(retained, offset, retained.length - offset, null);
      if (written.bytesWritten === 0) throw new Error(`Could not write ${label}`);
      offset += written.bytesWritten;
    }
    bytes += retained.length;
    consume?.(retained);
    if (overflow) throw new Error(`${label} exceeded ${maximum} bytes`);
  }
  return bytes;
}

async function runTar(
  args: string[],
  stdout: FileHandle,
  stderr: FileHandle,
  stdoutLimit: number,
  consume?: (chunk: Buffer) => void,
): Promise<number> {
  const child = spawn("/usr/bin/tar", args, {
    env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((accept, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => accept({ code, signal }));
  });
  const stop = () => { child.kill("SIGKILL"); };
  const guard = async (task: Promise<number>) => {
    try {
      return await task;
    } catch (error) {
      stop();
      throw error;
    }
  };
  const results = await Promise.allSettled([
    guard(copyBounded(child.stdout, stdout, stdoutLimit, "tar stdout", stop, consume)),
    guard(copyBounded(child.stderr, stderr, STDERR_LIMIT, "tar stderr", stop)),
    exited,
  ] as const);
  for (const result of results) {
    if (result.status === "rejected") throw result.reason;
  }
  const output = results[0];
  const exit = results[2];
  if (output.status !== "fulfilled" || exit.status !== "fulfilled") throw new Error("tar did not complete");
  if (exit.value.code !== 0) {
    throw new Error(`tar exited with code ${exit.value.code}, signal ${exit.value.signal}`);
  }
  return output.value;
}

export async function inspectNewArchive(
  archivePath: string,
  evidenceDir: string,
): Promise<ReturnType<typeof selectLibdevice>> {
  await mkdir(evidenceDir, { recursive: true });
  const stdout = await open(join(evidenceDir, "archive-list.stdout"), "wx");
  try {
    const stderr = await open(join(evidenceDir, "archive-list.stderr"), "wx");
    try {
      const chunks: Buffer[] = [];
      await runTar([
        "--list", "--verbose", "--numeric-owner", "--quoting-style=escape", "--file", archivePath,
      ], stdout, stderr, LIST_LIMIT, (chunk) => { chunks.push(chunk); });
      return selectLibdevice(parseTarListing(Buffer.concat(chunks).toString("utf8")));
    } finally {
      await stderr.close();
    }
  } finally {
    await stdout.close();
  }
}

export async function extractMember(
  archivePath: string,
  member: ArchiveMember,
  destination: string,
  evidenceDir: string,
  label: string,
): Promise<{ path: string; bytes: number; sha256: string }> {
  const basename = posix.basename(member.name);
  const maximum = basename === "libdevice.10.bc" ? BITCODE_LIMIT : LICENSE_NAME.test(basename) ? LICENSE_LIMIT : 0;
  requireRegularSize(member, maximum);
  const path = resolve(destination);
  if (path.split(sep).includes("runs")) throw new Error("Payload destination must not be under runs/");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(label)) throw new Error("Invalid extraction evidence label");
  await mkdir(evidenceDir, { recursive: true });
  const output = await open(path, "wx");
  try {
    const stderr = await open(join(evidenceDir, `${label}.stderr`), "wx");
    try {
      const hash = createHash("sha256");
      const bytes = await runTar([
        "--extract", "--to-stdout", "--no-wildcards", "--file", archivePath, "--", member.name,
      ], output, stderr, member.size, (chunk) => { hash.update(chunk); });
      if (bytes !== member.size) throw new Error("Extracted member size does not match its listing");
      return { path, bytes, sha256: hash.digest("hex") };
    } finally {
      await stderr.close();
    }
  } finally {
    await output.close();
  }
}
