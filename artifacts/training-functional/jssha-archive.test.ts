// SPEC: _spec/runtime-protocol.puml
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { inspectVerifiedArchive } from "./jssha-archive.ts";
import { JSSHA, verifyJsshaExport } from "./reference-retry.ts";
import { inspectVerifiedArchive as oldInspect } from "../../_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source2/capture.ts";

const MIB = 1048576, utf8 = new TextDecoder("utf-8", { fatal: true });
const hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
interface Entry { name: string; data?: Buffer; type?: string; prefix?: string; size?: number }
function checksum(h: Buffer): void { h.fill(32, 148, 156); h.write(h.reduce((a, b) => a + b, 0).toString(8).padStart(6, "0") + "\0 ", 148, 8, "ascii"); }
function header(entry: Entry): Buffer {
  const data = entry.data ?? Buffer.alloc(0), h = Buffer.alloc(512);
  h.write(entry.name, 0, 100, "utf8");
  for (const [start, length, n] of [[100, 8, 0o644], [108, 8, 0], [116, 8, 0], [124, 12, entry.size ?? data.length], [136, 12, 0]] as const) h.write(n.toString(8).padStart(length - 1, "0") + "\0", start, length, "ascii");
  h[156] = (entry.type ?? "0").charCodeAt(0); h.write("ustar\0" + "00", 257, 8, "binary"); if (entry.prefix) h.write(entry.prefix, 345, 155);
  checksum(h); return h;
}
function tar(entries: Entry[] = required()): Buffer { return Buffer.concat([...entries.flatMap(e => { const data = e.data ?? Buffer.alloc(0); return [header(e), data, Buffer.alloc((512 - data.length % 512) % 512)]; }), Buffer.alloc(1024)]); }
function required(): Entry[] { return JSSHA.requiredMembers.map((m, i) => ({ name: m.member, data: i === 0 ? Buffer.from(JSON.stringify({ name: JSSHA.name, version: JSSHA.version })) : Buffer.from("synthetic unexecuted source\n") })); }
function bound(bytes: Buffer) { return { ...JSSHA, integrity: "sha512-" + createHash("sha512").update(bytes).digest("base64") }; }
function inspectBoth(data: Buffer, spec = JSSHA) { const bytes = gzipSync(data), pinned = { ...spec, integrity: bound(bytes).integrity }, result = inspectVerifiedArchive(bytes, pinned); expect(result).toEqual(oldInspect(bytes, pinned)); return result; }
function rejectsBoth(data: Buffer, code: string) { const bytes = gzipSync(data), spec = bound(bytes); expect(() => inspectVerifiedArchive(bytes, spec)).toThrow(code); expect(() => oldInspect(bytes, spec)).toThrow(code); }
function paxRecord(key: string, value: string): Buffer { const content = ` ${key}=${value}\n`; let n = Buffer.byteLength(content) + 1; while (String(n).length + Buffer.byteLength(content) !== n) n = String(n).length + Buffer.byteLength(content); return Buffer.from(`${n}${content}`); }
function modify(start: number, value: Buffer): Buffer { const data = tar(); value.copy(data, start); if (start !== 148) checksum(data.subarray(0, 512)); return data; }

test("copies the frozen pure inspector body with only the exact NUL ownership delta", () => {
  const original = fs.readFileSync(resolve(import.meta.dir, "../../_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source2/capture.ts"), "utf8"), current = fs.readFileSync(resolve(import.meta.dir, "jssha-archive.ts"), "utf8");
  const expected = original.slice(original.indexOf("function field("), original.indexOf("\n\nexport interface HttpResponse"));
  const actual = current.slice(current.indexOf("function field(")).replace("  if ((start === 108 || start === 116) && length === 8 && bytes.length === 8 && bytes.every(b => b === 0)) return 0;\n", "").trimEnd();
  expect(actual).toBe(expected);
});

describe("fixed PREP1 archive read-only regression", () => {
  test("preserves original bytes, selects exact members, and checks the original sha256 export", () => {
    const path = resolve(import.meta.dir, "scratch/reference-prep-1/raw/jssha-3.3.2.tgz"), before = fs.statSync(path, { bigint: true }), bytes = fs.readFileSync(path);
    expect(bytes.length).toBe(135944); expect(hash(bytes)).toBe("c372d61fc6843661abbdb868e9d28e8d3c7ce1c19fd7ce559d77fca90d02bd08");
    expect(() => oldInspect(bytes, JSSHA)).toThrow("tar-octal");
    const selected = inspectVerifiedArchive(bytes, JSSHA), pkg = JSON.parse(utf8.decode(selected.files[0]!.data)) as { name: string; version: string; exports: Record<string, { import?: unknown }> };
    expect(pkg.name).toBe("jssha"); expect(pkg.version).toBe("3.3.2");
    expect(pkg.exports["./sha256"]?.import).toEqual({ types: "./dist/sha256.d.mts", default: "./dist/sha256.mjs" }); expect(verifyJsshaExport(pkg.exports)).toBe("./dist/sha256.mjs");
    expect(selected.files.map(f => ({ member: f.member, retainedFile: f.retainedFile, bytes: f.data.length, sha256: hash(f.data), license: f.license }))).toEqual([
      { member: "package/package.json", retainedFile: "jssha-3.3.2-package.json", bytes: 5351, sha256: "a4813aab26cb4626fe638a9c8557c3601f3a59d4b67749b73f52c7b9f41a7951", license: false },
      { member: "package/dist/sha256.mjs", retainedFile: "jssha-3.3.2-dist-sha256.mjs", bytes: 10033, sha256: "4911466b7ab8e64e1030977aa3b07050d964d957d9e3abfa6a32d9097bde2e50", license: false },
      { member: "package/LICENSE", retainedFile: "jssha-3.3.2-LICENSE", bytes: 1539, sha256: "9a5fa7f7df7e9fac895f3a5d553e6a68d32e27cd7ac4d62c50588ab68dc619ab", license: true },
    ]);
    expect(selected.expandedBytesIncludingSkippedContent).toBe(730112); expect(selected.physicalTarHeaders).toBe(45); expect(selected.licenseMember).toBe("package/LICENSE"); expect(selected.legalClearance).toBe(false);
    expect(hash(bytes)).toBe("c372d61fc6843661abbdb868e9d28e8d3c7ce1c19fd7ce559d77fca90d02bd08");
    const after = fs.statSync(path, { bigint: true }); expect([after.dev, after.ino, after.size, after.mtimeNs, after.ctimeNs]).toEqual([before.dev, before.ino, before.size, before.mtimeNs, before.ctimeNs]);
  });
});

describe("UID and GID NUL-only delta", () => {
  test.each([{ fields: [108] }, { fields: [116] }, { fields: [108, 116] }])("accepts exactly eight NULs only in ownership fields %j", ({ fields }) => {
    const data = tar(); for (const start of fields) data.fill(0, start, start + 8); checksum(data.subarray(0, 512));
    const bytes = gzipSync(data), spec = bound(bytes), result = inspectVerifiedArchive(bytes, spec);
    expect(result.files.map(f => f.data)).toEqual(required().map(e => e.data!)); expect(result.physicalTarHeaders).toBe(2); expect(() => oldInspect(bytes, spec)).toThrow("tar-octal");
  });
  test("accepts NUL ownership fields on every physical header without mutating the archive", () => {
    const data = tar([...required(), { name: "package/LICENSE", data: Buffer.from("exact notice\n") }, { name: "package/skipped", data: Buffer.from("skipped") }]);
    for (let at = 0; at < data.length - 1024;) { const h = data.subarray(at, at + 512), size = parseInt(h.subarray(124, 135).toString("ascii"), 8); h.fill(0, 108, 124); checksum(h); at += 512 + Math.ceil(size / 512) * 512; }
    const bytes = gzipSync(data), original = Buffer.from(bytes), result = inspectVerifiedArchive(bytes, bound(bytes)); expect(bytes.equals(original)).toBe(true); expect(result.files[2]!.data.toString()).toBe("exact notice\n"); expect(result.files).toHaveLength(3);
  });
  for (const [start, width] of [[100, 8], [124, 12], [136, 12], [148, 8]] as const) {
    test(`rejects all-NUL nonownership numeric field ${start}`, () => { rejectsBoth(modify(start, Buffer.alloc(width)), "tar-octal"); });
    test(`rejects all-space nonownership numeric field ${start}`, () => { rejectsBoth(modify(start, Buffer.alloc(width, 32)), "tar-octal"); });
  }
  for (const start of [108, 116]) for (const [label, value] of [
    ["spaces", Buffer.alloc(8, 32)], ["NUL-space", Buffer.from("\0\0\0\0\0\0\0 ")], ["space-NUL", Buffer.from(" \0\0\0\0\0\0\0")],
    ["NUL-leading-digit", Buffer.from([0, 0, 0, 0, 0, 0, 0, 48])], ["internal-space", Buffer.from("0 000000")], ["internal-NUL", Buffer.from("000\0 001")],
    ["tab", Buffer.from("0000000\t")], ["newline", Buffer.from("0000000\n")], ["nine", Buffer.from("0000009\0")], ["negative", Buffer.from("-000001\0")],
    ["high-bit", Buffer.from([128, 48, 48, 48, 48, 48, 48, 0])],
  ] as const) test(`rejects ${label} ownership numeric field ${start}`, () => { rejectsBoth(modify(start, value), "tar-octal"); });
  test.each([[100, "000 0644"], [124, "0000 0000000"], [136, "00000000000\t"]] as const)("retains strict malformed numeric rejection at %i", (start, text) => { rejectsBoth(modify(start, Buffer.from(text)), "tar-octal"); });
  test("retains ordinary octal leading spaces and numeric terminators", () => { expect(inspectBoth(modify(100, Buffer.from(" 000644\0"))).files).toHaveLength(2); });
});

describe("unchanged structural checks with numeric UID and GID", () => {
  test("checks the fixed SRI before gunzip", () => { for (const inspect of [inspectVerifiedArchive, oldInspect]) expect(() => inspect(Buffer.from("not gzip"), JSSHA)).toThrow("sri-before-inflate"); });
  test("rejects matching SRI on invalid gzip", () => { const bytes = Buffer.from("not gzip"); for (const inspect of [inspectVerifiedArchive, oldInspect]) expect(() => inspect(bytes, bound(bytes))).toThrow("gzip-invalid-or-expanded-cap"); });
  test("rejects compressed bytes above 2 MiB before inflate", () => { const bytes = Buffer.alloc(2 * MIB + 1); for (const inspect of [inspectVerifiedArchive, oldInspect]) expect(() => inspect(bytes, bound(bytes))).toThrow("sri-before-inflate"); });
  test("counts skipped content toward the expanded cap", () => { rejectsBoth(tar([...required(), { name: "package/skipped", data: Buffer.alloc(8 * MIB) }]), "gzip-invalid-or-expanded-cap"); });
  test("accepts the exact 8 MiB expanded cap", () => { const base = tar(), data = tar([...required(), { name: "package/skipped", data: Buffer.alloc(8 * MIB - base.length - 512) }]); expect(data.length).toBe(8 * MIB); expect(inspectBoth(data).expandedBytesIncludingSkippedContent).toBe(8 * MIB); });
  test("rejects a non-block-aligned expanded stream", () => { rejectsBoth(Buffer.concat([tar(), Buffer.alloc(1)]), "expanded-or-block-cap"); });
  test("retains exact selected payloads and notice preference", () => {
    const entries = [...required(), { name: "package/LICENSE.txt", data: Buffer.from("third") }, { name: "package/LICENSE.md", data: Buffer.from("second") }, { name: "package/LICENSE", data: Buffer.from("exact notice\n") }], result = inspectBoth(tar(entries));
    expect(result.files.map(f => f.member)).toEqual(["package/package.json", "package/dist/sha256.mjs", "package/LICENSE"]); expect(result.files[2]!.data.toString()).toBe("exact notice\n"); expect(result.legalClearance).toBe(false);
  });
  test("retains exact USTAR prefix origin", () => { const entries = required(); entries[1] = { name: "dist/sha256.mjs", prefix: "package", data: entries[1]!.data }; expect(inspectBoth(tar(entries)).files).toHaveLength(2); });
  test("accepts GNU USTAR magic unchanged", () => { const data = modify(257, Buffer.from("ustar  \0")); expect(inspectBoth(data).files).toHaveLength(2); });
  test.each(["name", "version"])("rejects wrong package %s", key => { const entries = required(); entries[0]!.data = Buffer.from(JSON.stringify({ name: "jssha", version: "3.3.2", [key]: "wrong" })); rejectsBoth(tar(entries), "package-identity"); });
  test("rejects an absent required member", () => { rejectsBoth(tar(required().slice(0, 1)), "missing-required-member"); });
  test("rejects invalid package JSON as data", () => { const entries = required(); entries[0]!.data = Buffer.from("not executable JSON"); const bytes = gzipSync(tar(entries)); for (const inspect of [inspectVerifiedArchive, oldInspect]) expect(() => inspect(bytes, bound(bytes))).toThrow(); });
  test("rejects package JSON arrays", () => { const entries = required(); entries[0]!.data = Buffer.from("[]"); rejectsBoth(tar(entries), "object-required"); });
  test("retains at most three selected files", () => { const data = tar([...required(), { name: "package/third", data: Buffer.from("third") }, { name: "package/fourth", data: Buffer.from("fourth") }]); expect(() => inspectBoth(data, { ...JSSHA, requiredMembers: [...JSSHA.requiredMembers, { member: "package/third", retainedFile: "third" }, { member: "package/fourth", retainedFile: "fourth" }] })).toThrow("selected-cap"); });
  test("requires maximumLicenseFiles exactly one", () => { expect(() => inspectBoth(tar(), { ...JSSHA, maximumLicenseFiles: 2 })).toThrow("selected-cap"); });
  test("rejects duplicate selected physical members", () => { rejectsBoth(tar([...required(), required()[1]!]), "physical-selected-duplicate-or-type"); });
  test("rejects selected directories", () => { const entries = required(); entries[1] = { name: entries[1]!.name, type: "5" }; rejectsBoth(tar(entries), "physical-selected-duplicate-or-type"); });
  test.each(["1", "2", "3", "4", "6", "7", "S", "K"])("rejects unsupported skipped type %s", type => { rejectsBoth(tar([...required(), { name: "package/skipped", type }]), "tar-unsupported-type-or-link"); });
  test("rejects a link target even on a regular header", () => { rejectsBoth(modify(157, Buffer.from("target")), "tar-unsupported-type-or-link"); });
  test("rejects invalid USTAR magic", () => { rejectsBoth(modify(257, Buffer.from("invalid!")), "tar-format"); });
  test("rejects malformed string-field tails", () => { rejectsBoth(modify(0, Buffer.from("x\0y")), "tar-field-tail"); });
  test.each(["../escape", "/absolute", "package/../escape", "package//escape", "package\\escape"])("rejects unsafe skipped path %s", name => { rejectsBoth(tar([...required(), { name }]), "tar-path"); });
  test("rejects a nonempty directory", () => { rejectsBoth(tar([...required(), { name: "package/directory/", type: "5", data: Buffer.from("x") }]), "directory-size"); });
  test("counts every physical metadata header", () => { rejectsBoth(tar([...required(), ...Array.from({ length: 255 }, () => ({ name: "GlobalHead", type: "g", data: paxRecord("mtime", "0") }))]), "physical-header-cap"); });
  test("accepts exactly 256 physical headers", () => { expect(inspectBoth(tar([...required(), ...Array.from({ length: 254 }, (_, n) => ({ name: `package/skipped-${n}` }))])).physicalTarHeaders).toBe(256); });
  test("accepts harmless PAX and exact selected origin and size", () => { const entries = required(), runtime = entries[1]!, data = Buffer.concat([paxRecord("path", runtime.name), paxRecord("size", String(runtime.data!.length)), paxRecord("mtime", "0")]); expect(inspectBoth(tar([entries[0]!, { name: "PaxHeader/runtime", type: "x", data }, runtime])).files).toHaveLength(2); });
  test("rejects PAX hiding a selected physical member", () => { const entries = required(); rejectsBoth(tar([entries[0]!, { name: "PaxHeader/runtime", type: "x", data: paxRecord("path", "package/other") }, entries[1]!]), "selected-origin-type-or-duplicate"); });
  test("rejects PAX synthesizing a selected logical member", () => { const entries = required(); rejectsBoth(tar([entries[0]!, { name: "PaxHeader/runtime", type: "x", data: paxRecord("path", entries[1]!.name) }, { name: "package/other", data: entries[1]!.data }]), "selected-origin-type-or-duplicate"); });
  test("rejects PAX size disagreement", () => { const entries = required(); rejectsBoth(tar([entries[0]!, { name: "PaxHeader/runtime", type: "x", data: paxRecord("size", "1") }, entries[1]!]), "pax-size-origin-ambiguity"); });
  test.each([paxRecord("GNU.sparse.size", "1"), Buffer.concat([paxRecord("path", "a"), paxRecord("path", "b")]), Buffer.from("999 path=x\n")])("rejects unsupported or malformed PAX %j", data => { rejectsBoth(tar([{ name: "PaxHeader/x", type: "x", data }, ...required()]), "pax-"); });
  test.each([0, 1])("rejects high-bit PAX length byte %i", digit => { const data = paxRecord("mtime", "0"); data[digit] = data[digit]! | 128; rejectsBoth(tar([{ name: "PaxHeader/highbit", type: "x", data }, ...required()]), "pax-length-ascii"); });
  test.each(["path", "size"])("rejects global PAX %s", key => { rejectsBoth(tar([{ name: "GlobalHead", type: "g", data: paxRecord(key, key === "size" ? "0" : "package/other") }, ...required()]), "global-path-or-size"); });
  test("rejects pending PAX at the terminator", () => { rejectsBoth(tar([...required(), { name: "PaxHeader/end", type: "x", data: paxRecord("mtime", "0") }]), "tar-terminator"); });
  test("accepts GNU longnames for skipped content", () => { expect(inspectBoth(tar([...required(), { name: "./LongLink", type: "L", data: Buffer.from("package/" + "a".repeat(140) + "\0") }, { name: "package/short", data: Buffer.from("skipped") }])).files).toHaveLength(2); });
  test("rejects GNU aliasing a selected origin", () => { const entries = required(); rejectsBoth(tar([entries[0]!, { name: "LongLink", type: "L", data: Buffer.from(entries[1]!.name + "\0") }, { name: "package/short", data: entries[1]!.data }]), "selected-origin-type-or-duplicate"); });
  test("rejects PAX and GNU metadata stacking", () => { rejectsBoth(tar([{ name: "PaxHeader/x", type: "x", data: paxRecord("mtime", "0") }, { name: "LongLink", type: "L", data: Buffer.from("package/other\0") }, ...required()]), "gnu-longname"); });
  test("rejects duplicate PAX metadata stacking", () => { rejectsBoth(tar([{ name: "PaxHeader/x", type: "x", data: paxRecord("mtime", "0") }, { name: "PaxHeader/y", type: "x", data: paxRecord("mtime", "0") }, ...required()]), "metadata-stacking"); });
  test("rejects malformed GNU longname terminators", () => { rejectsBoth(tar([{ name: "LongLink", type: "L", data: Buffer.from("package/other") }, ...required()]), "gnu-longname"); });
  test("rejects checksum corruption without normalizing headers", () => { const data = tar(); data[0] = 88; rejectsBoth(data, "tar-checksum"); });
  test("rejects nonzero payload padding", () => { const data = tar(); data[512 + required()[0]!.data!.length] = 1; rejectsBoth(data, "tar-payload-padding"); });
  test("rejects a missing terminator", () => { rejectsBoth(tar().subarray(0, -1024), "missing-terminator"); });
  test("requires two terminating zero blocks", () => { rejectsBoth(tar().subarray(0, -512), "tar-terminator"); });
  test("rejects a truncated skipped payload", () => { rejectsBoth(tar([...required(), { name: "package/skipped", size: 1000000 }]), "tar-payload-padding"); });
  test("rejects nonzero bytes after the terminator", () => { rejectsBoth(Buffer.concat([tar(), Buffer.from([1]), Buffer.alloc(511)]), "tar-terminator"); });
});
