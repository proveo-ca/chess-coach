// SPEC: _spec/gpu-input-transfer.puml
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { sourceInputPaths, sourceInventory } from "../../../../tooling/runtime/qualification";
import { repository, work } from "../../provision";
import { runBounded, sourceFilePaths } from "../../verify";

const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const [label] = Bun.argv.slice(2);
if (Bun.argv.length !== 3 || !/^gpu-input-transfer-source-[1-9][0-9]*$/.test(label ?? "") || resolve(process.cwd()) !== resolve(repository)) throw Error("TRANSFER_SOURCE_CHECK_CONTEXT_REQUIRED");
const directory = resolve(work, "runs", label!);
await mkdir(directory); await mkdir(resolve(directory, "home")); await mkdir(resolve(directory, "tmp"));
const paths = new Set([...(await sourceFilePaths("typecheck-source")), ...(await sourceInventory(repository)).map(source => source.path),
  "_work/gpu-owner-recovery/provision.ts",
  "tooling/runtime/Dockerfile", "tooling/runtime/Dockerfile.gpu", "_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-6/sources.json",
  "_work/gpu-owner-recovery/runs/gpu-qualification-llvm-flags-1/receipt.json", "_work/gpu-owner-recovery/runs/gpu-prepared-llvm-cache-1/registry-manifest.json",
  "_work/gpu-owner-recovery/runs/gpu-qualification-input-inventory-1/command.stdout"]);
for (const name of ["preparation.json", "receipt.json", "context-manifest.json", "source-gate.json", "publication.json"]) paths.add("_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/" + name);
paths.add("_work/gpu-owner-recovery/runs/gpu-input-transfer-source-3/receipt.json");
for (const name of ["publication.json", "reuse.json", "outcome-check.json"]) paths.add("_work/gpu-owner-recovery/runs/host-feasibility-publication-2/" + name);
for (const pattern of ["_work/gpu-owner-recovery/qualification/**/*.{ts,json,fish}", "_work/gpu-owner-recovery/prepared-llvm*/**/*.{ts,json}"]) {
  for await (const path of new Bun.Glob(pattern).scan({ cwd: repository, onlyFiles: true })) paths.add(path);
}
const sources = await Promise.all([...paths].sort().map(async path => ({ path, sha256: hash(await readFile(resolve(repository, path))) })));
const nativePaths = await sourceInputPaths(repository);
await writeFile(resolve(directory, "sources.json"), JSON.stringify(sources, null, 2) + "\n", { flag: "wx" });
const commands = [
  { name: "transfer-unit", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./_work/gpu-owner-recovery/qualification/transfer/archive.test.ts", "./_work/gpu-owner-recovery/qualification/transfer/prepare.test.ts", "./_work/gpu-owner-recovery/qualification/transfer/publish.test.ts"] },
  { name: "qualification-unit", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./packages/runtime/tests/gpu-recipe.test.ts", "./packages/runtime/tests/gpu-qualification.test.ts", "./_work/gpu-owner-recovery/prepared-llvm/verify.test.ts"] },
  ...["tsconfig.json", "tsconfig.tests.json", "_work/gpu-owner-recovery/qualification/tsconfig.json", "_work/gpu-owner-recovery/qualification/transfer/tsconfig.json"].map((project, index) => ({
    name: `types-${index}`, argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "-p", project],
  })),
];
const results = [];
let failure: string | null = null, sourceChanged = false;
try {
  for (const command of commands) {
    const step = resolve(directory, command.name); await mkdir(step);
    const result = await runBounded(command.argv, step, 120_000, { cwd: repository, environment: {
      PATH: "/usr/local/bin:/usr/bin:/bin", HOME: resolve(directory, "home"), TMPDIR: resolve(directory, "tmp"), NO_COLOR: "1", MISE_AUTO_INSTALL: "false", MISE_TASK_RUN_AUTO_INSTALL: "false",
    } });
    const streams = await Promise.all(["stdout", "stderr"].map(async stream => {
      const path = resolve(step, `command.${stream}`), bytes = await readFile(path);
      return { path: relative(repository, path), bytes: bytes.length, sha256: hash(bytes) };
    }));
    results.push({ ...command, ...result, streams });
    if (result.status !== "PASS") break;
  }
  sourceChanged = (await Promise.all(sources.map(async source => hash(await readFile(resolve(repository, source.path))) !== source.sha256))).some(Boolean);
  sourceChanged ||= JSON.stringify(await sourceInputPaths(repository)) !== JSON.stringify(nativePaths);
} catch (error) { failure = String(error); sourceChanged = true; }
const status = !failure && !sourceChanged && results.length === commands.length && results.every(result => result.status === "PASS") ? "PASS_TRANSFER_SOURCE_ONLY" : "FAIL_TRANSFER_SOURCE_ONLY";
await writeFile(resolve(directory, "receipt.json"), JSON.stringify({ version: "chess-coach.qualification-transfer-source.v1", status, failure, sourceChanged, sources, results,
  nativeSourceCount: (await sourceInventory(repository)).length, payloadAcquisitionPerformed: false, llvmPayloadsRead: false, preparationExecuted: false, publicationExecuted: false,
  llvmExecuted: false, cargoExecuted: false, hostOrGpuExecuted: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status, sources: sources.length, receipt: relative(repository, resolve(directory, "receipt.json")) }));
process.exitCode = status === "PASS_TRANSFER_SOURCE_ONLY" ? 0 : 1;
