// SPEC: _spec/tooling/sbx-dev/preparation-workflow.puml
import { expect, test } from "bun:test";
import { TarInspector, inspectZipArchive } from "../complete-archive.mjs";

const bounds = { root: "root", maxBytes: 8192, maxMembers: 64, maxMetadataBytes: 131072 };
const zipBounds = { ...bounds, maxEntryBytes: 8192 };

function rejects(operation) {
  let error;
  try { operation(); } catch (caught) { error = caught; }
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toBe("UNSAFE_ARCHIVE");
  expect(error.code).toBe("UNSAFE_ARCHIVE");
}

function checksum(header) {
  header.fill(32, 148, 156);
  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");
  return header;
}

function tarHeader({ path = "root/file", size = 0, type = "0", link = "", mode = 0o644, prefix = "", gnu = false } = {}) {
  const header = Buffer.alloc(512);
  const number = (offset, length, value) => header.write(`${value.toString(8).padStart(length - 1, "0")}\0`, offset, length, "ascii");
  header.write(path, 0, 100, "utf8");
  number(100, 8, mode);
  number(108, 8, 0);
  number(116, 8, 0);
  number(124, 12, size);
  number(136, 12, 0);
  header[156] = typeof type === "number" ? type : type.charCodeAt(0);
  header.write(link, 157, 100, "utf8");
  header.write(gnu ? "ustar  \0" : "ustar\0" + "00", 257, 8, "ascii");
  if (!gnu) header.write(prefix, 345, 155, "utf8");
  return checksum(header);
}

function tarRecord(options = {}, value = "") {
  const content = Buffer.from(value);
  return Buffer.concat([tarHeader({ size: content.length, ...options }), content, Buffer.alloc((512 - content.length % 512) % 512)]);
}

function tar(...records) {
  return Buffer.concat([...records, Buffer.alloc(1024)]);
}

function inspectTar(data, options = {}, stride = 513) {
  const inspector = new TarInspector({ ...bounds, ...options });
  for (let offset = 0; offset < data.length; offset += stride) inspector.write(data.subarray(offset, offset + stride));
  return inspector.finish();
}

function pax(...pairs) {
  return Buffer.concat(pairs.map(([key, value]) => {
    const body = ` ${key}=${value}\n`;
    let length = Buffer.byteLength(body) + 1;
    while (Buffer.byteLength(`${length}${body}`) !== length) length = Buffer.byteLength(`${length}${body}`);
    return Buffer.from(`${length}${body}`);
  }));
}

function localPax(...pairs) {
  return tarRecord({ path: "PaxHeader", type: "x" }, pax(...pairs));
}

function crc(content) {
  let value = 0xffffffff;
  for (const byte of content) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  }
  return (value ^ 0xffffffff) >>> 0;
}

function deflateStored(content) {
  const header = Buffer.alloc(5);
  header[0] = 1;
  header.writeUInt16LE(content.length, 1);
  header.writeUInt16LE(content.length ^ 0xffff, 3);
  return Buffer.concat([header, content]);
}

function zipExtra(id, content) {
  const header = Buffer.alloc(4);
  header.writeUInt16LE(id, 0);
  header.writeUInt16LE(content.length, 2);
  return Buffer.concat([header, content]);
}

function timestampExtra(flags, local) {
  const count = local ? (flags & 1) + ((flags >>> 1) & 1) + ((flags >>> 2) & 1) : flags & 1;
  const content = Buffer.alloc(1 + 4 * count);
  content[0] = flags;
  for (let index = 0; index < count; index++) content.writeUInt32LE(0xfedcba98 + index, 1 + 4 * index);
  return zipExtra(0x5455, content);
}

function unixExtra(uid = Buffer.from([0]), gid = Buffer.from([0]), version = 1) {
  return zipExtra(0x7875, Buffer.concat([Buffer.from([version, uid.length]), uid, Buffer.from([gid.length]), gid]));
}

function zip(items = [{ path: "root/file", content: "hello" }], comment = Buffer.alloc(0)) {
  const locals = [], centralRecords = [], locations = [];
  let offset = 0;
  for (const item of items) {
    const name = Buffer.from(item.path), content = Buffer.from(item.content ?? "");
    const localExtra = Buffer.from(item.localExtra ?? []), centralExtra = Buffer.from(item.centralExtra ?? []);
    const method = item.method ?? 0, payload = item.payload ?? (method === 8 ? deflateStored(content) : content);
    const flags = 0x800 | (item.descriptor ? 8 : 0), digest = crc(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    if (!item.descriptor) {
      local.writeUInt32LE(digest, 14);
      local.writeUInt32LE(payload.length, 18);
      local.writeUInt32LE(content.length, 22);
    }
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(localExtra.length, 28);
    let descriptor = Buffer.alloc(0);
    if (item.descriptor) {
      const signed = item.descriptor !== "unsigned";
      descriptor = Buffer.alloc(signed ? 16 : 12);
      if (signed) descriptor.writeUInt32LE(0x08074b50, 0);
      const start = signed ? 4 : 0;
      descriptor.writeUInt32LE(digest, start);
      descriptor.writeUInt32LE(payload.length, start + 4);
      descriptor.writeUInt32LE(content.length, start + 8);
    }
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(digest, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(centralExtra.length, 30);
    central.writeUInt32LE(((item.mode ?? (item.path.endsWith("/") ? 0o040755 : 0o100755)) << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    const body = offset + 30 + name.length + localExtra.length;
    locations.push({ local: offset, body, descriptor: body + payload.length });
    locals.push(local, name, localExtra, payload, descriptor);
    centralRecords.push(Buffer.concat([central, name, centralExtra]));
    offset += local.length + name.length + localExtra.length + payload.length + descriptor.length;
  }
  const centralOffset = offset;
  for (let index = 0; index < locations.length; index++) {
    locations[index].central = offset;
    offset += centralRecords[index].length;
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(items.length, 8);
  end.writeUInt16LE(items.length, 10);
  end.writeUInt32LE(offset - centralOffset, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(comment.length, 20);
  return { data: Buffer.concat([...locals, ...centralRecords, end, comment]), locations, end: offset, central: centralOffset };
}

test("TAR streams across byte and block boundaries and returns effective inventory", () => {
  const data = tar(tarRecord({ path: "root/", type: "5", mode: 0o755 }), tarRecord({ path: "root/file" }, "x".repeat(1025)));
  for (const stride of [1, 7, 511, 512, 513, 1024, 8192]) {
    const result = inspectTar(data, {}, stride);
    expect(result).toEqual({ entries: [
      { path: "root", type: "directory", size: 0, mode: 0o755, link: null },
      { path: "root/file", type: "file", size: 1025, mode: 0o644, link: null },
    ], bytes: 1025, members: 2, metadataBytes: 1037 });
  }
});

test("TAR consumes reusable payload chunks without returning file content", () => {
  const inspector = new TarInspector(bounds), payload = Buffer.alloc(128, 65);
  inspector.write(tarHeader({ size: 8192 }));
  for (let index = 0; index < 64; index++) {
    payload.fill(index);
    inspector.write(payload);
  }
  inspector.write(Buffer.alloc(1024));
  const result = inspector.finish();
  expect(result.bytes).toBe(8192);
  expect(Object.hasOwn(result.entries[0], "content")).toBe(false);
});

test("TAR accepts USTAR prefix, GNU L/K and local PAX without counting extensions as members", () => {
  const longPath = `root/${"a".repeat(101)}`;
  const data = tar(
    tarRecord({ path: "root", type: "5" }),
    tarRecord({ path: "file", prefix: "root" }, "abc"),
    tarRecord({ path: "././@LongLink", type: "L", gnu: true }, `${longPath}\0`),
    tarRecord({ path: "short", gnu: true }, "long"),
    tarRecord({ path: "././@LongLink", type: "K", gnu: true }, `${longPath.slice(5)}\0`),
    tarRecord({ path: "root/sym", type: "2", gnu: true }),
    localPax(["path", "root/pax"], ["size", "3"], ["mtime", "12.25"], ["atime", "0"], ["ctime", "1"]),
    tarRecord({ path: "short", size: 0 }, "pax"),
    localPax(["linkpath", "root/pax"]), tarRecord({ path: "root/hard", type: "1" }),
  );
  const result = inspectTar(data, { maxMembers: 6 }, 1);
  expect(result.members).toBe(6);
  expect(result.bytes).toBe(10);
  expect(result.entries.map((entry) => entry.path)).toEqual(["root", "root/file", longPath, "root/sym", "root/pax", "root/hard"]);
  expect(result.entries[3].link).toBe(longPath.slice(5));
  expect(result.entries[5].link).toBe("root/pax");
});

test("TAR accepts internal file links, hardlink chains and acyclic directory links", () => {
  const result = inspectTar(tar(
    tarRecord({ path: "root", type: "5" }), tarRecord({ path: "root/lib", type: "5" }),
    tarRecord({ path: "root/bin", type: "5" }), tarRecord({ path: "root/lib/file" }, "data"),
    tarRecord({ path: "root/bin/tool", type: "2", link: "../lib/file" }),
    tarRecord({ path: "root/alias", type: "2", link: "lib" }),
    tarRecord({ path: "root/second", type: "2", link: "bin/tool" }),
    tarRecord({ path: "root/hard", type: "1", link: "root/lib/file" }),
    tarRecord({ path: "root/hard2", type: "1", link: "root/hard" }),
  ));
  expect(result.bytes).toBe(4);
  expect(result.members).toBe(9);
});

test("TAR rejects noncanonical, unportable and malformed UTF-8 paths", () => {
  for (const path of ["/root/a", "../root/a", "root/../a", "root/./a", "./root/a", "root//a", "root/a/", "other/a", "root/a:b", "root/a\\b", "root/a\nb", "root/a\n", "root/a\u2028"]) {
    rejects(() => inspectTar(tar(tarRecord({ path }))));
  }
  for (const position of [0, 157, 345]) {
    const header = tarHeader();
    header[position] = 0xff;
    rejects(() => inspectTar(tar(checksum(header))));
  }
  const hidden = tarHeader();
  hidden[30] = 65;
  rejects(() => inspectTar(tar(checksum(hidden))));
  rejects(() => inspectTar(tar(localPax(["path", `root/${"a".repeat(1020)}`]), tarRecord())));
});

test("TAR rejects corrupt checksums, partial numbers, base-256 and unsupported formats", () => {
  const corrupt = tarHeader();
  corrupt[0] ^= 1;
  rejects(() => inspectTar(tar(corrupt)));
  for (const value of ["00000000008\0", "0000001x   ", "-000000001\0", "1\0" + "0000001\0", "1\n"]) {
    const header = tarHeader();
    header.fill(0, 124, 136);
    header.write(value, 124, 12, "ascii");
    rejects(() => inspectTar(tar(checksum(header))));
  }
  const binary = tarHeader();
  binary[124] = 0x80;
  rejects(() => inspectTar(tar(checksum(binary))));
  const format = tarHeader();
  format.fill(0, 257, 265);
  rejects(() => inspectTar(tar(checksum(format))));
});

test("TAR rejects incomplete headers, bodies, padding, end markers and appended garbage", () => {
  const data = tar(tarRecord({}, "hello"));
  for (const end of [1, 511, 512, 514, 517, 1023, 1024, 1536, data.length - 1]) {
    rejects(() => inspectTar(data.subarray(0, end)));
  }
  const padding = Buffer.from(data);
  padding[520] = 1;
  rejects(() => inspectTar(padding));
  rejects(() => inspectTar(Buffer.concat([data, Buffer.from([1])])));
  rejects(() => inspectTar(Buffer.concat([Buffer.alloc(512), tarRecord()])));
  expect(inspectTar(Buffer.concat([data, Buffer.alloc(512)])).members).toBe(1);
  rejects(() => inspectTar(Buffer.concat([data, Buffer.alloc(1)])));
});

test("TAR enforces declared bytes, members, metadata, extension and serialized zero caps", () => {
  rejects(() => inspectTar(tar(tarRecord({}, "four")), { maxBytes: 3 }));
  rejects(() => inspectTar(tar(tarRecord({ path: "root/a" }), tarRecord({ path: "root/b" })), { maxMembers: 1 }));
  rejects(() => inspectTar(tar(tarRecord()), { maxMetadataBytes: 512 }));
  rejects(() => inspectTar(tar(tarHeader({ path: "LongLink", type: "L", size: 65537 }))));
  rejects(() => inspectTar(tar(localPax(["path", "root/a"]), tarRecord()), { maxMetadataBytes: 600 }));
  const inspector = new TarInspector({ ...bounds, maxBytes: 1, maxMembers: 1, maxMetadataBytes: 1 });
  inspector.write(Buffer.alloc(1024));
  rejects(() => inspector.write(Buffer.alloc(1024 ** 2)));
  rejects(() => inspector.finish());
  const early = new TarInspector({ ...bounds, maxBytes: 1, maxMembers: 1, maxMetadataBytes: 1 });
  rejects(() => early.write(Buffer.alloc(1024 ** 2 + 2051)));
});

test("TAR rejects privileged modes, special kinds, sparse records and duplicate/type conflicts", () => {
  for (const mode of [0o4755, 0o2755, 0o1755, 0o10000]) rejects(() => inspectTar(tar(tarRecord({ mode }))));
  for (const type of ["3", "4", "6", "7", "S", "g", "X", "V", "D"]) rejects(() => inspectTar(tar(tarRecord({ type }))));
  for (const type of ["1", "2", "5"]) rejects(() => inspectTar(tar(tarRecord({ type, link: type === "5" ? "" : "root/file" }, "x"))));
  rejects(() => inspectTar(tar(tarRecord({ link: "root/a" }))));
  rejects(() => inspectTar(tar(tarRecord(), tarRecord())));
  rejects(() => inspectTar(tar(tarRecord({ path: "root/a", type: "5" }), tarRecord({ path: "root/a/", type: "5" }))));
  const sparse = tarHeader({ gnu: true });
  sparse[482] = 1;
  rejects(() => inspectTar(tar(checksum(sparse))));
});

test("TAR rejects malformed, unsupported and conflicting metadata records", () => {
  for (const value of ["0 path=root/a\n", "99 path=root/a\n", "19 path=root/a", "x path=root/a\n", "020 path=root/a\n", "4 x\n", ""]) {
    rejects(() => inspectTar(tar(tarRecord({ path: "Pax", type: "x" }, value), tarRecord())));
  }
  for (const pair of [["GNU.sparse.map", "0,1"], ["uid", "1"], ["size", "1x"], ["size", "9007199254740992"], ["path", ""], ["mtime", "NaN"], ["mtime", "-1"], ["mtime", "1e2"], ["mtime", "1\u2028"], ["size", "1\u2028"]]) {
    rejects(() => inspectTar(tar(localPax(pair), tarRecord())));
  }
  rejects(() => inspectTar(tar(localPax(["path", "root/a"], ["path", "root/b"]), tarRecord())));
  rejects(() => inspectTar(tar(localPax(["path", "root/a"]), localPax(["size", "0"]), tarRecord())));
  rejects(() => inspectTar(tar(localPax(["path", "root/a"]), tarRecord({ path: "Long", type: "L" }, "root/b\0"), tarRecord())));
  rejects(() => inspectTar(tar(localPax(["path", "root/a"]))));
  for (const value of ["root/a", "root/a\0junk\0", "root/\xff\0", "\0"]) {
    const body = value.includes("\xff") ? Buffer.from([114, 111, 111, 116, 47, 255, 0]) : Buffer.from(value);
    rejects(() => inspectTar(tar(tarRecord({ path: "Long", type: "L" }, body), tarRecord())));
  }
  const malformed = pax(["path", "root/a"]);
  malformed[malformed.length - 2] = 255;
  rejects(() => inspectTar(tar(tarRecord({ path: "Pax", type: "x" }, malformed), tarRecord())));
});

test("TAR rejects escaping, dangling and cyclic links and unsafe directory aliases", () => {
  const root = tarRecord({ path: "root", type: "5" });
  const file = tarRecord({ path: "root/file" }, "data");
  for (const link of ["/root/file", "../file", "../root/file", "../../root/file", "./file", "file//x", "file/", "abs:uri", "missing", "missing/../file", "link"]) {
    rejects(() => inspectTar(tar(root, file, tarRecord({ path: "root/link", type: "2", link }))));
  }
  for (const link of ["file", "../root/file", "/root/file", "root/missing", "root"]) {
    rejects(() => inspectTar(tar(root, file, tarRecord({ path: "root/link", type: "1", link }))));
  }
  for (const type of ["1", "2"]) {
    const target = type === "1" ? "root/" : "";
    rejects(() => inspectTar(tar(root,
      tarRecord({ path: "root/a", type, link: `${target}b` }), tarRecord({ path: "root/b", type, link: `${target}a` }))));
  }
  rejects(() => inspectTar(tar(root, tarRecord({ path: "root/a", type: "5" }), tarRecord({ path: "root/a/up", type: "2", link: ".." }))));
  rejects(() => inspectTar(tar(root,
    tarRecord({ path: "root/a", type: "5" }), tarRecord({ path: "root/b", type: "5" }),
    tarRecord({ path: "root/a/link", type: "2", link: "../b" }), tarRecord({ path: "root/b/link", type: "2", link: "../a" }))));
  rejects(() => inspectTar(tar(root, file,
    tarRecord({ path: "root/sym", type: "2", link: "file" }), tarRecord({ path: "root/hard", type: "1", link: "root/sym" }))));
  rejects(() => inspectTar(tar(root, file,
    tarRecord({ path: "root/d", type: "5" }), tarRecord({ path: "root/alias", type: "2", link: "d" }),
    tarRecord({ path: "root/link", type: "2", link: "alias/../file" }))));
});

test("TAR inventory forbids children below files or links regardless of member order", () => {
  for (const parent of [tarRecord({ path: "root/a" }), tarRecord({ path: "root/a", type: "2", link: "file" }), tarRecord({ path: "root/a", type: "1", link: "root/file" })]) {
    const child = tarRecord({ path: "root/a/child" });
    for (const records of [[parent, child], [child, parent]]) rejects(() => inspectTar(tar(tarRecord(), ...records)));
  }
});

test("TAR instances reject reuse after finishing or failure and reject nonbyte chunks", () => {
  const inspector = new TarInspector(bounds);
  inspector.write(new Uint8Array(tar()));
  expect(inspector.finish().members).toBe(0);
  rejects(() => inspector.finish());
  rejects(() => inspector.write(Buffer.alloc(0)));
  for (const input of ["archive", [], null, new DataView(new ArrayBuffer(4))]) {
    const invalid = new TarInspector(bounds);
    rejects(() => invalid.write(input));
    rejects(() => invalid.write(Buffer.alloc(1024)));
    rejects(() => invalid.finish());
  }
});

test("archive APIs reject invalid roots and nonpositive, fractional or unsafe limits", () => {
  for (const root of ["", ".", "..", "/root", "a/b", "a:b", "a\nb", "root\n", "root\u2028", "a".repeat(1025)]) {
    rejects(() => new TarInspector({ ...bounds, root }));
    rejects(() => inspectZipArchive(zip().data, { ...zipBounds, root }));
  }
  for (const key of ["maxBytes", "maxMembers", "maxMetadataBytes"]) {
    for (const value of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1", undefined]) {
      rejects(() => new TarInspector({ ...bounds, [key]: value }));
      rejects(() => inspectZipArchive(zip().data, { ...zipBounds, [key]: value }));
    }
  }
  rejects(() => new TarInspector({ ...bounds, maxMembers: Number.MAX_SAFE_INTEGER }));
  for (const maxEntryBytes of [0, -1, 1.5, 128 * 1024 ** 2 + 1, undefined]) rejects(() => inspectZipArchive(zip().data, { ...zipBounds, maxEntryBytes }));
});

test("ZIP returns stored/deflated file contents and normalized directories", () => {
  const fixture = zip([{ path: "root/" }, { path: "root/stored", content: "stored" }, { path: "root/deflated", content: "deflated", method: 8 }], Buffer.from("comment"));
  const result = inspectZipArchive(new Uint8Array(fixture.data), zipBounds);
  expect(result.bytes).toBe(14);
  expect(result.members).toBe(3);
  expect(result.entries[0]).toEqual({ path: "root", type: "directory", size: 0, mode: 0o755, link: null, content: undefined });
  expect(result.entries[1].content).toEqual(Buffer.from("stored"));
  expect(result.entries[2].content).toEqual(Buffer.from("deflated"));
  expect(result.entries[1].mode).toBe(0o755);
});

test("ZIP validates signed and unsigned data descriptors", () => {
  for (const descriptor of [true, "unsigned"]) {
    const fixture = zip([{ path: "root/file", content: "descriptor", method: 8, descriptor }]);
    expect(inspectZipArchive(fixture.data, zipBounds).entries[0].content.toString()).toBe("descriptor");
    fixture.data[fixture.locations[0].descriptor + (descriptor === true ? 4 : 0)] ^= 1;
    rejects(() => inspectZipArchive(fixture.data, zipBounds));
  }
});

test("ZIP accepts a synthetic compressed DEFLATE stream with a known CRC vector", () => {
  expect(crc(Buffer.from("123456789"))).toBe(0xcbf43926);
  const fixture = zip([{ path: "root/file", content: "hello", method: 8, payload: Buffer.from("cb48cdc9c90700", "hex") }]);
  expect(inspectZipArchive(fixture.data, zipBounds).entries[0].content).toEqual(Buffer.from("hello"));
});

test("ZIP accepts unique timestamp/Unix extras in either order without materializing their values", () => {
  const content = Buffer.from("payload\0data");
  for (const method of [0, 8]) {
    for (let flags = 0; flags <= 7; flags++) {
      const localExtra = Buffer.concat([timestampExtra(flags, true), unixExtra(Buffer.alloc(flags + 1, 255), Buffer.alloc(8 - flags))]);
      const centralExtra = Buffer.concat([unixExtra(Buffer.alloc(8 - flags), Buffer.alloc(flags + 1, 127)), timestampExtra(flags, false)]);
      const fixture = zip([{ path: "root/file", content, method, mode: 0o100751, localExtra, centralExtra }]);
      expect(inspectZipArchive(fixture.data, zipBounds)).toEqual({
        entries: [{ path: "root/file", type: "file", size: content.length, mode: 0o751, link: null, content }],
        bytes: content.length, members: 1, metadataBytes: 125 + localExtra.length + centralExtra.length,
      });
    }
  }
});

test("ZIP counts both encoded extra blocks in metadata and permits either block to be absent", () => {
  const item = { path: "root/file", content: "hello" };
  const baseline = zip([item]), baseMetadata = baseline.data.length - 5 + item.path.length;
  const localExtra = Buffer.concat([timestampExtra(7, true), unixExtra()]);
  const centralExtra = Buffer.concat([timestampExtra(7, false), unixExtra()]);
  for (const extras of [{ localExtra }, { centralExtra }, { localExtra, centralExtra }]) {
    const encoded = (extras.localExtra?.length ?? 0) + (extras.centralExtra?.length ?? 0);
    const fixture = zip([{ ...item, ...extras }]);
    expect(inspectZipArchive(fixture.data, { ...zipBounds, maxMetadataBytes: baseMetadata + encoded }))
      .toEqual({ ...inspectZipArchive(baseline.data, zipBounds), metadataBytes: baseMetadata + encoded });
    rejects(() => inspectZipArchive(fixture.data, { ...zipBounds, maxMetadataBytes: baseMetadata + encoded - 1 }));
  }
  rejects(() => inspectZipArchive(zip([{ ...item, localExtra, centralExtra }]).data,
    { ...zipBounds, maxMetadataBytes: baseMetadata + Math.max(localExtra.length, centralExtra.length) }));
});

test("ZIP rejects unknown, duplicated, truncated and gapped extra TLVs in either block", () => {
  for (const area of ["localExtra", "centralExtra"]) {
    const timestamp = timestampExtra(7, area === "localExtra"), owner = unixExtra();
    const overrun = Buffer.from(timestamp);
    overrun.writeUInt16LE(timestamp.length - 3, 2);
    const malformed = [
      Buffer.alloc(1), Buffer.from([0x55, 0x54, 0]), timestamp.subarray(0, -1), overrun,
      Buffer.concat([timestamp, timestamp]), Buffer.concat([owner, owner]),
      Buffer.concat([timestamp, owner, timestamp]), Buffer.concat([timestamp, Buffer.alloc(1)]),
      Buffer.concat([timestamp, Buffer.alloc(4)]),
      ...[0x0001, 0x9901, 0x7075, 0x6375, 0x9999].map((id) => zipExtra(id, Buffer.alloc(0))),
      Buffer.concat([owner, zipExtra(0x9999, Buffer.alloc(0))]),
    ];
    for (const extra of malformed) rejects(() => inspectZipArchive(zip([{ path: "root/file", [area]: extra }]).data, zipBounds));
  }
});

test("ZIP timestamp extras enforce local popcounts and central mtime-only lengths", () => {
  for (const area of ["localExtra", "centralExtra"]) {
    const invalidLengths = area === "localExtra"
      ? [[0, 1], [0, 4], [1, 0], [1, 3], [1, 5], [7, 4], [7, 8], [3, 4], [2, 0]]
      : [[0, 4], [1, 0], [1, 3], [1, 8], [7, 12], [6, 4], [2, 4]];
    const invalid = [Buffer.alloc(0), Buffer.from([8]), Buffer.from([255]),
      ...invalidLengths.map(([flags, length]) => Buffer.concat([Buffer.from([flags]), Buffer.alloc(length)]))];
    for (const content of invalid) rejects(() => inspectZipArchive(zip([{ path: "root/file", [area]: zipExtra(0x5455, content) }]).data, zipBounds));
  }
});

test("ZIP new Unix extras require version one and exact one-to-eight-byte UID/GID fields", () => {
  const invalid = [
    ...[[], [1], [1, 1], [1, 1, 7], [1, 2, 7], [1, 1, 7, 1], [1, 1, 7, 1, 8, 0]]
      .map((value) => zipExtra(0x7875, Buffer.from(value))),
    unixExtra(undefined, undefined, 0), unixExtra(undefined, undefined, 2),
    unixExtra(Buffer.alloc(0)), unixExtra(Buffer.alloc(9)),
    unixExtra(undefined, Buffer.alloc(0)), unixExtra(undefined, Buffer.alloc(9)),
  ];
  for (const area of ["localExtra", "centralExtra"]) {
    for (const extra of invalid) rejects(() => inspectZipArchive(zip([{ path: "root/file", [area]: extra }]).data, zipBounds));
  }
});

test("ZIP extra blocks cannot overrun outer records, create gaps or loosen entry validation", () => {
  const localExtra = timestampExtra(7, true), centralExtra = timestampExtra(7, false);
  for (const [area, field, size] of [["local", 28, localExtra.length], ["central", 30, centralExtra.length]]) {
    for (const length of [0, 1, size - 1, 65535]) {
      const fixture = zip([{ path: "root/file", content: "hello", localExtra, centralExtra }]);
      fixture.data.writeUInt16LE(length, fixture.locations[0][area] + field);
      rejects(() => inspectZipArchive(fixture.data, zipBounds));
    }
  }
  for (const item of [{ path: "root/../escape" }, { path: "root/file", mode: 0o104755 }, { path: "root/file", mode: 0o120777 }]) {
    rejects(() => inspectZipArchive(zip([{ ...item, localExtra, centralExtra }]).data, zipBounds));
  }
  const mismatch = zip([{ path: "root/file", localExtra, centralExtra }]);
  mismatch.data[mismatch.locations[0].local + 30] = 65;
  rejects(() => inspectZipArchive(mismatch.data, zipBounds));
});

test("ZIP metadata preserves CRC, descriptor and overlapping-body boundaries", () => {
  const extras = { localExtra: Buffer.concat([timestampExtra(7, true), unixExtra()]), centralExtra: timestampExtra(7, false) };
  for (const method of [0, 8]) {
    for (const descriptor of [false, true, "unsigned"]) {
      const fixture = zip([{ path: "root/file", content: "hello", method, descriptor, ...extras }]);
      expect(inspectZipArchive(fixture.data, zipBounds).entries[0].content).toEqual(Buffer.from("hello"));
      fixture.data[fixture.locations[0].body + (method === 8 ? 5 : 0)] ^= 1;
      rejects(() => inspectZipArchive(fixture.data, zipBounds));
      if (descriptor) {
        const bad = zip([{ path: "root/file", content: "hello", method, descriptor, ...extras }]);
        bad.data[bad.locations[0].descriptor + (descriptor === true ? 4 : 0)] ^= 1;
        rejects(() => inspectZipArchive(bad.data, zipBounds));
      }
    }
  }
  const overlap = zip([{ path: "root/a", content: "a", ...extras }, { path: "root/b", content: "b", ...extras }]);
  for (const [area, field] of [["local", 18], ["local", 22], ["central", 20], ["central", 24]]) {
    overlap.data.writeUInt32LE(2, overlap.locations[0][area] + field);
  }
  rejects(() => inspectZipArchive(overlap.data, zipBounds));
});

test("ZIP rejects malformed EOCD, comments, tail data, split disks and ZIP64", () => {
  for (const length of [0, 1, 21, 30, zip().data.length - 1]) rejects(() => inspectZipArchive(zip().data.subarray(0, length), zipBounds));
  rejects(() => inspectZipArchive(Buffer.concat([zip().data, Buffer.from([0])]), zipBounds));
  for (const [relative, value, width] of [[4, 1, 2], [6, 1, 2], [8, 2, 2], [10, 0xffff, 2], [12, 0xffffffff, 4], [16, 0xffffffff, 4], [20, 1, 2]]) {
    const fixture = zip();
    fixture.data[`writeUInt${width * 8}LE`](value, fixture.end + relative);
    rejects(() => inspectZipArchive(fixture.data, zipBounds));
  }
  const longComment = zip(undefined, Buffer.alloc(65535, 65));
  expect(inspectZipArchive(longComment.data, zipBounds).members).toBe(1);
});

test("ZIP rejects local/central disagreements, encryption, malformed extras and unknown compression", () => {
  for (const [area, relative, value, width] of [
    ["local", 0, 0, 4], ["central", 0, 0, 4], ["local", 4, 45, 2], ["central", 6, 45, 2],
    ["local", 6, 0x801, 2], ["central", 8, 0x801, 2], ["local", 8, 8, 2], ["central", 10, 99, 2],
    ["local", 14, 1, 4], ["local", 18, 1, 4], ["local", 22, 1, 4], ["local", 26, 1, 2],
    ["local", 28, 1, 2], ["central", 30, 1, 2], ["central", 34, 1, 2],
    ["central", 20, 0xffffffff, 4], ["central", 24, 0xffffffff, 4], ["central", 42, 0xffffffff, 4],
  ]) {
    const fixture = zip();
    fixture.data[`writeUInt${width * 8}LE`](value, fixture.locations[0][area] + relative);
    rejects(() => inspectZipArchive(fixture.data, zipBounds));
  }
  const mismatch = zip();
  mismatch.data[mismatch.locations[0].local + 30 + 5] = 65;
  rejects(() => inspectZipArchive(mismatch.data, zipBounds));
  const encrypted = zip();
  encrypted.data.writeUInt16LE(0x801, encrypted.locations[0].local + 6);
  encrypted.data.writeUInt16LE(0x801, encrypted.locations[0].central + 8);
  rejects(() => inspectZipArchive(encrypted.data, zipBounds));
  const incompatible = zip([{ path: "root/file", content: "hello", method: 8 }]);
  incompatible.data.writeUInt16LE(10, incompatible.locations[0].local + 4);
  incompatible.data.writeUInt16LE(10, incompatible.locations[0].central + 6);
  rejects(() => inspectZipArchive(incompatible.data, zipBounds));
});

test("ZIP rejects unsafe paths, invalid UTF-8, Unix links, special and privileged modes", () => {
  for (const path of ["/root/a", "../root/a", "root/../a", "root/./a", "root//a", "./root/a", "other/file", "root/uri:x", "root/a\\b", "root/a\nb", "root/a\n", "root/a\u2028", `root/${"a".repeat(1020)}`]) {
    rejects(() => inspectZipArchive(zip([{ path }]).data, zipBounds));
  }
  for (const mode of [0o120777, 0o020600, 0o010600, 0o060600, 0o140600, 0o104755, 0o102755, 0o101755, 0o040755]) {
    rejects(() => inspectZipArchive(zip([{ path: "root/file", mode }]).data, zipBounds));
  }
  rejects(() => inspectZipArchive(zip([{ path: "root/dir/", mode: 0o100755 }]).data, zipBounds));
  rejects(() => inspectZipArchive(zip([{ path: "root/dir/", content: "data" }]).data, zipBounds));
  const invalid = zip();
  invalid.data[invalid.locations[0].local + 30] = 255;
  invalid.data[invalid.locations[0].central + 46] = 255;
  rejects(() => inspectZipArchive(invalid.data, zipBounds));
});

test("ZIP rejects duplicate paths, ancestor conflicts, overlapping records and excess records", () => {
  rejects(() => inspectZipArchive(zip([{ path: "root/file" }, { path: "root/file" }]).data, zipBounds));
  for (const items of [[{ path: "root/a" }, { path: "root/a/b" }], [{ path: "root/a/b" }, { path: "root/a" }]]) {
    rejects(() => inspectZipArchive(zip(items).data, zipBounds));
  }
  const overlap = zip([{ path: "root/a", content: "a" }, { path: "root/b", content: "b" }]);
  overlap.data.writeUInt32LE(2, overlap.locations[0].local + 18);
  overlap.data.writeUInt32LE(2, overlap.locations[0].local + 22);
  overlap.data.writeUInt32LE(2, overlap.locations[0].central + 20);
  overlap.data.writeUInt32LE(2, overlap.locations[0].central + 24);
  rejects(() => inspectZipArchive(overlap.data, zipBounds));
  const centralOverlap = zip();
  centralOverlap.data.writeUInt32LE(1000, centralOverlap.locations[0].local + 18);
  centralOverlap.data.writeUInt32LE(1000, centralOverlap.locations[0].local + 22);
  centralOverlap.data.writeUInt32LE(1000, centralOverlap.locations[0].central + 20);
  centralOverlap.data.writeUInt32LE(1000, centralOverlap.locations[0].central + 24);
  rejects(() => inspectZipArchive(centralOverlap.data, zipBounds));
  const extra = zip([{ path: "root/a" }, { path: "root/b" }]);
  extra.data.writeUInt16LE(1, extra.end + 8);
  extra.data.writeUInt16LE(1, extra.end + 10);
  rejects(() => inspectZipArchive(extra.data, zipBounds));
});

test("ZIP enforces CRC, exact expansion, compression consumption and software caps", () => {
  for (const method of [0, 8]) {
    const fixture = zip([{ path: "root/file", content: "hello", method }]);
    fixture.data[fixture.locations[0].body + (method === 8 ? 5 : 0)] ^= 1;
    rejects(() => inspectZipArchive(fixture.data, zipBounds));
  }
  for (const size of [1, 4, 6]) {
    const fixture = zip([{ path: "root/file", content: "hello", method: 8 }]);
    fixture.data.writeUInt32LE(size, fixture.locations[0].local + 22);
    fixture.data.writeUInt32LE(size, fixture.locations[0].central + 24);
    rejects(() => inspectZipArchive(fixture.data, zipBounds));
  }
  const content = Buffer.from("hello");
  for (const payload of [Buffer.from([255]), Buffer.concat([deflateStored(content), Buffer.from([0])])]) {
    rejects(() => inspectZipArchive(zip([{ path: "root/file", content, method: 8, payload }]).data, zipBounds));
  }
  for (const options of [{ maxBytes: 4 }, { maxEntryBytes: 4 }, { maxMetadataBytes: 1 }]) {
    rejects(() => inspectZipArchive(zip().data, { ...zipBounds, ...options }));
  }
  rejects(() => inspectZipArchive(zip([{ path: "root/a", content: "aaa" }, { path: "root/b", content: "bbb" }]).data, { ...zipBounds, maxBytes: 5 }));
  rejects(() => inspectZipArchive(zip([{ path: "root/a" }, { path: "root/b" }]).data, { ...zipBounds, maxMembers: 1 }));
  rejects(() => inspectZipArchive("not bytes", zipBounds));
});
