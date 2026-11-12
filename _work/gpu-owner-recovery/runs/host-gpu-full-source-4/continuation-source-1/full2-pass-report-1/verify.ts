// SPEC: _spec/gpu-full-qualification.puml
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runBounded } from "../../../../verify";
import { hash, reportRoot } from "./records";

const commands = [
  { id: "records", argv: [process.execPath, "--no-env-file", "--no-install", reportRoot + "records.ts", "--receive-report"] },
  { id: "unit", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./" + reportRoot + "records.test.ts"] },
  { id: "types", argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "--noEmit", "--strict", "--noUnusedLocals", "--noUnusedParameters", "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "Bundler", "--types", "bun", reportRoot + "records.ts", reportRoot + "records.test.ts", reportRoot + "verify.ts"] },
];
const label = Bun.argv[2];
if (!label || !/^verification-[1-9][0-9]?$/.test(label)) throw Error("FRESH_BOUNDED_RECORD_VERIFICATION_LABEL_REQUIRED");
const directory = reportRoot + label; await mkdir(directory);
const sources = await Promise.all(["reported-input.json", "records.ts", "records.test.ts", "verify.ts"].map(async name => ({ path: reportRoot + name, sha256: hash(await readFile(reportRoot + name)) })));
const results = [];
for (const command of commands) {
  const step = directory + "/" + command.id; await mkdir(step);
  const result = await runBounded(command.argv, resolve(step), 120000, { cwd: process.cwd(), environment: { PATH: "/usr/local/bin:/usr/bin:/bin", NO_COLOR: "1", MISE_AUTO_INSTALL: "false", MISE_EXEC_AUTO_INSTALL: "false", MISE_TASK_RUN_AUTO_INSTALL: "false" } });
  const streams = await Promise.all(["stdout", "stderr"].map(async name => { const path = step + "/command." + name, bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }));
  results.push({ ...command, ...result, streams }); if (result.status !== "PASS") break;
}
const sourceChanged = (await Promise.all(sources.map(async source => hash(await readFile(source.path)) !== source.sha256))).some(Boolean);
const passed = !sourceChanged && results.length === commands.length && results.every(result => result.status === "PASS");
await writeFile(directory + "/receipt.json", JSON.stringify({ status: passed ? "PASS_OPERATOR_REPORTED_FULL_SIX_RECORDS_SOURCE_TESTS_AND_TYPES_ONLY" : "FAIL_GPU_FULL_PASS_REPORT_VERIFICATION", sources, sourceChanged, results,
  originalHostFilesReceived: false, originalCaptureBytesRehashed: false, actualHostGpuOrNativeExecutedByCoding: false, automaticRetryAuthorized: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: passed ? "PASS" : "FAIL", receipt: directory + "/receipt.json", stages: results.length }));
process.exitCode = passed ? 0 : 1;
