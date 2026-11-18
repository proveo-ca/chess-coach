// SPEC: _spec/gpu-build.puml
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { environment, prepare, repository, work } from "../provision";
import { graphResultVerified } from "../prepared-llvm-mise/provision";
import { runBounded } from "../verify";

type ExpectedLock = { sha256: string; total: number; maximumRegistryEntries: number; source: string };
type RegistryEntry = { name: string; version: string; source: string; checksum: string };
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

export function validateLockedRegistry(text: string, expected: ExpectedLock): RegistryEntry[] {
  if (digest(text) !== expected.sha256) throw Error("APPROVED_LOCK_HASH_REQUIRED");
  const lock = Bun.TOML.parse(text) as { package?: { name?: unknown; version?: unknown; source?: unknown; checksum?: unknown }[] };
  if (!Array.isArray(lock.package) || lock.package.length !== expected.total) throw Error("LOCKED_PACKAGE_COUNT_MISMATCH");
  const registry: RegistryEntry[] = [];
  for (const pkg of lock.package) {
    if (typeof pkg.name !== "string" || typeof pkg.version !== "string") throw Error("LOCK_PACKAGE_IDENTITY_REQUIRED");
    if (pkg.source === undefined) continue;
    if (pkg.source !== expected.source || typeof pkg.checksum !== "string" || !/^[a-f0-9]{64}$/.test(pkg.checksum)) throw Error("LOCKED_CRATES_IO_SOURCE_AND_CHECKSUM_REQUIRED");
    registry.push({ name: pkg.name, version: pkg.version, source: pkg.source, checksum: pkg.checksum });
  }
  if (registry.length > expected.maximumRegistryEntries) throw Error("REGISTRY_ENTRY_BUDGET_EXCEEDED");
  return registry;
}

export async function executeFetch(io: { readLock(): Promise<string>; fetch(): Promise<{ status: string }>; unchanged(): Promise<boolean>; verify(): Promise<boolean> }, expected: ExpectedLock) {
  const before = await io.readLock();
  validateLockedRegistry(before, expected);
  const fetched = await io.fetch();
  try { if (await io.readLock() !== before || !await io.unchanged()) return "FAIL_BOUND_INPUT_CHANGED"; }
  catch { return "FAIL_BOUND_INPUT_CHANGED"; }
  if (fetched.status !== "PASS") return "FAIL_FETCH";
  try { if (!await io.verify()) return "CACHE_FETCHED_OFFLINE_GRAPHS_NOT_VERIFIED"; }
  catch { return "CACHE_FETCHED_OFFLINE_GRAPHS_NOT_VERIFIED"; }
  try { return await io.unchanged() ? "CACHE_AND_FEATURE_TREES_PASS_NO_COMPILATION" : "FAIL_BOUND_INPUT_CHANGED"; }
  catch { return "FAIL_BOUND_INPUT_CHANGED"; }
}

async function main() {
  if (Bun.argv.length !== 2 || resolve(process.cwd()) !== resolve(repository)) throw Error("LOCKED_CACHE_FETCH_CONTEXT_REQUIRED");
  const requestPath = resolve(work, "prepared-llvm-cache/request.json"), request = JSON.parse(await readFile(requestPath, "utf8"));
  if (request.authorization.maximumFetchInvocations !== 1 || request.authorization.lockedRegistryMetadataAndCrateDownloadsAuthorized !== true
    || request.lockSha256 !== "77f674cc26a01f26558fd99c45bdcd5566017be05833fce1d39cae98cda05955" || request.lockedPackages !== 675 || request.maximumRegistryEntries !== 671
    || request.registrySource !== "registry+https://github.com/rust-lang/crates.io-index" || request.runId !== "gpu-prepared-llvm-cache-1" || request.graphVerificationRunId !== "gpu-prepared-llvm-local-6") {
    throw Error("LOCKED_CACHE_AUTHORITY_SCOPE_REQUIRED");
  }
  const directory = resolve(work, "runs", request.runId);
  await mkdir(directory);
  await prepare();
  const lockPath = resolve(repository, "Cargo.lock"), expected = { sha256: request.lockSha256, total: 675, maximumRegistryEntries: 671, source: request.registrySource };
  const registry = validateLockedRegistry(await readFile(lockPath, "utf8"), expected);
  await writeFile(resolve(directory, "registry-manifest.json"), JSON.stringify(registry, null, 2) + "\n", { flag: "wx" });
  const prior = JSON.parse(await readFile(resolve(work, "runs/gpu-prepared-llvm-local-5/sources.json"), "utf8")) as { path: string; sha256: string }[];
  const sourcePaths = new Set([...prior.map(source => source.path), "_work/gpu-owner-recovery/prepared-llvm-cache/request.json",
    "_work/gpu-owner-recovery/prepared-llvm-cache/fetch.ts", "_work/gpu-owner-recovery/prepared-llvm-cache/fetch.test.ts", "_work/gpu-owner-recovery/prepared-llvm-cache/tsconfig.json",
    "_work/gpu-owner-recovery/prepared-llvm-mise/provision.ts"]);
  const sources = await Promise.all([...sourcePaths].sort().map(async path => ({ path, sha256: digest(await readFile(resolve(repository, path))) })));
  for (const source of prior) if (sources.find(current => current.path === source.path)?.sha256 !== source.sha256) throw Error("PREPARED_SOURCE_CHANGED_BEFORE_FETCH");
  await writeFile(resolve(directory, "sources.json"), JSON.stringify(sources, null, 2) + "\n", { flag: "wx" });
  const unchanged = async () => {
    try { return !(await Promise.all(sources.map(async source => digest(await readFile(resolve(repository, source.path))) !== source.sha256))).some(Boolean); }
    catch { return false; }
  };
  const toolchain = resolve(environment.RUSTUP_HOME!, "toolchains/1.95.0-x86_64-unknown-linux-gnu/bin");
  const cargo = resolve(toolchain, "cargo"), rustc = resolve(toolchain, "rustc");
  await access(cargo, constants.X_OK); await access(rustc, constants.X_OK);
  const fetchEnvironment = { ...environment, PATH: `${toolchain}:${environment.PATH}`, RUSTC: rustc, RUSTUP_AUTO_INSTALL: "0", CARGO_NET_OFFLINE: "false",
    CARGO_NET_RETRY: "0", CARGO_HTTP_TIMEOUT: "30", CARGO_REGISTRIES_CRATES_IO_PROTOCOL: "sparse" };
  const results: unknown[] = [];
  async function run(name: string, argv: string[], timeoutMs: number, childEnvironment: Record<string, string>) {
    const step = resolve(directory, name);
    await mkdir(step);
    const result = await runBounded(argv, step, timeoutMs, { cwd: repository, environment: childEnvironment });
    const streams = await Promise.all(["stdout", "stderr"].map(async stream => {
      const path = resolve(step, `command.${stream}`), bytes = await readFile(path);
      return { path: relative(repository, path), bytes: bytes.length, sha256: digest(bytes) };
    }));
    const receipt = { name, argv, timeoutMs, environment: childEnvironment, ...result, streams };
    await writeFile(resolve(step, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
    results.push(receipt);
    return result;
  }
  let fetchInvocations = 0, status = "FAIL_PREFLIGHT", failure: string | null = null, graphStatus: string | null = null;
  try {
    status = await executeFetch({ readLock: () => readFile(lockPath, "utf8"), unchanged,
      fetch: async () => {
        if (++fetchInvocations !== 1) throw Error("FETCH_INVOCATION_BUDGET");
        return run("fetch", [cargo, "fetch", "--locked", "--target", "x86_64-unknown-linux-gnu"], 600_000, fetchEnvironment);
      },
      verify: async () => {
        const verified = await run("offline-graphs", [process.execPath, "--no-env-file", "--no-install", resolve(work, "prepared-llvm/verify.ts"), request.graphVerificationRunId], 780_000,
          { ...environment, CARGO_NET_OFFLINE: "true", RUSTUP_AUTO_INSTALL: "0" });
        try {
          const graph = JSON.parse(await readFile(resolve(work, "runs", request.graphVerificationRunId, "receipt.json"), "utf8"));
          graphStatus = graph.graphStatus;
          return verified.status === "PASS" && graphResultVerified(graph, cargo, rustc);
        } catch (error) {
          failure = String(error);
          graphStatus = "VERIFIER_RECEIPT_UNAVAILABLE_OR_INVALID";
          return false;
        }
      } }, expected);
  } catch (error) { failure = String(error); status = fetchInvocations === 0 ? "FAIL_PREFLIGHT" : "FAIL_FETCH_OR_VERIFICATION_EXCEPTION"; }
  const sourceChanged = !await unchanged();
  const receipt = { version: "chess-coach.gpu-functional-cargo-cache-fetch.v1", scope: "ONE_LOCKED_REGISTRY_FETCH_AND_OFFLINE_FEATURE_TREES_ONLY", status, failure,
    request: relative(repository, requestPath), sourceChanged, sourceCount: sources.length, fetchInvocationsConsumed: fetchInvocations, automaticRetryAuthorized: false,
    approvedRegistryEntries: registry.length, lockSha256: request.lockSha256, results, graphStatus, packageUpgradesPerformed: false, toolchainReinstalled: false,
    compilationPerformed: false, llvmBundleOperationPerformed: false, imageOperationPerformed: false, hostGpuOperationPerformed: false, trainingReady: false };
  await writeFile(resolve(directory, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status, failure, fetchInvocations, graphStatus, sourceChanged, receipt: relative(repository, resolve(directory, "receipt.json")) }));
  process.exitCode = status === "CACHE_AND_FEATURE_TREES_PASS_NO_COMPILATION" && !sourceChanged ? 0 : 1;
}

if (import.meta.main) await main();
