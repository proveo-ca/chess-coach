// SPEC: _spec/gpu-build.puml
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { environment, prepare, repository, work } from "../provision";
import { runBounded } from "../verify";

type StepResult = { status: string; stdout: string };
type PlanIO = { configuration: string; readConfiguration(): Promise<string>; run(name: string, args: string[], timeoutMs: number): Promise<StepResult> };
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

export function validateConfiguration(text: string) {
  const actual = Bun.TOML.parse(text);
  const expected = { tools: { "core:rust": { version: "1.95.0", profile: "minimal", components: ["rustfmt", "clippy"], targets: [] } } };
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error("PINNED_SCOPED_RUST_CONFIGURATION_REQUIRED");
}

export function validateEffectiveScope(listing: string, settings: string[], expected: { configuration: string; rustup: string; cargo: string }) {
  const configs = JSON.parse(listing) as { path?: unknown; tools?: unknown }[];
  if (!Array.isArray(configs) || configs.length !== 1 || configs[0]?.path !== expected.configuration || JSON.stringify(configs[0]?.tools) !== JSON.stringify(["rust"])) {
    throw Error("FRESH_SCOPED_MISE_CONFIGURATION_REQUIRED");
  }
  if (JSON.stringify(settings.map(value => value.trim())) !== JSON.stringify([expected.rustup, expected.cargo, "x86_64-unknown-linux-gnu"])) {
    throw Error("REPOSITORY_OWNED_RUST_HOMES_REQUIRED");
  }
}

export function graphResultVerified(value: unknown, cargo: string, rustc: string) {
  const receipt = value as { graphStatus?: string; sourcesChangedDuringRun?: boolean; graphEnvironment?: { RUSTC?: string }; graphs?: { status?: string; argv?: string[]; expectedFeatureTextPresent?: boolean }[] } | null;
  return receipt?.graphStatus === "PASS_FEATURE_TREE_ONLY" && receipt.sourcesChangedDuringRun === false && receipt.graphEnvironment?.RUSTC === rustc
    && Array.isArray(receipt.graphs) && receipt.graphs.length === 3
    && receipt.graphs.every(graph => graph.status === "PASS" && graph.argv?.[0] === cargo && graph.expectedFeatureTextPresent === true);
}

export async function executePlan(io: PlanIO, homes: { rustup: string; cargo: string }) {
  const source = await io.readConfiguration();
  validateConfiguration(source);
  const outputs: Record<string, string> = {};
  const preflight = [
    { name: "version", args: ["--version"] },
    { name: "install-help", args: ["install", "--help"] },
    { name: "trust-help", args: ["trust", "--help"] },
    { name: "trust", args: ["trust", io.configuration] },
    { name: "config", args: ["config", "ls", "--json"] },
    { name: "rustup-home", args: ["settings", "get", "rust.rustup_home"] },
    { name: "cargo-home", args: ["settings", "get", "rust.cargo_home"] },
    { name: "host", args: ["settings", "get", "rust.default_host"] },
  ];
  for (const step of preflight) {
    const result = await io.run(step.name, step.args, 10_000);
    if (result.status !== "PASS") return { status: "FAIL_PREFLIGHT", failedStep: step.name, installInvocations: 0 };
    outputs[step.name] = result.stdout;
  }
  validateEffectiveScope(outputs.config!, [outputs["rustup-home"]!, outputs["cargo-home"]!, outputs.host!], { configuration: io.configuration, ...homes });
  if (await io.readConfiguration() !== source) throw Error("CONFIGURATION_CHANGED_BEFORE_INSTALL");
  const installed = await io.run("install", ["install", "--jobs", "1", "core:rust"], 600_000);
  return { status: installed.status === "PASS" ? "TOOLCHAIN_INSTALL_PASS" : "FAIL_INSTALL", failedStep: installed.status === "PASS" ? null : "install", installInvocations: 1 };
}

async function main() {
  if (Bun.argv.length !== 2 || resolve(process.cwd()) !== resolve(repository)) throw Error("SCOPED_RUST_PROVISION_CONTEXT_REQUIRED");
  const requestPath = resolve(work, "prepared-llvm-mise/request.json");
  const request = JSON.parse(await readFile(requestPath, "utf8"));
  if (request.authorization.maximumInstallInvocations !== 1 || request.authorization.toolchainDownloadsAuthorized !== true || request.authorization.projectDependencyDownloadsAuthorized !== false
    || request.runId !== "gpu-prepared-llvm-mise-1" || request.graphVerificationRunId !== "gpu-prepared-llvm-local-5") throw Error("PROVISION_AUTHORITY_SCOPE_REQUIRED");
  const directory = resolve(work, "runs", request.runId);
  await mkdir(directory);
  await prepare();
  const sourcePaths = [requestPath, resolve(work, "prepared-llvm-mise/provision.ts"), resolve(work, "prepared-llvm-mise/provision.test.ts"),
    resolve(work, "prepared-llvm-mise/tsconfig.json"), resolve(work, "mise.toml"), resolve(work, "provision.ts"), resolve(work, "verify.ts"), resolve(work, "command-supervisor.ts")];
  const sources = await Promise.all(sourcePaths.map(async path => ({ path: relative(repository, path), sha256: digest(await readFile(path)) })));
  await writeFile(resolve(directory, "sources.json"), JSON.stringify(sources, null, 2) + "\n", { flag: "wx" });
  const results: unknown[] = [];
  let installInvocations = 0;
  async function run(name: string, argv: string[], timeoutMs: number, cwd: string) {
    const step = resolve(directory, name);
    await mkdir(step);
    const result = await runBounded(argv, step, timeoutMs, { cwd, environment });
    const streams = await Promise.all(["stdout", "stderr"].map(async stream => {
      const path = resolve(step, `command.${stream}`), bytes = await readFile(path);
      return { path: relative(repository, path), bytes: bytes.length, sha256: digest(bytes) };
    }));
    const receipt = { name, argv, timeoutMs, cwd, environment, ...result, streams };
    await writeFile(resolve(step, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
    results.push(receipt);
    return { status: result.status, stdout: await readFile(resolve(step, "command.stdout"), "utf8") };
  }
  let status = "FAIL_PREFLIGHT", failure: string | null = null, graphStatus: string | null = null;
  try {
    const outcome = await executePlan({ configuration: resolve(work, "mise.toml"), readConfiguration: () => readFile(resolve(work, "mise.toml"), "utf8"),
      run: async (name, args, timeoutMs) => {
        if (name === "install" && ++installInvocations !== 1) throw Error("INSTALL_INVOCATION_BUDGET");
        return run(name, ["/usr/local/bin/mise", ...args], timeoutMs, work);
      } }, { rustup: environment.RUSTUP_HOME!, cargo: environment.CARGO_HOME! });
    status = outcome.status;
    if (outcome.failedStep) failure = outcome.failedStep;
    if (status === "TOOLCHAIN_INSTALL_PASS") {
      const verified = await run("offline-graphs", [process.execPath, "--no-env-file", "--no-install", resolve(work, "prepared-llvm/verify.ts"), request.graphVerificationRunId], 780_000, repository);
      const graphReceipt = JSON.parse(await readFile(resolve(work, "runs", request.graphVerificationRunId, "receipt.json"), "utf8"));
      graphStatus = graphReceipt.graphStatus;
      const toolchain = resolve(environment.RUSTUP_HOME!, "toolchains/1.95.0-x86_64-unknown-linux-gnu/bin");
      status = verified.status === "PASS" && graphResultVerified(graphReceipt, resolve(toolchain, "cargo"), resolve(toolchain, "rustc"))
        ? "TOOLCHAIN_AND_FEATURE_TREES_PASS_NO_COMPILATION" : "TOOLCHAIN_INSTALLED_OFFLINE_GRAPHS_NOT_VERIFIED";
    }
  } catch (error) { failure = String(error); }
  const sourceChanged = (await Promise.all(sources.map(async source => digest(await readFile(resolve(repository, source.path))) !== source.sha256))).some(Boolean);
  const receipt = { version: "chess-coach.gpu-functional-rust-provision.v1", scope: "ONE_SCOPED_MISE_TOOLCHAIN_INSTALL_AND_OFFLINE_GRAPH_RECHECK_ONLY", status, failure,
    request: relative(repository, requestPath), sources, sourceChanged, installInvocationsConsumed: installInvocations, automaticRetryAuthorized: false, results, graphStatus,
    toolchainDownloadsAuthorized: true, projectDependencyDownloadsAuthorized: false, compilationPerformed: false, llvmOperationPerformed: false, imageOperationPerformed: false,
    hostGpuOperationPerformed: false, trainingReady: false };
  await writeFile(resolve(directory, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status, failure, installInvocations, graphStatus, sourceChanged, receipt: relative(repository, resolve(directory, "receipt.json")) }));
  process.exitCode = status === "TOOLCHAIN_AND_FEATURE_TREES_PASS_NO_COMPILATION" && !sourceChanged ? 0 : 1;
}

if (import.meta.main) await main();
