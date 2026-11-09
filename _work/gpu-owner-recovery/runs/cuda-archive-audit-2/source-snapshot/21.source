// SPEC: _spec/recovery.md

import { afterEach, expect, test } from "bun:test";
import { inspectElf, type ElfMetadata } from "./cuda-elf";

const BASE = 0x400000n;
const INTERP = 0x200;
const DYNAMIC = 0x400;
const STRINGS = 0x11000;
const LIMIT64 = (1n << 64n) - 1n;
type Entry = [bigint, bigint];
type Fixture = { bytes: Uint8Array; entries: Entry[]; indices: bigint[] };
const data = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const ph = (index: number) => 64 + index * 56;
const readViolations: string[] = [];
afterEach(() => { expect(readViolations.splice(0)).toEqual([]); });

function segment(bytes: Uint8Array, index: number, type: number, offset: bigint,
  address: bigint, fileSize: bigint, memorySize = fileSize): void {
  const v = data(bytes), at = ph(index);
  v.setUint32(at, type, true);
  v.setBigUint64(at + 8, offset, true);
  v.setBigUint64(at + 16, address, true);
  v.setBigUint64(at + 32, fileSize, true);
  v.setBigUint64(at + 40, memorySize, true);
}

function dynamic(f: Fixture, entries: Entry[]): void {
  f.entries = entries;
  f.bytes.fill(0, DYNAMIC, STRINGS);
  const v = data(f.bytes);
  entries.forEach(([tag, value], index) => {
    v.setBigInt64(DYNAMIC + index * 16, tag, true);
    v.setBigUint64(DYNAMIC + index * 16 + 8, value, true);
  });
  segment(f.bytes, 2, 2, BigInt(DYNAMIC), BASE + BigInt(DYNAMIC), BigInt(entries.length * 16));
}

function fixture(options: { names?: string[]; soname?: string | null; interpreter?: string } = {}): Fixture {
  const bytes = new Uint8Array(STRINGS + 8192), v = data(bytes);
  bytes.set([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1]);
  v.setUint16(16, 3, true); v.setUint16(18, 62, true); v.setUint32(20, 1, true);
  v.setBigUint64(32, 64n, true); v.setUint16(52, 64, true);
  v.setUint16(54, 56, true); v.setUint16(56, 3, true);
  segment(bytes, 0, 1, 0n, BASE, BigInt(bytes.length));
  v.setBigUint64(ph(0) + 48, 4096n, true);
  const interpreter = new TextEncoder().encode(`${options.interpreter ?? "/lib64/ld-linux-x86-64.so.2"}\0`);
  bytes.set(interpreter, INTERP);
  segment(bytes, 1, 3, BigInt(INTERP), BASE + BigInt(INTERP), BigInt(interpreter.length));
  const names = options.names ?? ["libc.so.6", "liblzma.so.5"];
  const soname = options.soname === undefined ? "sample.so" : options.soname;
  const indices: bigint[] = [], entries: Entry[] = [];
  let offset = 1;
  for (const name of [...names, ...(soname === null ? [] : [soname])]) {
    indices.push(BigInt(offset));
    const encoded = new TextEncoder().encode(`${name}\0`);
    bytes.set(encoded, STRINGS + offset); offset += encoded.length;
  }
  names.forEach((_, index) => entries.push([1n, indices[index]!]));
  if (soname !== null) entries.push([14n, indices[names.length]!]);
  entries.push([5n, BASE + BigInt(STRINGS)], [10n, BigInt(offset)], [0n, 0n]);
  const f = { bytes, entries, indices };
  dynamic(f, entries);
  return f;
}

function tag(f: Fixture, wanted: bigint, value: bigint): void {
  dynamic(f, f.entries.map(([entry, old]) => [entry, entry === wanted ? value : old]));
}

async function inspect(bytes: Uint8Array, size = BigInt(bytes.length), short = false): Promise<ElfMetadata> {
  const requests: [bigint, number][] = [];
  try {
    return await inspectElf(async (offset, length) => {
      requests.push([offset, length]);
      if (typeof offset !== "bigint" || offset < 0n || !Number.isSafeInteger(length) || length <= 0
        || offset + BigInt(length) > size || offset > BigInt(Number.MAX_SAFE_INTEGER)) {
        readViolations.push("Out-of-bounds callback");
        throw new Error("Out-of-bounds callback");
      }
      const start = Number(offset);
      return bytes.slice(start, start + length - (short ? 1 : 0));
    }, size);
  } finally {
    if (requests.reduce((sum, [, length]) => sum + length, 0) > 32 * 1024 * 1024) {
      readViolations.push("Read budget exceeded");
    }
  }
}

test("returns dynamic metadata only", async () => {
  expect(await inspect(fixture().bytes)).toEqual({
    interpreter: "/lib64/ld-linux-x86-64.so.2", needed: ["libc.so.6", "liblzma.so.5"],
    soname: "sample.so",
  });
});

test("accepts static executable without interpreter or needed names", async () => {
  const f = fixture(), v = data(f.bytes);
  v.setUint16(16, 2, true); v.setUint16(56, 1, true);
  expect(await inspect(f.bytes)).toEqual({ interpreter: null, needed: [], soname: null });
});

test("accepts empty dynamic metadata and standard non-path tags", async () => {
  const f = fixture();
  dynamic(f, [[4n, 0n], [7n, 0n], [30n, 0n], [0x6ffffef5n, 0n], [0x6ffffffbn, 0n], [36n, 0n], [0n, 0n]]);
  expect((await inspect(f.bytes)).needed).toEqual([]);
});

test("accepts dynamic dependencies without an interpreter", async () => {
  const f = fixture(); data(f.bytes).setUint32(ph(1), 0, true);
  const metadata = await inspect(f.bytes);
  expect(metadata.interpreter).toBeNull();
  expect(metadata.needed).toEqual(["libc.so.6", "liblzma.so.5"]);
});

test("rejects page-rounded LOAD overlap with different backing bytes outside declared overlap", async () => {
  const f = fixture(); data(f.bytes).setUint16(56, 4, true);
  segment(f.bytes, 0, 1, 0n, BASE, BigInt(STRINGS + 64));
  segment(f.bytes, 3, 1, BigInt(STRINGS + 4096 + 128), BASE + BigInt(STRINGS + 128), 64n);
  await expect(inspect(f.bytes)).rejects.toThrow("ambiguous load mapping");
});

test("accepts adjacent LOAD mappings separated at the exact page boundary", async () => {
  const f = fixture(); data(f.bytes).setUint16(56, 4, true);
  segment(f.bytes, 0, 1, 0n, BASE, BigInt(STRINGS));
  segment(f.bytes, 3, 1, BigInt(STRINGS), BASE + BigInt(STRINGS), BigInt(f.bytes.length - STRINGS));
  expect((await inspect(f.bytes)).needed).toEqual(["libc.so.6", "liblzma.so.5"]);
});

test("accepts exactly 256 bounded program headers and the fixed file-size boundary", async () => {
  const f = fixture(); f.bytes.fill(0, ph(1), ph(256));
  data(f.bytes).setUint16(56, 256, true);
  expect((await inspect(f.bytes, 512n * 1024n * 1024n)).needed).toEqual([]);
});

test.each([
  ["magic", 0, 0, 1], ["class", 4, 1, 1], ["endian", 5, 2, 1], ["ident version", 6, 0, 1],
  ["version", 20, 0, 4], ["machine", 18, 183, 2], ["type", 16, 1, 2],
  ["ehsize", 52, 63, 2], ["phentsize", 54, 55, 2], ["zero phnum", 56, 0, 2],
  ["phnum cap", 56, 257, 2], ["extended phnum", 56, 65535, 2],
] as const)("rejects header %s", async (_, at, value, width) => {
  const f = fixture(), v = data(f.bytes);
  if (width === 1) v.setUint8(at, value);
  else if (width === 2) v.setUint16(at, value, true);
  else v.setUint32(at, value, true);
  await expect(inspect(f.bytes)).rejects.toThrow();
});

test.each([-1n, 0n, 63n, 512n * 1024n * 1024n + 1n, LIMIT64])("rejects file size %s before reads", async (size) => {
  let called = false;
  await expect(inspectElf(async () => { called = true; return new Uint8Array(); }, size)).rejects.toThrow();
  expect(called).toBe(false);
});

test("rejects truncated header, program table, and short callback buffers", async () => {
  await expect(inspect(new Uint8Array(63))).rejects.toThrow();
  await expect(inspect(fixture().bytes.slice(0, 100))).rejects.toThrow();
  await expect(inspect(fixture().bytes, undefined, true)).rejects.toThrow("short read");
});

test.each([0n, 63n, 1n << 53n, LIMIT64])("bounds program header offset %s", async (offset) => {
  const f = fixture(); data(f.bytes).setBigUint64(32, offset, true);
  await expect(inspect(f.bytes)).rejects.toThrow();
});

test.each([
  [8, LIMIT64], [8, 1n << 53n], [32, LIMIT64], [16, LIMIT64], [40, LIMIT64], [40, 1n], [48, 3n], [48, 1n << 23n],
] as const)("checks load field %s = %s", async (field, value) => {
  const f = fixture(); data(f.bytes).setBigUint64(ph(0) + field, value, true);
  await expect(inspect(f.bytes)).rejects.toThrow();
});

test.each(["ld.so", "/", "//lib/ld.so", "/lib//ld.so", "/lib/./ld.so", "/lib/../ld.so", "/lib/ld.so/", "/lib/ld\n.so", "/lib/ld.so\n", "/lib/ld\\so", "/lib/ldé.so"])("rejects interpreter %j", async (interpreter) => {
  await expect(inspect(fixture({ interpreter }).bytes)).rejects.toThrow();
});

test("rejects interpreter size, embedded NUL, invalid UTF-8, and absent terminator", async () => {
  for (const length of [0n, 1n, 4097n]) {
    const f = fixture(), v = data(f.bytes);
    v.setBigUint64(ph(1) + 32, length, true); v.setBigUint64(ph(1) + 40, length, true);
    await expect(inspect(f.bytes)).rejects.toThrow();
  }
  for (const byte of [0, 0xff]) {
    const f = fixture(); f.bytes[INTERP + 2] = byte;
    await expect(inspect(f.bytes)).rejects.toThrow();
  }
  const f = fixture(), length = Number(data(f.bytes).getBigUint64(ph(1) + 32, true));
  f.bytes[INTERP + length - 1] = 65;
  await expect(inspect(f.bytes)).rejects.toThrow();
});

test("rejects repeated interpreter and dynamic segments", async () => {
  for (const index of [1, 2]) {
    const f = fixture(); data(f.bytes).setUint16(56, 4, true);
    f.bytes.copyWithin(ph(3), ph(index), ph(index) + 56);
    await expect(inspect(f.bytes)).rejects.toThrow();
  }
});

test.each(["", ".", "..", "../lib.so", "/lib.so", "dir/lib.so", "lib\n.so", "lib.so\n", "lib.so\r", "lib.so\u2028", "lib\u007f.so", "libé.so", "lib\\so", "lib so"])("rejects needed and SONAME %j", async (name) => {
  await expect(inspect(fixture({ names: [name] }).bytes)).rejects.toThrow();
  await expect(inspect(fixture({ soname: name }).bytes)).rejects.toThrow();
});

test("rejects invalid UTF-8, duplicates, and excess names", async () => {
  const f = fixture(); f.bytes[STRINGS + 1] = 0xff;
  await expect(inspect(f.bytes)).rejects.toThrow();
  await expect(inspect(fixture({ names: ["libc.so.6", "libc.so.6"] }).bytes)).rejects.toThrow("duplicate DT_NEEDED");
  const names = Array.from({ length: 64 }, (_, index) => `lib${index}.so`);
  expect((await inspect(fixture({ names, soname: null }).bytes)).needed).toHaveLength(64);
  await expect(inspect(fixture({ names }).bytes)).rejects.toThrow("name count");
  await expect(inspect(fixture({ names: [...names, "extra.so"], soname: null }).bytes)).rejects.toThrow("name count");
});

test.each([5n, 10n])("rejects missing or duplicate string metadata tag %s", async (wanted) => {
  const f = fixture(); dynamic(f, f.entries.filter(([entry]) => entry !== wanted));
  await expect(inspect(f.bytes)).rejects.toThrow();
  const g = fixture(); dynamic(g, [[wanted, 1n], ...g.entries]);
  await expect(inspect(g.bytes)).rejects.toThrow();
});

test("rejects duplicate SONAME and SONAME-first name cap", async () => {
  const f = fixture(); dynamic(f, [[14n, f.indices[2]!], ...f.entries]);
  await expect(inspect(f.bytes)).rejects.toThrow();
  const g = fixture({ names: Array.from({ length: 64 }, (_, i) => `lib${i}.so`) });
  dynamic(g, [...g.entries.filter(([t]) => t === 14n), ...g.entries.filter(([t]) => t !== 14n)]);
  await expect(inspect(g.bytes)).rejects.toThrow("name count");
});

test.each([0n, 16n * 1024n * 1024n + 1n, LIMIT64])("rejects string table size %s", async (size) => {
  const f = fixture(); tag(f, 10n, size);
  await expect(inspect(f.bytes)).rejects.toThrow();
});

test("maps the entire string table including its fixed-cap boundary", async () => {
  const f = fixture(); tag(f, 10n, 16n * 1024n * 1024n);
  const bytes = new Uint8Array(STRINGS + 16 * 1024 * 1024); bytes.set(f.bytes);
  segment(bytes, 0, 1, 0n, BASE, BigInt(bytes.length));
  expect((await inspect(bytes)).needed).toEqual(["libc.so.6", "liblzma.so.5"]);
  data(bytes).setBigUint64(ph(0) + 32, BigInt(bytes.length - 1), true);
  await expect(inspect(bytes)).rejects.toThrow("non-file-backed");
});

test.each([0n, BASE - 1n, LIMIT64, 1n << 53n])("rejects string table address %s", async (address) => {
  const f = fixture(); tag(f, 5n, address);
  await expect(inspect(f.bytes)).rejects.toThrow();
});

test("rejects strtab in BSS, partial file backing, and ambiguous partial mappings", async () => {
  for (const end of [STRINGS, STRINGS + 2]) {
    const f = fixture(); data(f.bytes).setBigUint64(ph(0) + 32, BigInt(end), true);
    await expect(inspect(f.bytes)).rejects.toThrow("non-file-backed");
  }
  for (const [delta, fileSize] of [[0, 1n], [2, 1n], [2, 0n]] as const) {
    const f = fixture(); data(f.bytes).setUint16(56, 4, true);
    segment(f.bytes, 3, 1, BigInt(STRINGS + delta), BASE + BigInt(STRINGS + delta), fileSize, 1n);
    await expect(inspect(f.bytes)).rejects.toThrow("ambiguous");
  }
  const f = fixture(); data(f.bytes).setUint32(ph(0), 0, true);
  await expect(inspect(f.bytes)).rejects.toThrow("missing load");
});

test("rejects dynamic mapping mismatch and BSS", async () => {
  const f = fixture(); data(f.bytes).setBigUint64(ph(2) + 16, BASE + BigInt(DYNAMIC + 16), true);
  await expect(inspect(f.bytes)).rejects.toThrow("mapping mismatch");
  const g = fixture(); data(g.bytes).setBigUint64(ph(0) + 32, BigInt(DYNAMIC), true);
  await expect(inspect(g.bytes)).rejects.toThrow("non-file-backed");
});

test.each([0n, 15n, 4097n * 16n])("rejects dynamic size %s", async (size) => {
  const f = fixture(), v = data(f.bytes);
  v.setBigUint64(ph(2) + 32, size, true); v.setBigUint64(ph(2) + 40, size, true);
  await expect(inspect(f.bytes)).rejects.toThrow();
});

test("requires DT_NULL within at most 4096 entries", async () => {
  const f = fixture(); dynamic(f, f.entries.filter(([entry]) => entry !== 0n));
  await expect(inspect(f.bytes)).rejects.toThrow("unterminated dynamic");
  const g = fixture(); dynamic(g, [...Array.from({ length: 4095 }, (): Entry => [21n, 0n]), [0n, 0n]]);
  expect((await inspect(g.bytes)).needed).toEqual([]);
  dynamic(g, Array.from({ length: 4096 }, (): Entry => [21n, 0n]));
  await expect(inspect(g.bytes)).rejects.toThrow("unterminated dynamic");
});

test.each([15n, 29n, 0x6ffffefan, 0x6ffffefbn, 0x6ffffefcn, 0x7ffffffdn, 0x7fffffffn])("rejects loader directive %s", async (directive) => {
  const f = fixture(); dynamic(f, [[directive, 1n], ...f.entries]);
  await expect(inspect(f.bytes)).rejects.toThrow("loader directive");
});

test.each([-1n, 31n, 0x7ffffffen])("rejects unsupported dynamic tag %s", async (unknown) => {
  const f = fixture(); dynamic(f, [[unknown, 1n], ...f.entries]);
  await expect(inspect(f.bytes)).rejects.toThrow("unsupported dynamic tag");
});

test("bounds string indices and terminators to DT_STRSZ", async () => {
  for (const index of [1000n, LIMIT64]) {
    const f = fixture(); tag(f, 1n, index);
    await expect(inspect(f.bytes)).rejects.toThrow("string index");
  }
  const f = fixture({ names: ["lib.so"], soname: null }); tag(f, 10n, 7n);
  await expect(inspect(f.bytes)).rejects.toThrow("unterminated");
});

test("caps individual strings at 4096 encoded bytes including NUL", async () => {
  expect((await inspect(fixture({ names: ["a".repeat(4095)], soname: null }).bytes)).needed[0]).toHaveLength(4095);
  await expect(inspect(fixture({ names: ["a".repeat(4096)], soname: null }).bytes)).rejects.toThrow("oversized string");
});
