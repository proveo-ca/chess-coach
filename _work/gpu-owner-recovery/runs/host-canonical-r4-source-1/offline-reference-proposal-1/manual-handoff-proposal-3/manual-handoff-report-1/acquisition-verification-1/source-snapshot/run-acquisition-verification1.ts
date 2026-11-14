// SPEC: _spec/manual-handoff-implementation-3.puml
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import { R, pin, emit } from "./acquisition-report1.ts";

const output = `${R}/acquisition-verification-1`; fs.mkdirSync(output, { mode: 0o700 });
const compiler = "node_modules/typescript/bin/tsc";
const commands = [
  { name: "report-tests", argv: ["--no-env-file", "--no-install", "test", `${R}/acquisition-report1.test.ts`] },
  { name: "strict-tsc", argv: ["--no-env-file", "--no-install", compiler, "--project", `${R}/acquisition-report1.tsconfig.json`] },
  { name: "report-check", argv: ["--no-env-file", "--no-install", `${R}/validate-acquisition-report1.ts`, "--emit-exclusive"] }
];
const records = commands.map(({ name, argv }) => {
  const result = spawnSync(process.execPath, argv, { cwd: process.cwd(), env: { LANG: "C", LC_ALL: "C" }, encoding: "buffer", timeout: 120000, maxBuffer: 2 ** 21 });
  const stdout = emit(`${output}/${name}.stdout`, result.stdout ?? Buffer.alloc(0)), stderr = emit(`${output}/${name}.stderr`, result.stderr ?? Buffer.alloc(0));
  return { name, executable: process.execPath, argv, cwd: process.cwd(), exitCode: result.status, signal: result.signal, error: result.error?.message ?? null, stdout, stderr };
});
emit(`${output}/result.json`, { version: "chess-coach.h3-acquisition-report-verification.v1", scope: "OFFLINE_REPORT_ONLY", commands: records,
  compiler: fs.existsSync(compiler) ? pin(compiler) : null, sourceQualificationsReplayed: false, actualHostOrNetworkExecuted: false, trainingReady: false });
for (const record of records) { assert.equal(record.exitCode, 0, record.name); assert.equal(record.signal, null); assert.equal(record.error, null); }
process.stdout.write(JSON.stringify({ status: "PASS_OFFLINE_REPORT_TESTS_TSC_AND_PRESERVATION", result: pin(`${output}/result.json`) }) + "\n");
