// SPEC: _spec/recovery.md
import { createHash } from "node:crypto";
import { tarPrefix, type TarInventory } from "./cuda-tar";

export const compatibilityFixturePath = "_work/gpu-owner-recovery/fixtures/cuda-bun-compatibility.json";
export const compatibilityFixturePins = Object.freeze({
  tarSha256: "780b54898801bb4eaa7b47da96e5c9fbb67c1a1fa0d5b423fb844659fab7175b",
  xzSha256: "dbe1de8b5a5e967ab6866b9cb1718c4b883f5a19ba05557261d127e802cf05de",
} as const);
export type CompatibilityFixture = {
  version: "chess-coach.cuda-bun-compatibility-fixture.v1";
  tar: { bytes: 1536; sha256: string; base64: string };
  xz: { bytes: 1592; sha256: string; base64: string };
  inventory: TarInventory;
};

const concatenate = (...parts: Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.byteLength; }
  return result;
};
export function compatibilityFixtureCRC32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function littleEndian(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}
function vli(value: number): Uint8Array {
  const bytes: number[] = [];
  do { bytes.push((value & 0x7f) | (value >= 128 ? 0x80 : 0)); value = Math.floor(value / 128); } while (value);
  return new Uint8Array(bytes);
}
function buildTar(): Uint8Array {
  const tar = new Uint8Array(1536), put = (offset: number, value: string) => tar.set(Buffer.from(value, "ascii"), offset);
  put(0, tarPrefix); put(100, "0000755\0");
  for (const offset of [108, 116, 329, 337]) put(offset, "0000000\0");
  for (const offset of [124, 136]) put(offset, "00000000000\0");
  tar.fill(32, 148, 156); put(156, "5"); put(257, "ustar\0" + "00");
  const checksum = tar.subarray(0, 512).reduce((sum, byte) => sum + byte, 0);
  put(148, `${checksum.toString(8).padStart(6, "0")}\0 `);
  return tar;
}
function buildXZ(tar: Uint8Array): Uint8Array {
  const flags = new Uint8Array([0, 1]);
  const header = new Uint8Array([2, 0, 0x21, 1, 0, 0, 0, 0]);
  const payload = concatenate(new Uint8Array([1, 5, 0xff]), tar, new Uint8Array([0]));
  const block = concatenate(header, littleEndian(compatibilityFixtureCRC32(header)), payload,
    littleEndian(compatibilityFixtureCRC32(tar)));
  const indexRecord = concatenate(new Uint8Array([0, 1]), vli(block.byteLength), vli(tar.byteLength));
  const index = concatenate(indexRecord, new Uint8Array((4 - indexRecord.byteLength % 4) % 4));
  const footer = concatenate(littleEndian((index.byteLength + 4) / 4 - 1), flags);
  return concatenate(new Uint8Array([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0]), flags,
    littleEndian(compatibilityFixtureCRC32(flags)), block, index, littleEndian(compatibilityFixtureCRC32(index)),
    littleEndian(compatibilityFixtureCRC32(footer)), footer, new Uint8Array([0x59, 0x5a]));
}
function digest(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
export function buildCompatibilityFixture(): CompatibilityFixture {
  const tar = buildTar(), xz = buildXZ(tar);
  return {
    version: "chess-coach.cuda-bun-compatibility-fixture.v1",
    tar: { bytes: 1536, sha256: digest(tar), base64: Buffer.from(tar).toString("base64") },
    xz: { bytes: 1592, sha256: digest(xz), base64: Buffer.from(xz).toString("base64") },
    inventory: { version: 1, prefix: tarPrefix, entries: [{ path: tarPrefix, type: "directory", mode: 0o755, size: 0 }],
      totals: { decompressedBytes: 1536, headerCount: 3, extensionBytes: 0, fileBytes: 0, count: 1 } },
  };
}
export function validateCompatibilityFixture(bytes: Uint8Array): {
  manifest: CompatibilityFixture; tar: Uint8Array; xz: Uint8Array;
} {
  const manifest = buildCompatibilityFixture();
  const canonical = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== canonical.byteLength || !canonical.equals(bytes)) {
    throw Error("CUDA_BUN_COMPATIBILITY_FIXTURE_CANONICAL");
  }
  if (manifest.tar.sha256 !== compatibilityFixturePins.tarSha256 || manifest.xz.sha256 !== compatibilityFixturePins.xzSha256) {
    throw Error("CUDA_BUN_COMPATIBILITY_FIXTURE_PINS");
  }
  return { manifest, tar: Buffer.from(manifest.tar.base64, "base64"), xz: Buffer.from(manifest.xz.base64, "base64") };
}
