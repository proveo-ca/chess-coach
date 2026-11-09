// SPEC: _spec/gpu-build.puml
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { executeFetch, validateLockedRegistry } from "./fetch";

const registrySource = "registry+https://github.com/rust-lang/crates.io-index";
const checksum = "0".repeat(64);
const text = `version = 4\n[[package]]\nname = "local"\nversion = "0.1.0"\n[[package]]\nname = "dep"\nversion = "1.0.0"\nsource = "${registrySource}"\nchecksum = "${checksum}"\n`;
const expected = (value = text) => ({ sha256: createHash("sha256").update(value).digest("hex"), total: 2, maximumRegistryEntries: 1, source: registrySource });

function fixture(fetchStatus = "PASS", changed = false, verified = true) {
  let fetches = 0, verifications = 0;
  return { io: { readLock: async () => text, fetch: async () => { fetches++; return { status: fetchStatus }; },
    unchanged: async () => !changed, verify: async () => { verifications++; return verified; } }, counts: () => ({ fetches, verifications }) };
}

test("only the frozen registry identities and checksums enter the cache manifest", () => {
  expect(validateLockedRegistry(text, expected())).toEqual([{ name: "dep", version: "1.0.0", source: registrySource, checksum }]);
  expect(() => validateLockedRegistry(text + "\n", expected())).toThrow("APPROVED_LOCK_HASH_REQUIRED");
  expect(() => validateLockedRegistry(text, { ...expected(), total: 3 })).toThrow("LOCKED_PACKAGE_COUNT_MISMATCH");
  expect(() => validateLockedRegistry(text, { ...expected(), maximumRegistryEntries: 0 })).toThrow("REGISTRY_ENTRY_BUDGET_EXCEEDED");
});

test("nonregistry sources or missing checksums stop before network access", async () => {
  for (const bad of [text.replace(registrySource, "git+https://example.invalid/repo"), text.replace(checksum, "missing")]) {
    expect(() => validateLockedRegistry(bad, expected(bad))).toThrow("LOCKED_CRATES_IO_SOURCE_AND_CHECKSUM_REQUIRED");
  }
  const { io, counts } = fixture();
  await expect(executeFetch(io, { ...expected(), sha256: "f".repeat(64) })).rejects.toThrow("APPROVED_LOCK_HASH_REQUIRED");
  expect(counts()).toEqual({ fetches: 0, verifications: 0 });
});

test("successful cache preparation invokes one fetch and one offline verification", async () => {
  const { io, counts } = fixture();
  expect(await executeFetch(io, expected())).toBe("CACHE_AND_FEATURE_TREES_PASS_NO_COMPILATION");
  expect(counts()).toEqual({ fetches: 1, verifications: 1 });
});

test("fetch failure preserves a failed result without retries or graph execution", async () => {
  const { io, counts } = fixture("FAIL");
  expect(await executeFetch(io, expected())).toBe("FAIL_FETCH");
  expect(counts()).toEqual({ fetches: 1, verifications: 0 });
});

test("bound source changes stop graph execution after the single fetch", async () => {
  const { io, counts } = fixture("PASS", true);
  expect(await executeFetch(io, expected())).toBe("FAIL_BOUND_INPUT_CHANGED");
  expect(counts()).toEqual({ fetches: 1, verifications: 0 });
});

test("fetch success cannot replace missing offline graph evidence", async () => {
  const { io, counts } = fixture("PASS", false, false);
  expect(await executeFetch(io, expected())).toBe("CACHE_FETCHED_OFFLINE_GRAPHS_NOT_VERIFIED");
  expect(counts()).toEqual({ fetches: 1, verifications: 1 });
});

test("post-fetch lock mutation or unreadable bound inputs cannot trigger verification", async () => {
  const mutation = fixture();
  let reads = 0;
  mutation.io.readLock = async () => ++reads === 1 ? text : text + "\n";
  expect(await executeFetch(mutation.io, expected())).toBe("FAIL_BOUND_INPUT_CHANGED");
  expect(mutation.counts()).toEqual({ fetches: 1, verifications: 0 });
  const unreadable = fixture();
  unreadable.io.unchanged = async () => { throw Error("SOURCE_UNREADABLE"); };
  expect(await executeFetch(unreadable.io, expected())).toBe("FAIL_BOUND_INPUT_CHANGED");
  expect(unreadable.counts()).toEqual({ fetches: 1, verifications: 0 });
});

test("missing verification receipts preserve successful fetch scope without a preflight label", async () => {
  const { io, counts } = fixture();
  let verificationAttempts = 0;
  io.verify = async () => { verificationAttempts++; throw Error("RECEIPT_UNAVAILABLE"); };
  expect(await executeFetch(io, expected())).toBe("CACHE_FETCHED_OFFLINE_GRAPHS_NOT_VERIFIED");
  expect(counts().fetches).toBe(1);
  expect(verificationAttempts).toBe(1);
});
