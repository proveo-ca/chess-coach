// SPEC: _spec/runtime-protocol.puml
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const root = "/home/gu1lty/Projects/proveo/chess-coach";
const directory = `${root}/_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-1/clock-comparison-1`;
const bun = "/usr/local/bin/bun";
const code = "process.stdout.write(JSON.stringify({pid:process.pid,ppid:process.ppid,bun:process.versions.bun,execPath:process.execPath,clockNs:process.hrtime.bigint().toString()})+'\\n')";
const samples: unknown[] = [];
let failure: string | null = null;
function requireValue(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
try {
  requireValue(process.cwd() === root && process.execPath === bun && process.versions.bun === "1.4.0", "pinned-parent");
  for (let index = 0; index < 3; index++) {
    const before = process.hrtime.bigint();
    const child = spawnSync(bun, ["--no-env-file", "--no-install", "--eval", code], { cwd: root, env: { LANG: "C", LC_ALL: "C" }, timeout: 3000, maxBuffer: 1024 });
    const after = process.hrtime.bigint();
    writeFileSync(`${directory}/child-${index}.stdout`, child.stdout, { flag: "wx" });
    writeFileSync(`${directory}/child-${index}.stderr`, child.stderr, { flag: "wx" });
    requireValue(child.status === 0 && child.signal === null && !child.error && child.stderr.length === 0, "child-exit-or-streams");
    const result = JSON.parse(child.stdout.toString("utf8"));
    requireValue(result.ppid === process.pid && result.bun === "1.4.0" && result.execPath === bun && /^[0-9]+$/.test(result.clockNs), "owned-clock-child");
    const stamp = BigInt(result.clockNs);
    samples.push({ index, beforeNs: before.toString(), child: result, afterNs: after.toString(), childInsideParentBracket: before <= stamp && stamp <= after });
    requireValue(before <= stamp && stamp <= after, "cross-process-hrtime-origin-mismatch");
  }
} catch (error) { failure = String(error); }
const source = readFileSync(`${directory}/proof.ts`);
const receipt = { status: failure ? "FAIL_PINNED_BUN_CROSS_PROCESS_CLOCK_COMPARISON" : "PASS_THREE_PINNED_BUN_CROSS_PROCESS_CLOCK_BRACKETS", failure, sourceSha256: createHash("sha256").update(source).digest("hex"), childSource: code, samples, scope: "OBSERVED_LOCAL_PINNED_BUN_HRTIME_COMPARABILITY_NOT_A_UNIVERSAL_RUNTIME_GUARANTEE", actualCaptureEntryOrWorkerInvoked: false, actualGetRequests: 0, productionRootsTouched: false, nativeHostGpuOrReferenceExecuted: false, approvalConsumedOrRenewed: false, trainingReady: false };
writeFileSync(`${directory}/receipt.json`, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: receipt.status, failure, samples: samples.length }));
process.exitCode = failure ? 1 : 0;
