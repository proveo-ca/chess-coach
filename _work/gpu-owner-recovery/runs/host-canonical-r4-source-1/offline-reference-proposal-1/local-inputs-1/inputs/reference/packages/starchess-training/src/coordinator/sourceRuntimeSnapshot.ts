// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, readdirSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import {
  fixedSourcePhysicalRoot, rejectSourceAuthority, requireSourcePath, sourceSha256, stableSourceStat,
  type SourceManifestEntry,
} from "./sourceManifest";

export const SOURCE_INSTALLED_ROOTS = Object.freeze(["/app/node_modules", ...["starchess-core", "starchess-arena", "starchess-training"]
  .map(name => `/app/packages/${name}/node_modules`)]);
export type CapturedRuntimeTree = Readonly<{ root: string; algorithm: "sha256(JSON.stringify(entries))";
  sha256: string; entries: readonly SourceManifestEntry[] }>;
export type CapturedDependencyManifestV1 = Readonly<{ version: 1; installed: readonly CapturedRuntimeTree[];
  installedSha256: string; frozenStore: CapturedRuntimeTree; tools: CapturedRuntimeTree }>;
declare const runtimeSnapshotBrand: unique symbol;
export type CapturedRuntimeSnapshot = Readonly<{ [runtimeSnapshotBrand]: "captured-runtime-bytes" }>;
type Snapshot = Readonly<{ manifest: CapturedDependencyManifestV1; files: ReadonlyMap<string, string> }>;
const snapshots = new WeakMap<object, Snapshot>();
const lookup = WeakMap.prototype.get.bind(snapshots), publish = WeakMap.prototype.set.bind(snapshots);
const requireSnapshot = (value: unknown): Snapshot => {
  if (value === null || typeof value !== "object") return rejectSourceAuthority("RUNTIME");
  return lookup(value) ?? rejectSourceAuthority("RUNTIME");
};

export const captureFilesystemRuntimeSnapshot = (
  repositoryRoot: string, frozenStoreRoot: string, toolTreeRoot: string,
): CapturedRuntimeSnapshot => {
  const repository = fixedSourcePhysicalRoot(repositoryRoot), store = fixedSourcePhysicalRoot(frozenStoreRoot), tools = fixedSourcePhysicalRoot(toolTreeRoot);
  const files = new Map<string, string>();
  let count = 0, total = 0;
  const tree = (physical: string, root: string): CapturedRuntimeTree => {
    const base = fixedSourcePhysicalRoot(physical), entries: SourceManifestEntry[] = [];
    const walk = (path: string, depth: number): void => {
      if (++count > 131072 || depth > 128) return rejectSourceAuthority("LIMIT");
      const absolute = path === "." ? base : join(base, path), stat = lstatSync(absolute);
      const mode = (stat.mode & 0o7777).toString(8);
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
        if (!Number.isSafeInteger(stat.size) || stat.size > 33554432 || stat.size > 1073741824 - total) return rejectSourceAuthority("LIMIT");
        const fd = openSync(absolute, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        try {
          const opened = fstatSync(fd);
          if (!opened.isFile() || !stableSourceStat(stat, opened)) return rejectSourceAuthority("SNAPSHOT");
          const bytes = Buffer.alloc(opened.size);
          let offset = 0;
          while (offset < bytes.length) {
            const length = readSync(fd, bytes, offset, bytes.length - offset, offset);
            if (!length) return rejectSourceAuthority("SNAPSHOT");
            offset += length;
          }
          if (!stableSourceStat(opened, fstatSync(fd)) || !stableSourceStat(opened, lstatSync(absolute))) return rejectSourceAuthority("SNAPSHOT");
          entries.push(Object.freeze({ path, mode, type: "file", bytes: bytes.length, sha256: sourceSha256(bytes) }));
          files.set(`${root}/${path}`, bytes.toString("base64"));
          total += bytes.length;
        } finally { closeSync(fd); }
      } else return rejectSourceAuthority("RUNTIME");
    };
    walk(".", 0);
    return Object.freeze({ root, algorithm: "sha256(JSON.stringify(entries))", sha256: sourceSha256(JSON.stringify(entries)), entries: Object.freeze(entries) });
  };
  const installed = Object.freeze(SOURCE_INSTALLED_ROOTS.map(root => tree(join(repository, root.slice("/app/".length)), root)));
  const manifest = Object.freeze({ version: 1, installed, installedSha256: sourceSha256(JSON.stringify(installed)),
    frozenStore: tree(store, "/pnpm/store"), tools: tree(tools, "/opt/pnpm") } as const);
  const result = Object.freeze(Object.create(null)) as CapturedRuntimeSnapshot;
  publish(result, Object.freeze({ manifest, files }));
  return result;
};
export const capturedRuntimeManifest = (snapshot: CapturedRuntimeSnapshot): CapturedDependencyManifestV1 => requireSnapshot(snapshot).manifest;
export const requireCapturedRuntimeSnapshot = (value: unknown): CapturedRuntimeSnapshot => {
  requireSnapshot(value);
  return value as CapturedRuntimeSnapshot;
};
export const readCapturedRuntimeFile = (snapshot: CapturedRuntimeSnapshot, absolutePath: string): Uint8Array => {
  if (typeof absolutePath !== "string" || !absolutePath.startsWith("/")) return rejectSourceAuthority("PATH");
  requireSourcePath(absolutePath.slice(1));
  const stored = requireSnapshot(snapshot).files.get(absolutePath);
  if (stored === undefined) return rejectSourceAuthority("RUNTIME");
  return new Uint8Array(Buffer.from(stored, "base64"));
};
export const verifyCapturedRuntimeManifest = (snapshot: CapturedRuntimeSnapshot, bytes: Uint8Array): void => {
  if (new TextDecoder("utf-8", { fatal: true }).decode(bytes) !== JSON.stringify(requireSnapshot(snapshot).manifest, null, 2) + "\n") {
    return rejectSourceAuthority("RUNTIME");
  }
};
