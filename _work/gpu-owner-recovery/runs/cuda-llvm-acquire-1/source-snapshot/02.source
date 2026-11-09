// SPEC: _spec/recovery.md
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import type { BigIntStats } from "node:fs";
import { link, lstat, mkdir, open, realpath } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { repository } from "./provision";
import { artifactIdentities, readContinuationInputs, validateContinuation } from "./cuda-continuation";
import type { ArtifactId, ArtifactIdentity, ContinuationInputs } from "./cuda-continuation";

class AcquisitionError extends Error {}
function fail(code: string): never { throw new AcquisitionError(code); }
export const acquisitionFailureCode = (error: unknown): string => error instanceof AcquisitionError ? error.message : "ACQUISITION_FAILED";
export type FileIdentity = Readonly<{ device: string; inode: string; byteLength: number; mode: number; mtime: string; ctime: string }>;
export type FileSnapshot = Readonly<{ descriptor: FileIdentity; path: FileIdentity }>;
export type ArtifactReader = Readonly<{ snapshot: () => Promise<FileSnapshot>; chunks: () => AsyncIterable<Uint8Array>; close: () => Promise<void> }>;
export type ArtifactStage = Readonly<{ write: (bytes: Uint8Array) => Promise<void>; seal: () => Promise<void>;
  reader: () => Promise<ArtifactReader>; close: () => Promise<void> }>;
export type ArtifactVerdict = Readonly<{ version: "chess-coach.cuda-artifact-acquisition.v1"; artifact: ArtifactId; status: "PASS" | "FAIL";
  code: string; bytes: number; sha256: string | null; cache: "PUBLISHED" | "REUSED" | null; trainingReady: false }>;
export type OperationState = Readonly<{ claimed: boolean; verdict: ArtifactVerdict | null }>;
export type VerdictCommitIO = Readonly<{
  openStage: (artifact: ArtifactId, status: ArtifactVerdict["status"]) => Promise<Readonly<{
    write: (bytes: Uint8Array) => Promise<void>; sync: () => Promise<void>; close: () => Promise<void>;
  }>>;
  publish: (artifact: ArtifactId, status: ArtifactVerdict["status"]) => Promise<void>;
}>;
export type ArtifactResponse = Readonly<{ status: number; location: string | null; contentLength: string | null;
  chunks: () => AsyncIterable<Uint8Array>; cancel: () => Promise<void> }>;
export type TrustedArtifactIO = Readonly<{
  readContinuation: () => Promise<ContinuationInputs>; inspectOperation: (artifact: ArtifactId) => Promise<OperationState | null>;
  claimOperation: (artifact: ArtifactId) => Promise<void>; finishOperation: (artifact: ArtifactId, verdict: ArtifactVerdict) => Promise<void>;
  openCache: (artifact: ArtifactId) => Promise<ArtifactReader | null>; createStage: (artifact: ArtifactId) => Promise<ArtifactStage>;
  publish: (artifact: ArtifactId, verified: FileSnapshot) => Promise<"PUBLISHED" | "REUSED">;
  fetch: (url: string) => Promise<ArtifactResponse>;
}>;
const identitiesMatch = (a: FileIdentity, b: FileIdentity) => a.device === b.device && a.inode === b.inode &&
  a.byteLength === b.byteLength && a.mode === b.mode && a.mtime === b.mtime && a.ctime === b.ctime;
const validSnapshot = (snapshot: FileSnapshot, expected: ArtifactIdentity) => identitiesMatch(snapshot.descriptor, snapshot.path) &&
  (snapshot.descriptor.mode & 0o170000) === 0o100000 && snapshot.descriptor.byteLength === expected.byteLength;

async function verifyFile(reader: ArtifactReader, expected: ArtifactIdentity): Promise<FileSnapshot> {
  try {
    const before = await reader.snapshot();
    if (!validSnapshot(before, expected)) fail("CACHE_IDENTITY_MISMATCH");
    let length = 0;
    const hash = createHash("sha256");
    for await (const chunk of reader.chunks()) {
      if (!(chunk instanceof Uint8Array) || chunk.byteLength > expected.byteLength - length) fail("CACHE_BYTE_LIMIT");
      length += chunk.byteLength;
      hash.update(chunk);
    }
    const after = await reader.snapshot();
    if (!validSnapshot(after, expected) || !identitiesMatch(before.descriptor, after.descriptor)) fail("CACHE_IDENTITY_CHANGED");
    if (length !== expected.byteLength) fail("CACHE_LENGTH_MISMATCH");
    if (hash.digest("hex") !== expected.sha256) fail("CACHE_DIGEST_MISMATCH");
    return after;
  } finally { await reader.close(); }
}

export function validateArtifactURL(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { return fail("REDIRECT_URL_REJECTED"); }
  if (url.protocol !== "https:" || !["github.com", "release-assets.githubusercontent.com"].includes(url.hostname) ||
      (url.port !== "" && url.port !== "443") || url.username !== "" || url.password !== "" || url.hash !== "") fail("REDIRECT_URL_REJECTED");
  return url;
}

async function finalResponse(expected: ArtifactIdentity, trusted: TrustedArtifactIO): Promise<ArtifactResponse> {
  let url = validateArtifactURL(expected.url), redirects = 0;
  const visited = new Set<string>();
  while (true) {
    if (visited.has(url.href)) fail("REDIRECT_LOOP");
    visited.add(url.href);
    let response: ArtifactResponse;
    try { response = await trusted.fetch(url.href); } catch { return fail("FETCH_FAILED"); }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      try { await response.cancel(); } catch { fail("FETCH_BODY_FAILED"); }
      if (redirects >= 3) fail("REDIRECT_LIMIT");
      if (response.location === null) fail("REDIRECT_LOCATION_REQUIRED");
      let target: string;
      try { target = new URL(response.location!, url).href; } catch { return fail("REDIRECT_URL_REJECTED"); }
      url = validateArtifactURL(target);
      redirects++;
      continue;
    }
    if (response.status !== 200) {
      try { await response.cancel(); } catch { fail("FETCH_BODY_FAILED"); }
      fail(Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? `HTTP_STATUS_${response.status}` : "HTTP_STATUS_INVALID");
    }
    if (response.contentLength !== null && response.contentLength !== String(expected.byteLength)) {
      try { await response.cancel(); } catch { fail("FETCH_BODY_FAILED"); }
      fail("CONTENT_LENGTH_MISMATCH");
    }
    return response;
  }
}

async function checkSequence(artifact: ArtifactId, trusted: TrustedArtifactIO): Promise<void> {
  const archive = await trusted.inspectOperation("llvm-archive"), checksums = await trusted.inspectOperation("llvm-checksums");
  for (const state of [archive, checksums]) {
    if (state && (!state.claimed || !state.verdict || state.verdict.status !== "PASS")) fail("SEQUENCE_HALTED_OR_INCOMPLETE");
  }
  if ((artifact === "llvm-archive" ? archive : checksums) !== null) fail("ARTIFACT_OPERATION_ALREADY_CONSUMED");
  if (artifact === "llvm-checksums" && archive === null) fail("ARCHIVE_OPERATION_REQUIRED_FIRST");
  if (artifact === "llvm-archive" && checksums !== null) fail("SEQUENCE_ORDER_INVALID");
}

async function acquireEngine(artifact: ArtifactId, expected: ArtifactIdentity, trusted: TrustedArtifactIO): Promise<ArtifactVerdict> {
  const input = await trusted.readContinuation();
  validateContinuation(input.requestBytes, input.binding, input.evidence);
  await checkSequence(artifact, trusted);
  await trusted.claimOperation(artifact);
  let stage: ArtifactStage | null = null, length = 0, cache: ArtifactVerdict["cache"] = null;
  try {
    const existing = await trusted.openCache(artifact);
    if (existing) { await verifyFile(existing, expected); length = expected.byteLength; cache = "REUSED"; }
    else {
      stage = await trusted.createStage(artifact);
      const response = await finalResponse(expected, trusted), hash = createHash("sha256");
      try {
        for await (const chunk of response.chunks()) {
          if (!(chunk instanceof Uint8Array)) fail("FETCH_BODY_INVALID");
          const remaining = expected.byteLength - length;
          if (chunk.byteLength > remaining) {
            if (remaining > 0) { await stage.write(chunk.subarray(0, remaining)); length += remaining; }
            fail("ARTIFACT_BYTE_LIMIT");
          }
          await stage.write(chunk);
          length += chunk.byteLength;
          hash.update(chunk);
        }
      } catch (error) {
        try { await response.cancel(); } catch { /* SPEC: _spec/recovery.md */ }
        if (error instanceof AcquisitionError) throw error;
        fail("FETCH_BODY_FAILED");
      }
      if (length !== expected.byteLength) fail("ARTIFACT_LENGTH_MISMATCH");
      if (hash.digest("hex") !== expected.sha256) fail("ARTIFACT_DIGEST_MISMATCH");
      await stage.seal();
      const snapshot = await verifyFile(await stage.reader(), expected);
      cache = await trusted.publish(artifact, snapshot);
      const published = await trusted.openCache(artifact);
      if (!published) fail("PUBLISHED_CACHE_MISSING");
      await verifyFile(published, expected);
      await stage.close(); stage = null;
    }
    const verdict: ArtifactVerdict = { version: "chess-coach.cuda-artifact-acquisition.v1", artifact, status: "PASS", code: "VERIFIED_EXACT_ARTIFACT",
      bytes: length, sha256: expected.sha256, cache, trainingReady: false };
    await trusted.finishOperation(artifact, verdict);
    return verdict;
  } catch (error) {
    if (stage) { try { await stage.close(); } catch { /* SPEC: _spec/recovery.md */ } }
    const code = acquisitionFailureCode(error);
    const verdict: ArtifactVerdict = { version: "chess-coach.cuda-artifact-acquisition.v1", artifact, status: "FAIL", code,
      bytes: length, sha256: null, cache: null, trainingReady: false };
    await trusted.finishOperation(artifact, verdict);
    return verdict;
  }
}

async function commitVerdict(artifact: ArtifactId, verdict: ArtifactVerdict, trusted: VerdictCommitIO): Promise<void> {
  const stage = await trusted.openStage(artifact, verdict.status);
  let failure: string | null = null;
  try {
    try { await stage.write(new TextEncoder().encode(JSON.stringify(verdict) + "\n")); } catch { failure = "VERDICT_WRITE_FAILED"; }
    if (failure === null) { try { await stage.sync(); } catch { failure = "VERDICT_SYNC_FAILED"; } }
  } finally { try { await stage.close(); } catch { failure ??= "VERDICT_CLOSE_FAILED"; } }
  if (failure !== null) fail(failure);
  await trusted.publish(artifact, verdict.status);
}

export async function acquireExactArtifact(artifact: ArtifactId, trusted: TrustedArtifactIO = productionIO): Promise<ArtifactVerdict> {
  if (artifact !== "llvm-archive" && artifact !== "llvm-checksums") fail("CLOSED_ARTIFACT_REQUIRED");
  return acquireEngine(artifact, artifactIdentities[artifact], trusted);
}
export async function acquireCLI(args: readonly string[], trusted: TrustedArtifactIO = productionIO): Promise<ArtifactVerdict> {
  if (args.length !== 1 || (args[0] !== "llvm-archive" && args[0] !== "llvm-checksums")) fail("CLOSED_ACQUISITION_CLI_REQUIRED");
  return acquireExactArtifact(args[0], trusted);
}
export const acquisitionTestOnly = Object.freeze({
  run: (artifact: ArtifactId, identity: ArtifactIdentity, trusted: TrustedArtifactIO) => acquireEngine(artifact, identity, trusted),
  commitVerdict,
});

const runRoot = resolve(repository, "_work/gpu-owner-recovery/runs/cuda-llvm-acquire-1");
const scratchRoot = resolve(repository, "_work/gpu-owner-recovery/scratch/cuda-llvm-acquire-1");
const leaf = (artifact: ArtifactId) => artifact === "llvm-archive" ? "archive" : "checksums";
const operationDirectory = (artifact: ArtifactId) => resolve(runRoot, leaf(artifact));
const stagePath = (artifact: ArtifactId) => resolve(scratchRoot, leaf(artifact), "artifact.partial");
const cachePath = (artifact: ArtifactId) => resolve(repository, artifactIdentities[artifact].destination);
const missing = (error: unknown) => !!error && typeof error === "object" && "code" in error && error.code === "ENOENT";
const exists = (error: unknown) => !!error && typeof error === "object" && "code" in error && error.code === "EEXIST";

async function fixedDirectory(path: string, create: boolean): Promise<boolean> {
  const parts = relative(repository, path).split("/");
  if (parts.some(part => part === ".." || part === "")) fail("FIXED_DIRECTORY_REQUIRED");
  let current = resolve(repository);
  for (const part of parts) {
    current = resolve(current, part);
    let stat;
    try { stat = await lstat(current); } catch (error) {
      if (!missing(error)) throw error;
      if (!create) return false;
      try { await mkdir(current, { mode: 0o700 }); } catch (error) { if (!exists(error)) throw error; }
      stat = await lstat(current);
    }
    if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o022) !== 0 ||
        stat.uid !== process.getuid!() || await realpath(current) !== current) fail("UNTRUSTED_FIXED_DIRECTORY");
  }
  return true;
}
const identity = (stat: BigIntStats): FileIdentity => ({ device: String(stat.dev), inode: String(stat.ino),
  byteLength: Number(stat.size), mode: Number(stat.mode), mtime: String(stat.mtimeNs), ctime: String(stat.ctimeNs) });

async function openReader(path: string): Promise<ArtifactReader> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  return {
    async snapshot() { return { descriptor: identity(await handle.stat({ bigint: true })), path: identity(await lstat(path, { bigint: true })) }; },
    async *chunks() {
      let offset = 0;
      while (true) {
        const bytes = Buffer.alloc(64 * 1024), result = await handle.read(bytes, 0, bytes.byteLength, offset);
        if (result.bytesRead === 0) break;
        offset += result.bytesRead;
        yield bytes.subarray(0, result.bytesRead);
      }
    },
    close: () => handle.close(),
  };
}
async function readSmallOptional(path: string): Promise<Uint8Array | null> {
  let handle: FileHandle;
  try { handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW); } catch (error) { if (missing(error)) return null; throw error; }
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.size <= 0n || before.size > 4096n) fail("INVALID_OPERATION_RECORD");
    const bytes = Buffer.alloc(Number(before.size) + 1);
    let length = 0;
    while (length < bytes.byteLength) {
      const result = await handle.read(bytes, length, bytes.byteLength - length, length);
      if (result.bytesRead === 0) break;
      length += result.bytesRead;
    }
    const after = await handle.stat({ bigint: true }), pathStat = await lstat(path, { bigint: true });
    if (BigInt(length) !== before.size || !identitiesMatch(identity(before), identity(after)) ||
        !identitiesMatch(identity(after), identity(pathStat))) fail("OPERATION_RECORD_CHANGED");
    return bytes.subarray(0, length);
  } finally { await handle.close(); }
}
async function writeExclusive(path: string, value: unknown): Promise<void> {
  const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(JSON.stringify(value) + "\n"); await handle.sync(); } finally { await handle.close(); }
}
const marker = (artifact: ArtifactId) => ({ version: "chess-coach.cuda-artifact-operation.v1", artifact, sequence: "cuda-llvm-acquire-1" });
const productionIO: TrustedArtifactIO = {
  readContinuation: readContinuationInputs,
  async inspectOperation(artifact) {
    const directory = operationDirectory(artifact);
    if (!await fixedDirectory(directory, false)) return null;
    const claim = await readSmallOptional(resolve(directory, ".operation")), verdictBytes = await readSmallOptional(resolve(directory, "artifact.json"));
    if (!claim && !verdictBytes) return null;
    if (!claim) fail("MISSING_OPERATION_MARKER");
    if (JSON.stringify(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(claim))) !== JSON.stringify(marker(artifact))) fail("INVALID_OPERATION_MARKER");
    let verdict: ArtifactVerdict | null = null;
    if (verdictBytes) {
      const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(verdictBytes));
      const expected = artifactIdentities[artifact];
      if (!value || value.version !== "chess-coach.cuda-artifact-acquisition.v1" || value.artifact !== artifact || value.trainingReady !== false ||
          !["PASS", "FAIL"].includes(value.status) || !Number.isSafeInteger(value.bytes) || value.bytes < 0 || value.bytes > expected.byteLength ||
          (value.status === "PASS" && (value.bytes !== expected.byteLength || value.sha256 !== expected.sha256 || value.code !== "VERIFIED_EXACT_ARTIFACT" ||
            !["PUBLISHED", "REUSED"].includes(value.cache)))) fail("INVALID_OPERATION_VERDICT");
      verdict = value;
    }
    return { claimed: true, verdict };
  },
  async claimOperation(artifact) {
    await fixedDirectory(operationDirectory(artifact), true);
    await writeExclusive(resolve(operationDirectory(artifact), ".operation"), marker(artifact));
  },
  async finishOperation(artifact, verdict) {
    const pending = (status: ArtifactVerdict["status"]) => resolve(operationDirectory(artifact), `artifact.${status.toLowerCase()}.pending.json`);
    await commitVerdict(artifact, verdict, {
      async openStage(selected, status) {
        if (selected !== artifact) fail("CLOSED_ARTIFACT_REQUIRED");
        const handle = await open(pending(status), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        return { write: bytes => handle.writeFile(bytes), sync: () => handle.sync(), close: () => handle.close() };
      },
      async publish(selected, status) {
        if (selected !== artifact) fail("CLOSED_ARTIFACT_REQUIRED");
        await link(pending(status), resolve(operationDirectory(artifact), "artifact.json"));
      },
    });
  },
  async openCache(artifact) {
    if (!await fixedDirectory(dirname(cachePath(artifact)), false)) return null;
    try { return await openReader(cachePath(artifact)); } catch (error) { if (missing(error)) return null; throw error; }
  },
  async createStage(artifact) {
    await fixedDirectory(scratchRoot, true);
    await mkdir(dirname(stagePath(artifact)), { mode: 0o700 });
    await fixedDirectory(dirname(stagePath(artifact)), false);
    const handle = await open(stagePath(artifact), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    let closed = false;
    return {
      async write(bytes) {
        let offset = 0;
        while (offset < bytes.byteLength) { const result = await handle.write(bytes, offset, bytes.byteLength - offset); if (result.bytesWritten === 0) fail("STAGE_WRITE_FAILED"); offset += result.bytesWritten; }
      },
      async seal() { await handle.sync(); await handle.chmod(0o400); },
      reader: () => openReader(stagePath(artifact)),
      async close() { if (!closed) { closed = true; await handle.close(); } },
    };
  },
  async publish(artifact, verified) {
    await fixedDirectory(dirname(stagePath(artifact)), false);
    if (!identitiesMatch(identity(await lstat(stagePath(artifact), { bigint: true })), verified.path)) fail("STAGED_IDENTITY_CHANGED");
    await fixedDirectory(dirname(cachePath(artifact)), true);
    try { await link(stagePath(artifact), cachePath(artifact)); return "PUBLISHED"; } catch (error) { if (exists(error)) return "REUSED"; throw error; }
  },
  async fetch(url) {
    for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy", "NO_PROXY", "no_proxy"]) {
      if (process.env[key] !== undefined) fail("AMBIENT_PROXY_FORBIDDEN");
    }
    const response = await fetch(url, { method: "GET", credentials: "omit", redirect: "manual", headers: { "Accept-Encoding": "identity" },
      decompress: false, keepalive: false });
    return { status: response.status, location: response.headers.get("location"), contentLength: response.headers.get("content-length"),
      async *chunks() {
        if (!response.body) fail("FETCH_BODY_MISSING");
        const reader = response.body!.getReader();
        try { while (true) { const result = await reader.read(); if (result.done) break; yield result.value; } } finally { reader.releaseLock(); }
      },
      async cancel() { if (response.body) await response.body.cancel(); },
    };
  },
};

if (import.meta.main) {
  try { const result = await acquireCLI(Bun.argv.slice(2)); console.log(JSON.stringify(result)); process.exitCode = result.status === "PASS" ? 0 : 1; }
  catch (error) { console.error(acquisitionFailureCode(error)); process.exitCode = 1; }
}
