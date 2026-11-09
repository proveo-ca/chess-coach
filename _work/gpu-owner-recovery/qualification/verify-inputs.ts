// SPEC: _spec/gpu-qualification.puml
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { repository, work } from "../provision";
import { runBounded } from "../verify";

const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const [label] = Bun.argv.slice(2);
if (Bun.argv.length !== 3 || !/^gpu-input-inventory-source-[1-9][0-9]*$/.test(label ?? "") || resolve(process.cwd()) !== resolve(repository)) throw Error("INPUT_SOURCE_CHECK_CONTEXT_REQUIRED");
const directory = resolve(work, "runs", label!);
await mkdir(directory); await mkdir(resolve(directory, "home")); await mkdir(resolve(directory, "tmp"));
const paths = ["qualification/input-request.json", "qualification/input-inventory.ts", "qualification/input-inventory.test.ts", "qualification/inspect-builder.fish",
  "qualification/verify-inputs.ts", "qualification/tsconfig.json", "provision.ts", "verify.ts", "command-supervisor.ts"].map(path => relative(repository, resolve(work, path)));
paths.push("tsconfig.json", "Cargo.lock");
const sources = await Promise.all(paths.map(async path => ({ path, sha256: hash(await readFile(path)) })));
await writeFile(resolve(directory, "sources.json"), JSON.stringify(sources, null, 2) + "\n", { flag: "wx" });
const fishCandidate = "/home/agent/toolchains/linux-amd64/.local/share/mise/installs/github-fish-shell-fish-shell/4.9.3/fish";
const fish = await access(fishCandidate, constants.X_OK).then(() => fishCandidate, () => null);
const commands = [
  { name: "unit", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./_work/gpu-owner-recovery/qualification/input-inventory.test.ts"] },
  { name: "types", argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "-p", "_work/gpu-owner-recovery/qualification/tsconfig.json"] },
  ...(fish ? [{ name: "fish-syntax", argv: [fish, "--no-config", "--no-execute", resolve(work, "qualification/inspect-builder.fish")] }] : []),
];
const results = [];
const attemptedStages: string[] = [];
let failure: string | null = null, sourceChanged = false;
try {
  for (const command of commands) {
    const step = resolve(directory, command.name); await mkdir(step);
    attemptedStages.push(command.name);
    const result = await runBounded(command.argv, step, 120_000, { cwd: repository,
      environment: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: resolve(directory, "home"), TMPDIR: resolve(directory, "tmp"), NO_COLOR: "1",
        MISE_AUTO_INSTALL: "false", MISE_TASK_RUN_AUTO_INSTALL: "false" } });
    const streams = await Promise.all(["stdout", "stderr"].map(async stream => {
      const path = resolve(step, `command.${stream}`), bytes = await readFile(path);
      return { path: relative(repository, path), bytes: bytes.length, sha256: hash(bytes) };
    }));
    results.push({ ...command, ...result, streams });
    if (result.status !== "PASS") break;
  }
  sourceChanged = (await Promise.all(sources.map(async source => hash(await readFile(source.path)) !== source.sha256))).some(Boolean);
} catch (error) { failure = String(error); sourceChanged = true; }
const status = !failure && !sourceChanged && results.length === commands.length && results.every(result => result.status === "PASS") ? "PASS_INPUT_SOURCE_ONLY" : "FAIL_INPUT_SOURCE_ONLY";
await writeFile(resolve(directory, "receipt.json"), JSON.stringify({ version: "chess-coach.input-inventory-source.v1", status, failure, sourceChanged, sources, results,
  fishSyntaxChecked: results.some(result => result.name === "fish-syntax" && result.status === "PASS"), fishSyntaxAttempted: attemptedStages.includes("fish-syntax"),
  fishSyntaxAvailable: Boolean(fish), fishSyntaxSkipReason: !fish ? "EXISTING_FISH_UNAVAILABLE_NO_INSTALLATION_AUTHORIZED" : attemptedStages.includes("fish-syntax") ? null : "EARLIER_STAGE_FAILED", metadataInventoryExecuted: false,
  hostPacketExecuted: false, imageOperationPerformed: false, llvmExecuted: false, compilationPerformed: false, gpuExecuted: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status, fishSyntaxChecked: results.some(result => result.name === "fish-syntax" && result.status === "PASS"), receipt: relative(repository, resolve(directory, "receipt.json")) }));
process.exitCode = status === "PASS_INPUT_SOURCE_ONLY" ? 0 : 1;
