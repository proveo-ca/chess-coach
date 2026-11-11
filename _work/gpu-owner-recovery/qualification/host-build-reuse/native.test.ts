// SPEC: _spec/gpu-host-build-reuse.puml
import { beforeAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { nativeCommands } from "../host-build/driver";
import { afterWrite, beforeWrite, nativePath } from "../policy-record-fix/correction";
import { applyRecordOverlay, type OverlayIO } from "./native";
import { reusePlan, type ReusePlan } from "./plan";

type Inventory = { path: string; sha256: string }[];
const sourcePath = "/build/native/" + nativePath, manifestPath = "/build/native/qualification/source-manifest.json";
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
let plan: ReusePlan, original: Inventory, previous: string, oldManifest: string, source: string;

beforeAll(async () => {
  plan = await reusePlan();
  const prepared = JSON.parse(await readFile(new URL("../../runs/host-feasibility-inputs-1/preparation.json", import.meta.url), "utf8"));
  original = prepared.nativeSourceInventory;
  oldManifest = JSON.stringify(original, null, 2) + "\n";
  previous = await readFile(new URL("../../runs/host-gpu-policy-record-correction-source-2/baseline-source/command.stdout", import.meta.url), "utf8");
  source = await readFile(new URL("./native.ts", import.meta.url), "utf8");
  expect(hash(oldManifest)).toBe(plan.previousSourceManifestSha256);
  expect(hash(previous)).toBe(plan.overlay.previousSha256);
});

function fixture() {
  const p = structuredClone(plan), files = new Map([[sourcePath, previous], [manifestPath, oldManifest]]);
  const writes: { path: string; text: string }[] = [], attempts: { path: string; text: string }[] = [], reads: string[] = [], events: string[] = [];
  let inventoryCalls = 0;
  const io: OverlayIO = {
    async read(path) {
      reads.push(path); events.push("read:" + path);
      if (!files.has(path)) throw Error("UNEXPECTED_MOCK_READ:" + path);
      return Buffer.from(files.get(path)!);
    },
    async write(path, text) {
      attempts.push({ path, text }); events.push("write:" + path);
      if (path !== sourcePath && path !== manifestPath) throw Error("UNEXPECTED_MOCK_WRITE:" + path);
      files.set(path, text); writes.push({ path, text });
    },
    async inventory() {
      inventoryCalls++; events.push("inventory");
      return original.map(row => ({ ...row, sha256: row.path === nativePath ? hash(files.get(sourcePath)!) : row.sha256 }));
    },
  };
  return { p, files, writes, attempts, reads, events, io, inventoryCalls: () => inventoryCalls };
}

function bindManifest(p: ReusePlan, rows: Inventory) {
  p.correctedManifest.utf8 = JSON.stringify(rows, null, 2) + "\n";
  p.correctedManifest.sha256 = hash(p.correctedManifest.utf8);
  p.sourceManifestSha256 = p.correctedManifest.sha256;
}

function bindCorrectedText(p: ReusePlan, text: string) {
  p.overlay.correctedUtf8 = text; p.overlay.correctedSha256 = hash(text);
  bindManifest(p, original.map(row => ({ ...row, sha256: row.path === nativePath ? p.overlay.correctedSha256 : row.sha256 })));
}

test("the pure overlay writes only the fresh gpu source and manifest, then returns a new verified native65 array", async () => {
  const f = fixture(), expected: Inventory = JSON.parse(f.p.correctedManifest.utf8);
  const result = await applyRecordOverlay(f.p, f.io);
  expect(result).toEqual(expected); expect(result).not.toBe(original);
  expect(result).toHaveLength(65); expect(f.inventoryCalls()).toBe(2);
  expect(f.writes).toEqual([{ path: sourcePath, text: f.p.overlay.correctedUtf8 }, { path: manifestPath, text: f.p.correctedManifest.utf8 }]);
  expect(f.attempts).toEqual(f.writes);
  expect(f.reads).toEqual([manifestPath, sourcePath, manifestPath]);
  expect(f.events).toEqual(["read:" + manifestPath, "inventory", "read:" + sourcePath, "write:" + sourcePath, "write:" + manifestPath, "inventory", "read:" + manifestPath]);
  expect(hash(f.files.get(manifestPath)!)).toBe(f.p.sourceManifestSha256);
  expect(original.find(row => row.path === nativePath)!.sha256).toBe(plan.overlay.previousSha256);
});

test("changed old manifests and incomplete, reordered or changed initial inventories fail before writes", async () => {
  const mutations: ((f: ReturnType<typeof fixture>) => void)[] = [
    f => { f.files.set(manifestPath, oldManifest + "\n"); },
    f => { f.io.inventory = async () => original.slice(1); },
    f => { f.io.inventory = async () => [...original].reverse(); },
    f => { f.io.inventory = async () => original.map((row, index) => index === 0 ? { ...row, sha256: "0".repeat(64) } : { ...row }); },
  ];
  for (const mutate of mutations) {
    const f = fixture(); mutate(f);
    await expect(applyRecordOverlay(f.p, f.io)).rejects.toThrow("ORIGINAL_STAGED_NATIVE_GENERATION_REQUIRED");
    expect(f.attempts).toEqual([]);
  }
});

test("a changed old gpu source fails its own binding without touching the manifest or source", async () => {
  const f = fixture(); f.files.set(sourcePath, previous + "\n");
  f.io.inventory = async () => structuredClone(original);
  await expect(applyRecordOverlay(f.p, f.io)).rejects.toThrow("ORIGINAL_GPU_RECORD_SOURCE_REQUIRED");
  expect(f.attempts).toEqual([]); expect(f.files.get(manifestPath)).toBe(oldManifest);
});

test("every corrected UTF-8, overlay digest, manifest digest and plan-generation mismatch fails closed", async () => {
  const mutations: ((p: ReusePlan) => void)[] = [
    p => { p.overlay.correctedUtf8 += "\n"; }, p => { p.overlay.correctedSha256 = "0".repeat(64); },
    p => { p.correctedManifest.utf8 += "\n"; }, p => { p.correctedManifest.sha256 = "0".repeat(64); },
    p => { p.sourceManifestSha256 = "0".repeat(64); },
  ];
  for (const mutate of mutations) {
    const f = fixture(); mutate(f.p);
    await expect(applyRecordOverlay(f.p, f.io)).rejects.toThrow("BOUND_CORRECTED_SOURCE_AND_MANIFEST_REQUIRED");
    expect(f.attempts).toEqual([]);
  }
  const f = fixture(), rows: Inventory = JSON.parse(f.p.correctedManifest.utf8);
  rows.find(row => row.path === nativePath)!.sha256 = "0".repeat(64); bindManifest(f.p, rows);
  await expect(applyRecordOverlay(f.p, f.io)).rejects.toThrow("OVERLAY_MATCHES_MANIFEST_REQUIRED");
  expect(f.attempts).toEqual([]);
});

test("arbitrary overlay paths cannot redirect reads or writes into Cargo, target caches or other files", async () => {
  for (const path of ["Cargo.toml", "../gpu.rs", "/build/native/" + nativePath, "target-gpu/record", "../../capture/cargo-home/config.toml"]) {
    const f = fixture(); f.p.overlay.path = path;
    await expect(applyRecordOverlay(f.p, f.io)).rejects.toThrow("ONLY_GPU_RECORD_OVERLAY_ALLOWED");
    expect(f.reads).toEqual([]); expect(f.attempts).toEqual([]); expect(f.inventoryCalls()).toBe(0);
  }
});

test("freshly rebound extra edits, reversions and corrections outside the intended function remain forbidden", async () => {
  for (const text of [plan.overlay.correctedUtf8 + "\n", previous, plan.overlay.correctedUtf8.replace(afterWrite, afterWrite + " ")]) {
    const f = fixture(); bindCorrectedText(f.p, text);
    await expect(applyRecordOverlay(f.p, f.io)).rejects.toThrow("EXACT_GPU_POLICY_RECORD_SLICE_CORRECTION_REQUIRED");
    expect(f.attempts).toEqual([]);
  }
  const f = fixture(), text = previous.replace("fn cuda_f64_policy_channel_subprocesses_agree_and_reload() {", "fn source_only_wrong_function() {");
  f.files.set(sourcePath, text); f.p.overlay.previousSha256 = hash(text);
  const rows = original.map(row => ({ ...row, sha256: row.path === nativePath ? hash(text) : row.sha256 }));
  const manifest = JSON.stringify(rows, null, 2) + "\n";
  f.files.set(manifestPath, manifest); f.p.previousSourceManifestSha256 = hash(manifest);
  f.io.inventory = async () => structuredClone(rows);
  bindCorrectedText(f.p, text.replace(beforeWrite, afterWrite));
  await expect(applyRecordOverlay(f.p, f.io)).rejects.toThrow("EXACT_GPU_POLICY_RECORD_SLICE_CORRECTION_REQUIRED");
  expect(f.attempts).toEqual([]);
});

test("the corrected generation rejects missing, extra, duplicate, reordered and multiply changed native members", async () => {
  const expected: Inventory = JSON.parse(plan.correctedManifest.utf8);
  const invalid: { rows: Inventory; reason: string }[] = [
    { rows: expected.slice(1), reason: "UNCHANGED_NATIVE65_MEMBERSHIP_REQUIRED" },
    { rows: [...expected, { path: "source-only-extra.rs", sha256: "0".repeat(64) }], reason: "UNCHANGED_NATIVE65_MEMBERSHIP_REQUIRED" },
    { rows: expected.map((row, index) => index === 0 ? { ...expected[1]! } : { ...row }), reason: "UNCHANGED_NATIVE65_MEMBERSHIP_REQUIRED" },
    { rows: [...expected].reverse(), reason: "UNCHANGED_NATIVE65_MEMBERSHIP_REQUIRED" },
    { rows: expected.map((row, index) => index === 0 ? { ...row, sha256: "0".repeat(64) } : { ...row }), reason: "ONLY_GPU_POLICY_RECORD_SOURCE_MAY_CHANGE" },
    { rows: structuredClone(original), reason: "ONLY_GPU_POLICY_RECORD_SOURCE_MAY_CHANGE" },
  ];
  for (const { rows, reason } of invalid) {
    const f = fixture(); bindManifest(f.p, rows);
    await expect(applyRecordOverlay(f.p, f.io)).rejects.toThrow(reason);
    expect(f.attempts).toEqual([]);
  }
});

test("post-write inventory or manifest corruption cannot produce an accepted overlay result", async () => {
  for (const mode of ["inventory", "manifest", "inventory-read-failure"] as const) {
    const f = fixture(), inventory = f.io.inventory; let calls = 0;
    f.io.inventory = async () => {
      const rows = await inventory(); calls++;
      if (calls === 2) {
        if (mode === "inventory-read-failure") throw Error("MOCK_POST_INVENTORY_READ_FAILED");
        if (mode === "inventory") rows[0]!.sha256 = "0".repeat(64);
        if (mode === "manifest") f.files.set(manifestPath, f.p.correctedManifest.utf8 + "\n");
      }
      return rows;
    };
    await expect(applyRecordOverlay(f.p, f.io)).rejects.toThrow(mode === "inventory-read-failure" ? "MOCK_POST_INVENTORY_READ_FAILED" : "CORRECTED_STAGED_NATIVE_GENERATION_REQUIRED");
    expect(f.writes.map(row => row.path)).toEqual([sourcePath, manifestPath]);
  }
});

test("failure on the first permitted write preserves the original source, manifest and attempted-write log", async () => {
  const f = fixture();
  f.io.write = async (path, text) => { f.attempts.push({ path, text }); throw Error("MOCK_FIRST_WRITE_FAILED"); };
  await expect(applyRecordOverlay(f.p, f.io)).rejects.toThrow("MOCK_FIRST_WRITE_FAILED");
  expect(f.attempts).toEqual([{ path: sourcePath, text: f.p.overlay.correctedUtf8 }]);
  expect(f.writes).toEqual([]); expect(f.files.get(sourcePath)).toBe(previous); expect(f.files.get(manifestPath)).toBe(oldManifest);
  expect(f.inventoryCalls()).toBe(1);
});

test("failure on the second permitted write retains the successful source write without cleanup or rollback", async () => {
  const f = fixture(), write = f.io.write;
  f.io.write = async (path, text) => {
    if (path === manifestPath) { f.attempts.push({ path, text }); throw Error("MOCK_SECOND_WRITE_FAILED"); }
    await write(path, text);
  };
  await expect(applyRecordOverlay(f.p, f.io)).rejects.toThrow("MOCK_SECOND_WRITE_FAILED");
  expect(f.attempts.map(row => row.path)).toEqual([sourcePath, manifestPath]);
  expect(f.writes).toEqual([{ path: sourcePath, text: f.p.overlay.correctedUtf8 }]);
  expect(f.files.get(sourcePath)).toBe(f.p.overlay.correctedUtf8); expect(f.files.get(manifestPath)).toBe(oldManifest);
  expect(f.inventoryCalls()).toBe(1);
});

test("the future native entrypoint stages only two fresh source trees and reuses the five compile-only commands", () => {
  const body = source.slice(source.indexOf("export async function runReuseNative("));
  expect(body).toMatch(/for\s*\(const source of\s*\["\/received\/current-native",\s*"\/received\/qualification-tools"\]\)\s*await stageTree\(source,\s*root,/);
  expect(body.match(/\bstageTree\(/g)).toHaveLength(1);
  expect(source).toMatch(/import\s*\{[^}]*nativeCommands[^}]*recordNativeCommand[^}]*recheckNativeSource[^}]*stageTree[^}]*\}\s*from\s*"\.\.\/host-build\/driver"/);
  expect(body).toMatch(/for\s*\(const command of nativeCommands\(\)\)/);
  expect(body).not.toMatch(/\/received\/cargo-home|\b(?:rm|rmdir|unlink|readdir|glob)\s*\(|\b(?:cp|rsync)\b|runNativeBuild\s*\(|Bun\.spawn|\bexecFile\s*\(/);
  const commands = nativeCommands();
  expect(commands.map(row => row.id)).toEqual(["rustc-version", "cargo-version", "llvm-version", "gpu-learning", "gpu-policy"]);
  for (const command of commands.filter(row => !row.version)) {
    expect(command.argv.slice(0, 2)).toEqual(["cargo", "test"]);
    for (const flag of ["--no-run", "--offline", "--locked", "--message-format=json"]) expect(command.argv).toContain(flag);
  }
  for (const label of ["testsExecuted", "gpuExecuted", "trainingReady"]) expect(body).toMatch(new RegExp(label + ":\\s*false"));
});

test("native work clips the common deadline before staging and rechecks stability after catch without replacing primary failure", () => {
  const body = source.slice(source.indexOf("export async function runReuseNative("));
  expect(plan.limits.nativeWorkMs).toBe(3600000); expect(plan.limits.nativeAcceptanceReserveMs).toBe(120000);
  expect(body).toContain('readFile("/evidence/deadline.json", "utf8")');
  expect(body).toMatch(/deadline\s*=\s*Math\.min\(started\s*\+\s*p\.limits\.nativeWorkMs,\s*performance\.now\(\)\s*\+\s*normalDeadlineEpoch\s*-\s*p\.limits\.nativeAcceptanceReserveMs\s*-\s*Date\.now\(\)\)/);
  expect(body.indexOf("NATIVE_HOST_ACCEPTANCE_RESERVE_REQUIRED")).toBeLessThan(body.indexOf('stage = "staging"'));
  expect(body).toMatch(/\}\s*catch\s*\(error\)\s*\{\s*failure\s*=[^\n]+\}\s*const sourceCheck = await recheckNativeSource\(inventory,\s*readInventory,\s*remaining\);/);
  expect(body).toMatch(/sourceCheck\.sourceChanged\s*!==\s*false\s*\|\|\s*!sourceCheck\.sourceStabilityChecked/);
  expect(body).toContain('failure ??= sourceCheck.sourceChanged ? "NATIVE_SOURCE_CHANGED" : "NATIVE_SOURCE_STABILITY_UNCHECKED"');
  expect(body).toContain("...sourceCheck");
  expect(body.indexOf("await recordNativeCommand(")).toBeLessThan(body.indexOf("await recheckNativeSource("));
  expect(body.indexOf("await recheckNativeSource(")).toBeLessThan(body.indexOf('await writeFile(directory + "/receipt.json"'));
  expect(body).toContain('flag: "wx"'); expect(body).toContain("constants.COPYFILE_EXCL");
});
