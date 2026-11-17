// SPEC: _spec/runtime-protocol.puml
import { describe, expect, test, spyOn } from "bun:test";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as https from "node:https";
import * as childProcess from "node:child_process";
import { resolve, dirname } from "node:path";
import { gzipSync } from "node:zlib";
import { claimFresh, download, inspectVerifiedArchive, JSSHA, mapInputRows, validateRow, verifyJsshaExport, verifyReference } from "./reference-retry.ts";
import type { Transport } from "./reference-retry.ts";

const ROOT = resolve(import.meta.dir, "../.."), SCRATCH = resolve(ROOT, "artifacts/training-functional/scratch");
const REF = "b4b241481fb12de4a7344e6dba8eda775af57675", MIB = 1048576;
const hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const encode = (v: unknown) => Buffer.from(JSON.stringify(v));
type Row = Parameters<typeof validateRow>[1];
function fixture() { return fs.mkdtempSync(resolve(SCRATCH, "reference-retry-unit-")); }
function put(root: string, path: string, b: Uint8Array, mode = 0o644) { const dest = resolve(root, path); fs.mkdirSync(dirname(dest), { recursive: true }); fs.writeFileSync(dest, b, { flag: "wx", mode }); return dest; }
function row(path = "a.ts", b = Buffer.from("synthetic source")): Row { return { path, bytes: b.length, sha256: hash(b), sourceMode: "100644", gitBlobOid: createHash("sha1").update(`blob ${b.length}\0`).update(b).digest("hex") }; }
function inputs() { const r = row(); return { m: { reference: REF, sourceRoot: "ignored-historical-root", entries: [{ path: r.path, expectedBytes: r.bytes, sourceMode: r.sourceMode, gitBlobOid: r.gitBlobOid }] }, t: { reference: REF, inputManifestSha256: "synthetic", files: [r] } }; }
function tar(files: [string, Buffer][]): Buffer {
  const blocks: Buffer[] = [];
  for (const [name, bytes] of files) {
    const header = Buffer.alloc(512); header.write(name, 0, 100);
    for (const [offset, length, n] of [[100, 8, 0o644], [108, 8, 0], [116, 8, 0], [124, 12, bytes.length], [136, 12, 0]]) header.write(n!.toString(8).padStart(length! - 1, "0") + "\0", offset!, length!);
    header.fill(32, 148, 156); header[156] = 48; header.write("ustar\0" + "00", 257, 8);
    header.write(header.reduce((n, b) => n + b, 0).toString(8).padStart(6, "0") + "\0 ", 148, 8);
    blocks.push(header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512));
  }
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}
function archive(extra: [string, Buffer][] = []) {
  const bytes = tar([["package/package.json", encode({ name: "jssha", version: "3.3.2", exports: { "./sha256": { import: { types: "./dist/sha256.d.mts", default: "./dist/sha256.mjs" } } } })], ["package/dist/sha256.mjs", Buffer.from("synthetic unexecuted text")], ...extra]);
  return { bytes, spec: { ...JSSHA, integrity: "sha512-" + createHash("sha512").update(bytes).digest("base64") } };
}
function transport(chunks: Uint8Array[], status = 200, encoding?: string) {
  let calls = 0, signal: AbortSignal | undefined;
  const send: Transport = async s => { calls++; signal = s; return { status, encoding, body: (async function* () { yield* chunks; })() }; };
  return { send, calls: () => calls, signal: () => signal };
}
function referenceFixture(omitFirstOutput = false) {
  const root = fixture(), source = resolve(root, "source"), bundles = resolve(root, "bundles");
  const entries = ["challenge/admission.ts", "challenge/corpus.ts", "challenge/r3Session.ts", "players/strategic.ts", "run/bank.ts"].map(p => `packages/starchess-arena/src/${p}`).concat("packages/starchess-core/src/index.ts");
  const input = Buffer.from("synthetic input text"), output = Buffer.from("synthetic output text"); put(source, "input.ts", input);
  const inventory = entries.map((entry, index) => { if (!omitFirstOutput || index !== 0) put(bundles, entry, output); return { entry, inputs: [{ path: "input.ts", byteLength: input.length, sha256: hash(input) }], output: { path: entry, byteLength: output.length, sha256: hash(output) } }; });
  return { source, bundles, doc: { version: "chess-coach.reference-bundles.v1", reference: REF, bunVersion: "1.4.0", inventory } };
}

test("preserves the failed driver flow except fresh paths, the new inspector, and nested export selection", () => {
  const original = fs.readFileSync(resolve(import.meta.dir, "reference-prep.ts"), "utf8"), current = fs.readFileSync(resolve(import.meta.dir, "reference-retry.ts"), "utf8");
  const expected = original.replace('from "../../_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source2/capture.ts";', 'from "./jssha-archive.ts";').replaceAll("artifacts/training-functional/scratch/reference-prep-1", "artifacts/training-functional/scratch/reference-prep-2").replaceAll("artifacts/training-functional/reference-prep-1", "artifacts/training-functional/reference-prep-2");
  const start = current.indexOf("export function verifyJsshaExport("), end = current.indexOf("function assemble()", start);
  const actual = (current.slice(0, start) + current.slice(end)).replace("  verifyJsshaExport(jssha.exports);", '  check((jssha.exports?.["./sha256"] as { import?: unknown } | undefined)?.import === "./dist/sha256.mjs", "jssha-sha256-export");');
  expect(actual).toBe(expected);
});

describe("import and fresh claims", () => {
  test("import spawns nothing, builds nothing, and makes no network request", async () => {
    const forbidden = () => { throw new Error("forbidden import side effect"); };
    const spies = [spyOn(Bun, "spawn").mockImplementation(forbidden), spyOn(Bun, "spawnSync").mockImplementation(forbidden), spyOn(Bun, "build").mockImplementation(forbidden), spyOn(https, "request").mockImplementation(forbidden), spyOn(childProcess, "spawn").mockImplementation(forbidden), spyOn(globalThis, "fetch").mockImplementation(Object.assign(forbidden, { preconnect: forbidden }))];
    try { const path = "./reference-retry.ts?synthetic-import-only"; await import(path); for (const spy of spies) expect(spy).not.toHaveBeenCalled(); }
    finally { for (const spy of spies) spy.mockRestore(); }
  });
  test("fresh claim persists an exclusive attempt before other work", () => {
    const root = resolve(fixture(), "operation"), claim = claimFresh(root); expect(fs.readdirSync(root)).toEqual(["attempt.json"]); expect(JSON.parse(fs.readFileSync(resolve(root, "attempt.json"), "utf8"))).toEqual(claim); expect(claim.automaticRetry).toBe(false);
  });
  test("reuse fails and preserves a partial file and the original claim", () => {
    const root = resolve(fixture(), "operation"), claim = claimFresh(root); put(root, "partial", Buffer.from("preserve")); expect(() => claimFresh(root)).toThrow(); expect(fs.readFileSync(resolve(root, "partial"), "utf8")).toBe("preserve"); expect(JSON.parse(fs.readFileSync(resolve(root, "attempt.json"), "utf8"))).toEqual(claim);
  });
  test("existing empty roots cannot be adopted", () => { const root = fixture(); expect(() => claimFresh(root)).toThrow(); expect(fs.readdirSync(root)).toEqual([]); });
  test("symlink parents cannot be claimed through", () => { const root = fixture(); fs.symlinkSync(root, resolve(root, "link")); expect(() => claimFresh(resolve(root, "link/op"))).toThrow("unsafe-parent"); });
});

describe("synthetic one-GET transport", () => {
  test("one call streams exact bytes and aborts its transport after completion", async () => {
    const t = transport([Buffer.from("one"), Buffer.from("two")]), written: Buffer[] = [];
    expect((await download(t.send, b => written.push(b))).toString()).toBe("onetwo"); expect(Buffer.concat(written).toString()).toBe("onetwo"); expect(t.calls()).toBe(1); expect(t.signal()?.aborted).toBe(true);
  });
  test.each([301, 302, 307, 308, 404, 500])("status %s never redirects or retries", async status => {
    const t = transport([Buffer.from("unread")], status); let written = 0; await expect(download(t.send, () => written++)).rejects.toThrow("http-status-no-redirect"); expect(written).toBe(0); expect(t.calls()).toBe(1); expect(t.signal()?.aborted).toBe(true);
  });
  test("rejects transport encodings", async () => { const t = transport([], 200, "gzip"); await expect(download(t.send, () => {})).rejects.toThrow("http-encoding"); });
  test("accepts the exact 2 MiB compressed bound", async () => { const t = transport([Buffer.alloc(2 * MIB)]); expect((await download(t.send, () => {})).length).toBe(2 * MIB); });
  test("caps the streamed bytes before writing an overbound chunk", async () => {
    const t = transport([Buffer.from("partial"), Buffer.alloc(2 * MIB)]), saved: Buffer[] = []; await expect(download(t.send, b => saved.push(b))).rejects.toThrow("stream-bound-or-abort"); expect(Buffer.concat(saved).toString()).toBe("partial"); expect(t.calls()).toBe(1); expect(t.signal()?.aborted).toBe(true);
  });
  test("preserves on-disk partial bytes after a synthetic stream failure", async () => {
    const root = fixture(), path = put(root, "partial.tgz", Buffer.alloc(0)), fd = fs.openSync(path, "a");
    const send: Transport = async () => ({ status: 200, body: (async function* () { yield Buffer.from("partial"); throw new Error("synthetic failure"); })() });
    try { await expect(download(send, b => fs.writeFileSync(fd, b))).rejects.toThrow("synthetic failure"); } finally { fs.closeSync(fd); }
    expect(fs.readFileSync(path, "utf8")).toBe("partial");
  });
  test("absolute deadline aborts a stalled response without another GET", async () => {
    let signal: AbortSignal | undefined, calls = 0; const send: Transport = s => { signal = s; calls++; return new Promise(() => {}); };
    await expect(download(send, () => {}, 10)).rejects.toThrow("get-deadline"); expect(calls).toBe(1); expect(signal?.aborted).toBe(true);
  });
  test("absolute deadline also covers a stalled body", async () => {
    let signal: AbortSignal | undefined; const send: Transport = async s => { signal = s; return { status: 200, body: { [Symbol.asyncIterator]: () => ({ next: () => new Promise(() => {}) }) } }; };
    await expect(download(send, () => {}, 10)).rejects.toThrow("get-deadline"); expect(signal?.aborted).toBe(true);
  });
  test.each([0, -1, 30001, Infinity, NaN])("invalid duration %s invokes no transport", async ms => { const t = transport([]); await expect(download(t.send, () => {}, ms)).rejects.toThrow("get-duration"); expect(t.calls()).toBe(0); });
});

describe("read-only nested jssha export selection", () => {
  test("selects the exact original conditional import default without changing the manifest", () => {
    const exports = { "./sha256": { import: { types: "./dist/sha256.d.mts", default: "./dist/sha256.mjs" }, require: { types: "./dist/sha256.d.cts", default: "./dist/sha256.js" } } }, before = JSON.stringify(exports);
    expect(verifyJsshaExport(exports)).toBe("./dist/sha256.mjs"); expect(JSON.stringify(exports)).toBe(before);
  });
  test.each([undefined, {}, { "./sha256": null }, { "./sha256": { import: null } }, { "./sha256": { import: "./dist/sha256.mjs" } },
    { "./sha256": { import: { default: "./dist/sha256.js" } } }, { "./sha256": { require: { default: "./dist/sha256.mjs" } } },
    { "./sha256": { import: { types: "./dist/sha256.mjs" } } }, { "./sha256": { import: { default: "../dist/sha256.mjs" } } }])("rejects a missing or different runtime selection %j", exports => {
    expect(() => verifyJsshaExport(exports)).toThrow("jssha-sha256-export");
  });
});

describe("new verified archive inspector", () => {
  test("checks SRI before touching invalid gzip bytes", () => { expect(() => inspectVerifiedArchive(Buffer.from("not gzip"), JSSHA)).toThrow("sri-before-inflate"); });
  test("matching SRI reaches the gzip check", () => { const bytes = Buffer.from("not gzip"), spec = { ...JSSHA, integrity: "sha512-" + createHash("sha512").update(bytes).digest("base64") }; expect(() => inspectVerifiedArchive(bytes, spec)).toThrow("gzip-invalid-or-expanded-cap"); });
  test("selects only required members and one preferred exact license", () => {
    const license = Buffer.from("preserved LICENSE\n"), a = archive([["package/LICENSE.txt", Buffer.from("txt")], ["package/LICENSE.md", Buffer.from("md")], ["package/LICENSE", license], ["package/unselected.js", Buffer.from("never retained")]]), selected = inspectVerifiedArchive(a.bytes, a.spec);
    expect(selected.files.map(f => f.member)).toEqual(["package/package.json", "package/dist/sha256.mjs", "package/LICENSE"]); expect(selected.files[2]!.data.equals(license)).toBe(true); expect(selected.legalClearance).toBe(false);
  });
  test("records license absence without synthesizing a file", () => { const a = archive(), selected = inspectVerifiedArchive(a.bytes, a.spec); expect(selected.licenseMember).toBeNull(); expect(selected.files).toHaveLength(2); });
  test("rejects duplicate selected members", () => { const a = archive([["package/dist/sha256.mjs", Buffer.from("duplicate")]]); expect(() => inspectVerifiedArchive(a.bytes, a.spec)).toThrow(); });
  test("bounds all expanded content, including skipped members", () => { const a = archive([["package/skipped", Buffer.alloc(8 * MIB)]]); expect(() => inspectVerifiedArchive(a.bytes, a.spec)).toThrow("gzip-invalid-or-expanded-cap"); });
  test("bounds all physical headers, including skipped members", () => { const a = archive(Array.from({ length: 255 }, (_, i) => [`package/skipped-${i}`, Buffer.alloc(0)])); expect(() => inspectVerifiedArchive(a.bytes, a.spec)).toThrow("physical-header-cap"); });
});

describe("pinned source mapping", () => {
  test("maps application entries without using historical gitRoot", () => { const { m, t } = inputs(); expect(mapInputRows({ ...m, gitRoot: "/not-used" } as typeof m, t, 1, t.files[0]!.bytes)).toEqual(t.files); });
  test("maps corpus bytes/mode entries", () => { const r = row(), m = { reference: REF, sourceRoot: "unused", entries: [{ path: r.path, bytes: r.bytes, mode: r.sourceMode, gitBlobOid: r.gitBlobOid }] }; expect(mapInputRows(m, { reference: REF, inputManifestSha256: "unused", files: [r] }, 1, r.bytes)).toEqual([r]); });
  test.each(["reference", "material-reference", "size", "mode", "blob", "hash", "missing", "extra", "duplicate", "path", "total"])("rejects %s mismatches", kind => {
    const { m, t } = inputs(); let count = 1, total = t.files[0]!.bytes;
    if (kind === "reference") m.reference = "wrong"; if (kind === "material-reference") t.reference = "wrong";
    if (kind === "size") m.entries[0]!.expectedBytes++; if (kind === "mode") m.entries[0]!.sourceMode = "120000"; if (kind === "blob") m.entries[0]!.gitBlobOid = "0".repeat(40); if (kind === "hash") t.files[0]!.sha256 = "invalid";
    if (kind === "missing") t.files[0]!.path = "other.ts"; if (kind === "extra") t.files.push(row("extra.ts"));
    if (kind === "duplicate") { count = 2; total *= 2; m.entries.push({ ...m.entries[0]! }); t.files.push({ ...t.files[0]! }); }
    if (kind === "path") { m.entries[0]!.path = "../escape"; t.files[0]!.path = "../escape"; } if (kind === "total") total++;
    expect(() => mapInputRows(m, t, count, total)).toThrow();
  });
  test("rehashes actual regular file bytes, mode, SHA256 and Git blob", () => { const root = fixture(), b = Buffer.from("synthetic source"), r = row(); put(root, r.path, b); expect(validateRow(root, r).equals(b)).toBe(true); });
  test("rejects changed source bytes", () => { const root = fixture(), r = row(); put(root, r.path, Buffer.from("wrong same size")); expect(() => validateRow(root, r)).toThrow("source-hash-mode"); });
  test("rejects an incorrect recorded Git blob", () => { const root = fixture(), r = row(); put(root, r.path, Buffer.from("synthetic source")); expect(() => validateRow(root, { ...r, gitBlobOid: "0".repeat(40) })).toThrow("source-git-blob"); });
  test("rejects incorrect file modes", () => { const root = fixture(), r = row(), path = put(root, r.path, Buffer.from("synthetic source")); fs.chmodSync(path, 0o755); expect(() => validateRow(root, r)).toThrow("source-hash-mode"); });
  test("preserves an executable source mode", () => { const root = fixture(), r = { ...row(), sourceMode: "100755" }; put(root, r.path, Buffer.from("synthetic source"), 0o755); expect(validateRow(root, r).length).toBe(r.bytes); });
  test("rejects hardlinked assembled source files", () => { const root = fixture(), r = row(), path = put(root, r.path, Buffer.from("synthetic source")); fs.linkSync(path, resolve(root, "second-link")); expect(() => validateRow(root, r)).toThrow("regular-file-bound"); });
  test("rejects symlink files and symlink ancestors", () => { const root = fixture(), r = row(), path = put(root, "real", Buffer.from("synthetic source")); fs.symlinkSync(path, resolve(root, r.path)); expect(() => validateRow(root, r)).toThrow(); fs.symlinkSync(root, resolve(root, "link")); expect(() => validateRow(resolve(root, "link"), { ...r, path: "real" })).toThrow("unsafe-parent"); });
});

describe("six-output read-only verification", () => {
  test("accepts six synthetic inventories without evaluating any source", () => { const f = referenceFixture(); expect(verifyReference(f.source, f.bundles, encode(f.doc)).inventory).toHaveLength(6); });
  test("bounds reference metadata before parsing", () => { const f = referenceFixture(); expect(() => verifyReference(f.source, f.bundles, Buffer.alloc(MIB + 1))).toThrow("reference-metadata-bound"); });
  test.each(["five", "seven", "duplicate-entry", "reference", "bun", "version", "output-path", "output-hash", "output-size", "input-hash", "input-size", "input-path", "duplicate-input", "empty-input"])("rejects %s", kind => {
    const f = referenceFixture(), first = f.doc.inventory[0]!;
    if (kind === "five") f.doc.inventory.pop(); if (kind === "seven") f.doc.inventory.push(structuredClone(first)); if (kind === "duplicate-entry") f.doc.inventory[1]!.entry = first.entry;
    if (kind === "reference") f.doc.reference = "wrong"; if (kind === "bun") f.doc.bunVersion = "0.0.0"; if (kind === "version") f.doc.version = "wrong";
    if (kind === "output-path") first.output.path = "../escape"; if (kind === "output-hash") first.output.sha256 = "0".repeat(64); if (kind === "output-size") first.output.byteLength++;
    if (kind === "input-hash") first.inputs[0]!.sha256 = "0".repeat(64); if (kind === "input-size") first.inputs[0]!.byteLength++; if (kind === "input-path") first.inputs[0]!.path = "../escape";
    if (kind === "duplicate-input") first.inputs.push({ ...first.inputs[0]! }); if (kind === "empty-input") first.inputs = [];
    expect(() => verifyReference(f.source, f.bundles, encode(f.doc))).toThrow();
  });
  test("rejects a missing output without creating it", () => { const f = referenceFixture(true), path = resolve(f.bundles, f.doc.inventory[0]!.entry); expect(() => verifyReference(f.source, f.bundles, encode(f.doc))).toThrow(); expect(fs.existsSync(path)).toBe(false); });
  test("rejects an absent declared input", () => { const f = referenceFixture(); f.doc.inventory[0]!.inputs[0]!.path = "missing.ts"; expect(() => verifyReference(f.source, f.bundles, encode(f.doc))).toThrow(); });
  test("rejects a symlink declared input even inside source", () => { const f = referenceFixture(); fs.symlinkSync("input.ts", resolve(f.source, "linked.ts")); f.doc.inventory[0]!.inputs[0]!.path = "linked.ts"; expect(() => verifyReference(f.source, f.bundles, encode(f.doc))).toThrow(); });
});
