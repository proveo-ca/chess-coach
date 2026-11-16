// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { posix } from "node:path";
import { fileURLToPath } from "node:url";
import { types } from "node:util";
import {
  capturedSourceManifest, readCapturedSourceFile, rejectSourceAuthority, requireCapturedSourceSnapshot,
  type CapturedSourceSnapshot, type SourceManifestEntry,
} from "./sourceManifest";
import { capturedRuntimeManifest, readCapturedRuntimeFile, requireCapturedRuntimeSnapshot, type CapturedRuntimeSnapshot } from "./sourceRuntimeSnapshot";

export type SourceMemoryFs = Readonly<{
  fs: Readonly<Record<string, unknown>>; canonicalPath(value: unknown): string; assertCurrent(): void;
  forbid(): never; revoke(): void;
}>;
type Member = Readonly<{ entry: SourceManifestEntry; bytes?: string }>;

export const createSourceMemoryFs = (source: CapturedSourceSnapshot, runtime?: CapturedRuntimeSnapshot): SourceMemoryFs => {
  requireCapturedSourceSnapshot(source);
  if (runtime !== undefined) requireCapturedRuntimeSnapshot(runtime);
  const members = new Map<string, Member>(), descriptors = new Map<number, string>();
  let active = true, forbidden = false, nextDescriptor = 3;
  const assertCurrent = (): void => {
    if (!active) return rejectSourceAuthority("REVOKED");
    if (forbidden) return rejectSourceAuthority("FORBIDDEN_ACQUISITION");
  };
  const forbid = (): never => { forbidden = true; return rejectSourceAuthority("FORBIDDEN_ACQUISITION"); };
  const add = (root: string, entries: readonly SourceManifestEntry[], read: (path: string) => Uint8Array): void => {
    for (const entry of entries) {
      const path = entry.path === "." ? root : `${root}/${entry.path}`;
      if (members.has(path)) return rejectSourceAuthority("SNAPSHOT");
      members.set(path, Object.freeze({ entry, ...(entry.type === "file" ? { bytes: Buffer.from(read(entry.path)).toString("base64") } : {}) }));
    }
  };
  add("/app", capturedSourceManifest(source).entries, path => readCapturedSourceFile(source, path));
  if (runtime !== undefined) {
    const manifest = capturedRuntimeManifest(runtime);
    for (const tree of [...manifest.installed, manifest.frozenStore, manifest.tools]) {
      add(tree.root, tree.entries, path => readCapturedRuntimeFile(runtime, `${tree.root}/${path}`));
    }
  }
  for (const path of [...members.keys()]) {
    for (let parent = posix.dirname(path); !members.has(parent); parent = posix.dirname(parent)) {
      members.set(parent, Object.freeze({ entry: Object.freeze({ path: parent, mode: "755", type: "directory" }) }));
      if (parent === "/") break;
    }
  }
  const compilerCaseProbes = new Set([...members.keys()].filter(path => path.endsWith("/typescript/lib/typescript.js"))
    .map(path => path.replace(/\w/g, character => character === character.toUpperCase() ? character.toLowerCase() : character.toUpperCase())));
  const allowed = (path: string): boolean => path === "/" || path === "/pnpm" || path === "/opt" ||
    path === "/app" || path.startsWith("/app/") || path === "/pnpm/store" || path.startsWith("/pnpm/store/") ||
    path === "/opt/pnpm" || path.startsWith("/opt/pnpm/");
  const checkedPath = (value: unknown): string => {
    assertCurrent();
    if (value !== null && typeof value === "object" && types.isProxy(value)) return forbid();
    const path = value instanceof URL ? value.protocol === "file:" && !value.search && !value.hash ? fileURLToPath(value) : forbid() : value;
    if (typeof path !== "string" || path.length > 4096 || !path.startsWith("/") || path.includes("\\") || path.includes("\0") ||
        path !== "/" && path.split("/").slice(1).some(part => !part || part === "." || part === "..") ||
        !allowed(path) && !compilerCaseProbes.has(path)) return forbid();
    return path;
  };
  const missing = (path: string, code = "ENOENT"): never => { throw Object.assign(new Error(`${code}: ${path}`), { code }); };
  const canonical = (value: unknown, followFinal = true): string => {
    let path = checkedPath(value);
    const seen = new Set<string>();
    for (let links = 0; links < 40; links++) {
      const parts = path.split("/").filter(Boolean);
      let cursor = "", changed = false;
      for (let index = 0; index < parts.length; index++) {
        cursor += `/${parts[index]}`;
        const member = members.get(cursor);
        if (!member) return missing(cursor);
        if (member.entry.type === "symlink" && (followFinal || index < parts.length - 1)) {
          if (seen.has(cursor) || !member.entry.target || member.entry.target.includes("\\") || member.entry.target.includes("\0")) return forbid();
          seen.add(cursor);
          const target = posix.resolve(posix.dirname(cursor), member.entry.target);
          path = checkedPath(posix.join(target, ...parts.slice(index + 1)));
          changed = true;
          break;
        }
        if (index < parts.length - 1 && member.entry.type !== "directory") return missing(cursor, "ENOTDIR");
      }
      if (!changed) return path;
    }
    return forbid();
  };
  const stat = (value: unknown, follow = true): object => {
    const path = canonical(value, follow), member = members.get(path)!;
    const kind = member.entry.type, mode = parseInt(member.entry.mode, 8) | (kind === "file" ? 0o100000 : kind === "directory" ? 0o040000 : 0o120000);
    return Object.freeze({ dev: 1, ino: path, mode, size: kind === "file" ? member.entry.bytes : 0, mtimeMs: 0, ctimeMs: 0, nlink: 1,
      isFile: () => kind === "file", isDirectory: () => kind === "directory", isSymbolicLink: () => kind === "symlink" });
  };
  const readFile = (value: unknown, options?: unknown): Buffer | string => {
    const path = canonical(value), member = members.get(path)!;
    if (member.entry.type !== "file") return missing(path, "EISDIR");
    const encoding = typeof options === "string" ? options : options === undefined || options === null ? undefined :
      typeof options === "object" && Object.keys(options).every(key => key === "encoding" || key === "flag") &&
      (!Object.hasOwn(options, "flag") || (options as { flag: unknown }).flag === "r") ? (options as { encoding?: unknown }).encoding : forbid();
    const bytes = Buffer.from(member.bytes!, "base64");
    if (encoding === undefined || encoding === null) return bytes;
    if (typeof encoding !== "string" || !Buffer.isEncoding(encoding)) return forbid();
    return bytes.toString(encoding);
  };
  const readdir = (value: unknown, options?: unknown): unknown[] => {
    const path = canonical(value), member = members.get(path)!;
    if (member.entry.type !== "directory") return missing(path, "ENOTDIR");
    if (options !== undefined && (options === null || typeof options !== "object" || Object.keys(options).some(key => key !== "withFileTypes") ||
        (options as { withFileTypes?: unknown }).withFileTypes !== true)) return forbid();
    const children = [...members.keys()].filter(child => child !== path && posix.dirname(child) === path).sort();
    return children.map(child => options === undefined ? posix.basename(child) : Object.freeze({ ...stat(child, false), name: posix.basename(child) }));
  };
  const open = (value: unknown, flags: unknown): number => {
    if (flags !== "r" && flags !== 0 && flags !== (0x20000 | 0x800)) return forbid();
    const path = canonical(value);
    if (members.get(path)!.entry.type !== "file") return missing(path, "EISDIR");
    const fd = nextDescriptor++;
    descriptors.set(fd, path);
    return fd;
  };
  const fdPath = (fd: unknown): string => {
    assertCurrent();
    if (typeof fd !== "number" || !descriptors.has(fd)) return forbid();
    return descriptors.get(fd)!;
  };
  const realpath = Object.assign((value: unknown): string => canonical(value), { native: (value: unknown): string => canonical(value) });
  const promises = new Proxy(Object.freeze({ __esModule: false, readFile: async (value: unknown, options?: unknown) => readFile(value, options),
    readdir: async (value: unknown, options?: unknown) => readdir(value, options), stat: async (value: unknown) => stat(value),
    lstat: async (value: unknown) => stat(value, false), realpath: async (value: unknown) => canonical(value),
    readlink: async (value: unknown) => { const entry = members.get(canonical(value, false))!.entry; return entry.type === "symlink" ? entry.target : forbid(); } }),
  { get: (target, key) => Object.hasOwn(target, key) ? Reflect.get(target, key) : forbid() });
  const fs = Object.freeze({
    __esModule: false,
    constants: Object.freeze({ O_RDONLY: 0, O_NOFOLLOW: 0x20000, O_NONBLOCK: 0x800 }),
    readFileSync: readFile, readdirSync: readdir, statSync: (value: unknown) => stat(value), lstatSync: (value: unknown) => stat(value, false),
    realpathSync: Object.freeze(realpath), readlinkSync: (value: unknown) => {
      const path = canonical(value, false), entry = members.get(path)!.entry;
      if (entry.type !== "symlink") return missing(path, "EINVAL");
      return entry.target;
    },
    existsSync: (value: unknown) => { try { canonical(value); return true; } catch (error) { assertCurrent(); if ((error as { code?: string }).code === "ENOENT") return false; throw error; } },
    openSync: open, fstatSync: (fd: unknown) => stat(fdPath(fd)), closeSync: (fd: unknown) => { fdPath(fd); descriptors.delete(fd as number); },
    readSync: (fd: unknown, buffer: Uint8Array, offset: number, length: number, position: number) => {
      const bytes = readFile(fdPath(fd)) as Buffer;
      if (!types.isUint8Array(buffer) || ![offset, length, position].every(value => Number.isSafeInteger(value) && value >= 0) ||
          offset > buffer.length || length > buffer.length - offset) return forbid();
      const count = Math.max(0, Math.min(length, bytes.length - position));
      buffer.set(bytes.subarray(position, position + count), offset);
      return count;
    },
    promises,
  });
  const facade = new Proxy(fs, { get: (target, key) => Object.hasOwn(target, key) ? Reflect.get(target, key) : forbid() });
  return Object.freeze({ fs: facade, canonicalPath: canonical, assertCurrent, forbid, revoke: () => { active = false; } });
};
