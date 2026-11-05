// SPEC: _spec/tooling/sbx-dev/preparation-workflow.puml
import { posix } from "node:path";
import { inflateRawSync } from "node:zlib";

const BLOCK = 512;
const EXTENSION_CAP = 65536;
const TRAILER_CAP = 1024 ** 2;
const ZIP_ENTRY_CAP = 128 * 1024 ** 2;
const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const paxKeys = new Set(["path", "linkpath", "size", "mtime", "atime", "ctime"]);

function unsafe() {
  const error = new Error("UNSAFE_ARCHIVE");
  error.code = "UNSAFE_ARCHIVE";
  throw error;
}

function integer(value) {
  if (!Number.isSafeInteger(value) || value < 0) unsafe();
  return value;
}

function add(a, b, limit = Number.MAX_SAFE_INTEGER) {
  const result = integer(a + b);
  if (result > limit) unsafe();
  return result;
}

function limits(options, zip = false) {
  if (!options || typeof options.root !== "string" || !options.root || /[^A-Za-z0-9_.+-]/.test(options.root)
    || options.root.length > 1024 || [".", ".."].includes(options.root)) unsafe();
  for (const key of ["maxBytes", "maxMembers", "maxMetadataBytes", ...(zip ? ["maxEntryBytes"] : [])]) {
    if (!Number.isSafeInteger(options[key]) || options[key] <= 0) unsafe();
  }
  if (zip && options.maxEntryBytes > ZIP_ENTRY_CAP) unsafe();
  const streamLimit = add(add(options.maxBytes, integer(options.maxMembers * 2048)),
    add(options.maxMetadataBytes, TRAILER_CAP));
  return { root: options.root, maxBytes: options.maxBytes, maxMembers: options.maxMembers,
    maxMetadataBytes: options.maxMetadataBytes, maxEntryBytes: options.maxEntryBytes, streamLimit };
}

function bytes(value) {
  if (!(value instanceof Uint8Array)) unsafe();
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}

function text(value) {
  return utf8.decode(value);
}

function portable(value) {
  return typeof value === "string" && value.length > 0 && !/[^A-Za-z0-9._/+@%=-]/.test(value);
}

function pathName(value, root, directory = false) {
  if (!portable(value) || value.length > 1024) unsafe();
  const path = directory && value.endsWith("/") ? value.slice(0, -1) : value;
  if (path.split("/").some((part) => !part || part === "." || part === "..")
    || (path !== root && !path.startsWith(`${root}/`))) unsafe();
  return path;
}

function permissions(mode) {
  if (!Number.isSafeInteger(mode) || mode < 0 || mode > 0o7777 || (mode & 0o7000)) unsafe();
  return mode;
}

function linkTarget(entry, root, inventory, isDirectory) {
  const link = entry.link;
  if (!portable(link) || link.length > 1024 || link.startsWith("/")
    || link.split("/").some((part) => !part || part === ".") || entry.path === root) unsafe();
  const parts = entry.type === "hardlink" ? [] : posix.dirname(entry.path).split("/");
  const segments = link.split("/");
  for (let index = 0; index < segments.length; index++) {
    const part = segments[index];
    if (part === "..") {
      if (entry.type === "hardlink" || parts.length <= 1) unsafe();
      parts.pop();
    } else parts.push(part);
    if (parts[0] !== root) unsafe();
    if (index !== segments.length - 1 && !isDirectory(parts.join("/"))) unsafe();
  }
  const target = parts.join("/");
  if (!inventory.has(target)) unsafe();
  return target;
}

function validateInventory(entries, root) {
  const inventory = new Map();
  const directories = new Set();
  for (const entry of entries) {
    if (inventory.has(entry.path)) unsafe();
    inventory.set(entry.path, entry);
    if (entry.type === "directory") directories.add(entry.path);
  }
  for (const entry of entries) {
    let parent = posix.dirname(entry.path);
    while (parent !== ".") {
      if (inventory.has(parent) && inventory.get(parent).type !== "directory") unsafe();
      parent = posix.dirname(parent);
    }
  }
  const paths = [...inventory.keys()].sort();
  const isDirectory = (path) => {
    const member = inventory.get(path);
    if (member) return member.type === "directory";
    const prefix = `${path}/`;
    let low = 0, high = paths.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (paths[middle] < prefix) low = middle + 1;
      else high = middle;
    }
    return paths[low]?.startsWith(prefix) ?? false;
  };
  const targets = new Map();
  for (const entry of entries) {
    if (entry.link !== null) targets.set(entry.path, linkTarget(entry, root, inventory, isDirectory));
  }
  const resolved = new Map();
  for (const entry of entries) {
    if (!targets.has(entry.path) || resolved.has(entry.path)) continue;
    const chain = [], visiting = new Set();
    let current = entry.path;
    while (targets.has(current) && !resolved.has(current)) {
      if (visiting.has(current)) unsafe();
      visiting.add(current);
      chain.push(current);
      const next = targets.get(current);
      if (inventory.get(current).type === "hardlink" && inventory.get(next).type === "symlink") unsafe();
      current = next;
    }
    const terminal = resolved.get(current) ?? inventory.get(current);
    if (!terminal || !["file", "directory"].includes(terminal.type)) unsafe();
    for (const path of chain) {
      if (inventory.get(path).type === "hardlink" && terminal.type !== "file") unsafe();
      resolved.set(path, terminal);
    }
  }
  for (const [path, terminal] of resolved) {
    if (terminal.type === "directory") directories.add(posix.dirname(path));
  }
  const graph = new Map([...directories].map((path) => [path, new Set()]));
  for (const directory of directories) {
    let parent = posix.dirname(directory);
    while (parent !== "." && !graph.has(parent)) parent = posix.dirname(parent);
    if (graph.has(parent)) graph.get(parent).add(directory);
  }
  for (const [path, terminal] of resolved) {
    if (terminal.type === "directory") graph.get(posix.dirname(path)).add(terminal.path);
  }
  const colors = new Map();
  for (const start of graph.keys()) {
    if (colors.has(start)) continue;
    const stack = [[start, false]];
    while (stack.length) {
      const [node, leaving] = stack.pop();
      if (leaving) { colors.set(node, 2); continue; }
      if (colors.get(node) === 1) unsafe();
      if (colors.get(node) === 2) continue;
      colors.set(node, 1);
      stack.push([node, true]);
      for (const next of graph.get(node)) stack.push([next, false]);
    }
  }
}

function field(header, offset, length) {
  const value = header.subarray(offset, offset + length);
  const end = value.indexOf(0);
  if (end !== -1 && value.subarray(end).some((byte) => byte !== 0)) unsafe();
  return text(end === -1 ? value : value.subarray(0, end));
}

function octal(header, offset, length, optional = false) {
  const value = header.subarray(offset, offset + length);
  if (value[0] & 0x80) unsafe();
  if (optional && value.every((byte) => byte === 0 || byte === 32)) return 0;
  const source = text(value);
  const match = /^ *([0-7]+)[\0 ]*$/.exec(source);
  if (!match || match[0] !== source) unsafe();
  let result = 0;
  for (const digit of match[1]) result = add(integer(result * 8), digit.charCodeAt(0) - 48);
  return result;
}

function tarHeader(header) {
  const checksum = octal(header, 148, 8);
  let actual = 0;
  for (let index = 0; index < BLOCK; index++) actual += index >= 148 && index < 156 ? 32 : header[index];
  if (actual !== checksum) unsafe();
  const ustar = header.subarray(257, 265).equals(Buffer.from("ustar\0" + "00"));
  const gnu = header.subarray(257, 265).equals(Buffer.from("ustar  \0"));
  if (!ustar && !gnu) unsafe();
  const mode = permissions(octal(header, 100, 8));
  for (const [offset, length] of [[108, 8], [116, 8], [136, 12]]) octal(header, offset, length);
  if (octal(header, 329, 8, true) || octal(header, 337, 8, true)) unsafe();
  for (const offset of [265, 297]) {
    if (/[\x00-\x1f\x7f]/.test(field(header, offset, 32))) unsafe();
  }
  let prefix = "";
  if (ustar) prefix = field(header, 345, 155);
  else {
    octal(header, 345, 12, true);
    octal(header, 357, 12, true);
    if (header.subarray(369, 500).some((byte) => byte !== 0)) unsafe();
  }
  if (header.subarray(500).some((byte) => byte !== 0)) unsafe();
  const name = field(header, 0, 100), link = field(header, 157, 100);
  if (!portable(name) || (prefix && !portable(prefix)) || (link && !portable(link))) unsafe();
  return { name: `${prefix ? `${prefix}/` : ""}${name}`, link, mode,
    size: octal(header, 124, 12), kind: header[156] };
}

function decimal(value) {
  if (/^(0|[1-9][0-9]*)$/.exec(value)?.[0] !== value) unsafe();
  return integer(Number(value));
}

function paxRecords(payload) {
  const result = {};
  let offset = 0;
  while (offset < payload.length) {
    const space = payload.indexOf(32, offset);
    if (space === -1 || space - offset > 6) unsafe();
    const length = decimal(text(payload.subarray(offset, space)));
    const end = add(offset, length, payload.length);
    if (end <= space + 1 || payload[end - 1] !== 10) unsafe();
    const record = text(payload.subarray(space + 1, end - 1));
    const equals = record.indexOf("=");
    if (equals < 1) unsafe();
    const key = record.slice(0, equals), value = record.slice(equals + 1);
    if (!paxKeys.has(key) || Object.hasOwn(result, key) || !value || /[\x00-\x1f\x7f]/.test(value)) unsafe();
    if (key === "size") result[key] = decimal(value);
    else {
      if (["mtime", "atime", "ctime"].includes(key)
        && (/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.exec(value)?.[0] !== value || value.length > 64
          || !Number.isFinite(Number(value)) || Number(value) > Number.MAX_SAFE_INTEGER)) unsafe();
      result[key] = value;
    }
    offset = end;
  }
  if (!offset) unsafe();
  return result;
}

export class TarInspector {
  #limits;
  #closed = false;
  #entries = [];
  #names = new Set();
  #bytes = 0;
  #streamBytes = 0;
  #metadataBytes = 0;
  #header = Buffer.alloc(BLOCK);
  #headerBytes = 0;
  #phase = "header";
  #remaining = 0;
  #padding = 0;
  #zeros = 0;
  #trailer = 0;
  #extension = null;
  #extensionBytes = 0;
  #extensionKind = null;
  #pending = {};
  #pendingKinds = new Set();

  constructor(options) {
    try { this.#limits = limits(options); }
    catch { unsafe(); }
  }

  #reserve(count) {
    this.#metadataBytes = add(this.#metadataBytes, count, this.#limits.maxMetadataBytes);
  }

  #acceptHeader() {
    const header = this.#header;
    if (header.every((byte) => byte === 0)) {
      if (this.#pendingKinds.size) unsafe();
      this.#zeros++;
      if (this.#zeros === 2) { this.#phase = "trailer"; this.#trailer = 1024; }
      return;
    }
    if (this.#zeros) unsafe();
    this.#reserve(BLOCK);
    const item = tarHeader(header);
    const extension = [76, 75, 120].includes(item.kind);
    if (extension) {
      if (this.#pendingKinds.has(item.kind) || item.size < 1 || item.size > EXTENSION_CAP || item.link) unsafe();
      this.#pendingKinds.add(item.kind);
      this.#reserve(item.size);
      this.#extension = Buffer.alloc(item.size);
      this.#extensionKind = item.kind;
      this.#extensionBytes = 0;
    } else {
      const type = new Map([[0, "file"], [48, "file"], [53, "directory"], [50, "symlink"], [49, "hardlink"]]).get(item.kind);
      if (!type || this.#entries.length >= this.#limits.maxMembers) unsafe();
      const path = pathName(this.#pending.path ?? item.name, this.#limits.root, type === "directory");
      const size = this.#pending.size ?? item.size;
      const target = this.#pending.linkpath ?? item.link;
      const link = ["symlink", "hardlink"].includes(type) ? target : null;
      if ((type !== "file" && size !== 0) || (link === null ? target !== "" : !target)
        || this.#names.has(path)) unsafe();
      this.#reserve(path.length + (link?.length ?? 0));
      this.#names.add(path);
      this.#entries.push({ path, type, size, mode: item.mode, link });
      if (type === "file") this.#bytes = add(this.#bytes, size, this.#limits.maxBytes);
      this.#pending = {};
      this.#pendingKinds.clear();
      item.size = size;
    }
    this.#remaining = item.size;
    this.#padding = (BLOCK - item.size % BLOCK) % BLOCK;
    this.#phase = item.size ? "body" : "header";
  }

  #acceptExtension() {
    const payload = this.#extension;
    let values;
    if (this.#extensionKind === 120) values = paxRecords(payload);
    else {
      if (payload.at(-1) !== 0 || payload.indexOf(0) !== payload.length - 1) unsafe();
      const value = text(payload.subarray(0, -1));
      if (!portable(value) || value.length > 1024) unsafe();
      values = { [this.#extensionKind === 76 ? "path" : "linkpath"]: value };
    }
    for (const [key, value] of Object.entries(values)) {
      if (Object.hasOwn(this.#pending, key)) unsafe();
      this.#pending[key] = value;
    }
    this.#extension = null;
    this.#extensionKind = null;
  }

  write(chunk) {
    try {
      if (this.#closed) unsafe();
      const input = bytes(chunk);
      this.#streamBytes = add(this.#streamBytes, input.length, this.#limits.streamLimit);
      let offset = 0;
      while (offset < input.length) {
        if (this.#phase === "trailer") {
          this.#trailer = add(this.#trailer, input.length - offset, TRAILER_CAP);
          if (input.subarray(offset).some((byte) => byte !== 0)) unsafe();
          break;
        }
        if (this.#phase === "header") {
          const count = Math.min(BLOCK - this.#headerBytes, input.length - offset);
          this.#header.set(input.subarray(offset, offset + count), this.#headerBytes);
          this.#headerBytes += count;
          offset += count;
          if (this.#headerBytes === BLOCK) {
            this.#headerBytes = 0;
            this.#acceptHeader();
          }
        } else if (this.#phase === "body") {
          const count = Math.min(this.#remaining, input.length - offset);
          if (this.#extension) {
            this.#extension.set(input.subarray(offset, offset + count), this.#extensionBytes);
            this.#extensionBytes += count;
          }
          this.#remaining -= count;
          offset += count;
          if (!this.#remaining) {
            if (this.#extension) this.#acceptExtension();
            this.#phase = this.#padding ? "padding" : "header";
          }
        } else {
          const count = Math.min(this.#padding, input.length - offset);
          if (input.subarray(offset, offset + count).some((byte) => byte !== 0)) unsafe();
          this.#padding -= count;
          offset += count;
          if (!this.#padding) this.#phase = "header";
        }
      }
    } catch { this.#closed = true; unsafe(); }
  }

  finish() {
    try {
      if (this.#closed) unsafe();
      this.#closed = true;
      if (this.#phase !== "trailer" || this.#headerBytes || this.#streamBytes % BLOCK || this.#pendingKinds.size) unsafe();
      validateInventory(this.#entries, this.#limits.root);
      return { entries: this.#entries, bytes: this.#bytes, members: this.#entries.length, metadataBytes: this.#metadataBytes };
    } catch { this.#closed = true; unsafe(); }
  }
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  return crc >>> 0;
});

function crc32(content) {
  let crc = 0xffffffff;
  for (const byte of content) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}

function zipMode(attributes, platform, name) {
  const unix = attributes >>> 16, kind = unix & 0o170000;
  const directory = name.endsWith("/");
  if (![0, 3].includes(platform) || (platform === 0 && unix) || (attributes & 0xffff & ~0x31)
    || ((attributes & 0x10) && !directory) || ![0, 0o100000, 0o040000].includes(kind)
    || (kind && (kind === 0o040000) !== directory)) unsafe();
  return { type: directory ? "directory" : "file",
    mode: permissions(unix ? unix & 0o7777 : directory ? 0o755 : 0o644) };
}

function zipExtras(data, local) {
  const seen = new Set();
  let offset = 0;
  while (offset < data.length) {
    if (offset + 4 > data.length) unsafe();
    const id = data.readUInt16LE(offset), size = data.readUInt16LE(offset + 2);
    const start = offset + 4, end = start + size;
    if (end > data.length || seen.has(id)) unsafe();
    seen.add(id);
    if (id === 0x5455) {
      if (!size || (data[start] & ~7)) unsafe();
      const flags = data[start];
      const count = local ? (flags & 1) + ((flags >>> 1) & 1) + ((flags >>> 2) & 1) : flags & 1;
      if (size !== 1 + 4 * count) unsafe();
    } else if (id === 0x7875) {
      if (size < 5 || data[start] !== 1) unsafe();
      const uidSize = data[start + 1], gidOffset = start + 2 + uidSize;
      if (uidSize < 1 || uidSize > 8 || gidOffset >= end) unsafe();
      const gidSize = data[gidOffset];
      if (gidSize < 1 || gidSize > 8 || gidOffset + 1 + gidSize !== end) unsafe();
    } else unsafe();
    offset = end;
  }
}

function inspectZip(input, options) {
  const bounds = limits(options, true), data = bytes(input);
  if (data.length < 22 || data.length > bounds.streamLimit || data.length > 2 * 1024 ** 3) unsafe();
  let end = -1;
  for (let offset = data.length - 22; offset >= Math.max(0, data.length - 65557); offset--) {
    if (data.readUInt32LE(offset) === 0x06054b50 && offset + 22 + data.readUInt16LE(offset + 20) === data.length) {
      end = offset;
      break;
    }
  }
  if (end < 0 || data.readUInt16LE(end + 4) || data.readUInt16LE(end + 6)) unsafe();
  const count = data.readUInt16LE(end + 10), centralSize = data.readUInt32LE(end + 12), central = data.readUInt32LE(end + 16);
  if (count === 0xffff || centralSize === 0xffffffff || central === 0xffffffff
    || data.readUInt16LE(end + 8) !== count || count > bounds.maxMembers || central + centralSize !== end) unsafe();
  const entries = [], records = [];
  let cursor = central, total = 0, metadata = data.length - end;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || data.readUInt32LE(cursor) !== 0x02014b50) unsafe();
    const needed = data.readUInt16LE(cursor + 6), flags = data.readUInt16LE(cursor + 8), method = data.readUInt16LE(cursor + 10);
    const crc = data.readUInt32LE(cursor + 16), compressed = data.readUInt32LE(cursor + 20), size = data.readUInt32LE(cursor + 24);
    const nameSize = data.readUInt16LE(cursor + 28), extra = data.readUInt16LE(cursor + 30), comment = data.readUInt16LE(cursor + 32);
    const local = data.readUInt32LE(cursor + 42), recordEnd = cursor + 46 + nameSize + extra + comment;
    if (![10, 20].includes(needed) || (needed === 10 && (method !== 0 || (flags & 8)))
      || ![0, 8].includes(method) || (flags & ~0x080e) || (method === 0 && (flags & 6))
      || !nameSize || recordEnd > end || data.readUInt16LE(cursor + 34)
      || (data.readUInt16LE(cursor + 36) & ~1) || [compressed, size, local].includes(0xffffffff)
      || size > bounds.maxEntryBytes) unsafe();
    const nameBytes = data.subarray(cursor + 46, cursor + 46 + nameSize), name = text(nameBytes);
    const { type, mode } = zipMode(data.readUInt32LE(cursor + 38), data[cursor + 5], name);
    const path = pathName(name, bounds.root, type === "directory");
    if ((type === "directory" && (size || compressed || crc || method)) || (method === 0 && compressed !== size)) unsafe();
    total = add(total, size, bounds.maxBytes);
    metadata = add(metadata, 46 + nameSize + extra + comment + 30 + nameSize + path.length, bounds.maxMetadataBytes);
    zipExtras(data.subarray(cursor + 46 + nameSize, cursor + 46 + nameSize + extra), false);
    if (local + 30 > central || data.readUInt32LE(local) !== 0x04034b50
      || data.readUInt16LE(local + 4) !== needed || data.readUInt16LE(local + 6) !== flags
      || data.readUInt16LE(local + 8) !== method || data.readUInt16LE(local + 26) !== nameSize
      || local + 30 + nameSize > central
      || !data.subarray(local + 30, local + 30 + nameSize).equals(nameBytes)) unsafe();
    const localExtra = data.readUInt16LE(local + 28), extraStart = local + 30 + nameSize;
    const body = extraStart + localExtra, bodyEnd = body + compressed;
    if (bodyEnd > central) unsafe();
    metadata = add(metadata, localExtra, bounds.maxMetadataBytes);
    zipExtras(data.subarray(extraStart, body), true);
    for (const [offset, expected] of [[14, crc], [18, compressed], [22, size]]) {
      const actual = data.readUInt32LE(local + offset);
      if (actual !== expected && (!(flags & 8) || actual !== 0)) unsafe();
    }
    let recordLimit = bodyEnd;
    if (flags & 8) {
      if (recordLimit + 12 > central) unsafe();
      if (data.readUInt32LE(recordLimit) === 0x08074b50) recordLimit += 4;
      if (recordLimit + 12 > central || data.readUInt32LE(recordLimit) !== crc
        || data.readUInt32LE(recordLimit + 4) !== compressed || data.readUInt32LE(recordLimit + 8) !== size) unsafe();
      recordLimit += 12;
      metadata = add(metadata, recordLimit - bodyEnd, bounds.maxMetadataBytes);
    }
    entries.push({ path, type, size, mode, link: null });
    records.push({ local, end: recordLimit, body, bodyEnd, method, crc });
    cursor = recordEnd;
  }
  if (cursor !== end || metadata > bounds.maxMetadataBytes) unsafe();
  let localEnd = 0;
  for (const record of [...records].sort((a, b) => a.local - b.local)) {
    if (record.local !== localEnd || record.end > central) unsafe();
    localEnd = record.end;
  }
  if (localEnd !== central) unsafe();
  validateInventory(entries, bounds.root);
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index], record = records[index];
    if (entry.type === "directory") { entry.content = undefined; continue; }
    const payload = data.subarray(record.body, record.bodyEnd);
    let content;
    if (record.method === 0) content = Buffer.from(payload);
    else {
      const expanded = inflateRawSync(payload, { maxOutputLength: Math.min(bounds.maxEntryBytes, entry.size) + 1, info: true });
      if (!expanded || !Buffer.isBuffer(expanded.buffer) || expanded.engine?.bytesWritten !== payload.length) unsafe();
      content = expanded.buffer;
    }
    if (content.length !== entry.size || crc32(content) !== record.crc) unsafe();
    entry.content = content;
  }
  return { entries, bytes: total, members: entries.length, metadataBytes: metadata };
}

export function inspectZipArchive(input, options) {
  try { return inspectZip(input, options); }
  catch { unsafe(); }
}
