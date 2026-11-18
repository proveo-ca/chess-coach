// SPEC: _spec/gpu-input-transfer.puml
import { expect, test } from "bun:test";
import { ByteBudget, nativeDestination, parseLlvmInventory, relativeInput, requireReviewedNativePaths, sparsePath, validateRegistry } from "./prepare";

test("byte budgets stop before exceeding the approved aggregate", () => {
  const budget = new ByteBudget(10);
  budget.charge(4); budget.charge(6);
  expect(budget.used).toBe(10);
  for (const invalid of [1, -1, NaN, Infinity]) expect(() => budget.charge(invalid)).toThrow("PAYLOAD_BYTE_BUDGET");
  expect(budget.used).toBe(10);
});

test("context mapping preserves schema and crate paths while relocating tools together", () => {
  expect(nativeDestination("Cargo.lock")).toBe("current-native/Cargo.lock");
  expect(nativeDestination("schemas/feature-layout.json")).toBe("current-native/schemas/feature-layout.json");
  expect(nativeDestination("crates/policy-io/tests/gpu.rs")).toBe("current-native/crates/policy-io/tests/gpu.rs");
  expect(nativeDestination("tooling/runtime/qualification.ts")).toBe("qualification-tools/tooling/runtime/qualification.ts");
  expect(nativeDestination("_work/gpu-owner-recovery/verify.ts")).toBe("qualification-tools/_work/gpu-owner-recovery/verify.ts");
  for (const invalid of ["/absolute", "../outside", "a/../b", "a//b", "bad\0name", "bad\nname"]) expect(() => relativeInput(invalid)).toThrow("RELATIVE_INPUT_PATH_REQUIRED");
});

test("new native source names cannot enter a preparation from an older source gate", () => {
  const sources = [{ path: "Cargo.lock", sha256: "a".repeat(64) }, { path: "crates/learning/src/lib.rs", sha256: "b".repeat(64) }];
  expect(() => requireReviewedNativePaths(sources.map(source => source.path), sources)).not.toThrow();
  expect(() => requireReviewedNativePaths([...sources.map(source => source.path), "crates/learning/src/new.rs"], sources)).toThrow("UNREVIEWED_NATIVE_INPUT");
});

test("sparse registry keys preserve Cargo's public registry layout", () => {
  expect(sparsePath("a")).toBe("1/a");
  expect(sparsePath("cc")).toBe("2/cc");
  expect(sparsePath("syn")).toBe("3/s/syn");
  expect(sparsePath("serde_json")).toBe("se/rd/serde_json");
  expect(() => sparsePath("../private")).toThrow("REGISTRY_PACKAGE_NAME_REQUIRED");
});

test("frozen registry validation rejects altered providers, versions and checksums", async () => {
  const entries = await Bun.file(new URL("../../runs/gpu-prepared-llvm-cache-1/registry-manifest.json", import.meta.url)).json();
  const lock = await Bun.file(new URL("../../../../Cargo.lock", import.meta.url)).text();
  expect(() => validateRegistry(entries, lock)).not.toThrow();
  expect(() => validateRegistry(entries.slice(1), lock)).toThrow("FROZEN_REGISTRY_MANIFEST_REQUIRED");
  for (const changed of [
    { ...entries[0], source: "git+https://example.invalid" },
    { ...entries[0], version: "../../outside" },
    { ...entries[0], checksum: "not-a-checksum" },
  ]) expect(() => validateRegistry([changed, ...entries.slice(1)], lock)).toThrow("FROZEN_REGISTRY_IDENTITY_REQUIRED");
  expect(() => validateRegistry([entries[0], entries[0], ...entries.slice(2)], lock)).toThrow("DUPLICATE_REGISTRY_IDENTITY");
  expect(() => validateRegistry([{ ...entries[0], checksum: "0".repeat(64) }, ...entries.slice(1)], lock)).toThrow("REGISTRY_MANIFEST_DIFFERS_FROM_LOCK");
  expect(() => validateRegistry(entries, lock + "\n")).toThrow("FROZEN_CARGO_LOCK_REQUIRED");
});

test("LLVM staging uses only the complete retained tree and recorded links", async () => {
  const text = await Bun.file(new URL("../../runs/gpu-qualification-input-inventory-1/command.stdout", import.meta.url)).text();
  const rows = parseLlvmInventory(text);
  expect(rows).toHaveLength(2684);
  expect(rows.filter(row => row.kind === "symlink").map(row => row.target)).toEqual(["lld", "lld"]);
  const parsed = text.trimEnd().split("\n").map(line => JSON.parse(line));
  parsed.at(-1).complete = false;
  expect(() => parseLlvmInventory(parsed.map(line => JSON.stringify(line)).join("\n"))).toThrow("APPROVED_COMPLETE_LLVM_METADATA_REQUIRED");
});

test("fresh transfer authority excludes host work, retries and credential changes", async () => {
  const request = await Bun.file(new URL("./request.json", import.meta.url)).json();
  expect(request.payloadReadHashCopyAndLocalStagingAuthorized).toBe(true);
  expect(request.normalSourceCommitAndHttpsPushAuthorized).toBe(true);
  expect(request.draftReleaseAndTwoUploadsAuthorized).toBe(true);
  expect(request.maximumReleaseCreations).toBe(1);
  expect(request.maximumAssetUploads).toBe(2);
  expect(request.releaseDraftRequired).toBe(true);
  for (const field of ["automaticRetryAuthorized", "authOrGitConfigurationChangesAuthorized", "publicReleaseOverwriteOrDeletionAuthorized", "operatorDownloadOrExtractionAuthorized", "imageBuildAuthorized", "hostOrGpuExecutionAuthorized", "compilationAuthorized", "trainingAuthorized", "oldHaltedLlvmArchivePipelineRenewed"]) expect(request[field]).toBe(false);
});
