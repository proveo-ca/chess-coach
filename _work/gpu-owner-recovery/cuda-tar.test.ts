// SPEC: _spec/recovery.md
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { auditTar, tarLimits, tarPrefix } from "./cuda-tar";

type LogicalEntry = { path: string; type: string; mode?: string; content?: string; target?: string; major?: number; minor?: number };
type WireOptions = { path?: string; type?: string; mode?: number; size?: number; target?: string; gnu?: boolean; prefix?: string };
const bytes = (value: string): Uint8Array => new TextEncoder().encode(value);
const concatenate = (...parts: Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
};
function put(buffer: Uint8Array, offset: number, length: number, value: string): void {
  const encoded = bytes(value);
  if (encoded.length > length) throw Error("TEST_FIELD_LENGTH");
  buffer.fill(0, offset, offset + length); buffer.set(encoded, offset);
}
function checksum(buffer: Uint8Array): Uint8Array {
  buffer.fill(32, 148, 156);
  const value = buffer.reduce((sum, byte) => sum + byte, 0);
  put(buffer, 148, 8, `${value.toString(8).padStart(6, "0")}\0 `);
  return buffer;
}
function wireHeader(options: WireOptions = {}): Uint8Array {
  const result = new Uint8Array(512);
  put(result, 0, 100, options.path ?? `${tarPrefix}/file`);
  put(result, 100, 8, `${(options.mode ?? 0o644).toString(8).padStart(7, "0")}\0`);
  for (const start of [108, 116]) put(result, start, 8, "0000000\0");
  put(result, 124, 12, `${(options.size ?? 0).toString(8).padStart(11, "0")}\0`);
  put(result, 136, 12, "00000000000\0");
  result[156] = (options.type ?? "0").charCodeAt(0);
  put(result, 157, 100, options.target ?? "");
  put(result, 257, 8, options.gnu ? "ustar  \0" : "ustar\0" + "00");
  if (options.prefix) put(result, 345, 155, options.prefix);
  return checksum(result);
}
const body = (payload: Uint8Array): Uint8Array => concatenate(payload, new Uint8Array((512 - payload.length % 512) % 512));
const member = (options: WireOptions = {}, payload: Uint8Array = new Uint8Array()): Uint8Array =>
  concatenate(wireHeader({ ...options, size: options.size ?? payload.length }), body(payload));
const end = new Uint8Array(1024);
const archive = (...members: Uint8Array[]): Uint8Array => concatenate(...members, end);
async function* chunks(data: Uint8Array, width = 16384): AsyncGenerator<Uint8Array> {
  for (let offset = 0; offset < data.length; offset += width) yield data.subarray(offset, offset + width);
}
const audit = (data: Uint8Array, width?: number) => auditTar(chunks(data, width));
const rejected = async (data: Uint8Array, code?: string): Promise<void> => {
  const pending = audit(data);
  if (code) await expect(pending).rejects.toThrow(`TAR_${code}`); else await expect(pending).rejects.toThrow();
};
function logical(entry: LogicalEntry): Uint8Array {
  const types: Record<string, string> = { file: "0", directory: "5", symlink: "2", hardlink: "1", fifo: "6", "character-device": "3" };
  const result = member({ path: entry.path, type: types[entry.type] ?? "?", mode: Number.parseInt(entry.mode ?? "0644", 8),
    target: entry.target }, bytes(entry.content ?? ""));
  if (entry.major !== undefined) put(result, 329, 8, `${entry.major.toString(8).padStart(7, "0")}\0`);
  if (entry.minor !== undefined) put(result, 337, 8, `${entry.minor.toString(8).padStart(7, "0")}\0`);
  checksum(result.subarray(0, 512));
  return result;
}
function record(key: string, value: string): Uint8Array {
  const tail = bytes(` ${key}=${value}\n`);
  let length = tail.length + 1;
  while (String(length).length + tail.length !== length) length = String(length).length + tail.length;
  return concatenate(bytes(String(length)), tail);
}
const pax = (records: [string, string][], global = false): Uint8Array =>
  member({ path: "PaxHeaders/synthetic", type: global ? "g" : "x" }, concatenate(...records.map(([key, value]) => record(key, value))));
const long = (value: string, link = false): Uint8Array =>
  member({ path: "././@LongLink", type: link ? "K" : "L", gnu: true }, concatenate(bytes(value), new Uint8Array(1)));
const regular = (name: string, content = ""): Uint8Array => member({ path: `${tarPrefix}/${name}` }, bytes(content));
const rootDirectory = (): Uint8Array => member({ path: tarPrefix, type: "5", mode: 0o755 });
const link = (name: string, target: string, hard = false): Uint8Array =>
  member({ path: `${tarPrefix}/${name}`, type: hard ? "1" : "2", target, mode: hard ? 0o644 : 0o777 });
const fixture = JSON.parse(readFileSync(new URL("./fixtures/cuda-tar-cases.json", import.meta.url), "utf8")) as {
  prefix: string; cases: { id: string; accept: boolean; entries: LogicalEntry[] }[];
};

test("logical fixture remains exactly fourteen synthetic TAR vectors", () => {
  expect(fixture.prefix).toBe(tarPrefix); expect(fixture.cases).toHaveLength(14);
});
for (const vector of fixture.cases) test(`persistent logical wire vector: ${vector.id}`, async () => {
  const data = archive(...vector.entries.map(logical));
  if (vector.accept) expect((await audit(data)).totals.count).toBe(vector.entries.length);
  else await rejected(data);
});

test("inventory hashes file payloads, omits link digests and uses UTF-8 byte ordering", async () => {
  const data = archive(regular("ä", "abc"), regular("Z"), link("a", "ä"));
  const result = await audit(data);
  expect(result).toEqual({ version: 1, prefix: tarPrefix, entries: [
    { path: `${tarPrefix}/Z`, type: "file", mode: 0o644, size: 0, sha256: createHash("sha256").digest("hex") },
    { path: `${tarPrefix}/a`, type: "symlink", mode: 0o777, size: 0, target: "ä" },
    { path: `${tarPrefix}/ä`, type: "file", mode: 0o644, size: 3, sha256: createHash("sha256").update("abc").digest("hex") },
  ], totals: { decompressedBytes: data.length, headerCount: 5, extensionBytes: 0, fileBytes: 3, count: 3 } });
});

test("one-byte, split-header, empty and huge chunks produce the same inventory", async () => {
  const data = archive(regular("one", "x".repeat(1400)), regular("two", "abc"));
  const expected = await audit(data);
  for (const width of [1, 17, 511, 512, 513, data.length]) expect(await audit(data, width)).toEqual(expected);
  async function* stream() { yield new Uint8Array(); yield data.subarray(0, 149); yield new Uint8Array(); yield data.subarray(149); }
  expect(await auditTar(stream())).toEqual(expected);
});

test("streams ordinary data into SHA256 without retaining payload chunks", async () => {
  const payload = bytes("synthetic inert data"), header = wireHeader({ size: payload.length });
  async function* stream() {
    yield header;
    const scratch = new Uint8Array(1);
    for (const byte of payload) { scratch[0] = byte; yield scratch; scratch[0] = 0; }
    yield new Uint8Array(512 - payload.length); yield end;
  }
  const result = await auditTar(stream());
  expect(result.entries[0]).toMatchObject({ size: payload.length, sha256: createHash("sha256").update(payload).digest("hex") });
});

test("rejects non-Uint8Array chunks including after termination", async () => {
  for (const value of [null, {}, "x", [0], new ArrayBuffer(1), new Uint16Array(1)]) {
    async function* stream() { yield end; yield value as Uint8Array; }
    await expect(auditTar(stream())).rejects.toThrow("TAR_CHUNK_TYPE");
  }
});

test("requires two complete zero terminators and rejects each truncation class", async () => {
  const data = archive(regular("file", "abc"));
  for (const length of [0, 1, 511, 512, 514, 515, 1023, 1024, 1535, 1536, data.length - 1]) await rejected(data.subarray(0, length));
  await rejected(concatenate(new Uint8Array(512), wireHeader()), "ZERO_TERMINATION");
});

test("an empty archive cannot claim an effective LLVM prefix", async () => {
  await rejected(archive(), "EMPTY");
  expect((await audit(archive(rootDirectory()))).totals.count).toBe(1);
});

test("requires zero payload padding and consumes every trailing chunk through EOF", async () => {
  const malformed = archive(regular("file", "a")); malformed[513] = 1;
  await rejected(malformed, "NONZERO_PADDING");
  let consumed = 0;
  async function* valid() { yield archive(rootDirectory()); for (let i = 0; i < 3; i++) { consumed++; yield new Uint8Array(513); } }
  expect((await auditTar(valid())).totals.decompressedBytes).toBe(1536 + 3 * 513); expect(consumed).toBe(3);
  async function* invalid() { yield end; yield new Uint8Array(3); yield bytes("x"); }
  await expect(auditTar(invalid())).rejects.toThrow("TAR_TRAILING_DATA");
});

test("checks unsigned header checksum before interpreting other fields", async () => {
  const bad = wireHeader(); bad[0] = 255; bad[124] = 128;
  await rejected(archive(bad), "CHECKSUM");
  const valid = member({ path: `${tarPrefix}/é` }); expect((await audit(archive(valid))).totals.count).toBe(1);
});

test("accepts POSIX prefix/name and GNU standard magic but rejects alternate dialects", async () => {
  const posix = member({ path: "file", prefix: `${tarPrefix}/lib` });
  expect((await audit(archive(posix))).entries[0]?.path).toBe(`${tarPrefix}/lib/file`);
  expect((await audit(archive(member({ gnu: true })))).totals.count).toBe(1);
  for (const magic of ["\0".repeat(8), "ustar\0" + "01", "ustar\0 \0", "ustar   "]) {
    const raw = wireHeader(); put(raw, 257, 8, magic); checksum(raw); await rejected(archive(raw), "MAGIC_VERSION");
  }
});

test("octal-only fields reject base256, signs, non-octal and malformed NUL numerics", async () => {
  for (const start of [100, 108, 116, 124, 136, 329, 337]) {
    for (const value of [128, 45, 56]) { const raw = wireHeader(); raw[start] = value; checksum(raw); await rejected(archive(raw)); }
  }
  const raw = wireHeader(); raw[108] = 0; raw[109] = 49; checksum(raw); await rejected(archive(raw), "OCTAL");
  const maximum = wireHeader(); put(maximum, 108, 8, "7777777\0"); put(maximum, 136, 12, "77777777777\0"); checksum(maximum);
  expect((await audit(archive(maximum))).totals.count).toBe(1);
});

test("required numeric fields reject blank and NUL-only encodings accepted only for unused fields", async () => {
  for (const [start, end] of [[100, 108], [108, 116], [116, 124], [124, 136], [136, 148]]) {
    for (const fill of [0, 32]) {
      const raw = wireHeader(); raw.fill(fill, start, end); checksum(raw);
      await rejected(archive(raw), "OCTAL_EMPTY");
    }
  }
  expect((await audit(archive(member({ gnu: true })))).totals.count).toBe(1);
});

test("strict strings reject malformed UTF-8, control bytes and data after NUL", async () => {
  for (const start of [0, 157, 265, 297, 345]) {
    for (const value of [255, 10]) { const raw = wireHeader(); raw[start] = value; checksum(raw); await rejected(archive(raw)); }
  }
  const raw = wireHeader(); raw[tarPrefix.length] = 0; raw[tarPrefix.length + 1] = 65; checksum(raw);
  await rejected(archive(raw), "STRING_NUL");
});

test("rejects sparse headers, sparse extensions, special and unknown entry types", async () => {
  for (const type of ["S", "3", "4", "6", "7", "V", "?", "D"]) await rejected(archive(member({ type })), "ENTRY_TYPE");
  for (const key of ["GNU.sparse.map", "GNU.sparse.size", "SCHILY.realsize", "SCHILY.xattr.user.test", "uid", "gname"]) {
    await rejected(archive(pax([[key, "1"]]), regular("file")), "PAX_KEY");
  }
  const raw = wireHeader({ gnu: true }); raw[482] = 49; checksum(raw);
  await rejected(archive(raw), "GNU_SPARSE_OR_EXTENSION");
});

test("rejects unsafe modes, payload-bearing non-files and writable implicit replacements", async () => {
  for (const mode of [0o4755, 0o2755, 0o1755, 0o666, 0o664, 0o244, 0o000]) await rejected(archive(member({ mode })));
  for (const mode of [0o455, 0o777, 0o757]) await rejected(archive(member({ path: `${tarPrefix}/dir`, type: "5", mode })));
  expect((await audit(archive(member({ path: `${tarPrefix}/dir`, type: "5", mode: 0o744 })))).totals.count).toBe(1);
  for (const type of ["1", "2", "5"]) await rejected(archive(member({ type, target: type === "5" ? "" : "file" }, bytes("x"))), "NON_FILE_SIZE");
  await rejected(archive(regular("file"), member({ path: `${tarPrefix}/hard`, type: "1", target: `${tarPrefix}/file`, mode: 0o777 })), "UNSAFE_MODE");
  expect((await audit(archive(link("link", "file"), regular("file")))).totals.count).toBe(2);
});

test("canonicalizes exactly one directory slash and permits implicit then explicit parents", async () => {
  const result = await audit(archive(regular("dir/file"), member({ path: `${tarPrefix}/dir/`, type: "5", mode: 0o755 })));
  expect(result.entries[0]?.path).toBe(`${tarPrefix}/dir`);
  await rejected(archive(member({ path: `${tarPrefix}/dir//`, type: "5", mode: 0o755 })));
  await rejected(archive(member({ path: `${tarPrefix}/dir/`, type: "5", mode: 0o755 }), member({ path: `${tarPrefix}/dir`, type: "5", mode: 0o755 })), "DUPLICATE_PATH");
});

test("rejects dot, redundant, absolute, backslash, reserved and wrong-prefix effective paths", async () => {
  for (const path of [`${tarPrefix}/./a`, `${tarPrefix}//a`, `${tarPrefix}/a/`, `${tarPrefix}/a/../b`,
    `${tarPrefix}/a\\b`, `${tarPrefix}/x/.tracel-llvm-installed`, "/absolute", "other/file", tarPrefix]) await rejected(archive(member({ path })));
});

test("later non-directory parents cannot invalidate earlier children", async () => {
  for (const parent of [regular("dir"), link("dir", "real"), link("dir", `${tarPrefix}/real`, true)]) {
    await rejected(archive(regular("dir/file"), regular("real"), parent), "PARENT_MUTATION");
    await rejected(archive(parent, regular("dir/file"), regular("real")), "NON_DIRECTORY_ANCESTOR");
  }
});

test("resolves forward, backward and chained hardlinks only to regular in-prefix targets", async () => {
  for (const entries of [[link("a", `${tarPrefix}/b`, true), link("b", `${tarPrefix}/file`, true), regular("file")],
    [regular("file"), link("b", `${tarPrefix}/file`, true), link("a", `${tarPrefix}/b`, true)]]) {
    expect((await audit(archive(...entries))).totals.count).toBe(3);
  }
  for (const target of ["file", "/file", `${tarPrefix}/../outside`, `${tarPrefix}/missing`, tarPrefix]) await rejected(archive(regular("file"), link("a", target, true)));
  await rejected(archive(regular("file"), link("sym", "file"), link("hard", `${tarPrefix}/sym`, true)), "HARDLINK_SYMLINK");
});

test("resolves full symlink path components including directory aliases and parent traversal", async () => {
  const result = await audit(archive(regular("real/file"), link("alias", "real"), link("selected", "alias/file"),
    link("real/back", "../real/file"), link("root", ".")));
  expect(result.totals.count).toBe(5);
  await rejected(archive(regular("real/file"), link("a", "real/file/../file")), "LINK_NON_DIRECTORY");
  await rejected(archive(regular("real/file"), link("a", "missing/../real/file")), "LINK_UNRESOLVED");
  await rejected(archive(regular("real/file"), link("dir", "."), link("real/bad", "../dir/../real/file")), "LINK_ESCAPE");
});

test("rejects cycles through complete target components and hardlink cycles", async () => {
  for (const data of [archive(link("a", "b"), link("b", "a")), archive(link("a", "a/file")),
    archive(link("a", `${tarPrefix}/b`, true), link("b", `${tarPrefix}/a`, true)),
    archive(link("alias", "."), link("a", "alias/a"))]) await rejected(data, "LINK_CYCLE");
});

test("GNU long names and long targets work with independently split metadata", async () => {
  const path = `${tarPrefix}/${"a".repeat(200)}`;
  const data = archive(long(path), member(), long(path, true), link("hard", "ignored", true));
  const result = await audit(data, 1);
  expect(result.entries.map(entry => entry.path)).toContain(path);
  expect(result.entries.find(entry => entry.type === "hardlink")).toMatchObject({ target: path });
  expect(result.totals.extensionBytes).toBe(2 * (bytes(path).length + 1));
  expect(result.totals.headerCount).toBe(6);
});

test("local PAX counts UTF-8 record bytes and overrides path, target and raw size", async () => {
  const path = `${tarPrefix}/é`;
  const data = archive(pax([["mtime", "123.456"], ["path", path], ["size", "3"]]), member({ size: 0 }, bytes("abc")),
    pax([["linkpath", "é"], ["path", `${tarPrefix}/alias`]]), link("raw", "ignored"));
  const result = await audit(data, 7);
  expect(result.entries.find(entry => entry.type === "file")).toMatchObject({ path, size: 3, sha256: createHash("sha256").update("abc").digest("hex") });
  expect(result.entries.find(entry => entry.type === "symlink")).toMatchObject({ target: "é" });
  expect((await audit(archive(pax([["size", "0"]]), member({ path: `${tarPrefix}/dir`, type: "5", mode: 0o755 })))).totals.count).toBe(1);
});

test("global non-path time attributes may inherit without altering entry data", async () => {
  const result = await audit(archive(pax([["mtime", "1.5"], ["atime", "2"], ["ctime", "0"]], true), regular("a"), regular("b")));
  expect(result.totals.count).toBe(2); expect(Object.keys(result.entries[0]!).sort()).toEqual(["mode", "path", "sha256", "size", "type"]);
  for (const key of ["path", "linkpath", "size"]) await rejected(archive(pax([[key, key === "size" ? "0" : `${tarPrefix}/file`]], true), regular("file")), "PAX_GLOBAL_OVERRIDE");
});

test("rejects duplicate and competing GNU/PAX overrides in either order", async () => {
  for (const field of ["path", "linkpath"]) {
    const value = field === "path" ? `${tarPrefix}/file` : "file";
    for (const extensions of [[long(value, field === "linkpath"), pax([[field, value]])],
      [pax([[field, value]]), long(value, field === "linkpath")], [pax([[field, value], [field, value]])],
      [pax([[field, value]]), pax([[field, value]])], [long(value, field === "linkpath"), long(value, field === "linkpath")]]) {
      await rejected(archive(...extensions, regular("file")));
    }
  }
  await rejected(archive(pax([["mtime", "1"]], true), pax([["mtime", "2"]], true), regular("file")), "OVERRIDE_CONFLICT");
  expect((await audit(archive(long(`${tarPrefix}/renamed`), pax([["mtime", "1"], ["size", "1"]]), member({}, bytes("x"))))).totals.count).toBe(1);
});

test("global headers cannot consume pending local PAX or GNU overrides differently from the consumer", async () => {
  for (const pending of [pax([["path", `${tarPrefix}/safe`]]), long(`${tarPrefix}/safe`), pax([["mtime", "1"]])]) {
    await rejected(archive(pending, pax([["mtime", "2"]], true), member({ path: `${tarPrefix}/.tracel-llvm-installed` })), "GLOBAL_AFTER_LOCAL_EXTENSION");
    await rejected(archive(pending, pax([["mtime", "2"]], true), member({ path: "other/file" })), "GLOBAL_AFTER_LOCAL_EXTENSION");
  }
  await rejected(archive(regular("file"), long("file", true), pax([["mtime", "1"]], true), link("alias", "../../outside")), "GLOBAL_AFTER_LOCAL_EXTENSION");
  await rejected(archive(pax([["path", `${tarPrefix}/safe`]]), pax([["size", "0"]]), regular("file")), "DUPLICATE_LOCAL_PAX");
  const valid = await audit(archive(pax([["mtime", "1"]], true), pax([["path", `${tarPrefix}/safe`]]), member({ path: "other/file" })));
  expect(valid.entries[0]?.path).toBe(`${tarPrefix}/safe`);
});

test("overrides expire after one ordinary member and orphan extensions fail", async () => {
  const result = await audit(archive(pax([["path", `${tarPrefix}/first`]]), regular("raw"), regular("second")));
  expect(result.entries.map(entry => entry.path)).toEqual([`${tarPrefix}/first`, `${tarPrefix}/second`]);
  for (const extension of [pax([["mtime", "1"]]), pax([["mtime", "1"]], true), long(`${tarPrefix}/file`), long("file", true)]) await rejected(archive(extension), "ORPHAN_EXTENSION");
});

test("rejects malformed PAX byte lengths, records, numeric values and unsupported keys", async () => {
  for (const payload of ["", "8 path=x", "9 path=x\n", "08 a=b\n", "0 a=b\n", "99999999999999999 a=b\n", "8 path\n", "x a=b\n", "5 a=\nJUNK"]) {
    await rejected(archive(member({ type: "x" }, bytes(payload)), regular("file")));
  }
  const valid = record("path", `${tarPrefix}/é`), incorrect = new Uint8Array(valid); incorrect[1] = incorrect[1]! - 1;
  await rejected(archive(member({ type: "x" }, incorrect), regular("file")));
  for (const size of ["-1", "+1", "01", "1.0", "9007199254740992", "999999999999999999999999999999", String(tarLimits.decompressedBytes + 1)]) {
    await rejected(archive(pax([["size", size]]), regular("file")));
  }
  for (const time of ["-1", "NaN", "Infinity", "1e2", "9007199254740992"]) await rejected(archive(pax([["mtime", time]]), regular("file")));
});

test("rejects unterminated GNU strings, embedded NULs and malformed UTF-8 metadata", async () => {
  for (const payload of [bytes(`${tarPrefix}/file`), concatenate(bytes(`${tarPrefix}/file\0junk`), new Uint8Array(1)),
    new Uint8Array([255, 0])]) await rejected(archive(member({ type: "L", gnu: true }, payload), regular("file")));
  await rejected(archive(pax([["path", `${tarPrefix}/a\0b`]]), regular("file")), "PATH");
  for (const type of ["L", "K"]) {
    await rejected(archive(member({ type, gnu: true }, bytes(`${tarPrefix}/file\0\0`)), regular("file")), "GNU_TERMINATOR");
  }
});

test("fixed production limits cannot be replaced by callers", async () => {
  expect(tarLimits).toEqual({ decompressedBytes: 536870912, headerCount: 65536, pathBytes: 4096, components: 64,
    extensionBytes: 65536, cumulativeExtensionBytes: 1048576, inventoryBytes: 33554432, graphNodes: 131072 });
  expect(Object.isFrozen(tarLimits)).toBe(true); expect(auditTar.length).toBe(1);
  const runtime = auditTar as unknown as (input: AsyncIterable<Uint8Array>, policy: unknown) => ReturnType<typeof auditTar>;
  await expect(runtime(chunks(archive(member({ path: "other/file" }))), { prefix: "other", limits: { pathBytes: Infinity } })).rejects.toThrow("TAR_ENTRY_PATH");
});

test("effective path and link limits accept exact byte/component ceilings", async () => {
  const path = `${tarPrefix}/${"a".repeat(tarLimits.pathBytes - tarPrefix.length - 1)}`;
  const result = await audit(archive(long(path), member(), long(path, true), link("hard", "ignored", true)));
  expect(result.entries[0]?.path.length).toBe(tarLimits.pathBytes);
  await rejected(archive(long(`${path}a`), member()), "PATH");
  await rejected(archive(long(`${path}a`, true), link("hard", "ignored", true)), "PATH");
  const nested = `${tarPrefix}/${Array.from({ length: 63 }, () => "d").join("/")}`;
  expect((await audit(archive(long(nested), member()))).totals.count).toBe(1);
  await rejected(archive(long(`${nested}/d`), member()), "COMPONENT_LIMIT");
  expect((await audit(archive(long(`${nested}/`), member({ type: "5", mode: 0o755 })))).totals.count).toBe(1);
});

test("per-extension ceiling accepts 64KiB exactly and rejects its next byte", async () => {
  const payload = record("mtime", `0.${"0".repeat(65521)}`);
  expect(payload.length).toBe(tarLimits.extensionBytes);
  expect((await audit(archive(member({ type: "x" }, payload), regular("file")))).totals.extensionBytes).toBe(65536);
  await rejected(archive(member({ type: "x" }, new Uint8Array(65537)), regular("file")), "EXTENSION_LIMIT");
});

test("cumulative extension ceiling includes every metadata payload", async () => {
  const payload = record("mtime", `0.${"0".repeat(65521)}`), extension = member({ type: "x" }, payload);
  async function* stream(extra: boolean) {
    for (let index = 0; index < 16; index++) { yield extension; yield regular(`file${index}`); }
    if (extra) yield pax([["mtime", "1"]]);
    yield end;
  }
  expect((await auditTar(stream(false))).totals.extensionBytes).toBe(1048576);
  await expect(auditTar(stream(true))).rejects.toThrow("TAR_EXTENSION_LIMIT");
});

test("all-header ceiling includes both terminators", async () => {
  async function* stream(count: number) { for (let index = 0; index < count; index++) yield regular(`f${index}`); yield end; }
  expect((await auditTar(stream(tarLimits.headerCount - 2))).totals.headerCount).toBe(tarLimits.headerCount);
  await expect(auditTar(stream(tarLimits.headerCount - 1))).rejects.toThrow("TAR_HEADER_LIMIT");
}, 60000);

test("a separate graph-node budget rejects unique deep prefixes before heap growth follows entry depth", async () => {
  async function* stream() {
    for (let index = 0; index < 3000; index++) {
      yield member({ path: "f", prefix: `${tarPrefix}/${String(index).padStart(5, "0")}/${Array.from({ length: 61 }, () => "d").join("/")}` });
    }
    yield end;
  }
  await expect(auditTar(stream())).rejects.toThrow("TAR_GRAPH_NODE_LIMIT");
});

test("inventory encoded-JSON ceiling fails without retaining archive payload bytes", async () => {
  async function* stream() {
    for (let index = 0; index < 65000; index++) {
      yield member({ path: `${String(index).padStart(5, "0")}${'"'.repeat(90)}`, prefix: `${tarPrefix}/${'"'.repeat(125)}` });
    }
    yield end;
  }
  await expect(auditTar(stream())).rejects.toThrow("TAR_INVENTORY_LIMIT");
}, 60000);

test("512MiB ceiling counts trailing zeros lazily and checks chunks before processing", async () => {
  const block = new Uint8Array(1024 * 1024);
  async function* stream(extra: boolean) {
    yield rootDirectory(); yield block.subarray(512);
    for (let index = 1; index < 512; index++) yield block;
    if (extra) yield new Uint8Array([1]);
  }
  const result = await auditTar(stream(false)); expect(result.totals.decompressedBytes).toBe(536870912);
  await expect(auditTar(stream(true))).rejects.toThrow("TAR_DECOMPRESSED_LIMIT");
}, 60000);
