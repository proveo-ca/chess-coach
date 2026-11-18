// SPEC: _spec/gpu-build.puml
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { environment, cache, repository, work } from "./provision";
import { runBounded } from "./verify";

const rust = resolve(cache, "rustup/toolchains/1.95.0-x86_64-unknown-linux-gnu/bin");
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const stages = [
  { name: "recipe", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./packages/runtime/tests/gpu-recipe.test.ts"], timeout: 30_000 },
  { name: "types-source", argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "-p", "tsconfig.json"], timeout: 120_000 },
  { name: "types-tests", argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "-p", "tsconfig.tests.json"], timeout: 120_000 },
  { name: "types-tools", argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "-p", "_work/gpu-owner-recovery/tsconfig.json"], timeout: 120_000 },
  { name: "cpu", argv: [resolve(rust, "cargo"), "test", "--locked", "--offline", "--jobs", "2", "-p", "chess-coach-learning", "-p", "chess-coach-policy-io"], timeout: 600_000 },
  { name: "cpu-recipe", argv: [resolve(rust, "cargo"), "test", "--locked", "--offline", "--jobs", "2", "-p", "chess-coach-host-facts", "--test", "recipe"], timeout: 120_000 },
];

async function main() {
  const [label] = Bun.argv.slice(2);
  if (Bun.argv.length !== 3 || !/^gpu-functional-local-[1-9][0-9]*$/.test(label ?? "") || resolve(process.cwd()) !== resolve(repository)) throw Error("LOCAL_FUNCTIONAL_VERIFICATION_CONTEXT_REQUIRED");
  const directory = resolve(work, "runs", label!);
  await mkdir(directory, { mode: 0o700 });
  const env = { ...environment, PATH: `${rust}:/usr/local/bin:/usr/bin:/bin`, RUSTC: resolve(rust, "rustc"), RUSTDOC: resolve(rust, "rustdoc"),
    CC: resolve(work, "zig-cc.ts"), CXX: resolve(work, "zig-cxx.ts"), AR: resolve(work, "zig-ar.ts"),
    CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER: resolve(work, "zig-cc.ts"),
    ZIG_GLOBAL_CACHE_DIR: resolve(cache, "zig/global"), ZIG_LOCAL_CACHE_DIR: resolve(cache, "zig/local"), CARGO_TERM_COLOR: "never", CARGO_NET_OFFLINE: "true" };
  const paths = new Set<string>();
  for (const pattern of ["package.json", "bun.lock", "Cargo.toml", "Cargo.lock", "tsconfig*.json", "crates/*/Cargo.toml", "crates/{learning,policy-io,host-facts}/**/*.rs",
    "packages/*/{src,tests}/**/*.{ts,json}", "tooling/**/*.{ts,json}", "schemas/**/*.json", "_work/gpu-owner-recovery/*.ts",
    "_work/gpu-owner-recovery/mise.toml", "_work/gpu-owner-recovery/tsconfig.json", "tooling/runtime/Dockerfile", "tooling/runtime/Dockerfile.gpu"]) {
    for await (const path of new Bun.Glob(pattern).scan({ cwd: repository, onlyFiles: true })) paths.add(path);
  }
  const sources = await Promise.all([...paths].sort().map(async path => ({ path, sha256: digest(await readFile(resolve(repository, path))) })));
  const sourceBytes = Buffer.from(JSON.stringify(sources, null, 2) + "\n");
  await writeFile(resolve(directory, "sources.json"), sourceBytes, { flag: "wx", mode: 0o600 });
  const results = [];
  for (const stage of stages) {
    const step = resolve(directory, stage.name);
    await mkdir(step, { mode: 0o700 });
    const result = await runBounded(stage.argv, step, stage.timeout, { cwd: repository, environment: env });
    const streams = await Promise.all(["stdout", "stderr"].map(async stream => {
      const path = resolve(step, `command.${stream}`), bytes = await readFile(path);
      return { path: relative(repository, path), bytes: bytes.length, sha256: digest(bytes) };
    }));
    const receipt = { stage: stage.name, argv: stage.argv, timeoutMs: stage.timeout, ...result, streams };
    await writeFile(resolve(step, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    results.push(receipt);
    if (result.status !== "PASS") break;
  }
  const sourceChanged = (await Promise.all(sources.map(async source => digest(await readFile(resolve(repository, source.path))) !== source.sha256))).some(Boolean);
  const status = results.length === stages.length && results.every(result => result.status === "PASS") && !sourceChanged ? "PASS" : "FAIL";
  const receipt = { version: "chess-coach.gpu-functional-local-verification.v1", scope: "LOCAL_RECIPE_TYPES_AND_DEFAULT_CPU_ONLY", status,
    sourceManifestSha256: digest(sourceBytes), sourceCount: sources.length, sourceChanged, environment: env, results,
    imageBuilt: false, actualHostExecuted: false, cudaGpuCodeExecuted: false, trainingReady: false };
  await writeFile(resolve(directory, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ receipt: relative(repository, resolve(directory, "receipt.json")), status, sourceChanged, trainingReady: false }));
  process.exitCode = status === "PASS" ? 0 : 1;
}

if (import.meta.main) await main();
