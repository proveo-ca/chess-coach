// SPEC: _spec/recovery.md
import { createHash } from "node:crypto";

export const tarPrefix = "tracel-llvm-23.1.0-4";
export const tarLimits = Object.freeze({ decompressedBytes: 512 * 1024 * 1024, headerCount: 65536,
  pathBytes: 4096, components: 64, extensionBytes: 64 * 1024,
  cumulativeExtensionBytes: 1024 * 1024, inventoryBytes: 32 * 1024 * 1024, graphNodes: 131072 });
type EntryBase = { path: string; mode: number; size: number };
export type TarEntry = EntryBase & ({ type: "file"; sha256: string } | { type: "directory" } |
  { type: "symlink" | "hardlink"; target: string });
export type TarInventory = { version: 1; prefix: typeof tarPrefix; entries: TarEntry[];
  totals: { decompressedBytes: number; headerCount: number; extensionBytes: number; fileBytes: number; count: number } };
type Node = { name: string; parent?: Node; children: Map<string, Node>; entry?: TarEntry };
type Overrides = { path?: string; linkpath?: string; size?: number };
type Header = { path: string; link: string; type: string; mode: number; size: number };
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
function fail(code: string): never { throw Error(`TAR_${code}`); }
const zero = (bytes: Uint8Array): boolean => bytes.every(byte => byte === 0);
const utf8 = (bytes: Uint8Array): string => { try { return decoder.decode(bytes); } catch { return fail("UTF8"); } };
function text(bytes: Uint8Array): string {
  const end = bytes.indexOf(0);
  if (end >= 0 && !zero(bytes.subarray(end))) fail("STRING_NUL");
  const value = utf8(end < 0 ? bytes : bytes.subarray(0, end));
  if (/[\x00-\x1f\x7f-\x9f]/u.test(value)) fail("STRING_CONTROL");
  return value;
}
function octal(bytes: Uint8Array, allowEmpty = false): number {
  if (bytes.some(byte => byte > 127)) fail("NUMERIC_ENCODING");
  const value = String.fromCharCode(...bytes);
  if (!/^(?: *[0-7]+[ \x00]*|[ \x00]*)$/.test(value)) fail("OCTAL");
  const digits = value.replace(/[ \x00]/g, "");
  if (digits === "" && !allowEmpty) fail("OCTAL_EMPTY");
  const number = digits === "" ? 0 : Number.parseInt(digits, 8);
  if (!Number.isSafeInteger(number) || number < 0) fail("NUMERIC_RANGE");
  return number;
}
function header(bytes: Uint8Array): Header {
  const expected = octal(bytes.subarray(148, 156));
  let checksum = 0;
  for (let i = 0; i < 512; i++) checksum += i >= 148 && i < 156 ? 32 : bytes[i]!;
  if (checksum !== expected) fail("CHECKSUM");
  const mode = octal(bytes.subarray(100, 108)), size = octal(bytes.subarray(124, 136));
  for (const [start, end] of [[108, 116], [116, 124], [136, 148]]) {
    octal(bytes.subarray(start, end));
  }
  octal(bytes.subarray(329, 337), true); octal(bytes.subarray(337, 345), true);
  const posix = Buffer.from(bytes.subarray(257, 265)).equals(Buffer.from("ustar\0" + "00"));
  const gnu = Buffer.from(bytes.subarray(257, 265)).equals(Buffer.from("ustar  \0"));
  if (!posix && !gnu) fail("MAGIC_VERSION");
  if (gnu) {
    octal(bytes.subarray(345, 357), true); octal(bytes.subarray(357, 369), true);
    if (!zero(bytes.subarray(369))) fail("GNU_SPARSE_OR_EXTENSION");
  } else if (!zero(bytes.subarray(500))) fail("HEADER_RESERVED");
  if (mode > 0o7777 || size > tarLimits.decompressedBytes) fail("HEADER_RANGE");
  const name = text(bytes.subarray(0, 100)), prefix = posix ? text(bytes.subarray(345, 500)) : "";
  const link = text(bytes.subarray(157, 257));
  text(bytes.subarray(265, 297)); text(bytes.subarray(297, 329));
  return { path: prefix ? `${prefix}/${name}` : name, link, mode, size, type: String.fromCharCode(bytes[156]!) };
}
function boundedPath(value: string): string[] {
  if (!value || Buffer.byteLength(value) > tarLimits.pathBytes || /[\x00-\x1f\x7f-\x9f\\]/u.test(value) || value.startsWith("/")) fail("PATH");
  const parts = value.split("/");
  if (parts.length > tarLimits.components) fail("COMPONENT_LIMIT");
  return parts;
}
function entryPath(value: string, directory: boolean): string {
  if (directory && value.endsWith("/")) value = value.slice(0, -1);
  const parts = boundedPath(value);
  if (parts[0] !== tarPrefix || parts.some(part => !part || part === "." || part === ".." || part === ".tracel-llvm-installed")) fail("ENTRY_PATH");
  if (parts.length === 1 && !directory) fail("ROOT_TYPE");
  return value;
}
function linkPath(value: string, path: string, hard: boolean): void {
  const parts = boundedPath(value);
  const base = hard ? [] : path.split("/").slice(0, -1);
  if (hard && parts[0] !== tarPrefix) fail("HARDLINK_PREFIX");
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") { if (base.length <= 1) fail("LINK_ESCAPE"); base.pop(); }
    else base.push(part);
    if (base[0] !== tarPrefix || base.length > tarLimits.components) fail("LINK_ESCAPE");
  }
}
function insert(root: Node, entry: TarEntry, budget: { nodes: number }): void {
  let node = root;
  for (const name of entry.path.split("/").slice(1)) {
    if (node.entry && node.entry.type !== "directory") fail("NON_DIRECTORY_ANCESTOR");
    let child = node.children.get(name);
    if (!child) {
      if (budget.nodes >= tarLimits.graphNodes) fail("GRAPH_NODE_LIMIT");
      budget.nodes++;
      child = { name, parent: node, children: new Map() }; node.children.set(name, child);
    }
    node = child;
  }
  if (node.entry) fail("DUPLICATE_PATH");
  if (node.children.size && entry.type !== "directory") fail("PARENT_MUTATION");
  node.entry = entry;
}
function validateLinks(root: Node): void {
  const resolved = new Map<Node, Node>();
  const restore = (node: Node): Node[] => {
    const nodes: Node[] = [];
    for (let next: Node | undefined = node; next; next = next.parent) nodes.push(next);
    return nodes.reverse();
  };
  const visit = (start: Node): void => {
    type Exit = { node: Node; hard: boolean };
    const active = new Set<Node>(), pending: (string | Exit)[] = restore(start).slice(1).map(node => node.name).reverse();
    let nodes = [root], hardDepth = 0;
    while (pending.length) {
      const part = pending.pop()!;
      let current = nodes[nodes.length - 1]!;
      if (typeof part !== "string") {
        if (part.hard && current.entry?.type !== "file") fail("HARDLINK_NOT_REGULAR");
        if (part.hard) hardDepth--;
        active.delete(part.node); resolved.set(part.node, current); continue;
      }
      if (current.entry && current.entry.type !== "directory") fail("LINK_NON_DIRECTORY");
      if (part === "." || part === "") continue;
      if (part === "..") { if (nodes.length <= 1) fail("LINK_ESCAPE"); nodes.pop(); continue; }
      const child = current.children.get(part);
      if (!child) fail("LINK_UNRESOLVED");
      const entry = child.entry;
      if (entry?.type !== "symlink" && entry?.type !== "hardlink") {
        nodes.push(child);
        if (nodes.length > tarLimits.components) fail("COMPONENT_LIMIT");
        continue;
      }
      if (entry.type === "symlink" && hardDepth) fail("HARDLINK_SYMLINK");
      const cached = resolved.get(child);
      if (cached) { nodes = restore(cached); continue; }
      if (active.has(child)) fail("LINK_CYCLE");
      active.add(child);
      const hard = entry.type === "hardlink";
      if (hard) { hardDepth++; nodes = [root]; }
      pending.push({ node: child, hard });
      pending.push(...entry.target.split("/").slice(hard ? 1 : 0).reverse());
    }
  };
  const pending = [root];
  while (pending.length) {
    const node = pending.pop()!;
    if (node.entry?.type === "symlink" || node.entry?.type === "hardlink") visit(node);
    for (const child of node.children.values()) pending.push(child);
  }
}
export function validateTarEntryGraph(entries: readonly TarEntry[]): void {
  if (entries.length === 0 || entries.length > tarLimits.headerCount - 2) fail("ENTRY_COUNT");
  const root: Node = { name: tarPrefix, children: new Map() }, graph = { nodes: 1 };
  for (const entry of entries) {
    if (entryPath(entry.path, entry.type === "directory") !== entry.path) fail("ENTRY_PATH");
    if (entry.type === "symlink" || entry.type === "hardlink") linkPath(entry.target, entry.path, entry.type === "hardlink");
    insert(root, entry, graph);
  }
  validateLinks(root);
}
function decimal(value: string): number {
  if (!/^(?:0|[1-9][0-9]*)$/.test(value)) fail("PAX_DECIMAL");
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) fail("PAX_RANGE");
  return number;
}
function pax(bytes: Uint8Array): [string, string][] {
  const records: [string, string][] = [];
  if (!bytes.length) fail("PAX_EMPTY");
  for (let offset = 0; offset < bytes.length;) {
    let space = offset;
    while (space < bytes.length && bytes[space] !== 32) {
      if (bytes[space]! < 48 || bytes[space]! > 57 || space - offset >= 16) fail("PAX_LENGTH");
      space++;
    }
    if (space === bytes.length) fail("PAX_LENGTH");
    const length = decimal(utf8(bytes.subarray(offset, space))), end = offset + length;
    if (!Number.isSafeInteger(end) || end > bytes.length || end <= space + 2 || bytes[end - 1] !== 10) fail("PAX_RECORD");
    const record = utf8(bytes.subarray(space + 1, end - 1)), equals = record.indexOf("=");
    if (equals <= 0) fail("PAX_RECORD");
    records.push([record.slice(0, equals), record.slice(equals + 1)]); offset = end;
  }
  return records;
}

export async function auditTar(chunks: AsyncIterable<Uint8Array>): Promise<TarInventory> {
  const inventory: TarInventory = { version: 1, prefix: tarPrefix, entries: [],
    totals: { decompressedBytes: 0, headerCount: 0, extensionBytes: 0, fileBytes: 0, count: 0 } };
  const root: Node = { name: tarPrefix, children: new Map() }, buffer = new Uint8Array(512);
  const graph = { nodes: 1 };
  const totals = inventory.totals, localKeys = new Set<string>(), globalKeys = new Set<string>();
  let overrides: Overrides = {}, longName: string | undefined, longLink: string | undefined, orphan = false;
  let localPaxPending = false;
  let state = "header" as "header" | "payload" | "padding" | "trailing", filled = 0, zeros = 0;
  let remaining = 0, padding = 0, metadata: Uint8Array | undefined, metadataOffset = 0, extension = "";
  let file: Extract<TarEntry, { type: "file" }> | undefined, hash: ReturnType<typeof createHash> | undefined;
  let entryBytes = 0;
  const checkInventory = () => {
    const overhead = Buffer.byteLength(JSON.stringify({ version: 1, prefix: tarPrefix, entries: [], totals }));
    if (entryBytes + overhead > tarLimits.inventoryBytes) fail("INVENTORY_LIMIT");
  };
  const finishBody = () => {
    if (metadata) {
      if (extension === "L" || extension === "K") {
        if (metadata.byteLength < 1 || metadata[metadata.byteLength - 1] !== 0 || metadata.subarray(0, -1).includes(0)) fail("GNU_TERMINATOR");
        const value = text(metadata.subarray(0, -1));
        boundedPath(extension === "L" && value.endsWith("/") ? value.slice(0, -1) : value);
        if (extension === "L") {
          if (longName !== undefined || localKeys.has("path")) fail("OVERRIDE_CONFLICT");
          longName = value;
        } else {
          if (longLink !== undefined || localKeys.has("linkpath")) fail("OVERRIDE_CONFLICT");
          longLink = value;
        }
      } else {
        const seen = extension === "g" ? globalKeys : localKeys;
        for (const [key, value] of pax(metadata)) {
          if (!["path", "linkpath", "size", "mtime", "atime", "ctime"].includes(key)) fail("PAX_KEY");
          if (seen.has(key)) fail("OVERRIDE_CONFLICT");
          seen.add(key);
          if (key === "path" || key === "linkpath" || key === "size") {
            if (extension === "g") fail("PAX_GLOBAL_OVERRIDE");
            if ((key === "path" && longName !== undefined) || (key === "linkpath" && longLink !== undefined)) fail("OVERRIDE_CONFLICT");
            if (key === "size") {
              overrides.size = decimal(value);
              if (overrides.size > tarLimits.decompressedBytes) fail("PAX_RANGE");
            } else {
              boundedPath(key === "path" && value.endsWith("/") ? value.slice(0, -1) : value);
              overrides[key] = value;
            }
          } else if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) > Number.MAX_SAFE_INTEGER) fail("PAX_TIME");
        }
      }
      metadata = undefined;
    } else if (file && hash) { file.sha256 = hash.digest("hex"); file = undefined; hash = undefined; }
    state = padding ? "padding" : "header";
  };
  const begin = (raw: Header) => {
    const isExtension = ["L", "K", "x", "g"].includes(raw.type);
    extension = isExtension ? raw.type : "";
    if (isExtension) {
      if (raw.type === "g" && (localPaxPending || longName !== undefined || longLink !== undefined)) fail("GLOBAL_AFTER_LOCAL_EXTENSION");
      if (raw.type === "x") {
        if (localPaxPending) fail("DUPLICATE_LOCAL_PAX");
        localPaxPending = true;
      }
      if (raw.size > tarLimits.extensionBytes || raw.size > tarLimits.cumulativeExtensionBytes - totals.extensionBytes) fail("EXTENSION_LIMIT");
      totals.extensionBytes += raw.size; orphan = true; metadata = new Uint8Array(raw.size); metadataOffset = 0;
      remaining = raw.size;
    } else {
      const type = raw.type === "0" || raw.type === "\0" ? "file" : raw.type === "5" ? "directory" : raw.type === "2" ? "symlink" : raw.type === "1" ? "hardlink" : fail("ENTRY_TYPE");
      const path = entryPath(longName ?? overrides.path ?? raw.path, type === "directory"), size = overrides.size ?? raw.size;
      const target = longLink ?? overrides.linkpath ?? raw.link;
      if (type !== "file" && (size !== 0 || raw.size !== 0)) fail("NON_FILE_SIZE");
      if ((raw.mode & 0o7000) !== 0) fail("PRIVILEGED_MODE");
      const required = type === "directory" ? 0o500 : 0o400;
      if (type !== "symlink" && ((raw.mode & 0o022) !== 0 || (raw.mode & required) !== required)) fail("UNSAFE_MODE");
      let entry: TarEntry;
      if (type === "symlink" || type === "hardlink") {
        linkPath(target, path, type === "hardlink"); entry = { path, type, mode: raw.mode, size: 0, target };
      } else {
        if (target !== "") fail("NON_LINK_TARGET");
        entry = type === "file" ? { path, type, mode: raw.mode, size, sha256: "0".repeat(64) } : { path, type, mode: raw.mode, size: 0 };
      }
      entryBytes += Buffer.byteLength(JSON.stringify(entry)) + (totals.count ? 1 : 0);
      totals.count++; checkInventory(); insert(root, entry, graph); inventory.entries.push(entry);
      if (entry.type === "file") {
        if (size > tarLimits.decompressedBytes - totals.fileBytes) fail("FILE_BYTE_LIMIT");
        totals.fileBytes += size; file = entry; hash = createHash("sha256");
      }
      remaining = size; overrides = {}; longName = undefined; longLink = undefined; localKeys.clear(); localPaxPending = false; orphan = false;
    }
    padding = (512 - remaining % 512) % 512;
    state = "payload";
    if (!remaining) finishBody();
  };
  for await (const chunk of chunks) {
    if (!(chunk instanceof Uint8Array)) fail("CHUNK_TYPE");
    if (!Number.isSafeInteger(chunk.byteLength) || chunk.byteLength > tarLimits.decompressedBytes - totals.decompressedBytes) fail("DECOMPRESSED_LIMIT");
    totals.decompressedBytes += chunk.byteLength;
    for (let offset = 0; offset < chunk.byteLength;) {
      if (state === "trailing") { if (!zero(chunk.subarray(offset))) fail("TRAILING_DATA"); break; }
      if (state === "header") {
        const count = Math.min(512 - filled, chunk.byteLength - offset);
        buffer.set(chunk.subarray(offset, offset + count), filled); filled += count; offset += count;
        if (filled < 512) continue;
        filled = 0;
        if (++totals.headerCount > tarLimits.headerCount) fail("HEADER_LIMIT");
        if (zero(buffer)) { if (++zeros === 2) state = "trailing"; continue; }
        if (zeros) fail("ZERO_TERMINATION");
        begin(header(buffer));
      } else if (state === "payload") {
        const count = Math.min(remaining, chunk.byteLength - offset), bytes = chunk.subarray(offset, offset + count);
        if (metadata) { metadata.set(bytes, metadataOffset); metadataOffset += count; } else hash?.update(bytes);
        remaining -= count; offset += count;
        if (!remaining) finishBody();
      } else {
        const count = Math.min(padding, chunk.byteLength - offset);
        if (!zero(chunk.subarray(offset, offset + count))) fail("NONZERO_PADDING");
        padding -= count; offset += count;
        if (!padding) state = "header";
      }
    }
  }
  if (state !== "trailing" || filled || remaining || padding) fail("TRUNCATED_OR_UNTERMINATED");
  if (orphan) fail("ORPHAN_EXTENSION");
  if (totals.count === 0) fail("EMPTY");
  validateLinks(root); checkInventory();
  inventory.entries.sort((left, right) => Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)));
  return inventory;
}
