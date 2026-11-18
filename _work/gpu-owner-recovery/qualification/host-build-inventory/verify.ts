// SPEC: _spec/gpu-host-build-inventory.puml
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { repository, work } from "../../provision";
import { runBounded, sourceFilePaths } from "../../verify";
import { sourceInventory } from "../../../../tooling/runtime/qualification";
import { renderHostBuildInventory } from "./render";
import plan from "./plan-run2.json";

const [label] = Bun.argv.slice(2);
if (Bun.argv.length !== 3 || !/^host-build-inventory-source-[1-9][0-9]*$/.test(label ?? "") || resolve(process.cwd()) !== resolve(repository)) throw Error("HOST_BUILD_INVENTORY_SOURCE_CONTEXT_REQUIRED");
const directory = resolve(work, "runs", label!), hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
await mkdir(directory); await mkdir(resolve(directory, "home")); await mkdir(resolve(directory, "tmp")); await mkdir(resolve(directory, "e2e"));
const native = await sourceInventory(repository), paths = new Set([...(await sourceFilePaths("typecheck-source")), ...native.map(row => row.path),
  "_work/gpu-owner-recovery/provision.ts", "tooling/runtime/Dockerfile", "tooling/runtime/Dockerfile.gpu",
  "_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/preparation.json", "_work/gpu-owner-recovery/runs/gpu-prepared-llvm-local-6/sources.json",
  "_work/gpu-owner-recovery/runs/host-build-inventory-source-3/receipt.json", "_work/gpu-owner-recovery/runs/host-build-inventory-source-3/host-command.fish",
  "_work/gpu-owner-recovery/runs/host-build-inventory-handoff-1/request.json"]);
for (const pattern of ["_work/gpu-owner-recovery/qualification/host-build-inventory/*.{ts,json}", "_work/gpu-owner-recovery/qualification/host-build-inventory/fixtures/*.json", "_work/gpu-owner-recovery/qualification/host-receive/*.{ts,json}",
  "_work/gpu-owner-recovery/runs/host-input-receive-observation-2/*.{ts,json,txt}", "_work/gpu-owner-recovery/runs/host-build-inventory-observation-1/*.{ts,json,txt}"]) for await (const path of new Bun.Glob(pattern).scan({ cwd: repository, onlyFiles: true })) paths.add(path);
const sources = await Promise.all([...paths].sort().map(async path => ({ path, sha256: hash(await readFile(resolve(repository, path))) })));
const command = Buffer.from(await renderHostBuildInventory() + "\n");
await writeFile(resolve(directory, "host-command.fish"), command, { flag: "wx" });
await writeFile(resolve(directory, "sources.json"), JSON.stringify(sources, null, 2) + "\n", { flag: "wx" });
const commands = [
  { name: "inventory-unit", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./_work/gpu-owner-recovery/qualification/host-build-inventory/render.test.ts"] },
  { name: "qualification-unit", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./packages/runtime/tests/gpu-recipe.test.ts", "./packages/runtime/tests/gpu-qualification.test.ts", "./_work/gpu-owner-recovery/prepared-llvm/verify.test.ts"] },
  ...["tsconfig.json", "tsconfig.tests.json", "_work/gpu-owner-recovery/qualification/tsconfig.json", "_work/gpu-owner-recovery/qualification/host-build-inventory/tsconfig.json"].map((project, index) => ({ name: "types-" + index, argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "-p", project] })),
];
const results = []; let failure: string | null = null, sourceChanged = false;
try {
  for (const command of commands) {
    const step = resolve(directory, command.name); await mkdir(step);
    const result = await runBounded(command.argv, step, 120000, { cwd: repository, environment: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: resolve(directory, "home"), TMPDIR: resolve(directory, "tmp"), NO_COLOR: "1", MISE_AUTO_INSTALL: "false", MISE_EXEC_AUTO_INSTALL: "false", MISE_TASK_RUN_AUTO_INSTALL: "false", INVENTORY_TEST_EVIDENCE: resolve(directory, "e2e") } });
    const streams = await Promise.all(["stdout", "stderr"].map(async stream => { const path = resolve(step, "command." + stream), bytes = await readFile(path); return { path: relative(repository, path), bytes: bytes.length, sha256: hash(bytes) }; }));
    results.push({ ...command, ...result, streams }); if (result.status !== "PASS") break;
  }
  sourceChanged = (await Promise.all(sources.map(async row => hash(await readFile(resolve(repository, row.path))) !== row.sha256))).some(Boolean);
  sourceChanged ||= JSON.stringify(await sourceInventory(repository)) !== JSON.stringify(native);
} catch (error) { failure = String(error); sourceChanged = true; }
const status = !failure && !sourceChanged && results.length === commands.length && results.every(row => row.status === "PASS") ? "PASS_HOST_BUILD_INVENTORY_SOURCE_ONLY" : "FAIL_HOST_BUILD_INVENTORY_SOURCE_ONLY";
await writeFile(resolve(directory, "receipt.json"), JSON.stringify({ status, failure, sourceChanged, sources, results,
  command: { path: relative(repository, resolve(directory, "host-command.fish")), bytes: command.length, sha256: hash(command) }, plan,
  fishSyntax: "NOT_RUN_LOCALLY_HOST_PRECHECK_EMBEDDED", hostExecutionApproved: false, sourcePublicationRequired: false, actualHostQueriesPerformed: false,
  payloadsReadOrCopied: false, buildPerformed: false, nativeOrGpuExecuted: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status, sources: sources.length, commandSha256: hash(command), receipt: relative(repository, resolve(directory, "receipt.json")) }));
process.exitCode = status === "PASS_HOST_BUILD_INVENTORY_SOURCE_ONLY" ? 0 : 1;
