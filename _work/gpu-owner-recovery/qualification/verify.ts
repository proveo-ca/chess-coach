// SPEC: _spec/gpu-qualification.puml
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { repository, work } from "../provision";
import { runBounded, sourceFilePaths } from "../verify";
import { sourceInventory } from "../../../tooling/runtime/qualification";

const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export async function checkSources(sources: { path: string; sha256: string }[], reader: (path: string) => Promise<Uint8Array>) {
  try { return { sourceChanged: (await Promise.all(sources.map(async source => hash(await reader(source.path)) !== source.sha256))).some(Boolean), failure: null }; }
  catch (error) { return { sourceChanged: true, failure: String(error) }; }
}

async function main() {
  const [label] = Bun.argv.slice(2);
  if (Bun.argv.length !== 3 || !/^gpu-qualification-source-[1-9][0-9]*$/.test(label ?? "") || resolve(process.cwd()) !== resolve(repository)) throw Error("SOURCE_CHECK_CONTEXT_REQUIRED");
  const directory = resolve(work, "runs", label!);
  await mkdir(directory);
  await mkdir(resolve(directory, "home")); await mkdir(resolve(directory, "tmp"));
  const paths = new Set([...(await sourceFilePaths("typecheck-source")), ...(await sourceInventory(repository)).map(source => source.path)]);
  for (const pattern of ["_work/gpu-owner-recovery/qualification/*.{ts,json}", "_work/gpu-owner-recovery/prepared-llvm*/**/*.{ts,json}"]) {
    for await (const path of new Bun.Glob(pattern).scan({ cwd: repository, onlyFiles: true })) paths.add(path);
  }
  const sources = await Promise.all([...paths].sort().map(async path => ({ path, sha256: hash(await readFile(resolve(repository, path))) })));
  const sourceBytes = Buffer.from(JSON.stringify(sources, null, 2) + "\n");
  await writeFile(resolve(directory, "sources.json"), sourceBytes, { flag: "wx" });
  const nativeSourceInventory = await sourceInventory(repository);
  await writeFile(resolve(directory, "host-source-manifest.json"), JSON.stringify(nativeSourceInventory, null, 2) + "\n", { flag: "wx" });
  const commands = [
    { name: "tests", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./packages/runtime/tests/gpu-recipe.test.ts", "./packages/runtime/tests/gpu-qualification.test.ts", "./_work/gpu-owner-recovery/prepared-llvm/verify.test.ts"] },
    ...["tsconfig.json", "tsconfig.tests.json", "_work/gpu-owner-recovery/tsconfig.json", "_work/gpu-owner-recovery/qualification/tsconfig.json"].map((project, index) => ({
      name: `types-${index}`, argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "-p", project],
    })),
  ];
  const environment = { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: resolve(directory, "home"), TMPDIR: resolve(directory, "tmp"), NO_COLOR: "1" };
  const results = [];
  let failure: string | null = null;
  try {
    for (const command of commands) {
      const step = resolve(directory, command.name); await mkdir(step);
      const result = await runBounded(command.argv, step, 120_000, { cwd: repository, environment });
      const streams = await Promise.all(["stdout", "stderr"].map(async stream => {
        const path = resolve(step, `command.${stream}`), bytes = await readFile(path);
        return { path: relative(repository, path), bytes: bytes.length, sha256: hash(bytes) };
      }));
      results.push({ ...command, ...result, streams });
      if (result.status !== "PASS") break;
    }
  } catch (error) { failure = String(error); }
  const checked = await checkSources(sources, path => readFile(resolve(repository, path)));
  const sourceChanged = checked.sourceChanged;
  failure ??= checked.failure;
  const status = !failure && !sourceChanged && results.length === commands.length && results.every(result => result.status === "PASS") ? "PASS_SOURCE_ONLY" : "FAIL_SOURCE_ONLY";
  const receipt = { version: "chess-coach.gpu-qualification-source.v1", status, failure, sourceManifestSha256: hash(sourceBytes), sourceCount: sources.length, sourceChanged, results,
    nativeSourceCount: nativeSourceInventory.length, cargoInvocations: 0, llvmInvocations: 0, compilationPerformed: false, downloadsPerformed: false,
    imageOperationPerformed: false, hostGpuOperationPerformed: false, trainingReady: false };
  await writeFile(resolve(directory, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status, receipt: relative(repository, resolve(directory, "receipt.json")) }));
  process.exitCode = status === "PASS_SOURCE_ONLY" ? 0 : 1;
}

if (import.meta.main) await main();
