// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { createHash } from "node:crypto";
import { constants, closeSync, fstatSync, lstatSync, openSync, readSync, readdirSync, readlinkSync } from "node:fs";
import { isAbsolute, join, parse, resolve } from "node:path";
import { types } from "node:util";

export class SourceAuthorityError extends Error {
  override readonly name = "SourceAuthorityError";
  constructor(readonly code: "PROVENANCE" | "PATH" | "LIMIT" | "SNAPSHOT" | "MANIFEST" | "POLICY" | "INVENTORY" |
    "AUDITOR_CODE" | "SOURCE_INPUT" | "REVOKED" | "IMMUTABLE_LOADING_UNSUPPORTED" | "RUNTIME" |
    "FORBIDDEN_ACQUISITION" | "AUDITOR_ENFORCEMENT_UNSUPPORTED" | "RUNTIME_IMAGE_BINDING_UNSUPPORTED") { super(code); }
}
export const rejectSourceAuthority = (code: SourceAuthorityError["code"]): never => { throw new SourceAuthorityError(code); };
export const sourceSha256 = (bytes: string | Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
export const SOURCE_EXCLUSIONS = Object.freeze(["node_modules", "_spec/evidence/ml-adjutant-r2-refresh"]);
export const SOURCE_INVENTORY_LOCATION = "/hermetic-evidence/source.json (outside inventoried root)";
export const SOURCE_MANIFEST_ALGORITHM = "sha256(JSON.stringify(entries))";
const ENTRY_CAP = 65536;
const FILE_BYTE_CAP = 16777216;
const SNAPSHOT_BYTE_CAP = 268435456;

export type SourceManifestEntry = Readonly<
  { path: string; mode: string; type: "directory" } |
  { path: string; mode: string; type: "file"; bytes: number; sha256: string } |
  { path: string; mode: string; type: "symlink"; target: string; sha256: string }
>;
export type CapturedSourceManifestV1 = Readonly<{
  version: 1; root: "/app"; exclusions: readonly string[]; inventoryLocation: typeof SOURCE_INVENTORY_LOCATION;
  algorithm: typeof SOURCE_MANIFEST_ALGORITHM; sha256: string; entries: readonly SourceManifestEntry[];
}>;
declare const snapshotBrand: unique symbol;
export type CapturedSourceSnapshot = Readonly<{ [snapshotBrand]: "captured-source-bytes-not-loading-authority" }>;
type Snapshot = Readonly<{ physicalRoot: string; manifest: CapturedSourceManifestV1;
  files: ReadonlyMap<string, string>; members: ReadonlyMap<string, SourceManifestEntry> }>;
const snapshots = new WeakMap<object, Snapshot>();
const lookupSnapshot = WeakMap.prototype.get.bind(snapshots);
const publishSnapshot = WeakMap.prototype.set.bind(snapshots);
const ownKeys = Reflect.ownKeys;
const descriptor = Object.getOwnPropertyDescriptor;
const isProxy = types.isProxy;

export const requireSourcePath = (value: unknown): string => {
  if (typeof value !== "string" || value.length === 0 || value.length > 4096 || value.startsWith("/") || value.includes("\\") ||
      value.includes("\0") || value.split("/").some(part => !part || part === "." || part === "..")) return rejectSourceAuthority("PATH");
  return value;
};
export const sourceRecord = (value: unknown, keys: readonly string[], code: SourceAuthorityError["code"]): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || isProxy(value) || Array.isArray(value)) return rejectSourceAuthority(code);
  const actual = ownKeys(value);
  if (actual.length !== keys.length || actual.some(key => typeof key !== "string" || !keys.includes(key))) return rejectSourceAuthority(code);
  const record = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    const field = descriptor(value, key);
    if (!field || !Object.hasOwn(field, "value") || !field.enumerable) return rejectSourceAuthority(code);
    record[key] = field.value;
  }
  return record;
};
export const sourceArray = (value: unknown, code: SourceAuthorityError["code"]): unknown[] => {
  if (value === null || typeof value !== "object" || isProxy(value) || !Array.isArray(value)) return rejectSourceAuthority(code);
  const length = descriptor(value, "length")?.value as unknown;
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0 || length > ENTRY_CAP ||
      ownKeys(value).length !== length + 1) return rejectSourceAuthority(code);
  const result: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const field = descriptor(value, String(index));
    if (!field || !Object.hasOwn(field, "value") || !field.enumerable) return rejectSourceAuthority(code);
    result.push(field.value);
  }
  return result;
};
export const parseSourceJson = (bytes: Uint8Array, code: SourceAuthorityError["code"]): unknown => {
  if (bytes.byteLength > 1048576) return rejectSourceAuthority("LIMIT");
  let parsed: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    parsed = JSON.parse(text) as unknown;
  } catch { return rejectSourceAuthority(code); }
  const pending: Array<{ value: unknown; depth: number }> = [{ value: parsed, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (++count > ENTRY_CAP || depth > 128) return rejectSourceAuthority("LIMIT");
    if (value !== null && typeof value === "object") {
      for (const child of Object.values(value)) pending.push({ value: child, depth: depth + 1 });
    }
  }
  return parsed;
};
export const canonicalSourceJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalSourceJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalSourceJson(record[key])}`).join(",")}}`;
};

const requireSnapshot = (value: unknown): Snapshot => {
  if (value === null || typeof value !== "object") return rejectSourceAuthority("PROVENANCE");
  const snapshot = lookupSnapshot(value);
  if (!snapshot) return rejectSourceAuthority("PROVENANCE");
  return snapshot;
};
const excluded = (path: string): boolean => path.split("/").includes(SOURCE_EXCLUSIONS[0]!) ||
  path === SOURCE_EXCLUSIONS[1] || path.startsWith(`${SOURCE_EXCLUSIONS[1]}/`);
export const fixedSourcePhysicalRoot = (root: string): string => {
  if (typeof root !== "string" || root.includes("\0") || !isAbsolute(root)) return rejectSourceAuthority("PATH");
  const absolute = resolve(root);
  let cursor = parse(absolute).root;
  for (const part of absolute.slice(cursor.length).split("/").filter(Boolean)) {
    cursor = join(cursor, part);
    if (lstatSync(cursor).isSymbolicLink()) return rejectSourceAuthority("SNAPSHOT");
  }
  if (!lstatSync(absolute).isDirectory()) return rejectSourceAuthority("SNAPSHOT");
  return absolute;
};
export const stableSourceStat = (before: ReturnType<typeof fstatSync>, after: ReturnType<typeof fstatSync>): boolean =>
  before.dev === after.dev && before.ino === after.ino && before.mode === after.mode && before.size === after.size &&
  before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs && before.nlink === after.nlink;

export const captureFilesystemSourceSnapshot = (trustedHostRoot: string): CapturedSourceSnapshot => {
  const root = fixedSourcePhysicalRoot(trustedHostRoot);
  const entries: SourceManifestEntry[] = [];
  const files = new Map<string, string>();
  let totalBytes = 0;
  const walk = (path: string, depth: number): void => {
    if (excluded(path)) return;
    if (depth > 128 || entries.length >= ENTRY_CAP) return rejectSourceAuthority("LIMIT");
    const absolute = path === "." ? root : join(root, path);
    const stat = lstatSync(absolute), mode = (stat.mode & 0o7777).toString(8);
    if (stat.isSymbolicLink()) {
      const target = readlinkSync(absolute);
      if (!stableSourceStat(stat, lstatSync(absolute))) return rejectSourceAuthority("SNAPSHOT");
      entries.push(Object.freeze({ path, mode, type: "symlink", target, sha256: sourceSha256(target) }));
    } else if (stat.isDirectory()) {
      entries.push(Object.freeze({ path, mode, type: "directory" }));
      const children = readdirSync(absolute).sort();
      for (const child of children) walk(requireSourcePath(path === "." ? child : `${path}/${child}`), depth + 1);
      if (!stableSourceStat(stat, lstatSync(absolute)) || JSON.stringify(children) !== JSON.stringify(readdirSync(absolute).sort())) {
        return rejectSourceAuthority("SNAPSHOT");
      }
    } else if (stat.isFile()) {
      if (!Number.isSafeInteger(stat.size) || stat.size > FILE_BYTE_CAP || stat.size > SNAPSHOT_BYTE_CAP - totalBytes) {
        return rejectSourceAuthority("LIMIT");
      }
      const fd = openSync(absolute, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        const opened = fstatSync(fd);
        if (!opened.isFile() || !stableSourceStat(stat, opened)) return rejectSourceAuthority("SNAPSHOT");
        const bytes = Buffer.alloc(opened.size);
        let offset = 0;
        while (offset < bytes.length) {
          const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
          if (count === 0) return rejectSourceAuthority("SNAPSHOT");
          offset += count;
        }
        if (!stableSourceStat(opened, fstatSync(fd)) || !stableSourceStat(opened, lstatSync(absolute))) return rejectSourceAuthority("SNAPSHOT");
        entries.push(Object.freeze({ path, mode, type: "file", bytes: bytes.length, sha256: sourceSha256(bytes) }));
        files.set(path, bytes.toString("base64"));
        totalBytes += bytes.length;
      } finally { closeSync(fd); }
    } else return rejectSourceAuthority("SNAPSHOT");
  };
  walk(".", 0);
  const manifest = Object.freeze({ version: 1, root: "/app", exclusions: SOURCE_EXCLUSIONS,
    inventoryLocation: SOURCE_INVENTORY_LOCATION, algorithm: SOURCE_MANIFEST_ALGORITHM,
    sha256: sourceSha256(JSON.stringify(entries)), entries: Object.freeze(entries) } as const);
  const token = Object.freeze(Object.create(null)) as CapturedSourceSnapshot;
  const members = new Map(entries.map(entry => [entry.path, entry]));
  publishSnapshot(token, Object.freeze({ physicalRoot: root, manifest, files, members }));
  return token;
};

export const requireCapturedSourceSnapshot = (value: unknown): CapturedSourceSnapshot => {
  requireSnapshot(value);
  return value as CapturedSourceSnapshot;
};
export const capturedSourcePhysicalRoot = (snapshot: CapturedSourceSnapshot): string => requireSnapshot(snapshot).physicalRoot;
export const capturedSourceManifest = (snapshot: CapturedSourceSnapshot): CapturedSourceManifestV1 => requireSnapshot(snapshot).manifest;
export const readCapturedSourceFile = (snapshot: CapturedSourceSnapshot, path: string): Uint8Array => {
  const stored = requireSnapshot(snapshot).files.get(requireSourcePath(path));
  if (stored === undefined) return rejectSourceAuthority("SNAPSHOT");
  return new Uint8Array(Buffer.from(stored, "base64"));
};
export const capturedSourceMember = (snapshot: CapturedSourceSnapshot, path: string): SourceManifestEntry | undefined => {
  const stored = requireSnapshot(snapshot), selected = requireSourcePath(path);
  return stored.members.get(selected);
};

export const verifyCapturedSourceManifest = (snapshot: CapturedSourceSnapshot, registeredBytes: Uint8Array): CapturedSourceManifestV1 => {
  const actual = requireSnapshot(snapshot).manifest;
  const parsed = sourceRecord(parseSourceJson(registeredBytes, "MANIFEST"),
    ["version", "root", "exclusions", "inventoryLocation", "algorithm", "sha256", "entries"], "MANIFEST");
  if (parsed.version !== 1 || parsed.root !== "/app" || parsed.inventoryLocation !== SOURCE_INVENTORY_LOCATION ||
      parsed.algorithm !== SOURCE_MANIFEST_ALGORITHM || parsed.sha256 !== actual.sha256 ||
      JSON.stringify(parsed.exclusions) !== JSON.stringify(SOURCE_EXCLUSIONS) ||
      JSON.stringify(parsed.entries) !== JSON.stringify(actual.entries)) return rejectSourceAuthority("MANIFEST");
  if (new TextDecoder("utf-8", { fatal: true }).decode(registeredBytes) !== JSON.stringify(actual, null, 2) + "\n") {
    return rejectSourceAuthority("MANIFEST");
  }
  return actual;
};
