// SPEC: _spec/gpu-full-qualification.puml
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBounded } from "../../../../verify";

const directory = fileURLToPath(new URL("./", import.meta.url));
const relative = "_work/gpu-owner-recovery/runs/host-gpu-full-source-4/continuation-source-1/full2-status-report-1/";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const commands = [
  { id: "unit", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./" + relative + "records.test.ts"] },
  { id: "types", argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "--noEmit", "--strict", "--noUnusedLocals", "--noUnusedParameters", "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "Bundler", "--types", "bun", relative + "records.test.ts", relative + "verify.ts"] },
  { id: "host-checkout-inputs", argv: ["git", "diff", "--no-ext-diff", "--no-textconv", "--exit-code", "35048e5c70ca9658a5faf8dbff73bd786c3d9cee", "f6bce72a2cd10f66acf77162166a1d03fc87cd13", "--", "Cargo.lock", "_work/gpu-owner-recovery/verify.ts", "_work/gpu-owner-recovery/command-supervisor.ts", "_work/gpu-owner-recovery/runs/host-gpu-full-source-4/host-command.fish"] },
  { id: "docs-whitespace", argv: ["git", "diff", "--check", "--", "_spec"] },
];

export async function verifyStatusReport(label: string) {
  if (!/^verification-[1-9][0-9]?$/.test(label)) throw Error("BOUNDED_FRESH_VERIFICATION_LABEL_REQUIRED");
  const verification = resolve(directory, label);
  await mkdir(verification);
  const sources = await Promise.all(["reported-status.txt", "observation.json", "fresh-manual-host-request.json", "fresh-manual-host-approval.json", "manual-delivery-observation.json", "publication-request.json", "manual-redelivery-approval.json", "records.test.ts", "verify.ts"].map(async path => ({ path: relative + path, sha256: hash(await readFile(resolve(directory, path))) })));
  const results = [];
  for (const command of commands) {
    const step = resolve(verification, command.id); await mkdir(step);
    const result = await runBounded(command.argv, step, 120000, { cwd: process.cwd(), environment: { PATH: "/usr/local/bin:/usr/bin:/bin", NO_COLOR: "1", GIT_NO_LAZY_FETCH: "1", GIT_NO_REPLACE_OBJECTS: "1", GIT_OPTIONAL_LOCKS: "0", MISE_AUTO_INSTALL: "false", MISE_EXEC_AUTO_INSTALL: "false", MISE_TASK_RUN_AUTO_INSTALL: "false" } });
    const streams = await Promise.all(["stdout", "stderr"].map(async name => {
      const path = relative + label + "/" + command.id + "/command." + name, bytes = await readFile(resolve(step, "command." + name));
      return { path, bytes: bytes.length, sha256: hash(bytes) };
    }));
    results.push({ ...command, ...result, streams });
    if (result.status !== "PASS") break;
  }
  const sourceChanged = (await Promise.all(sources.map(async source => hash(await readFile(source.path)) !== source.sha256))).some(Boolean);
  const passed = !sourceChanged && results.length === commands.length && results.every(result => result.status === "PASS");
  await writeFile(resolve(verification, "receipt.json"), JSON.stringify({ status: passed ? "PASS_STATUS_REPORT_AND_FRESH_MANUAL_APPROVAL_RECORDS_ONLY" : "FAIL_STATUS_REPORT_LOCAL_VERIFICATION", sources, sourceChanged, results, reportedHostGitCommit: "f6bce72a2cd10f66acf77162166a1d03fc87cd13", hostCommandExecuted: false, nativeCompilationOrGpuExecutionPerformed: false, frozenManifestMembersRehashed: false, originalHostBytesVerified: false, filesDeleted: 0, automaticRetryAuthorized: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: passed ? "PASS" : "FAIL", receipt: relative + label + "/receipt.json", stages: results.length }));
  process.exitCode = passed ? 0 : 1;
}

if (import.meta.main) await verifyStatusReport(Bun.argv[2] ?? "");
