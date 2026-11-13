// SPEC: _spec/runtime-protocol.puml
import { createHash, randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as https from "node:https";
import { spawn } from "node:child_process";
import { dirname, join, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import type { Readable, Writable } from "node:stream";
import { HOSTROOT, D, R2, S2, productionRootContext, validateBunRuntime, APPROVAL_SHA256 } from "./root-context.ts";
import { bindExclusiveCacheClaim, prepareClaimedCacheParent } from "./cache-parent-adapter.ts";

export { D };
export const ROOT = HOSTROOT;
export const SOURCE = S2;
export const R = R2;
export const RAW = "_work/gpu-owner-recovery/cache/reference-package-inputs-2";
export const OUTPUT = `${D}/package-inputs-2`;
export const OP = `${R}/acquisition-execution-1`;
export const BUN = process.execPath;
export const GRANT = "reference-two-package-source-acquisition-2";
export const SOURCE_FILES = ["capture.ts", "capture.test.ts", "capture-full.test.ts", "root-context.ts", "root-context.test.ts", "cache-parent.ts", "cache-parent.test.ts", "cache-parent-adapter.ts", "cache-parent-adapter.test.ts", "verify.ts", "tsconfig.json", ".gitignore"] as const;
export const PINS = Object.freeze({
  request: "c0288e1e34e24d2f7a81e12ee1967ffafbd2768b4c2a5bc2ba15826b6384ff3f",
  plan: "7f6a90ca105d6a7c5a45951b508d4a1ecdd5e217625d1cefe08da23557847405",
  approval: APPROVAL_SHA256,
  lock: "1d05ed3d8de5a94873f26a2fb51b88c080704d2e90bf942f9f0bb2ce75a504e0",
});
export const AUTHORITY_FILES = Object.freeze({
  [`${R}/request.json`]: PINS.request, [`${R}/plan.json`]: PINS.plan, [`${R}/approval2.json`]: PINS.approval,
  [`${R}/manual-handoff-request1.json`]: "47d63b8cb446cdc8a83323788c9106cdb82437992e7bd3a88f55821aa6bde52b",
  [`${R}/manual-handoff-plan1.json`]: "4297e4f1b763b5aa152b88a7a3e288a19cafc85331cbed2d776f38d043f8817a",
  [`${D}/package-acquisition-proposal-1/plan.json`]: "8ecfce5156322da42fb852cd071a6091b96187e19a88226bec68295936505f6c",
  [`${D}/local-inputs-1/check.json`]: "acca1e84beb0ebfacf3fb0a7967ffe5d16552861b0da98a4f7e6b4367cee9c63",
  [`${D}/local-inputs-1/inputs/reference/pnpm-lock.yaml`]: PINS.lock,
});
export const ELIGIBILITY_STATIC_READS = Object.freeze([...Object.keys(AUTHORITY_FILES), ...SOURCE_FILES.map(name => `${SOURCE}/${name}`), `${SOURCE}/execution-binding2.json`]);
export const CAPS = Object.freeze({ archive: 2 ** 21, expanded: 2 ** 23, selected: 2 ** 23,
  headers: 256, frame: 4096, journal: 16384, receipt: 65536, stdout: 32768, stderr: 8192,
  getMs: 30000, workMs: 108000, operationMs: 120000 });
export const URLS = ["https://registry.npmjs.org/fflate/-/fflate-0.8.3.tgz",
  "https://registry.npmjs.org/jssha/-/jssha-3.3.2.tgz"] as const;
const LOCK = `${D}/local-inputs-1/inputs/reference/pnpm-lock.yaml`;
const utf8 = new TextDecoder("utf-8", { fatal: true });
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Frame = Record<string, Json>;
export type Clock = () => number;
export function guardClock(read: Clock): Clock {
  let previous = -1;
  return () => { const value = read(); requireThat(Number.isSafeInteger(value) && value >= 0 && value >= previous, "clock-invalid-or-regressed"); previous = value; return value; };
}
export const now: Clock = guardClock(() => Number(process.hrtime.bigint() / 1000000n));
export function clockDomain(instance: string, role: "supervisor" | "worker" | "outer", pid: number): string {
  requireThat(/^[a-zA-Z0-9_-]{1,128}$/.test(instance) && Number.isSafeInteger(pid) && pid > 0, "clock-domain-identity");
  return `${instance}:${role}:${pid}`;
}
function duration(value: unknown, cap: number): number {
  requireThat(typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= cap, "duration-invalid-or-exhausted"); return value;
}
function addTime(anchor: number, ms: number): number {
  const result = anchor + ms; requireThat(Number.isSafeInteger(anchor) && anchor >= 0 && Number.isSafeInteger(result) && result >= anchor, "clock-cutoff-invalid"); return result;
}
export function requireThat(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}
export function sha(data: Uint8Array): string { return createHash("sha256").update(data).digest("hex"); }
function sri(data: Uint8Array): string { return `sha512-${createHash("sha512").update(data).digest("base64")}`; }
export function encoded(value: unknown, cap: number = CAPS.receipt): Buffer {
  const result = Buffer.from(JSON.stringify(value));
  requireThat(result.length <= cap, "serialized-cap");
  return result;
}
function object(value: unknown): Record<string, unknown> {
  requireThat(value !== null && typeof value === "object" && !Array.isArray(value), "object-required");
  return value as Record<string, unknown>;
}
function keys(value: object, expected: string[]): void {
  requireThat(JSON.stringify(Object.keys(value).sort()) === JSON.stringify(expected.sort()), "schema-keys");
}
export function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => Object.hasOwn(y, k) && equal(x[k], y[k]));
}
export function active(clock: Clock, deadline: number): void {
  const observed = clock(); requireThat(Number.isSafeInteger(observed) && observed >= 0 && Number.isSafeInteger(deadline) && deadline >= 0, "clock-invalid-or-regressed");
  requireThat(observed < deadline, "absolute-deadline");
}
export async function bounded<T>(promise: Promise<T>, deadline: number, clock: Clock = now): Promise<T> {
  active(clock, deadline);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("absolute-deadline")), Math.max(1, deadline - clock()));
    })]);
    active(clock, deadline);
    return result;
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
function safeParents(path: string): void {
  const parents: string[] = [];
  for (let p = dirname(resolve(path)); ; p = dirname(p)) { parents.push(p); if (dirname(p) === p) break; }
  for (const p of parents.reverse()) {
    const s = fs.lstatSync(p);
    requireThat(s.isDirectory() && !s.isSymbolicLink(), "unsafe-parent");
  }
}
export function readRegular(path: string, cap: number): Buffer {
  safeParents(path);
  const fd = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const before = fs.fstatSync(fd, { bigint: true });
    requireThat(before.isFile() && before.nlink === 1n && before.size <= BigInt(cap), "regular-file-cap");
    const data = Buffer.alloc(Number(before.size) + 1);
    let size = 0, count = 0;
    while ((count = fs.readSync(fd, data, size, data.length - size, null)) !== 0) {
      size += count; requireThat(size <= cap && size <= Number(before.size), "file-growth");
    }
    const after = fs.fstatSync(fd, { bigint: true });
    requireThat(size === Number(before.size) && before.size === after.size && before.mtimeNs === after.mtimeNs && before.ctimeNs === after.ctimeNs, "file-read-drift");
    return data.subarray(0, size);
  } finally { fs.closeSync(fd); }
}
function syncDir(path: string): void {
  const fd = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
export function exclusive(path: string, data: Uint8Array, cap: number = CAPS.receipt): void {
  requireThat(data.length <= cap, "write-cap"); safeParents(path);
  const fd = fs.openSync(path, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try { writeAll(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  syncDir(dirname(path));
}
function writeAll(fd: number, data: Uint8Array): void {
  let at = 0;
  while (at < data.length) { const count = fs.writeSync(fd, data, at); requireThat(count > 0, "short-write"); at += count; }
}
export function fresh(path: string): void { safeParents(path); fs.mkdirSync(path, { mode: 0o700 }); syncDir(dirname(path)); }
function exists(path: string): boolean { try { fs.lstatSync(path); return true; } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return false; throw e; } }
export type EligibilityReader = (relativePath: string, cap: number) => Buffer;
const readLocal: EligibilityReader = (path, cap) => readRegular(join(productionRootContext().readRoot, path), cap);
export function sourceHashes(read: EligibilityReader = readLocal): Record<string, string> {
  return Object.fromEntries(SOURCE_FILES.map(name => [name, sha(read(`${SOURCE}/${name}`, 256 * 1024))]));
}
export interface Member { member: string; retainedFile: string; futureRelativePath?: string }
export interface ArchiveSpec {
  name: string; version: string; url: string; archiveFile: string; integrity: string;
  requiredMembers: Member[]; optionalLicenseMembersInPreferenceOrder: string[];
  maximumLicenseFiles: number; licenseRetainedFilePrefix: string;
}
interface Plan { archives: ArchiveSpec[]; archiveRoot: string; selectedSourcesRoot: string }
export interface Identity { sourceHashes: Record<string, string>; bindings: typeof PINS; choiceSha256: string; executionBindingSha256: string; plan: Plan }
function jsonFile(path: string, cap: number = CAPS.receipt): unknown { return JSON.parse(utf8.decode(readRegular(path, cap))) as unknown; }
export function authority(read: EligibilityReader = readLocal): { plan: Plan; choiceSha256: string } {
  const data = Object.fromEntries(Object.entries(AUTHORITY_FILES).map(([path, hash]) => {
    const bytes = read(path, CAPS.expanded); requireThat(sha(bytes) === hash, `pinned-${path}`); return [path, bytes];
  }));
  const plan = JSON.parse(utf8.decode(data[`${R}/plan.json`]!)) as Plan;
  requireThat(equal(plan.archives.map(a => a.url), URLS) && plan.archiveRoot === RAW && plan.selectedSourcesRoot === `${OUTPUT}/files`, "fixed-plan");
  const lock = utf8.decode(data[LOCK]!);
  for (const spec of plan.archives) requireThat(lock.includes(spec.integrity), "lock-integrity");
  const original = object(JSON.parse(utf8.decode(data[`${D}/package-acquisition-proposal-1/plan.json`]!)));
  const archiveMap = (archives: unknown): unknown => { requireThat(Array.isArray(archives), "archive-map"); return archives.map(a => { const { urlStatus: _status, ...value } = object(a); return value; }); };
  requireThat(equal(archiveMap(plan.archives), archiveMap(original["archives"])), "immutable-r1-archive-map");
  const provenance = object(JSON.parse(utf8.decode(data[`${D}/local-inputs-1/check.json`]!)));
  requireThat(provenance["reference"] === "b4b241481fb12de4a7344e6dba8eda775af57675", "reference-provenance");
  const approval = object(JSON.parse(utf8.decode(data[`${R}/approval2.json`]!)));
  requireThat(approval["archiveGrantId"] === GRANT && approval["assistantMayExecuteActualHandoffOrAcquisition"] === false && approval["maximumCombinedAcquisitionAttempts"] === 1 && approval["maximumNpmGetRequests"] === 2, "genuine-approval-scope");
  const bindings = object(approval["bindings"]);
  for (const [key, path] of Object.entries({ acquisitionRequest: `${R}/request.json`, acquisitionPlan: `${R}/plan.json`, manualHandoffRequest: `${R}/manual-handoff-request1.json`, manualHandoffPlan: `${R}/manual-handoff-plan1.json` })) requireThat(equal(bindings[key], { path, sha256: AUTHORITY_FILES[path as keyof typeof AUTHORITY_FILES] }), "approval-four-bindings");
  return { plan, choiceSha256: PINS.approval };
}
export function validateRuntime(): void {
  const context = productionRootContext(); validateBunRuntime();
  requireThat(fileURLToPath(import.meta.url) === join(context.readRoot, SOURCE, "capture.ts") && process.cwd() === context.readRoot, "fixed-runtime-source");
}
export function validateReviewGate(reviews: unknown): void {
  requireThat(equal(reviews, { backend: "READY", devops: "READY", adversarial: "READY", security: "READY" }), "review-gate");
}
export function validateEligibility(read: EligibilityReader = readLocal): Identity {
  const auth = authority(read), hashes = sourceHashes(read);
  const bindingBytes = read(`${SOURCE}/execution-binding2.json`, CAPS.receipt);
  const binding = object(JSON.parse(utf8.decode(bindingBytes)));
  keys(binding, ["version", "grantId", "nonAuthorizing", "sourceHashes", "bindings", "choiceSha256", "verificationReceipt", "reviews"]);
  requireThat(binding["version"] === "chess-coach.bun-execution-binding.v1" && binding["grantId"] === GRANT && binding["nonAuthorizing"] === true && equal(binding["sourceHashes"], hashes) && equal(binding["bindings"], PINS) && binding["choiceSha256"] === auth.choiceSha256, "execution-binding");
  validateReviewGate(binding["reviews"]);
  const proof = object(binding["verificationReceipt"]);
  keys(proof, ["path", "sha256"]);
  requireThat(typeof proof["path"] === "string" && new RegExp(`^${SOURCE}/fullverification-[1-9][0-9]*/receipt\\.json$`).test(proof["path"]), "proof-location");
  const proofBytes = read(proof["path"], CAPS.receipt);
  requireThat(sha(proofBytes) === proof["sha256"], "proof-hash");
  const receipt = object(JSON.parse(utf8.decode(proofBytes)));
  requireThat(receipt["status"] === "PASS_OFFLINE_ONLY" && equal(receipt["sourceHashes"], hashes) && equal(receipt["bindings"], PINS) && receipt["choiceSha256"] === auth.choiceSha256 && receipt["actualGetRequests"] === 0 && receipt["productionEntryInvoked"] === false && receipt["productionWorkerInvoked"] === false && receipt["productionRootsTouched"] === false && receipt["readchecksMatch"] === true && receipt["clockProofValid"] === true && receipt["parentIntegrationProofValid"] === true && typeof receipt["testsPassed"] === "number" && receipt["testsPassed"] > 0 && receipt["testsFailed"] === 0 && receipt["typecheckExitCode"] === 0, "offline-proof");
  const manifest = read(`${dirname(proof["path"])}/source-manifest.json`, CAPS.receipt);
  requireThat(sha(manifest) === receipt["sourceManifestSha256"] && equal(JSON.parse(utf8.decode(manifest)), { sourceHashes: hashes, bindings: PINS, choiceSha256: auth.choiceSha256 }), "proof-manifest");
  return { ...auth, sourceHashes: hashes, bindings: PINS, executionBindingSha256: sha(bindingBytes) };
}
export const validateExecutionBinding2 = validateEligibility;

export interface Selected extends Member { data: Buffer; license: boolean }
export interface Inspection { files: Selected[]; licenseMember: string | null; legalClearance: false; expandedBytesIncludingSkippedContent: number; physicalTarHeaders: number }
function field(block: Buffer, start: number, length: number): string {
  const bytes = block.subarray(start, start + length), nul = bytes.indexOf(0);
  if (nul >= 0) requireThat(bytes.subarray(nul).every(b => b === 0), "tar-field-tail");
  return utf8.decode(nul < 0 ? bytes : bytes.subarray(0, nul));
}
function octal(block: Buffer, start: number, length: number): number {
  const bytes = block.subarray(start, start + length);
  requireThat(bytes.every(b => b < 128), "tar-octal");
  const match = /^ *([0-7]+)[\0 ]*$/.exec(bytes.toString("ascii"));
  requireThat(match !== null, "tar-octal");
  const n = parseInt(match[1]!, 8);
  requireThat(Number.isSafeInteger(n) && n >= 0, "tar-number"); return n;
}
function safeMember(path: string): void {
  const parts = path.split("/");
  requireThat(path.length > 0 && !path.startsWith("/") && !path.includes("\\") && !path.includes("\0") && parts.every((p, i) => p !== "." && p !== ".." && (p !== "" || i === parts.length - 1)), "tar-path");
}
function pax(data: Buffer): Map<string, string> {
  const result = new Map<string, string>();
  let at = 0;
  while (at < data.length) {
    const space = data.indexOf(32, at);
    requireThat(space > at && space - at <= 10, "pax-length");
    const originalDigits = data.subarray(at, space);
    requireThat(originalDigits.every(b => b >= 48 && b <= 57), "pax-length-ascii");
    const digits = originalDigits.toString("ascii");
    requireThat(/^[1-9][0-9]*$/.test(digits), "pax-length");
    const length = Number(digits), end = at + length;
    requireThat(Number.isSafeInteger(length) && end <= data.length && end > space + 2 && data[end - 1] === 10, "pax-bounds");
    const entry = utf8.decode(data.subarray(space + 1, end - 1)), equals = entry.indexOf("=");
    requireThat(equals > 0, "pax-entry");
    const key = entry.slice(0, equals), value = entry.slice(equals + 1);
    requireThat(["path", "size", "mtime", "atime", "ctime", "uid", "gid", "uname", "gname"].includes(key) && !result.has(key) && !value.includes("\0") && value !== "", "pax-unsupported-or-duplicate");
    result.set(key, value); at = end;
  }
  return result;
}
export function inspectVerifiedArchive(bytes: Buffer, spec: ArchiveSpec): Inspection {
  requireThat(bytes.length <= CAPS.archive && sri(bytes) === spec.integrity, "sri-before-inflate");
  let tar: Buffer;
  try { tar = gunzipSync(bytes, { maxOutputLength: CAPS.expanded + 1 }); } catch { throw new Error("gzip-invalid-or-expanded-cap"); }
  requireThat(tar.length <= CAPS.expanded && tar.length % 512 === 0, "expanded-or-block-cap");
  const candidates = new Set([...spec.requiredMembers.map(m => m.member), ...spec.optionalLicenseMembersInPreferenceOrder]);
  const selected = new Map<string, Buffer>(), physicalSelected = new Set<string>();
  let offset = 0, headers = 0, ended = false, local: Map<string, string> | undefined, longname: string | undefined;
  while (offset < tar.length) {
    const h = tar.subarray(offset, offset + 512);
    if (h.every(b => b === 0)) {
      requireThat(offset + 1024 <= tar.length && tar.subarray(offset).every(b => b === 0) && !local && longname === undefined, "tar-terminator");
      ended = true; break;
    }
    requireThat(++headers <= CAPS.headers, "physical-header-cap");
    const checksum = octal(h, 148, 8);
    requireThat(checksum === h.reduce((sum, b, i) => sum + (i >= 148 && i < 156 ? 32 : b), 0), "tar-checksum");
    const magic = h.subarray(257, 265).toString("binary");
    requireThat(magic === "ustar\0" + "00" || magic === "ustar  \0", "tar-format");
    for (const [start, len] of [[100, 8], [108, 8], [116, 8], [136, 12]] as const) octal(h, start, len);
    const type = String.fromCharCode(h[156]!), size = octal(h, 124, 12);
    const prefix = magic.startsWith("ustar\0") ? field(h, 345, 155) : "";
    const physical = (prefix ? `${prefix}/` : "") + field(h, 0, 100);
    if (!(type === "L" && ["././@LongLink", "./LongLink"].includes(physical))) safeMember(physical);
    requireThat(["0", "\0", "5", "x", "g", "L"].includes(type) && field(h, 157, 100) === "", "tar-unsupported-type-or-link");
    const start = offset + 512, end = start + size, next = start + Math.ceil(size / 512) * 512;
    requireThat(Number.isSafeInteger(next) && next <= tar.length && tar.subarray(end, next).every(b => b === 0), "tar-payload-padding");
    const payload = tar.subarray(start, end);
    if (candidates.has(physical)) {
      requireThat(!physicalSelected.has(physical) && (type === "0" || type === "\0"), "physical-selected-duplicate-or-type");
      physicalSelected.add(physical);
    }
    if (type === "x" || type === "g") {
      requireThat(!local && longname === undefined, "metadata-stacking");
      const metadata = pax(payload);
      if (type === "g") requireThat(!metadata.has("path") && !metadata.has("size"), "global-path-or-size");
      else local = metadata;
    } else if (type === "L") {
      requireThat(!local && longname === undefined && payload.length > 1 && payload[payload.length - 1] === 0 && payload.subarray(0, -1).indexOf(0) === -1, "gnu-longname");
      longname = utf8.decode(payload.subarray(0, -1)); safeMember(longname);
    } else {
      const logical = local?.get("path") ?? longname ?? physical;
      safeMember(logical);
      const paxSize = local?.get("size");
      requireThat(paxSize === undefined || (/^(0|[1-9][0-9]*)$/.test(paxSize) && Number(paxSize) === size), "pax-size-origin-ambiguity");
      if (type === "5") requireThat(size === 0, "directory-size");
      if (candidates.has(physical) || candidates.has(logical)) {
        requireThat(physical === logical && (type === "0" || type === "\0") && !selected.has(logical), "selected-origin-type-or-duplicate");
        selected.set(logical, Buffer.from(payload));
      }
      local = undefined; longname = undefined;
    }
    offset = next;
  }
  requireThat(ended, "missing-terminator");
  const files: Selected[] = spec.requiredMembers.map(member => {
    const data = selected.get(member.member); requireThat(data !== undefined, "missing-required-member");
    return { ...member, data, license: false };
  });
  const packageData = selected.get("package/package.json"); requireThat(packageData !== undefined, "package-json-required");
  const pkg = object(JSON.parse(utf8.decode(packageData)));
  requireThat(pkg["name"] === spec.name && pkg["version"] === spec.version, "package-identity");
  const licenseMember = spec.optionalLicenseMembersInPreferenceOrder.find(name => selected.has(name)) ?? null;
  if (licenseMember !== null) files.push({ member: licenseMember, retainedFile: spec.licenseRetainedFilePrefix + licenseMember.split("/").at(-1)!, data: selected.get(licenseMember)!, license: true });
  requireThat(spec.maximumLicenseFiles === 1 && files.length <= 3 && files.reduce((n, f) => n + f.data.length, 0) <= CAPS.selected, "selected-cap");
  return { files, licenseMember, legalClearance: false, expandedBytesIncludingSkippedContent: tar.length, physicalTarHeaders: headers };
}

export interface HttpResponse { statusCode: number; headers: Record<string, string | string[] | undefined>; body: AsyncIterable<Uint8Array> }
export type Transport = (spec: ArchiveSpec, signal: AbortSignal) => Promise<HttpResponse>;
export interface DownloadDeps { transport: Transport; deadline: number; clock?: Clock; event: (type: string, facts: Frame) => Promise<void> }
export interface DownloadFacts { bytes: number; sha256: string; sha512: string }
export async function downloadArchive(spec: ArchiveSpec, dest: { write: (data: Buffer) => void }, deps: DownloadDeps): Promise<{ data: Buffer; facts: DownloadFacts }> {
  const clock = guardClock(deps.clock ?? now), abort = new AbortController();
  const chunks: Buffer[] = []; let count = 0;
  try {
    active(clock, deps.deadline);
    const responsePromise = deps.transport(spec, abort.signal); void responsePromise.catch(() => {});
    await bounded(deps.event("GET_INVOKED", {}), deps.deadline, clock);
    const response = await bounded(responsePromise, deps.deadline, clock);
    requireThat(response.statusCode === 200, "http-status");
    requireThat(response.headers["content-encoding"] === undefined || response.headers["content-encoding"] === "identity", "http-content-encoding");
    const iterator = response.body[Symbol.asyncIterator]();
    while (true) {
      const next = await bounded(iterator.next(), deps.deadline, clock);
      if (next.done) break;
      requireThat(next.value instanceof Uint8Array, "http-chunk-type");
      requireThat(count + next.value.length <= CAPS.archive, "archive-byte-cap");
      const chunk = Buffer.from(next.value);
      active(clock, deps.deadline); dest.write(chunk); active(clock, deps.deadline);
      count += chunk.length; chunks.push(chunk);
    }
    const data = Buffer.concat(chunks, count);
    const facts = { bytes: count, sha256: sha(data), sha512: createHash("sha512").update(data).digest("hex") };
    await bounded(deps.event("RESPONSE_COMPLETED", { ...facts }), deps.deadline, clock);
    requireThat(sri(data) === spec.integrity, "archive-sri");
    return { data, facts };
  } finally { abort.abort(); }
}
const directTLS: Transport = (spec, signal) => new Promise((resolveResponse, reject) => {
  requireThat((URLS as readonly string[]).includes(spec.url), "fixed-url");
  const url = new URL(spec.url);
  const request = https.request({ protocol: "https:", hostname: "registry.npmjs.org", port: 443,
    path: url.pathname, method: "GET", agent: false, rejectUnauthorized: true, signal,
    maxHeaderSize: 8192, headers: { "Accept-Encoding": "identity", Connection: "close" } }, response => {
    response.on("error", reject);
    resolveResponse({ statusCode: response.statusCode ?? 0, headers: response.headers, body: response });
  });
  request.on("error", reject); request.end();
});

export class Journal {
  private fd: number; private size = 0;
  constructor(path: string) {
    safeParents(path);
    this.fd = fs.openSync(path, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    syncDir(dirname(path));
  }
  append(frame: Frame, terminal = false): void {
    const bytes = Buffer.concat([encoded(frame, CAPS.frame), Buffer.from("\n")]);
    requireThat(this.size + bytes.length <= CAPS.journal - (terminal ? 0 : 2048), "journal-cap");
    writeAll(this.fd, bytes); this.size += bytes.length; fs.fsyncSync(this.fd);
  }
  close(): void { fs.closeSync(this.fd); }
}
export interface Marker { attemptId: string; supervisorPid: number; supervisorDomain: string; origin: number; workDeadline: number; operationDeadline: number }
export function claimAttempt(path: string, clock: Clock = now, origin = clock()): Marker {
  active(clock, origin + CAPS.workMs); fresh(path);
  const attemptId = randomBytes(16).toString("hex");
  const marker = { attemptId, supervisorPid: process.pid, supervisorDomain: clockDomain(attemptId, "supervisor", process.pid), origin,
    workDeadline: addTime(origin, CAPS.workMs), operationDeadline: addTime(origin, CAPS.operationMs) };
  exclusive(join(path, "attempt.json"), encoded({ ...marker, grantId: GRANT, combinedAttemptsConsumed: 1, remainingCombinedAttempts: 0, automaticRetryAuthorized: false }));
  return marker;
}
export class Protocol {
  starts = 0; invoked = new Set<number>(); responses = new Map<number, Frame>(); completed = 0;
  done: Frame | undefined; deadline: number; workerPid = 0; workerDomain = "";
  workerStart = 0; requestStarts: number[] = []; private configured = false; private clock: Clock;
  constructor(readonly marker: Marker, private persist: (event: Frame) => void, clock: Clock = now) { this.deadline = marker.workDeadline; this.clock = guardClock(clock); }
  ready(frame: Frame, ownedPid: number): void {
    active(this.clock, this.marker.workDeadline);
    keys(frame, ["type", "attemptId", "supervisorPid", "workerPid", "supervisorDomain", "workerDomain", "workerStartMonoMs"]);
    requireThat(!this.workerDomain && frame["type"] === "READY" && frame["attemptId"] === this.marker.attemptId && frame["supervisorPid"] === this.marker.supervisorPid && frame["workerPid"] === ownedPid &&
      frame["supervisorDomain"] === this.marker.supervisorDomain && frame["workerDomain"] === clockDomain(this.marker.attemptId, "worker", ownedPid) && typeof frame["workerStartMonoMs"] === "number" && Number.isSafeInteger(frame["workerStartMonoMs"]) && frame["workerStartMonoMs"] >= 0, "ready-identity-or-duplicate");
    this.workerPid = ownedPid; this.workerDomain = frame["workerDomain"]; this.workerStart = frame["workerStartMonoMs"];
    this.persist({ ...frame, parentObservedMonoMs: this.clock(), clockDomain: this.marker.supervisorDomain });
  }
  configure(executionBindingSha256: string): Frame {
    requireThat(this.workerDomain && !this.configured, "config-before-ready-or-duplicate");
    const remainingWorkMs = duration(this.marker.workDeadline - this.clock(), CAPS.workMs); this.configured = true;
    return { type: "CONFIG", attemptId: this.marker.attemptId, supervisorPid: this.marker.supervisorPid, workerPid: this.workerPid,
      supervisorDomain: this.marker.supervisorDomain, workerDomain: this.workerDomain, remainingWorkMs, executionBindingSha256 };
  }
  accept(frame: Frame): Frame | undefined {
    active(this.clock, this.deadline);
    requireThat(this.configured && !this.done && frame["attemptId"] === this.marker.attemptId && frame["supervisorDomain"] === this.marker.supervisorDomain && frame["workerDomain"] === this.workerDomain, "protocol-identity-or-after-done");
    const common = ["type", "attemptId", "supervisorDomain", "workerDomain"];
    const type = frame["type"], ordinal = frame["ordinal"];
    if (type === "URL_START") {
      keys(frame, [...common, "ordinal", "requestStartMonoMs"]);
      requireThat(ordinal === this.starts && this.starts < 2 && this.completed === this.starts, "start-order");
      requireThat(typeof frame["requestStartMonoMs"] === "number" && Number.isSafeInteger(frame["requestStartMonoMs"]) && frame["requestStartMonoMs"] >= (this.requestStarts.at(-1) ?? this.workerStart), "worker-clock-order");
      const acceptedMonoMs = this.clock(); this.deadline = Math.min(addTime(acceptedMonoMs, CAPS.getMs), this.marker.workDeadline);
      this.persist({ ...frame, getDeadline: this.deadline, acceptedMonoMs, clockDomain: this.marker.supervisorDomain, actualGetIssued: null });
      this.starts++;
      this.requestStarts.push(frame["requestStartMonoMs"]);
      const remainingGetMs = duration(this.deadline - this.clock(), CAPS.getMs);
      return { type: "ACK", attemptId: this.marker.attemptId, supervisorDomain: this.marker.supervisorDomain, workerDomain: this.workerDomain, ordinal, remainingGetMs };
    }
    if (type === "GET_INVOKED" || type === "RESPONSE_COMPLETED" || type === "URL_DONE") {
      requireThat(typeof ordinal === "number" && ordinal === this.starts - 1 && this.completed === ordinal, "url-event-order");
      if (type === "GET_INVOKED") {
        keys(frame, [...common, "ordinal"]); requireThat(!this.invoked.has(ordinal), "duplicate-invocation"); this.invoked.add(ordinal);
      } else if (type === "RESPONSE_COMPLETED") {
        keys(frame, [...common, "ordinal", "bytes", "sha256", "sha512"]);
        requireThat(this.invoked.has(ordinal) && !this.responses.has(ordinal) && Number.isInteger(frame["bytes"]) && (frame["bytes"] as number) >= 0 && (frame["bytes"] as number) <= CAPS.archive && typeof frame["sha256"] === "string" && /^[a-f0-9]{64}$/.test(frame["sha256"]) && typeof frame["sha512"] === "string" && /^[a-f0-9]{128}$/.test(frame["sha512"]), "response-facts");
        this.responses.set(ordinal, frame);
      } else {
        keys(frame, [...common, "ordinal"]); requireThat(this.responses.has(ordinal), "done-before-response");
        this.completed++; this.deadline = this.marker.workDeadline;
      }
      this.persist(frame); return undefined;
    }
    if (type === "DONE") {
      keys(frame, [...common, "manifestSha256"]);
      requireThat(this.completed === 2 && this.invoked.size === 2 && typeof frame["manifestSha256"] === "string" && /^[a-f0-9]{64}$/.test(frame["manifestSha256"]), "done-without-evidence");
      this.persist(frame); this.done = frame; return undefined;
    }
    throw new Error("unknown-or-failed-frame");
  }
  facts(): Frame { return { combinedAttemptsConsumed: 1, remainingCombinedAttempts: 0, urlStartsConsumed: this.starts,
    confirmedGetInvocations: this.invoked.size, actualGetRequests: this.invoked.size === this.starts ? this.invoked.size : null,
    responsesCompleted: this.responses.size, urlsCompleted: this.completed, remainingGetSlots: 2 - this.starts, automaticRetryAuthorized: false }; }
}
export class WorkerTiming {
  readonly clock: Clock; readonly workerStart: number; readonly supervisorDomain: string; readonly workerDomain: string;
  workCutoff = 0; private sentReady = false; private configured = false; private nextOrdinal = 0; private requestStart: number | undefined;
  constructor(readonly attemptId: string, readonly supervisorPid: number, readonly workerPid: number, clock: Clock = now, workerStart?: number) {
    this.clock = guardClock(clock); this.workerStart = workerStart ?? this.clock();
    requireThat(Number.isSafeInteger(this.workerStart) && this.workerStart >= 0 && this.workerStart <= this.clock(), "worker-start-clock");
    this.supervisorDomain = clockDomain(attemptId, "supervisor", supervisorPid); this.workerDomain = clockDomain(attemptId, "worker", workerPid);
  }
  frame(type: string, facts: Frame = {}): Frame {
    return { type, attemptId: this.attemptId, supervisorDomain: this.supervisorDomain, workerDomain: this.workerDomain, ...facts };
  }
  ready(): Frame {
    requireThat(!this.sentReady, "duplicate-ready"); this.sentReady = true;
    return this.frame("READY", { supervisorPid: this.supervisorPid, workerPid: this.workerPid, workerStartMonoMs: this.workerStart });
  }
  acceptConfig(frame: Frame): void {
    keys(frame, ["type", "attemptId", "supervisorPid", "workerPid", "supervisorDomain", "workerDomain", "remainingWorkMs", "executionBindingSha256"]);
    requireThat(this.sentReady && !this.configured && frame["type"] === "CONFIG" && frame["attemptId"] === this.attemptId && frame["supervisorPid"] === this.supervisorPid && frame["workerPid"] === this.workerPid && frame["supervisorDomain"] === this.supervisorDomain && frame["workerDomain"] === this.workerDomain && typeof frame["executionBindingSha256"] === "string", "config-identity-or-duplicate");
    this.workCutoff = addTime(this.workerStart, duration(frame["remainingWorkMs"], CAPS.workMs));
    this.configured = true; active(this.clock, this.workCutoff);
  }
  startRequest(ordinal: number): Frame {
    requireThat(this.configured && this.requestStart === undefined && ordinal === this.nextOrdinal && ordinal < 2, "request-order");
    active(this.clock, this.workCutoff); this.requestStart = this.clock();
    return this.frame("URL_START", { ordinal, requestStartMonoMs: this.requestStart });
  }
  acceptAck(frame: Frame): number {
    keys(frame, ["type", "attemptId", "supervisorDomain", "workerDomain", "ordinal", "remainingGetMs"]);
    requireThat(this.configured && this.requestStart !== undefined && frame["type"] === "ACK" && frame["attemptId"] === this.attemptId && frame["supervisorDomain"] === this.supervisorDomain && frame["workerDomain"] === this.workerDomain && frame["ordinal"] === this.nextOrdinal, "ack-identity-or-stale");
    const deadline = Math.min(this.workCutoff, addTime(this.requestStart, duration(frame["remainingGetMs"], CAPS.getMs)));
    this.requestStart = undefined; this.nextOrdinal++; active(this.clock, deadline); return deadline;
  }
}
export class Frames {
  private bytes = Buffer.alloc(0); private queue: Frame[] = []; private total = 0;
  private ended = false; private error: Error | undefined; private wake: (() => void) | undefined;
  constructor(private stream: Readable) {
    stream.on("data", (chunk: Buffer) => { try {
      this.total += chunk.length; requireThat(this.total <= CAPS.stdout, "stdout-cap");
      let at = 0;
      while (at < chunk.length) {
        const target = this.bytes.length < 4 ? 4 : 4 + this.bytes.readUInt32BE(0);
        const take = Math.min(target - this.bytes.length, chunk.length - at);
        this.bytes = Buffer.concat([this.bytes, chunk.subarray(at, at + take)]); at += take;
        if (this.bytes.length < 4) continue;
        const length = this.bytes.readUInt32BE(0); requireThat(length > 0 && length <= CAPS.frame, "frame-cap");
        if (this.bytes.length < length + 4) continue;
        const payload = this.bytes.subarray(4, 4 + length), text = utf8.decode(payload);
        const frame = object(JSON.parse(text));
        requireThat(JSON.stringify(frame) === text, "noncanonical-or-duplicate-frame");
        this.queue.push(frame as Frame); requireThat(this.queue.length <= 32, "frame-queue-cap");
        this.bytes = Buffer.alloc(0);
      }
      this.wake?.();
    } catch (e) { this.fail(e); } });
    stream.on("end", () => { this.ended = true; if (this.bytes.length) this.fail(new Error("truncated-frame")); this.wake?.(); });
    stream.on("error", e => this.fail(e));
    stream.on("close", () => { if (!this.ended) this.fail(new Error("pipe-closed-before-end")); });
  }
  private fail(e: unknown): void { this.error = e instanceof Error ? e : new Error("pipe-error"); this.stream.pause(); this.wake?.(); }
  async read(deadline: number, clock: Clock = now): Promise<Frame | null> {
    while (true) {
      active(clock, deadline); if (this.error) throw this.error;
      const frame = this.queue.shift(); if (frame) return frame;
      if (this.ended) return null;
      try { await bounded(new Promise<void>(resolveWake => { this.wake = resolveWake; }), deadline, clock); }
      finally { this.wake = undefined; }
    }
  }
}
export async function sendFrame(stream: Writable, frame: Frame, deadline: number, clock: Clock = now): Promise<void> {
  const payload = encoded(frame, CAPS.frame), header = Buffer.alloc(4); header.writeUInt32BE(payload.length);
  await writeBounded(stream, Buffer.concat([header, payload]), deadline, clock);
}
async function writeBounded(stream: Writable, data: Buffer, deadline: number, clock: Clock): Promise<void> {
  const onError = (): void => {};
  stream.on("error", onError);
  try {
    await bounded(new Promise<void>((resolveWrite, reject) => {
      stream.write(data, error => { if (error) reject(error); else resolveWrite(); });
    }), deadline, clock);
  } finally { stream.off("error", onError); }
}
export interface WorkerHandle { pid: number; stdin: Writable; stdout: Readable; stderr: Readable; exited: Promise<number | null>; kill: (signal: NodeJS.Signals) => void; destroy: () => void }
function spawnWorker(): WorkerHandle {
  validateRuntime(); const context = productionRootContext();
  const child = spawn(validateBunRuntime(), ["--no-env-file", "--no-install", join(context.readRoot, SOURCE, "capture.ts"), "--worker"], {
    cwd: context.readRoot, env: { LANG: "C", LC_ALL: "C" }, stdio: ["pipe", "pipe", "pipe"], shell: false,
  });
  const exited = new Promise<number | null>((resolveExit, reject) => { child.once("exit", resolveExit); child.once("error", reject); });
  child.stdin.on("error", () => {});
  void exited.catch(() => {});
  return { pid: child.pid ?? -1, stdin: child.stdin, stdout: child.stdout, stderr: child.stderr, exited,
    kill: signal => { child.kill(signal); }, destroy: () => { child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy(); } };
}
export async function cleanupWorker(worker: WorkerHandle | undefined, deadline: number, clock: Clock = now): Promise<Frame> {
  if (!worker) return { workerReaped: false, workerExitCode: null, workerNotStarted: true, clockFailure: false, cleanupFailure: false, pipesDestroyed: true, termAttempted: false, killAttempted: false };
  let code: number | null = null, reaped = false, termSent = false, killSent = false;
  let clockFailure = false, cleanupFailure = false, pipesDestroyed = true, termAttempted = false, killAttempted = false;
  const localClock = guardClock(clock);
  const checkedClock: Clock = () => {
    try { requireThat(!clockFailure, "cleanup-clock-tainted"); return localClock(); }
    catch (error) { clockFailure = true; cleanupFailure = true; throw error; }
  };
  const cutoff = (ms: number): number | undefined => {
    if (clockFailure) return undefined;
    try {
      requireThat(Number.isSafeInteger(deadline) && deadline >= 0, "cleanup-cutoff-invalid");
      const sampled = checkedClock();
      return sampled < deadline ? addTime(sampled, Math.min(ms, deadline - sampled)) : undefined;
    } catch { cleanupFailure = true; return undefined; }
  };
  const signal = (name: "SIGTERM" | "SIGKILL"): void => {
    if (name === "SIGTERM") termAttempted = true; else killAttempted = true;
    try { worker.kill(name); if (name === "SIGTERM") termSent = true; else killSent = true; }
    catch { cleanupFailure = true; }
  };
  try {
    const observed = worker.exited.then(exit => {
      requireThat(exit === null || (Number.isSafeInteger(exit) && exit >= 0), "cleanup-exit-invalid");
      code = exit; reaped = true; return exit;
    });
    void observed.catch(() => { cleanupFailure = true; });
    const waitUntil = async (until: number | undefined): Promise<void> => {
      if (until === undefined || clockFailure || cleanupFailure) return;
      try { await bounded(observed, until, checkedClock); }
      catch (error) { if (clockFailure || !(error instanceof Error) || error.message !== "absolute-deadline") cleanupFailure = true; }
    };
    await waitUntil(cutoff(1));
    if (!reaped) {
      const until = cutoff(1000);
      if (until !== undefined) { signal("SIGTERM"); await waitUntil(until); }
    }
    if (!reaped) { signal("SIGKILL"); await waitUntil(cutoff(3000)); }
  } catch { cleanupFailure = true; }
  finally {
    if (!reaped && !killAttempted) signal("SIGKILL");
    try { worker.destroy(); } catch { cleanupFailure = true; }
    for (const pipe of [worker.stdin, worker.stdout, worker.stderr]) {
      try { pipe.destroy(); if (!pipe.destroyed) { pipesDestroyed = false; cleanupFailure = true; } }
      catch { pipesDestroyed = false; cleanupFailure = true; }
    }
  }
  return { workerReaped: reaped, workerExitCode: code, termSent, killSent, termAttempted, killAttempted,
    reapingUnresolved: !reaped, clockFailure, cleanupFailure, pipesDestroyed };
}
function stderrCompletion(stream: Readable): Promise<number> {
  return new Promise((resolveEnd, reject) => {
    let bytes = 0, ended = false;
    stream.on("data", (data: Buffer) => { bytes += data.length; if (bytes > CAPS.stderr) { stream.pause(); reject(new Error("stderr-cap")); } });
    stream.once("end", () => { ended = true; resolveEnd(bytes); }); stream.once("error", reject);
    stream.once("close", () => { if (!ended) reject(new Error("stderr-incomplete")); });
  });
}
export async function superviseWorker(worker: WorkerHandle, protocol: Protocol, config: Frame,
  validate: (frame: Frame) => Promise<void>, recheck: () => void, clock: Clock = now): Promise<void> {
  const frames = new Frames(worker.stdout), stderr = stderrCompletion(worker.stderr);
  void stderr.catch(() => {});
  const stderrFailure = stderr.then(bytes => { requireThat(bytes === 0, "worker-stderr"); return new Promise<never>(() => {}); });
  void stderrFailure.catch(() => {});
  const guard = <T>(promise: Promise<T>): Promise<T> => Promise.race([promise, stderrFailure]);
  const ready = await guard(frames.read(protocol.marker.workDeadline, clock));
  requireThat(ready !== null, "eof-before-ready"); protocol.ready(ready, worker.pid);
  const control = protocol.configure(config["executionBindingSha256"] as string);
  await guard(sendFrame(worker.stdin, control, protocol.deadline, clock));
  while (true) {
    const frame = await guard(frames.read(protocol.deadline, clock));
    if (frame === null) break;
    const ack = protocol.accept(frame); if (ack) await guard(sendFrame(worker.stdin, ack, protocol.deadline, clock));
  }
  requireThat(protocol.done !== undefined, "eof-without-done");
  requireThat(await guard(bounded(worker.exited, protocol.marker.workDeadline, clock)) === 0, "worker-nonzero");
  requireThat(await bounded(stderr, protocol.marker.workDeadline, clock) === 0, "worker-stderr");
  await bounded(validate(protocol.done), protocol.marker.workDeadline, clock);
  recheck(); active(clock, protocol.marker.workDeadline);
}
export function selectedManifest(inspections: Inspection[], specs: ArchiveSpec[], attemptId: string): Frame {
  requireThat(inspections.length === 2 && specs.length === 2, "two-inspections");
  const files = inspections.flatMap((inspection, index) => inspection.files.map(({ data, ...file }) => ({ ...file, package: specs[index]!.name, bytes: data.length, sha256: sha(data) })));
  requireThat(files.length <= 6 && new Set(files.map(f => f.retainedFile)).size === files.length && files.reduce((sum, f) => sum + f.bytes, 0) <= CAPS.selected, "aggregate-selected-cap-or-collision");
  for (const f of files) requireThat(/^[a-zA-Z0-9._-]+$/.test(f.retainedFile) && f.retainedFile !== "." && f.retainedFile !== "..", "flat-name");
  return { version: "chess-coach.bun-selected-inputs.v1", attemptId, files: files as unknown as Json,
    packages: inspections.map((i, index) => ({ name: specs[index]!.name, version: specs[index]!.version, licenseMember: i.licenseMember, legalClearance: false,
      expandedBytesIncludingSkippedContent: i.expandedBytesIncludingSkippedContent, physicalTarHeaders: i.physicalTarHeaders })),
    legalClearance: false, assembledSourceRoot: false, packageCodeExecuted: false, trainingReady: false };
}
async function preparePaths(marker: Marker, clock: Clock, operationIdentity: fs.BigIntStats): Promise<void> {
  requireThat(!exists(join(ROOT, RAW)) && !exists(join(ROOT, OUTPUT)), "roots-not-fresh");
  const lines = readRegular(join(ROOT, ".gitignore"), 65536).toString("utf8").split(/\r?\n/).map(s => s.trim());
  const at = lines.indexOf("/_work/gpu-owner-recovery/cache/");
  requireThat(at >= 0 && !lines.slice(at + 1).some(s => s.startsWith("!")), "cache-ignore");
  for (const rel of ["_work", "_work/gpu-owner-recovery", "_work/gpu-owner-recovery/cache", D]) {
    const path = join(ROOT, rel, ".gitignore");
    if (exists(path)) requireThat(!readRegular(path, 65536).toString("utf8").split(/\r?\n/).some(s => s.trim().startsWith("!")), "nested-unignore");
  }
  const deadline = { assertActive: () => active(clock, marker.workDeadline) };
  const claim = bindExclusiveCacheClaim(productionRootContext(), marker, deadline, operationIdentity);
  await prepareClaimedCacheParent(claim, deadline);
  active(clock, marker.workDeadline);
  fresh(join(ROOT, RAW)); active(clock, marker.workDeadline); fresh(join(ROOT, OUTPUT)); active(clock, marker.workDeadline); fresh(join(ROOT, OUTPUT, "files"));
}
function validateSelectedAt(rawRoot: string, outputRoot: string, specs: ArchiveSpec[], marker: Marker, protocol: Protocol, clock: Clock = now): void {
  const inspections = specs.map((spec, ordinal) => {
    active(clock, marker.workDeadline);
    const bytes = readRegular(join(rawRoot, spec.archiveFile), CAPS.archive), response = protocol.responses.get(ordinal);
    requireThat(response !== undefined, "final-response-missing");
    requireThat(bytes.length === response["bytes"] && sha(bytes) === response["sha256"] && createHash("sha512").update(bytes).digest("hex") === response["sha512"], "final-raw-binding");
    return inspectVerifiedArchive(bytes, spec);
  });
  const manifest = selectedManifest(inspections, specs, marker.attemptId);
  const manifestBytes = readRegular(join(outputRoot, "selected-input-manifest.json"), CAPS.receipt);
  requireThat(sha(manifestBytes) === protocol.done?.["manifestSha256"] && equal(JSON.parse(utf8.decode(manifestBytes)), manifest), "final-manifest");
  for (const file of inspections.flatMap(i => i.files)) {
    active(clock, marker.workDeadline);
    requireThat(readRegular(join(outputRoot, "files", file.retainedFile), CAPS.selected).equals(file.data), "selected-file-hash");
  }
  requireThat(equal(fs.readdirSync(rawRoot).sort(), specs.map(s => s.archiveFile).sort()) &&
    equal(fs.readdirSync(outputRoot).sort(), ["files", "selected-input-manifest.json"]) &&
    equal(fs.readdirSync(join(outputRoot, "files")).sort(), inspections.flatMap(i => i.files.map(f => f.retainedFile)).sort()), "exact-output-membership");
  active(clock, marker.workDeadline);
}
export interface SyntheticContext { scope: "OFFLINE_SYNTHETIC"; operationPath: string; clock?: Clock; eligibility: () => Identity; preflight: (marker: Marker) => void | Promise<void>;
  spawn: (marker: Marker) => WorkerHandle; validate: (frame: Frame) => Promise<void>; recheck: () => void;
  writeCompletion: (line: Buffer, deadline: number) => Promise<void> }
function validateSynthetic(context: SyntheticContext): void {
  const rel = relative(join(ROOT, SOURCE), resolve(context.operationPath)).split(sep).join("/");
  requireThat(context.scope === "OFFLINE_SYNTHETIC" && /^fullverification-[1-9][0-9]*\/fixtures\/[a-zA-Z0-9_-]+\/operation$/.test(rel), "synthetic-root-only");
  safeParents(context.operationPath);
}
export function validateSyntheticSelected(base: string, specs: ArchiveSpec[], marker: Marker, protocol: Protocol): void {
  const rel = relative(join(ROOT, SOURCE), resolve(base)).split(sep).join("/");
  requireThat(/^fullverification-[1-9][0-9]*\/fixtures\/[a-zA-Z0-9_-]+$/.test(rel), "synthetic-root-only");
  validateSelectedAt(join(base, "synthetic-raw"), join(base, "synthetic-selected"), specs, marker, protocol);
}
export interface FinalizationDeps {
  journalCandidate: (candidate: Frame) => void;
  closeJournal: () => void;
  persistReceipt: (bytes: Buffer) => void;
  writeCompletion: (line: Buffer, deadline: number) => Promise<void>;
}
export async function finalizeCapture(receipt: Frame, marker: Marker, deps: FinalizationDeps, clock: Clock = now): Promise<void> {
  clock = guardClock(clock);
  requireThat(receipt["terminalState"] === "PROVISIONAL_PASS" || receipt["terminalState"] === "FAIL", "provisional-or-failure-only");
  requireThat(receipt["terminalState"] !== "PROVISIONAL_PASS" || (receipt["clockFailure"] === false && receipt["cleanupFailure"] === false && receipt["pipesDestroyed"] === true), "cleanup-taint-disqualifies-candidate");
  const bytes = encoded(receipt);
  try {
    active(clock, marker.operationDeadline);
    deps.journalCandidate({ type: "TERMINAL_CANDIDATE", terminalState: receipt["terminalState"], attemptId: marker.attemptId,
      supervisorDomain: marker.supervisorDomain, failure: receipt["failure"] ?? null, deadlineSnapshot: receipt["deadlineSnapshot"] ?? null });
  } finally { deps.closeJournal(); }
  active(clock, marker.operationDeadline);
  deps.persistReceipt(bytes);
  active(clock, marker.operationDeadline);
  if (receipt["terminalState"] === "PROVISIONAL_PASS") {
    const candidate: Frame = { type: "COMPLETION_CANDIDATE", attemptId: marker.attemptId, consumptionReceiptSha256: sha(bytes),
      supervisorDomain: marker.supervisorDomain, originMonoMs: marker.origin, operationDeadlineMonoMs: marker.operationDeadline, candidatePreparationMonoMs: clock() };
    const line = Buffer.concat([encoded(candidate, CAPS.frame - 1), Buffer.from("\n")]);
    await bounded(deps.writeCompletion(line, marker.operationDeadline), marker.operationDeadline, clock);
    active(clock, marker.operationDeadline);
  }
}
export interface OuterWitness { exitCode: number | null; stdoutEof: boolean; stderrEof: boolean; stderrBytes: number;
  clockDomain: string; startedMonoMs: number; completionObservedMonoMs: number; timedOut: boolean }
export function assessCapture(receiptBytes: Buffer, stdout: Buffer, outer: OuterWitness | undefined, expectedIdentity: Identity): "PASS" | "FAIL" | "PROVISIONAL" {
  try {
    requireThat(receiptBytes.length <= CAPS.receipt, "receipt-cap");
    const receipt = object(JSON.parse(utf8.decode(receiptBytes)));
    const origin = receipt["origin"], deadline = receipt["operationDeadline"], snapshot = object(receipt["deadlineSnapshot"]);
    requireThat(typeof receipt["attemptId"] === "string" && typeof receipt["supervisorPid"] === "number" && typeof receipt["workerPid"] === "number" &&
      receipt["supervisorDomain"] === clockDomain(receipt["attemptId"], "supervisor", receipt["supervisorPid"]) && receipt["workerDomain"] === clockDomain(receipt["attemptId"], "worker", receipt["workerPid"]), "receipt-clock-domains");
    requireThat(receipt["version"] === "chess-coach.bun-acquisition-receipt.v1" && receipt["grantId"] === GRANT && receipt["terminalState"] === "PROVISIONAL_PASS" && receipt["failure"] === null && receipt["offlineSynthetic"] === false && receipt["interrupted"] === false && equal(receipt["identity"], expectedIdentity), "receipt-identity-or-state");
    requireThat(typeof origin === "number" && Number.isSafeInteger(origin) && origin >= 0 && deadline === origin + CAPS.operationMs && receipt["workDeadline"] === origin + CAPS.workMs &&
      snapshot["clockDomain"] === receipt["supervisorDomain"] && snapshot["operationDeadlineMonoMs"] === deadline && snapshot["observedExceeded"] === false && typeof snapshot["observedMonoMs"] === "number" && Number.isSafeInteger(snapshot["observedMonoMs"]) && snapshot["observedMonoMs"] >= origin && snapshot["observedMonoMs"] < deadline, "deadline-snapshot");
    const workerTiming = object(receipt["workerTiming"]);
    requireThat(workerTiming["clockDomain"] === receipt["workerDomain"] && typeof workerTiming["workerStartMonoMs"] === "number" && Number.isSafeInteger(workerTiming["workerStartMonoMs"]) && workerTiming["workerStartMonoMs"] >= 0 && Array.isArray(workerTiming["requestStartsMonoMs"]) && workerTiming["requestStartsMonoMs"].length === 2, "worker-timing");
    let lastWorker = workerTiming["workerStartMonoMs"];
    for (const stamp of workerTiming["requestStartsMonoMs"]) { requireThat(typeof stamp === "number" && Number.isSafeInteger(stamp) && stamp >= lastWorker, "worker-timing-order"); lastWorker = stamp; }
    requireThat(receipt["clockFailure"] === false && receipt["cleanupFailure"] === false && receipt["pipesDestroyed"] === true && receipt["workerReaped"] === true && receipt["workerExitCode"] === 0 && receipt["workerStdoutEof"] === true && receipt["workerStderrEof"] === true && receipt["doneEvidenceReceived"] === true &&
      receipt["eligibilityRevalidated"] === true && receipt["selectedHashesAndMembershipVerified"] === true && receipt["bindingRechecked"] === true &&
      receipt["combinedAttemptsConsumed"] === 1 && receipt["remainingCombinedAttempts"] === 0 && receipt["urlStartsConsumed"] === 2 && receipt["actualGetRequests"] === 2 && receipt["confirmedGetInvocations"] === 2 && receipt["responsesCompleted"] === 2 && receipt["urlsCompleted"] === 2 &&
      typeof receipt["selectedManifestSha256"] === "string" && /^[a-f0-9]{64}$/.test(receipt["selectedManifestSha256"]), "worker-and-binding-evidence");
    if (outer === undefined) return "PROVISIONAL";
    requireThat(typeof outer.clockDomain === "string" && /^[a-zA-Z0-9_-]{1,128}:outer:[1-9][0-9]*$/.test(outer.clockDomain) && Number.isSafeInteger(Number(outer.clockDomain.split(":").at(-1))) && outer.clockDomain !== receipt["supervisorDomain"] && outer.clockDomain !== receipt["workerDomain"], "outer-clock-domain");
    requireThat(outer.exitCode === 0 && outer.stdoutEof === true && outer.stderrEof === true && outer.stderrBytes === 0 && outer.timedOut === false &&
      Number.isSafeInteger(outer.startedMonoMs) && outer.startedMonoMs >= 0 && Number.isSafeInteger(outer.completionObservedMonoMs) && outer.completionObservedMonoMs - outer.startedMonoMs > 0 && outer.completionObservedMonoMs - outer.startedMonoMs < CAPS.operationMs, "outer-exit-eof-or-deadline");
    requireThat(stdout.length > 0 && stdout.length <= CAPS.frame, "completion-line-cap");
    const lines = utf8.decode(stdout).split("\n");
    requireThat(lines.length === 2 && lines[1] === "", "single-completion-line");
    const candidate = object(JSON.parse(lines[0]!));
    keys(candidate, ["type", "attemptId", "consumptionReceiptSha256", "supervisorDomain", "originMonoMs", "operationDeadlineMonoMs", "candidatePreparationMonoMs"]);
    requireThat(candidate["type"] === "COMPLETION_CANDIDATE" && candidate["attemptId"] === receipt["attemptId"] && candidate["consumptionReceiptSha256"] === sha(receiptBytes) &&
      candidate["supervisorDomain"] === receipt["supervisorDomain"] && candidate["originMonoMs"] === origin && candidate["operationDeadlineMonoMs"] === deadline && typeof candidate["candidatePreparationMonoMs"] === "number" && Number.isSafeInteger(candidate["candidatePreparationMonoMs"]) && candidate["candidatePreparationMonoMs"] >= snapshot["observedMonoMs"] && candidate["candidatePreparationMonoMs"] < deadline, "completion-candidate-binding");
    return "PASS";
  } catch { return "FAIL"; }
}
export async function superviseCapture(test?: SyntheticContext): Promise<Frame> {
  const clock = guardClock(test?.clock ?? now), origin = clock();
  if (test) validateSynthetic(test);
  else validateRuntime();
  const eligibility = test?.eligibility ?? validateEligibility;
  const identity = JSON.parse(utf8.decode(encoded(eligibility()))) as Identity;
  active(clock, origin + CAPS.workMs);
  const operation = test?.operationPath ?? join(ROOT, OP);
  const marker = claimAttempt(operation, clock, origin), operationIdentity = fs.lstatSync(operation, { bigint: true }), journal = new Journal(join(operation, "events.jsonl"));
  const protocol = new Protocol(marker, e => journal.append(e), clock);
  let worker: WorkerHandle | undefined, failure: string | null = null, success = false;
  let eligibilityRevalidated = false, workerEvidenceVerified = false, bindingRechecked = false;
  let cleanup: Frame = {}, receipt: Frame = {}, interruption = false;
  const interrupted = (): void => { interruption = true; try { worker?.kill("SIGTERM"); } catch {} };
  process.on("SIGINT", interrupted); process.on("SIGTERM", interrupted); process.on("SIGHUP", interrupted);
  try {
    journal.append({ type: "COMBINED_CLAIMED", attemptId: marker.attemptId, combinedAttemptsConsumed: 1 });
    active(clock, marker.workDeadline);
    requireThat(equal(eligibility(), identity), "post-claim-eligibility-drift"); eligibilityRevalidated = true;
    active(clock, marker.workDeadline);
    if (test) await test.preflight(marker);
    else {
      validateRuntime(); await preparePaths(marker, clock, operationIdentity); requireThat(equal(validateEligibility(), identity), "preflight-source-drift");
    }
    active(clock, marker.workDeadline); worker = test ? test.spawn(marker) : spawnWorker();
    const config: Frame = { executionBindingSha256: identity.executionBindingSha256 };
    await superviseWorker(worker, protocol, config, test?.validate ?? (async () => { validateSelectedAt(join(ROOT, RAW), join(ROOT, OUTPUT), identity.plan.archives, marker, protocol); }),
      test?.recheck ?? (() => { validateRuntime(); requireThat(equal(validateEligibility(), identity), "completion-source-drift"); }), clock);
    workerEvidenceVerified = true;
    requireThat(!interruption, "supervisor-interrupted"); success = true;
  } catch (e) { failure = e instanceof Error ? e.message.slice(0, 192) : "unknown-failure"; }
  finally {
    try {
    cleanup = await cleanupWorker(worker, marker.operationDeadline - 3000, clock);
    if (cleanup["workerReaped"] !== true || cleanup["workerExitCode"] !== 0 || cleanup["clockFailure"] !== false || cleanup["cleanupFailure"] !== false || cleanup["pipesDestroyed"] !== true || interruption) success = false;
    if (cleanup["clockFailure"] === true) failure ??= "cleanup-clock-failure";
    else if (cleanup["cleanupFailure"] === true || cleanup["pipesDestroyed"] !== true) failure ??= "worker-cleanup-failed";
    try {
      active(clock, marker.operationDeadline - 1000);
      if (test) test.recheck();
      else { validateRuntime(); requireThat(equal(validateEligibility(), identity), "finalization-source-drift"); }
      active(clock, marker.operationDeadline - 1000);
      bindingRechecked = true;
    } catch (e) { success = false; failure ??= e instanceof Error ? e.message : "finalization-failed"; }
    const observedMonoMs = clock();
    receipt = { version: "chess-coach.bun-acquisition-receipt.v1", grantId: GRANT, ...marker, terminalState: success ? "PROVISIONAL_PASS" : "FAIL",
      failure, identity: identity as unknown as Json, ...protocol.facts(), ...cleanup,
      doneEvidenceReceived: protocol.done !== undefined, artifactsPreserved: true, retriesPerformed: 0,
      eligibilityRevalidated, workerStdoutEof: workerEvidenceVerified, workerStderrEof: workerEvidenceVerified,
      selectedHashesAndMembershipVerified: workerEvidenceVerified, bindingRechecked,
      selectedManifestSha256: protocol.done?.["manifestSha256"] ?? null,
      workerPid: protocol.workerPid, workerDomain: protocol.workerDomain,
      workerTiming: { clockDomain: protocol.workerDomain, workerStartMonoMs: protocol.workerStart, requestStartsMonoMs: protocol.requestStarts },
      deadlineSnapshot: { clockDomain: marker.supervisorDomain, observedMonoMs, operationDeadlineMonoMs: marker.operationDeadline, observedExceeded: observedMonoMs >= marker.operationDeadline }, interrupted: interruption,
      strictOsSchedulingOrDurabilityDeadlineGuarantee: false, trainingReady: false, offlineSynthetic: Boolean(test) };
      await finalizeCapture(receipt, marker, { journalCandidate: candidate => journal.append(candidate, true), closeJournal: () => journal.close(),
        persistReceipt: bytes => exclusive(join(operation, "consumption-receipt.json"), bytes),
        writeCompletion: test?.writeCompletion ?? ((line, deadline) => writeBounded(process.stdout, line, deadline, clock)) }, clock);
      requireThat(!interruption, "supervisor-interrupted");
    } finally {
      process.off("SIGINT", interrupted); process.off("SIGTERM", interrupted); process.off("SIGHUP", interrupted);
    }
  }
  return receipt;
}
export async function runWorker(): Promise<void> {
  const clock = guardClock(now), workerStart = clock();
  validateRuntime();
  const markerRecord = object(jsonFile(join(ROOT, OP, "attempt.json")));
  requireThat(typeof markerRecord["attemptId"] === "string" && markerRecord["supervisorPid"] === process.ppid && markerRecord["combinedAttemptsConsumed"] === 1 && markerRecord["grantId"] === GRANT, "worker-attempt-binding");
  const timing = new WorkerTiming(markerRecord["attemptId"], process.ppid, process.pid, clock, workerStart);
  requireThat(markerRecord["supervisorDomain"] === timing.supervisorDomain, "worker-attempt-domain");
  const frames = new Frames(process.stdin), startupCutoff = addTime(workerStart, CAPS.workMs);
  await sendFrame(process.stdout, timing.ready(), startupCutoff, clock);
  const initial = await frames.read(startupCutoff, clock); requireThat(initial !== null, "config-eof"); timing.acceptConfig(initial);
  validateRuntime();
  const identity = validateEligibility(); requireThat(identity.executionBindingSha256 === initial["executionBindingSha256"], "worker-source-drift");
  requireThat(equal(fs.readdirSync(join(ROOT, RAW)), []) && equal(fs.readdirSync(join(ROOT, OUTPUT)).sort(), ["files"]) && equal(fs.readdirSync(join(ROOT, OUTPUT, "files")), []), "worker-fresh-roots");
  const inspections: Inspection[] = [];
  for (const [ordinal, spec] of identity.plan.archives.entries()) {
    await sendFrame(process.stdout, timing.startRequest(ordinal), timing.workCutoff, clock);
    const ack = await frames.read(timing.workCutoff, clock); requireThat(ack !== null, "ack-eof");
    const deadline = timing.acceptAck(ack);
    const path = join(ROOT, RAW, spec.archiveFile); safeParents(path);
    const fd = fs.openSync(path, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    let downloaded: Buffer;
    try {
      const result = await downloadArchive(spec, { write: data => writeAll(fd, data) }, { transport: directTLS, deadline, clock,
        event: async (type, facts) => sendFrame(process.stdout, timing.frame(type, { ordinal, ...facts }), deadline, clock) });
      downloaded = result.data; fs.fsyncSync(fd);
    } finally { fs.closeSync(fd); syncDir(dirname(path)); }
    inspections.push(inspectVerifiedArchive(downloaded, spec));
    await sendFrame(process.stdout, timing.frame("URL_DONE", { ordinal }), deadline, clock);
  }
  active(clock, timing.workCutoff);
  const manifest = selectedManifest(inspections, identity.plan.archives, timing.attemptId);
  exclusive(join(ROOT, OUTPUT, "selected-input-manifest.json"), encoded(manifest));
  for (const file of inspections.flatMap(i => i.files)) { active(clock, timing.workCutoff); exclusive(join(ROOT, OUTPUT, "files", file.retainedFile), file.data, CAPS.selected); }
  validateRuntime(); requireThat(equal(validateEligibility(), identity), "worker-final-source-drift");
  await sendFrame(process.stdout, timing.frame("DONE", { manifestSha256: sha(encoded(manifest)) }), timing.workCutoff, clock);
  process.stdin.destroy();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    requireThat(process.argv.length === 3, "explicit-entry-argument-required");
    if (process.argv[2] === "execute") { const receipt = await superviseCapture(); process.exitCode = receipt["terminalState"] === "PROVISIONAL_PASS" ? 0 : 1; }
    else if (process.argv[2] === "--worker") await runWorker();
    else throw new Error("unsupported-entry-argument");
  } catch (e) { process.stderr.write(`${e instanceof Error ? e.message : "capture-failed"}\n`); process.exitCode = 1; }
}
