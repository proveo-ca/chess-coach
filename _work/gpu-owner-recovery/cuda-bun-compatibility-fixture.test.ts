// SPEC: _spec/recovery.md
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { buildCompatibilityFixture, compatibilityFixtureCRC32, compatibilityFixturePath, compatibilityFixturePins,
  validateCompatibilityFixture, type CompatibilityFixture } from "./cuda-bun-compatibility-fixture";
import { auditTar, tarPrefix, type TarInventory } from "./cuda-tar";

const encode = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const persisted = readFileSync(new URL("./fixtures/cuda-bun-compatibility.json", import.meta.url));
const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function referenceCRC32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255]!;
  return (crc ^ 0xffffffff) >>> 0;
}
function readVLI(bytes: Uint8Array, start: number): { value: number; end: number } {
  let value = 0, shift = 0, end = start;
  for (;;) {
    const byte = bytes[end++];
    if (byte === undefined || shift > 56) throw Error("TEST_VLI");
    value += (byte & 127) * 2 ** shift;
    if (!(byte & 128)) return { value, end };
    shift += 7;
  }
}

test("pure CRC32 and canonical TAR pass chunked in-memory auditTar qualification", async () => {
  expect(compatibilityFixtureCRC32(Buffer.from("123456789"))).toBe(0xcbf43926);
  expect(compatibilityFixtureCRC32(new Uint8Array())).toBe(0);
  const allBytes = Uint8Array.from({ length: 256 }, (_, index) => index);
  expect(compatibilityFixtureCRC32(allBytes)).toBe(referenceCRC32(allBytes));
  const { manifest, tar } = validateCompatibilityFixture(persisted);
  expect(tar.byteLength).toBe(1536);
  const field = (start: number, length: number, value: string) => {
    expect(Buffer.from(tar.subarray(start, start + length))).toEqual(Buffer.from(value.padEnd(length, "\0"), "ascii"));
  };
  field(0, 100, "tracel-llvm-23.1.0-4"); field(100, 8, "0000755\0");
  for (const start of [108, 116, 329, 337]) field(start, 8, "0000000\0");
  for (const start of [124, 136]) field(start, 12, "00000000000\0");
  field(156, 1, "5"); field(157, 100, ""); field(257, 8, "ustar\0" + "00");
  field(265, 32, ""); field(297, 32, ""); field(345, 167, "");
  let sum = 0;
  for (let index = 0; index < 512; index++) sum += index >= 148 && index < 156 ? 32 : tar[index]!;
  field(148, 8, `${sum.toString(8).padStart(6, "0")}\0 `);
  expect(tar.subarray(512).byteLength).toBe(1024);
  expect(tar.subarray(512).every(byte => byte === 0)).toBe(true);
  const inventory: TarInventory = { version: 1, prefix: tarPrefix,
    entries: [{ path: tarPrefix, type: "directory", mode: 0o755, size: 0 }],
    totals: { decompressedBytes: 1536, headerCount: 3, extensionBytes: 0, fileBytes: 0, count: 1 } };
  expect(manifest.inventory).toEqual(inventory);
  for (const width of [1, 17, 511, 512, 513, 1536]) {
    async function* chunks() {
      yield new Uint8Array();
      for (let offset = 0; offset < tar.byteLength; offset += width) yield tar.subarray(offset, offset + width);
      yield new Uint8Array();
    }
    expect(await auditTar(chunks())).toEqual(inventory);
  }
});

test("pure XZ header, LZMA2, VLI, index and CRC layout; actual XZ decoder NOT RUN", () => {
  const { tar, xz } = validateCompatibilityFixture(persisted);
  const u32 = (offset: number) => new DataView(xz.buffer, xz.byteOffset, xz.byteLength).getUint32(offset, true);
  const bytes = (start: number, end: number) => [...xz.subarray(start, end)];
  expect(xz.byteLength).toBe(1592);
  expect(bytes(0, 6)).toEqual([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0]);
  expect(bytes(6, 8)).toEqual([0, 1]);
  expect(u32(8)).toBe(referenceCRC32(xz.subarray(6, 8)));
  expect(bytes(12, 20)).toEqual([2, 0, 0x21, 1, 0, 0, 0, 0]);
  expect((xz[12]! + 1) * 4).toBe(12);
  expect(u32(20)).toBe(referenceCRC32(xz.subarray(12, 20)));
  expect(bytes(24, 27)).toEqual([1, 5, 0xff]);
  expect(((xz[25]! << 8) | xz[26]!) + 1).toBe(1536);
  expect(xz.subarray(27, 1563)).toEqual(tar);
  expect(xz[1563]).toBe(0);
  expect(xz.subarray(24, 1564).byteLength).toBe(1540);
  expect((12 + 1540) % 4).toBe(0);
  expect(u32(1564)).toBe(referenceCRC32(tar));
  expect(bytes(1568, 1576)).toEqual([0, 1, 0x94, 0x0c, 0x80, 0x0c, 0, 0]);
  const count = readVLI(xz, 1569), block = readVLI(xz, count.end), decompressed = readVLI(xz, block.end);
  expect(count).toEqual({ value: 1, end: 1570 });
  expect(block).toEqual({ value: 1556, end: 1572 });
  expect(block.value).toBe(12 + 1540 + 4);
  expect(decompressed).toEqual({ value: 1536, end: 1574 });
  expect(bytes(decompressed.end, 1576)).toEqual([0, 0]);
  expect(u32(1576)).toBe(referenceCRC32(xz.subarray(1568, 1576)));
  expect(u32(1580)).toBe(referenceCRC32(xz.subarray(1584, 1590)));
  expect(u32(1584)).toBe(2);
  expect((u32(1584) + 1) * 4).toBe(1580 - 1568);
  expect(bytes(1588, 1590)).toEqual(bytes(6, 8));
  expect(bytes(1590, 1592)).toEqual([0x59, 0x5a]);
});

test("exact JSON regeneration rejects all payload-byte, hash, base64, schema and length corruption", () => {
  const manifest = buildCompatibilityFixture();
  expect(compatibilityFixturePath).toBe("_work/gpu-owner-recovery/fixtures/cuda-bun-compatibility.json");
  expect(Object.isFrozen(compatibilityFixturePins)).toBe(true);
  expect(persisted.equals(encode(manifest))).toBe(true);
  expect(JSON.parse(persisted.toString("utf8"))).toEqual(manifest);
  expect(manifest).toEqual(buildCompatibilityFixture());
  const validated = validateCompatibilityFixture(new Uint8Array(persisted));
  expect(validated.manifest).toEqual(manifest);
  expect(manifest.tar.sha256).toBe(compatibilityFixturePins.tarSha256);
  expect(manifest.xz.sha256).toBe(compatibilityFixturePins.xzSha256);
  const reject = (bytes: Uint8Array) => expect(() => validateCompatibilityFixture(bytes)).toThrow("CUDA_BUN_COMPATIBILITY_FIXTURE_CANONICAL");
  const rejectManifest = (mutate: (value: CompatibilityFixture) => void) => {
    const altered = structuredClone(manifest); mutate(altered); reject(encode(altered));
  };
  for (const key of ["tar", "xz"] as const) {
    const original = validated[key];
    expect(original.byteLength).toBe(manifest[key].bytes);
    expect(sha256(original)).toBe(manifest[key].sha256);
    expect(Buffer.from(original).toString("base64")).toBe(manifest[key].base64);
    for (let offset = 0; offset < original.byteLength; offset++) {
      const corrupt = Buffer.from(original); corrupt[offset] = corrupt[offset]! ^ 1;
      rejectManifest(value => { value[key].base64 = corrupt.toString("base64"); value[key].sha256 = sha256(corrupt); });
    }
    for (const size of [0, 1, original.byteLength - 1, original.byteLength + 1]) {
      const resized = Buffer.alloc(size); resized.set(original.subarray(0, size));
      rejectManifest(value => { Object.assign(value[key], { bytes: size, base64: resized.toString("base64"), sha256: sha256(resized) }); });
    }
    for (const sha of ["", "0".repeat(64), manifest[key].sha256.toUpperCase(), `${manifest[key].sha256}0`]) {
      rejectManifest(value => { value[key].sha256 = sha; });
    }
    for (const base64 of ["", "!", `${manifest[key].base64}\n`, ` ${manifest[key].base64}`, manifest[key].base64.replace(/\//g, "_")]) {
      if (base64 !== manifest[key].base64) rejectManifest(value => { value[key].base64 = base64; });
    }
    rejectManifest(value => { Object.assign(value[key], { bytes: String(value[key].bytes) }); });
    rejectManifest(value => { Object.assign(value[key], { unknown: true }); });
    for (const field of ["bytes", "sha256", "base64"]) rejectManifest(value => { Reflect.deleteProperty(value[key], field); });
  }
  const alternate = `${manifest.xz.base64.slice(0, -2)}p=`;
  expect(Buffer.from(alternate, "base64").equals(validated.xz)).toBe(true);
  rejectManifest(value => { value.xz.base64 = alternate; });
  rejectManifest(value => { value.xz.base64 = value.xz.base64.replace(/=+$/, ""); });
  const mutations: ((value: CompatibilityFixture) => void)[] = [
    value => { Object.assign(value, { unknown: true }); },
    value => { Object.assign(value, { version: "other" }); },
    value => { Object.assign(value, { tar: null }); },
    value => { Object.assign(value, { xz: [] }); },
    value => { Object.assign(value, { inventory: {} }); },
    value => { Object.assign(value.inventory, { unknown: true }); },
    value => { value.inventory.version = 2 as 1; },
    value => { Object.assign(value.inventory, { prefix: "other" }); },
    value => { value.inventory.entries = []; },
    value => { value.inventory.entries.push({ ...value.inventory.entries[0]! }); },
    value => { Object.assign(value.inventory.entries[0]!, { unknown: true }); },
    value => { Object.assign(value.inventory.entries[0]!, { mode: 0o500 }); },
    value => { Object.assign(value.inventory.entries[0]!, { size: 1 }); },
    value => { Object.assign(value.inventory.entries[0]!, { path: `${tarPrefix}/` }); },
    value => { Object.assign(value.inventory.entries[0]!, { type: "file" }); },
    value => { Object.assign(value.inventory.totals, { unknown: true }); },
  ];
  for (const mutate of mutations) rejectManifest(mutate);
  for (const field of ["version", "tar", "xz", "inventory"]) rejectManifest(value => { Reflect.deleteProperty(value, field); });
  for (const field of ["version", "prefix", "entries", "totals"]) rejectManifest(value => { Reflect.deleteProperty(value.inventory, field); });
  for (const field of ["path", "type", "mode", "size"]) rejectManifest(value => { Reflect.deleteProperty(value.inventory.entries[0]!, field); });
  for (const field of Object.keys(manifest.inventory.totals)) {
    rejectManifest(value => { Object.assign(value.inventory.totals, { [field]: -1 }); });
    rejectManifest(value => { Reflect.deleteProperty(value.inventory.totals, field); });
  }
  const text = persisted.toString("utf8");
  for (const alternateJSON of [JSON.stringify(manifest), ` ${text}`, `${text}\n`, `\ufeff${text}`,
    text.replace("{", `{\n  "version": "${manifest.version}",`),
    text.replace('"version"', '"\\u0076ersion"'),
    JSON.stringify({ inventory: manifest.inventory, xz: manifest.xz, tar: manifest.tar, version: manifest.version }, null, 2) + "\n",
    `${text}{}`, "null", "[]", "{}", '"fixture"', "1", "{", ""]) reject(Buffer.from(alternateJSON));
  for (const length of [0, 1, 100, persisted.byteLength - 1]) reject(persisted.subarray(0, length));
  const invalidUTF8 = Buffer.from(persisted); invalidUTF8[0] = 255; reject(invalidUTF8);
  for (const invalid of [null, {}, "fixture", new ArrayBuffer(0), new Uint16Array(0)]) reject(invalid as Uint8Array);
  validated.tar.fill(0); validated.xz.fill(0); validated.manifest.inventory.entries.length = 0;
  expect(buildCompatibilityFixture()).toEqual(manifest);
  expect(validateCompatibilityFixture(persisted).manifest).toEqual(manifest);
});
