// SPEC: _spec/gpu-build.puml
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBounded } from "../verify";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const work = resolve(repository, "_work/gpu-owner-recovery");
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

type CargoCandidate = { path: string; executableAvailable: boolean; eligibleForGraphProbe: boolean; rustcPath: string | null; rustcExecutableAvailable: boolean | null };

export function graphToolchain(candidates: readonly CargoCandidate[], environment: Readonly<Record<string, string>>): { cargo: string; environment: Record<string, string> } | null {
  const selected = candidates.find(candidate => candidate.executableAvailable && candidate.eligibleForGraphProbe && candidate.rustcExecutableAvailable === true);
  if (!selected?.rustcPath) return null;
  return { cargo: selected.path, environment: { ...environment, PATH: `${dirname(selected.path)}:${environment.PATH}`, RUSTC: selected.rustcPath } };
}

async function main() {
  const [label] = Bun.argv.slice(2);
  if (Bun.argv.length !== 3 || !/^gpu-prepared-llvm-local-[1-9][0-9]*$/.test(label ?? "") || resolve(process.cwd()) !== resolve(repository)) {
    throw Error("PREPARED_LLVM_STATIC_VERIFICATION_CONTEXT_REQUIRED");
  }
  const directory = resolve(work, "runs", label!);
  await mkdir(directory);
  await mkdir(resolve(directory, "home"));
  await mkdir(resolve(directory, "tmp"));
  const baseline = JSON.parse(await readFile(resolve(work, "runs/gpu-functional-local-3/sources.json"), "utf8")) as { path: string; sha256: string }[];
  const paths = new Set([...baseline.map(source => source.path), "_work/gpu-owner-recovery/prepared-llvm/verify.ts", "_work/gpu-owner-recovery/prepared-llvm/verify.test.ts",
    "_work/gpu-owner-recovery/prepared-llvm/tsconfig.json", "_work/gpu-owner-recovery/gpu-functional-prepared-llvm-implementation-request.json"]);
  const sources = await Promise.all([...paths].sort().map(async path => ({ path, sha256: digest(await readFile(resolve(repository, path))) })));
  const sourceBytes = Buffer.from(JSON.stringify(sources, null, 2) + "\n");
  await writeFile(resolve(directory, "sources.json"), sourceBytes, { flag: "wx" });
  const environment = { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: resolve(directory, "home"), TMPDIR: resolve(directory, "tmp"),
    LANG: "C.UTF-8", LC_ALL: "C.UTF-8", NO_COLOR: "1", MISE_AUTO_INSTALL: "false", MISE_TASK_RUN_AUTO_INSTALL: "false",
    RUSTUP_AUTO_INSTALL: "0", RUSTUP_HOME: resolve(work, "cache/rustup"), CARGO_HOME: resolve(work, "cache/cargo"), CARGO_NET_OFFLINE: "true" };
  async function run(stage: { name: string; argv: string[]; timeoutMs: number }, stageEnvironment: Record<string, string> = environment) {
    const step = resolve(directory, stage.name);
    await mkdir(step);
    const result = await runBounded(stage.argv, step, stage.timeoutMs, { cwd: repository, environment: stageEnvironment });
    const streams = await Promise.all(["stdout", "stderr"].map(async stream => {
      const path = resolve(step, `command.${stream}`), bytes = await readFile(path);
      return { path: relative(repository, path), bytes: bytes.length, sha256: digest(bytes) };
    }));
    const receipt = { ...stage, ...result, environment: stageEnvironment, streams };
    await writeFile(resolve(step, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
    return receipt;
  }
  const stages = [
    { name: "recipe", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./packages/runtime/tests/gpu-recipe.test.ts"], timeoutMs: 30_000 },
    { name: "verifier-tests", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./_work/gpu-owner-recovery/prepared-llvm/verify.test.ts"], timeoutMs: 30_000 },
    ...["source", "tests", "tools", "verifier"].map(name => ({ name: "types-" + name,
      argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "-p",
        ({ source: "tsconfig.json", tests: "tsconfig.tests.json", tools: "_work/gpu-owner-recovery/tsconfig.json", verifier: "_work/gpu-owner-recovery/prepared-llvm/tsconfig.json" } as Record<string, string>)[name]!], timeoutMs: 120_000 })),
  ];
  const results = [];
  for (const stage of stages) {
    const result = await run(stage);
    results.push(result);
    if (result.status !== "PASS") break;
  }
  const cargoCandidates = [resolve(work, "cache/rustup/toolchains/1.95.0-x86_64-unknown-linux-gnu/bin/cargo"),
    "/home/agent/toolchains/linux-amd64/.local/share/mise/installs/rust/1.95.0/bin/cargo", "/usr/local/bin/cargo", "/usr/bin/cargo", "/bin/cargo"];
  const pinnedCargoCandidates = cargoCandidates.slice(0, 2);
  async function executableAvailable(path: string) {
    try { await access(path, constants.X_OK); return true; }
    catch { return false; }
  }
  const cargoAvailability = await Promise.all(cargoCandidates.map(async path => {
    const eligibleForGraphProbe = pinnedCargoCandidates.includes(path);
    const rustcPath = eligibleForGraphProbe ? resolve(dirname(path), "rustc") : null;
    return { path, executableAvailable: await executableAvailable(path), eligibleForGraphProbe, rustcPath,
      rustcExecutableAvailable: rustcPath === null ? null : await executableAvailable(rustcPath) };
  }));
  const selectedCargo = graphToolchain(cargoAvailability, environment);
  const cargo = selectedCargo?.cargo;
  const graphEnvironment = selectedCargo?.environment ?? null;
  const graphs = [];
  if (cargo && graphEnvironment && results.length === stages.length && results.every(result => result.status === "PASS")) {
    for (const [mode, feature] of [["prepared", "gpu-prepared-llvm"], ["ordinary-cuda", "gpu-cuda"], ["cpu", null]] as const) {
      const argv = [cargo, "tree", "--locked", "--offline", "--target", "x86_64-unknown-linux-gnu", "-p", "chess-coach-policy-io", "-e", "features",
        ...(feature ? ["--features", feature] : ["--no-default-features"])];
      const result = await run({ name: "graph-" + mode, argv, timeoutMs: 60_000 }, graphEnvironment);
      const text = await readFile(resolve(directory, "graph-" + mode, "command.stdout"), "utf8");
      const bundledCuda = text.includes("tracel-llvm-bundler v23.1.0-4") && text.includes("cubecl-llvm v0.11.3");
      const xtask = text.includes('tracel-llvm-bundler feature "xtask"');
      const matches = mode === "prepared" ? bundledCuda && xtask : mode === "cpu" ? !text.includes("tracel-llvm-bundler") : bundledCuda && !xtask;
      graphs.push({ ...result, expectedFeatureTextPresent: result.status === "PASS" && matches });
      if (result.status !== "PASS" || !matches) break;
    }
  }
  const sourceChanged = (await Promise.all(sources.map(async source => digest(await readFile(resolve(repository, source.path))) !== source.sha256))).some(Boolean);
  const staticChecksPassed = results.length === stages.length && results.every(result => result.status === "PASS") && !sourceChanged;
  const graphStatus = !cargo ? "UNAVAILABLE_CARGO" : !staticChecksPassed ? "SKIPPED_STATIC_FAILURE"
    : graphs.length === 3 && graphs.every(graph => graph.status === "PASS" && graph.expectedFeatureTextPresent) ? "PASS_FEATURE_TREE_ONLY" : "FAIL_OR_INCOMPLETE";
  const status = !staticChecksPassed ? "FAIL_STATIC" : graphStatus === "PASS_FEATURE_TREE_ONLY" ? "PASS_STATIC_AND_FEATURE_TREE_ONLY"
    : graphStatus === "UNAVAILABLE_CARGO" ? "PASS_STATIC_GRAPH_UNAVAILABLE" : "FAIL_OR_INCOMPLETE_GRAPH";
  const changedFromBaseline = baseline.filter(source => sources.find(current => current.path === source.path)?.sha256 !== source.sha256).map(source => source.path);
  const receipt = { version: "chess-coach.gpu-prepared-llvm-local.v1", scope: "STATIC_CHECKS_AND_AVAILABLE_OFFLINE_FEATURE_TREES_ONLY", status,
    sourceManifestSha256: digest(sourceBytes), sourceCount: sources.length, sourcesChangedDuringRun: sourceChanged, changedFromBaseline,
    staticChecksPassed, results, environment, graphEnvironment, cargoAvailability, graphStatus, graphs, compilationPerformed: false, cpuTestsRun: false,
    imageBuilt: false, prefixStagedOrSelected: false, cudaGpuCodeExecuted: false, trainingReady: false };
  await writeFile(resolve(directory, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status, sourceChanged, graphStatus, receipt: relative(repository, resolve(directory, "receipt.json")) }));
  process.exitCode = staticChecksPassed && ["PASS_FEATURE_TREE_ONLY", "UNAVAILABLE_CARGO"].includes(graphStatus) ? 0 : 1;
}

if (import.meta.main) await main();
