// SPEC: _spec/recovery.md

export type BoundedReadAt = (offset: bigint, length: number) => Promise<Uint8Array>;

export type ElfMetadata = {
  interpreter: string | null;
  needed: string[];
  soname: string | null;
};

const MAX_FILE = 512n * 1024n * 1024n;
const MAX_READ = 32 * 1024 * 1024;
const MAX_STRTAB = 16n * 1024n * 1024n;
const MAX_STRING = 4096;
const MAX_NAMES = 64;
const U64_MAX = (1n << 64n) - 1n;
const PAGE_BYTES = 4096n;
const DENIED_TAGS = new Set([
  15n, 29n, 0x6ffffefan, 0x6ffffefbn, 0x6ffffefcn, 0x7ffffffdn, 0x7fffffffn,
]);
const IGNORED_TAGS = new Set([
  2n, 3n, 4n, 6n, 7n, 8n, 9n, 11n, 12n, 13n, 16n, 17n, 18n, 19n,
  20n, 21n, 22n, 23n, 24n, 25n, 26n, 27n, 28n, 30n, 32n, 33n, 34n,
  35n, 36n, 37n, 0x6ffffdf5n, 0x6ffffdf6n, 0x6ffffdf7n, 0x6ffffdf8n,
  0x6ffffdf9n, 0x6ffffdfan, 0x6ffffdfbn, 0x6ffffdfcn, 0x6ffffdfdn,
  0x6ffffdfen, 0x6ffffdffn, 0x6ffffef5n, 0x6ffffef6n, 0x6ffffef7n,
  0x6ffffef8n, 0x6ffffef9n, 0x6ffffefdn, 0x6ffffefen, 0x6ffffeffn,
  0x6ffffff0n, 0x6ffffff9n, 0x6ffffffan, 0x6ffffffbn, 0x6ffffffcn,
  0x6ffffffdn, 0x6ffffffen, 0x6fffffffn, 0x70000000n, 0x70000001n,
  0x70000003n,
]);

type Segment = {
  type: number;
  offset: bigint;
  address: bigint;
  fileSize: bigint;
  memorySize: bigint;
};

function requireElf(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid ELF: ${message}`);
}

function add64(a: bigint, b: bigint): bigint {
  requireElf(a >= 0n && b >= 0n && a <= U64_MAX && b <= U64_MAX - a, "u64 overflow");
  return a + b;
}

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
}

function isBasename(name: string): boolean {
  return name.length > 0 && !/[^A-Za-z0-9_.+-]/.test(name) && name !== "." && name !== "..";
}

function basename(name: string): string {
  requireElf(isBasename(name), "library basename");
  return name;
}

export async function inspectElf(read: BoundedReadAt, size: bigint): Promise<ElfMetadata> {
  requireElf(typeof size === "bigint" && size >= 64n && size <= MAX_FILE, "file size");
  let totalRead = 0;
  async function bounded(offset: bigint, length: number): Promise<Uint8Array> {
    requireElf(Number.isSafeInteger(length) && length > 0, "read length");
    requireElf(add64(offset, BigInt(length)) <= size, "read bounds");
    requireElf(length <= MAX_READ - totalRead, "read budget");
    totalRead += length;
    const bytes = await read(offset, length);
    requireElf(bytes instanceof Uint8Array && bytes.byteLength === length, "short read");
    return bytes;
  }
  function fileRange(offset: bigint, length: bigint): void {
    requireElf(add64(offset, length) <= size, "segment file range");
  }

  const header = view(await bounded(0n, 64));
  requireElf(header.getUint32(0, false) === 0x7f454c46, "magic");
  requireElf(header.getUint8(4) === 2 && header.getUint8(5) === 1, "class or endianness");
  requireElf(header.getUint8(6) === 1 && header.getUint32(20, true) === 1, "version");
  const elfType = header.getUint16(16, true);
  requireElf(elfType === 2 || elfType === 3, "type");
  requireElf(header.getUint16(18, true) === 62, "architecture");
  requireElf(header.getUint16(52, true) === 64, "header size");
  requireElf(header.getUint16(54, true) === 56, "program header size");
  const count = header.getUint16(56, true);
  requireElf(count > 0 && count <= 256, "program header count");
  const phOffset = header.getBigUint64(32, true);
  requireElf(phOffset >= 64n, "program header offset");
  const program = view(await bounded(phOffset, count * 56));
  const segments: Segment[] = [];
  for (let i = 0; i < count; i++) {
    const at = i * 56;
    const segment: Segment = {
      type: program.getUint32(at, true),
      offset: program.getBigUint64(at + 8, true),
      address: program.getBigUint64(at + 16, true),
      fileSize: program.getBigUint64(at + 32, true),
      memorySize: program.getBigUint64(at + 40, true),
    };
    fileRange(segment.offset, segment.fileSize);
    add64(segment.address, segment.fileSize);
    add64(segment.address, segment.memorySize);
    if ([1, 2, 3, 6].includes(segment.type)) {
      requireElf(segment.memorySize >= segment.fileSize, "segment memory size");
    }
    if (segment.type === 1) {
      const alignment = program.getBigUint64(at + 48, true);
      requireElf(alignment === 0n || (alignment & (alignment - 1n)) === 0n, "load alignment");
      requireElf(alignment <= 1n || segment.address % alignment === segment.offset % alignment, "load congruence");
    }
    segments.push(segment);
  }

  const loads = segments.filter((segment) => segment.type === 1);
  requireElf(loads.length > 0, "missing load segment");
  function mapRange(address: bigint, length: bigint): bigint {
    requireElf(length > 0n, "empty mapped range");
    const end = add64(address, length);
    const matches = loads.filter((segment) => {
      if (segment.memorySize === 0n) return false;
      const pageStart = segment.address / PAGE_BYTES * PAGE_BYTES;
      const memoryEnd = add64(segment.address, segment.memorySize);
      const pageEnd = memoryEnd % PAGE_BYTES === 0n ? memoryEnd : add64(memoryEnd, PAGE_BYTES - memoryEnd % PAGE_BYTES);
      return pageStart < end && pageEnd > address;
    });
    requireElf(matches.length === 1, "missing or ambiguous load mapping");
    const segment = matches[0]!;
    requireElf(address >= segment.address && end <= add64(segment.address, segment.fileSize), "non-file-backed mapping");
    const offset = add64(segment.offset, address - segment.address);
    fileRange(offset, length);
    return offset;
  }

  const result: ElfMetadata = { interpreter: null, needed: [], soname: null };
  const interpreters = segments.filter((segment) => segment.type === 3);
  requireElf(interpreters.length <= 1, "multiple interpreters");
  if (interpreters.length) {
    const interpreter = interpreters[0]!;
    requireElf(interpreter.fileSize > 1n && interpreter.fileSize <= BigInt(MAX_STRING), "interpreter size");
    const bytes = await bounded(interpreter.offset, Number(interpreter.fileSize));
    requireElf(bytes[bytes.length - 1] === 0 && bytes.indexOf(0) === bytes.length - 1, "interpreter terminator");
    const path = decode(bytes.subarray(0, -1));
    requireElf(path.startsWith("/") && path.length > 1
      && path.slice(1).split("/").every(isBasename), "canonical absolute interpreter");
    result.interpreter = path;
  }

  const dynamics = segments.filter((segment) => segment.type === 2);
  requireElf(dynamics.length <= 1, "multiple dynamic segments");
  if (!dynamics.length) return result;
  const dynamic = dynamics[0]!;
  requireElf(dynamic.fileSize > 0n && dynamic.fileSize % 16n === 0n
    && dynamic.fileSize / 16n <= 4096n, "dynamic size");
  requireElf(mapRange(dynamic.address, dynamic.fileSize) === dynamic.offset, "dynamic mapping mismatch");
  const entries = view(await bounded(dynamic.offset, Number(dynamic.fileSize)));
  let strtab: bigint | undefined;
  let strsz: bigint | undefined;
  let soname: bigint | undefined;
  const needed: bigint[] = [];
  let terminated = false;
  for (let at = 0; at < entries.byteLength; at += 16) {
    const tag = entries.getBigInt64(at, true);
    const value = entries.getBigUint64(at + 8, true);
    if (tag === 0n) { terminated = true; break; }
    requireElf(!DENIED_TAGS.has(tag), "loader directive");
    if (tag === 1n) {
      requireElf(needed.length + (soname === undefined ? 0 : 1) < MAX_NAMES, "name count");
      needed.push(value);
    } else if (tag === 5n) {
      requireElf(strtab === undefined, "duplicate DT_STRTAB");
      strtab = value;
    } else if (tag === 10n) {
      requireElf(strsz === undefined, "duplicate DT_STRSZ");
      strsz = value;
    } else if (tag === 14n) {
      requireElf(soname === undefined && needed.length < MAX_NAMES, "duplicate SONAME or name count");
      soname = value;
    } else {
      requireElf(IGNORED_TAGS.has(tag), "unsupported dynamic tag");
    }
  }
  requireElf(terminated, "unterminated dynamic array");
  if (strtab === undefined && strsz === undefined && needed.length === 0 && soname === undefined) return result;
  requireElf(strtab !== undefined && strsz !== undefined, "missing string table metadata");
  requireElf(strsz > 0n && strsz <= MAX_STRTAB, "string table size");
  const stringOffset = mapRange(strtab, strsz);
  async function nameAt(index: bigint): Promise<string> {
    requireElf(index < strsz!, "string index");
    const remaining = strsz! - index;
    const length = Number(remaining < BigInt(MAX_STRING) ? remaining : BigInt(MAX_STRING));
    const bytes = await bounded(add64(stringOffset, index), length);
    const end = bytes.indexOf(0);
    requireElf(end >= 0, "unterminated or oversized string");
    return basename(decode(bytes.subarray(0, end)));
  }
  for (const index of needed) {
    const name = await nameAt(index);
    requireElf(!result.needed.includes(name), "duplicate DT_NEEDED");
    result.needed.push(name);
  }
  if (soname !== undefined) result.soname = await nameAt(soname);
  return result;
}
