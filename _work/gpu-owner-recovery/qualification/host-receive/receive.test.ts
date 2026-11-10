// SPEC: _spec/gpu-input-transfer.puml
import { expect, test } from "bun:test";
import { hostCommandEnvironment, inputPath, nativePath, receive, receivePlan, selectReceivePaths, validateManifest, verifyListing, writeRetained } from "./receive";
import type { ContextResult, Manifest, ReceiveIO } from "./receive";

const rows = await Bun.file(new URL("../../runs/host-feasibility-inputs-1/context-manifest.json", import.meta.url)).json();
const prepared = await Bun.file(new URL("../../runs/host-feasibility-inputs-1/preparation.json", import.meta.url)).json();
const original: Manifest = { sourceCommit: receivePlan.assetSourceCommit, bundle: { name: receivePlan.bundle.name, bytes: receivePlan.bundle.bytes, sha256: receivePlan.bundle.sha256 },
  files: rows, nativeSourceInventory: prepared.nativeSourceInventory, cachedCrateArchives: prepared.cachedCrateArchives, registryMetadataFiles: prepared.registryMetadataFiles,
  missingArchives: prepared.missingArchives, missingMetadata: prepared.missingMetadata, completeOfflineBuildCoverageQualified: false };
const listing = [...new Set(["current-native", "qualification-tools", "cargo-home", "gpu-build/llvm", "gpu-runtime/rootfs", ...original.files.map(row => row.path)])].sort().join("\n") + "\n";
const context: ContextResult = { bytes: 429218730, files: 3800, directories: 137, links: 2, nativeInputs: 65, nativeManifestSha256: "a".repeat(64) };
function fixture() {
  const state = { clock: 0, cost: 10, manifest: structuredClone(original), listing, context: { ...context }, fail: "", wrongAsset: "" };
  const calls: { stage: string; ms: number }[] = [];
  const call = (stage: string, ms: number) => { calls.push({ stage, ms }); state.clock += state.cost; if (state.fail === stage) throw Error("MOCK_" + stage); };
  const io: ReceiveIO = {
    now: () => state.clock,
    download: async (asset, ms) => { call("download:" + asset.name, ms); return { bytes: asset.bytes, sha256: state.wrongAsset === asset.name ? "0".repeat(64) : asset.sha256 }; },
    manifest: async () => state.manifest,
    list: async ms => { call("list", ms); return state.listing; },
    extract: async ms => { call("extract", ms); },
    verify: async (_manifest, ms) => { call("verify", ms); return state.context; },
  };
  return { io, state, calls };
}

test("host proposal matches exact retained draft asset metadata without authorizing operations", async () => {
  const proposal = await Bun.file(new URL("./plan.json", import.meta.url)).json();
  const outcome = await Bun.file(new URL("../../runs/host-feasibility-publication-3/outcome-check.json", import.meta.url)).json();
  expect(proposal.assetSourceCommit).toBe(outcome.sourceCommit);
  for (const asset of [receivePlan.bundle, receivePlan.manifest]) {
    expect(proposal[asset.id === receivePlan.bundle.id ? "bundle" : "manifest"]).toEqual(asset);
    expect(outcome.assets.find((entry: { id: number }) => entry.id === asset.id)).toEqual({ id: asset.id, name: asset.name, bytes: asset.bytes, digest: "sha256:" + asset.sha256 });
  }
  expect(proposal.codingSourcePublicationApproved).toBe(false);
  expect(proposal.operatorReceiveCommandApproved).toBe(false);
  for (const key of ["installationOrAuthenticationChangesAuthorized", "automaticRetryOrOverwriteOrDeletionAuthorized", "imageBuildOrCompilationAuthorized", "llvmOrCargoExecutionAuthorized", "gpuExecutionAuthorized", "trainingAuthorized", "trainingReady"]) expect(proposal[key]).toBe(false);
});

test("closed run selectors preserve run 1 and choose distinct run-2 destinations", () => {
  expect(selectReceivePaths("--approved-host-receive-1")).toEqual({ workspace: receivePlan.workspace, evidence: receivePlan.evidence });
  expect(selectReceivePaths("--approved-host-receive-2")).toEqual({ workspace: "_work/gpu-owner-recovery/cache/host-receive-2", evidence: "_work/gpu-owner-recovery/runs/host-input-receive-2" });
  for (const value of [undefined, null, "", "--approved-host-receive-3", "../../other", "--approved-host-receive-2 "]) expect(() => selectReceivePaths(value)).toThrow("APPROVED_HOST_RECEIVE_COMMAND_REQUIRED");
});

test("run-2 paths drive artifact and receipt labels without changing asset inputs", async () => {
  const plan = await Bun.file(new URL("./plan-run2.json", import.meta.url)).json();
  expect(selectReceivePaths(plan.grant)).toEqual({ workspace: plan.workspace, evidence: plan.evidence });
  expect(plan.manifest).toEqual(receivePlan.manifest); expect(plan.bundle).toEqual(receivePlan.bundle);
  expect(plan.execution).toEqual({ tool: "mise", pins: ["core:bun@1.4.0", "core:rust@1.95.0"], autoInstall: false, execAutoInstall: false, taskAutoInstall: false });
  expect(plan.sourcePublicationApproved).toBe(false); expect(plan.operatorReceiveApproved).toBe(false); expect(plan.installationOrTrustOrConfigurationChangesAuthorized).toBe(false);
  const source = await Bun.file(new URL("./receive.ts", import.meta.url)).text();
  const main = source.slice(source.indexOf("async function main()"));
  expect(main).not.toContain("receivePlan.workspace"); expect(main).not.toContain("receivePlan.evidence");
  expect(main).toContain('receipt: selected.evidence + "/receipt.json"');
  expect(main).toContain('artifacts.push({ path: selected.evidence + "/"');
  expect(main.indexOf("selectReceivePaths(grant)")).toBeLessThan(main.indexOf("await mkdir(evidence)"));
});

test("manifest binds the original 65 source inputs and honest offline-build limitations", () => {
  expect(validateManifest(original)).toBe(original);
  expect(original.files.filter(row => row.kind === "file")).toHaveLength(3800);
  expect(original.nativeSourceInventory).toHaveLength(65);
  expect(original.missingArchives).toHaveLength(103);
  expect(original.missingMetadata).toEqual([]);
});

test("native paths preserve schema placement and move tool dependencies together", () => {
  expect(nativePath("schemas/feature-layout.json")).toBe("current-native/schemas/feature-layout.json");
  expect(nativePath("tooling/runtime/qualification.ts")).toBe("qualification-tools/tooling/runtime/qualification.ts");
  expect(nativePath("_work/gpu-owner-recovery/verify.ts")).toBe("qualification-tools/_work/gpu-owner-recovery/verify.ts");
  for (const path of ["../outside", "/outside", "a//b", "a/./b", "a/../b", "a\nb", "a b", "a\\b"]) expect(() => inputPath(path)).toThrow("RELATIVE_CONTEXT_PATH_REQUIRED");
});

test("altered source commits, bundle identities and native hashes stop validation", () => {
  for (const change of ["commit", "bundle", "native", "count", "offline"]) {
    const manifest = structuredClone(original);
    if (change === "commit") manifest.sourceCommit = "b".repeat(40);
    if (change === "bundle") manifest.bundle.sha256 = "b".repeat(64);
    if (change === "native") manifest.nativeSourceInventory[0]!.sha256 = "b".repeat(64);
    if (change === "count") manifest.files.pop();
    if (change === "offline") manifest.missingArchives = [];
    expect(() => validateManifest(manifest)).toThrow();
  }
});

test("manifest rejects duplicate paths, unsupported entry kinds and altered LLVM links", () => {
  const duplicate = structuredClone(original); duplicate.files[1] = duplicate.files[0]!;
  expect(() => validateManifest(duplicate)).toThrow("UNEXPECTED_OR_DUPLICATE_CONTEXT_PATH");
  const link = structuredClone(original); link.files.find(row => row.kind === "symlink")!.target = "different";
  expect(() => validateManifest(link)).toThrow("RECORDED_LLVM_LINK_REQUIRED");
  const size = structuredClone(original); size.files[0]!.bytes = -1;
  expect(() => validateManifest(size)).toThrow("CONTEXT_SIZE_REQUIRED");
});

test("standard tar listing matches manifest entries plus five explicit roots", () => {
  expect(verifyListing(listing, original)).toBeGreaterThan(original.files.length);
  const directories = listing.split("\n").filter(Boolean).map(path => original.files.some(row => row.path === path && row.kind === "directory") ? path + "/" : path).join("\n") + "\n";
  expect(verifyListing(directories, original)).toBe(verifyListing(listing, original));
  for (const altered of [listing + "unexpected\n", listing.replace("cargo-home\n", ""), listing + "current-native\n", "../outside\n", "", "x".repeat(2097153)]) expect(() => verifyListing(altered, original)).toThrow();
});

test("one host invocation downloads manifest first, then lists, extracts and verifies once", async () => {
  const f = fixture(); const result = await receive(f.io);
  expect(result.status).toBe("PASS_HOST_RECEIVE_AND_EXTRACT_ONLY");
  expect(result.attempts).toEqual({ downloads: 2, listing: 1, extraction: 1, verification: 1 });
  expect(f.calls.map(call => call.stage)).toEqual(["download:" + receivePlan.manifest.name, "download:" + receivePlan.bundle.name, "list", "extract", "verify"]);
  expect(f.calls[0]!.ms).toBe(600000);
  expect(f.calls[1]!.ms).toBeLessThan(f.calls[0]!.ms);
  expect(f.calls[3]!.ms).toBeLessThan(f.calls[2]!.ms);
  expect(f.calls[4]!.ms).toBeLessThan(f.calls[3]!.ms);
  expect(result.missingArchives).toHaveLength(103);
  expect(result.completeOfflineBuildCoverageQualified).toBe(false);
  for (const field of ["compilationPerformed", "llvmOrCargoExecuted", "gpuExecuted", "trainingReady"] as const) expect(result[field]).toBe(false);
});

test("asset digest failure consumes only attempted downloads and never extracts", async () => {
  for (const [name, count] of [[receivePlan.manifest.name, 1], [receivePlan.bundle.name, 2]] as const) {
    const f = fixture(); f.state.wrongAsset = name;
    const result = await receive(f.io);
    expect(result.failure).toBe("EXACT_ASSET_SIZE_AND_HASH_REQUIRED");
    expect(result.attempts.downloads).toBe(count);
    expect(result.attempts.extraction).toBe(0);
  }
});

test("wrong manifest and member inventory stop before any extraction", async () => {
  const manifest = fixture(); manifest.state.manifest.sourceCommit = "b".repeat(40);
  expect((await receive(manifest.io)).attempts.downloads).toBe(1);
  const archive = fixture(); archive.state.listing += "unexpected\n";
  const result = await receive(archive.io);
  expect(result.failure).toBe("ARCHIVE_MEMBER_SET_MISMATCH");
  expect(result.attempts.extraction).toBe(0);
});

test("failures preserve attempted stages without automatic retry", async () => {
  for (const stage of ["download:" + receivePlan.manifest.name, "download:" + receivePlan.bundle.name, "list", "extract", "verify"]) {
    const f = fixture(); f.state.fail = stage;
    const result = await receive(f.io);
    expect(result.status).toBe("FAIL_RECEIVE");
    expect(f.calls.filter(call => call.stage === stage)).toHaveLength(1);
    expect(f.calls.at(-1)!.stage).toBe(stage);
    expect(result.trainingReady).toBe(false);
  }
});

test("download and extraction phases share their respective shrinking deadlines", async () => {
  const downloads = fixture(); downloads.state.cost = 600000;
  const first = await receive(downloads.io);
  expect(first.failure).toBe("HOST_RECEIVE_DEADLINE");
  expect(first.attempts.downloads).toBe(1);
  const phase = fixture(); const list = phase.io.list;
  phase.io.list = async ms => { const value = await list(ms); phase.state.clock += 180000; return value; };
  const second = await receive(phase.io);
  expect(second.failure).toBe("HOST_RECEIVE_DEADLINE");
  expect(second.attempts.extraction).toBe(0);
});

test("a late second download cannot reset the shared asset deadline", async () => {
  const f = fixture(), download = f.io.download;
  f.io.download = async (asset, ms) => { const actual = await download(asset, ms); if (asset.id === receivePlan.bundle.id) f.state.clock = 600001; return actual; };
  const result = await receive(f.io);
  expect(result.failure).toBe("HOST_RECEIVE_DEADLINE");
  expect(result.attempts.downloads).toBe(2);
  expect(result.attempts.listing).toBe(0);
});

test("partial file writes count retained bytes before a subsequent write fails", async () => {
  let calls = 0;
  const retained: number[] = [];
  const writer = { write: async (_bytes: Uint8Array) => { if (++calls === 2) throw Error("MOCK_DISK_FULL"); return { bytesWritten: 2 }; } };
  await expect(writeRetained(writer, new Uint8Array([1, 2, 3, 4]), part => retained.push(...part))).rejects.toThrow("MOCK_DISK_FULL");
  expect(retained).toEqual([1, 2]);
  const complete: number[] = [];
  await writeRetained({ write: async () => ({ bytesWritten: 1 }) }, new Uint8Array([1, 2, 3]), part => complete.push(...part));
  expect(complete).toEqual([1, 2, 3]);
});

test("tar options cannot add executable commands and all API calls bind github.com", async () => {
  const environment = hostCommandEnvironment({ TAR_OPTIONS: "--checkpoint-action=exec=not-approved", GH_TOKEN: "in-memory-test-only" });
  expect(environment.TAR_OPTIONS).toBeUndefined();
  expect(environment.GH_TOKEN).toBe("in-memory-test-only");
  const source = await Bun.file(new URL("./receive.ts", import.meta.url)).text();
  expect(source).toContain('"gh", "api", "--hostname", "github.com"');
});

test("context totals cannot turn an incomplete receive into PASS", async () => {
  const f = fixture(); f.state.context.files--;
  const result = await receive(f.io);
  expect(result.failure).toBe("EXTRACTED_CONTEXT_TOTALS_MISMATCH");
  expect(result.status).toBe("FAIL_RECEIVE");
});

test("receiver stays standalone and contains no installation, compiler or GPU entrypoint", async () => {
  const source = await Bun.file(new URL("./receive.ts", import.meta.url)).text();
  for (const match of source.matchAll(/^import .* from "([^"]+)"/gm)) expect(match[1]!.startsWith("node:")).toBe(true);
  for (const command of ['["docker"', '["cargo"', '["llvm-config"', '"gh", "auth"', '"mise", "install"']) expect(source).not.toContain(command);
  expect(source).toContain('"Accept: application/octet-stream"');
  expect(source).toContain('"--no-same-owner"');
});
