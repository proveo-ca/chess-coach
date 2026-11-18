// SPEC: _spec/runtime-protocol.puml
import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import * as ts from "typescript";
import { runBounded } from "../../verify";
import type { CommandResult } from "../../verify";

const root = "/home/gu1lty/Projects/proveo/chess-coach";
const slice = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1";
const bun = "/usr/local/bin/bun";
const files = ["plan.json", "canonical.ts", "canonical.test.ts", "r4.test.ts", "verify.ts", "tsconfig.json"].map(file => `${slice}/${file}`);
const digest = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const json = (value: unknown) => JSON.stringify(value, (_key, value: unknown) => typeof value === "bigint" ? String(value) : value, 2) + "\n";
const persist = (path: string, value: unknown) => writeFile(path, json(value), { flag: "wx", mode: 0o600 });
type Binding = { path: string; bytes: number; sha256: string };

async function sourceBindings(): Promise<Binding[]> {
  const paths = new Set([...files, "package.json", "bun.lock", "tsconfig.json", "tooling/reference-entrypoints.json", "tooling/build-reference.ts",
    "packages/runtime/src/reference-driver.ts", "packages/runtime/tests/fixtures/native-reference-proof.json", "_work/gpu-owner-recovery/command-supervisor.ts",
    "node_modules/typescript/package.json", "node_modules/typescript/lib/_tsc.js", "node_modules/typescript/lib/typescript.js",
    "node_modules/@types/bun/package.json", "packages/contracts/node_modules/zod/package.json",
    "packages/contracts/package.json", "packages/runtime/package.json", "packages/policy/package.json"]);
  const pending = [...files.filter(path => path.endsWith(".ts")), "_work/gpu-owner-recovery/verify.ts"], visited = new Set<string>();
  const configPath = resolve(root, slice, "tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw new Error("TSC_CONFIG_READ");
  const options = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath)).options;
  while (pending.length) {
    const path = pending.pop()!;
    if (visited.has(path)) continue;
    visited.add(path); paths.add(path);
    const source = await readFile(resolve(root, path), "utf8");
    for (const imported of ts.preProcessFile(source, true, true).importedFiles) {
      const name = imported.fileName;
      if (!name.startsWith(".") && !name.startsWith("@chess-coach/")) continue;
      const result = ts.resolveModuleName(name, resolve(root, path), options, ts.sys).resolvedModule;
      if (!result) throw new Error(`UNRESOLVED_REPOSITORY_IMPORT:${path}:${name}`);
      const physical = await realpath(result.resolvedFileName);
      if (!physical.startsWith(root + "/") || physical.includes("/node_modules/")) throw new Error(`REPOSITORY_SOURCE_REQUIRED:${name}`);
      const dependency = relative(root, physical);
      paths.add(dependency);
      if (dependency.endsWith(".ts")) pending.push(dependency);
      if (name.startsWith("@chess-coach/")) paths.add(`packages/${name.slice("@chess-coach/".length).split("/")[0]}/package.json`);
    }
  }
  return Promise.all([...paths].sort().map(async path => {
    const bytes = await readFile(resolve(root, path));
    return { path, bytes: bytes.byteLength, sha256: digest(bytes) };
  }));
}

async function main(): Promise<void> {
  const [label] = Bun.argv.slice(2);
  if (Bun.argv.length !== 3 || !/^verification-[1-9][0-9]?$/.test(label ?? "")) throw new Error("FRESH_VERIFICATION_LABEL_1_TO_99_REQUIRED");
  if (process.cwd() !== root || Bun.version !== "1.4.0" || await realpath(process.execPath) !== await realpath(bun)) throw new Error("PINNED_REPOSITORY_BUN_1_4_REQUIRED");
  const directory = resolve(root, slice, label!);
  await mkdir(directory, { mode: 0o700 });
  const stages: { name: string; argv: string[]; result: CommandResult | null; streams?: Binding[]; error?: string }[] = [];
  const failures: string[] = [];
  let before: Binding[] = [], after: Binding[] = [], changed: string[] = [], mockEvidence: Binding[] = [];
  await persist(resolve(directory, ".operation"), { operation: "LOCAL_INJECTED_TESTS_AND_STRICT_TSC_ONLY", bunVersion: Bun.version,
    referenceInputDelivery: "REFERENCE_INPUT_DELIVERY_UNSELECTED", actualHostExecuted: false, trainingExecuted: false, trainingReady: false });
  try {
    for (const name of ["home", "tmp", "e2e"]) await mkdir(resolve(directory, name), { mode: 0o700 });
    before = await sourceBindings();
    await persist(resolve(directory, "sources-before.json"), before);
    const environment = { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: resolve(directory, "home"), TMPDIR: resolve(directory, "tmp"),
      BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0", NO_COLOR: "1", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", TZ: "UTC",
      MISE_AUTO_INSTALL: "false", MISE_EXEC_AUTO_INSTALL: "false", MISE_TASK_RUN_AUTO_INSTALL: "false",
      CANONICAL_R4_LOCAL_EVIDENCE: resolve(directory, "e2e") };
    const commands = [
      { name: "selected-pure-tests", argv: [bun, "--no-env-file", "--no-install", "test", `./${slice}/canonical.test.ts`, `./${slice}/r4.test.ts`] },
      { name: "strict-tsc", argv: [bun, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "--noEmit", "-p", `${slice}/tsconfig.json`] },
    ];
    for (const command of commands) {
      const stage: typeof stages[number] = { ...command, result: null };
      stages.push(stage);
      const step = resolve(directory, command.name);
      await mkdir(step, { mode: 0o700 });
      await persist(resolve(step, "invocation.json"), { argv: command.argv, timeoutMs: 60_000, cwd: root, environment });
      try {
        stage.result = await runBounded(command.argv, step, 60_000, { cwd: root, environment });
        if (stage.result.status !== "PASS") failures.push(`${command.name}:${stage.result.failure ?? stage.result.exitCode}`);
      } catch (error) { stage.error = String(error).slice(0, 4096); failures.push(`${command.name}:${stage.error}`); }
      stage.streams = [];
      for (const name of ["command.stdout", "command.stderr"]) {
        try {
          const path = relative(root, resolve(step, name)), bytes = await readFile(resolve(root, path));
          stage.streams.push({ path, bytes: bytes.byteLength, sha256: digest(bytes) });
        } catch (error) { failures.push(`${command.name}:${name}:${String(error).slice(0, 4096)}`); }
      }
      await persist(resolve(step, "receipt.json"), stage);
    }
    mockEvidence = [];
    for (const name of ["canonical-mock.json", "r4-selected-pure.json"]) {
      const path = relative(root, resolve(directory, "e2e", name)), bytes = await readFile(resolve(root, path));
      mockEvidence.push({ path, bytes: bytes.byteLength, sha256: digest(bytes) });
      const evidence = JSON.parse(bytes.toString("utf8"));
      if (evidence.execution !== "MOCK" || evidence.trainingReady !== false) throw new Error(`MOCK_EVIDENCE_REQUIRED:${name}`);
    }
  } catch (error) { failures.push(String(error).slice(0, 4096)); }
  finally {
    try {
      after = await sourceBindings();
      await persist(resolve(directory, "sources-after.json"), after);
      const original = new Map(before.map(entry => [entry.path, entry.sha256]));
      changed = after.filter(entry => original.get(entry.path) !== entry.sha256).map(entry => entry.path);
      changed.push(...before.filter(entry => !after.some(value => value.path === entry.path)).map(entry => entry.path));
      if (changed.length || !before.length) failures.push("SOURCE_BINDINGS_CHANGED_OR_MISSING");
    } catch (error) { failures.push(`AFTER_BINDINGS:${String(error).slice(0, 4096)}`); }
    const receipt = { version: "chess-coach.host-canonical-r4-local-verification.v1", label, status: failures.length ? "FAIL" : "PASS",
      scope: "SOURCE_ONLY_INJECTED_LOCAL_TESTS_AND_STRICT_TSC", spec: "_spec/runtime-protocol.puml", bunVersion: Bun.version,
      reference: "b4b241481fb12de4a7344e6dba8eda775af57675", referenceInputDelivery: "REFERENCE_INPUT_DELIVERY_UNSELECTED",
      beforeManifestSha256: digest(json(before)), afterManifestSha256: digest(json(after)), sourceCount: before.length, changed, stages, mockEvidence, failures,
      actualHostExecuted: false, actualProcessTransportInstantiated: false, workerProcessExecuted: false, nativeExecuted: false,
      gpuExecuted: false, referenceCaptured: false, referenceBuilt: false, referenceStaged: false, referenceAcquired: false,
      trainingExecuted: false, trainingReady: false, independentReferenceQualified: false, canonicalQualified: false,
      bothQualified: false, closeQualified: false, r4Qualified: false, wiringQualified: false, r4Scope: "SELECTED_PURE_CONTRACT_CASES_ONLY" };
    await persist(resolve(directory, "receipt.json"), receipt);
    console.log(json({ receipt: relative(root, resolve(directory, "receipt.json")), status: receipt.status, sourceCount: before.length,
      stages: stages.map(stage => ({ name: stage.name, status: stage.result?.status ?? "FAIL", exitCode: stage.result?.exitCode ?? null })),
      referenceInputDelivery: receipt.referenceInputDelivery, trainingReady: false }).trim());
    process.exitCode = failures.length ? 1 : 0;
  }
}

if (import.meta.main) await main();
