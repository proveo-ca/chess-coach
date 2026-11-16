// SPEC: _spec/runtime-protocol.puml
import * as fs from "node:fs";
import { join } from "node:path";
import type { CommandResult } from "../../../../verify.ts";
import { ROOT, OP, RAW, OUTPUT, CAPS, readRegular, sha, equal, requireThat } from "../package-acquisition-bun-source2/capture.ts";
import { INVOCATION } from "./invoke-approved-bun.ts";
import { verify } from "../package-acquisition-bun-source2/verify.ts";

function state(path: string): unknown {
  try {
    const s = fs.lstatSync(join(ROOT, path), { bigint: true });
    return { exists: true, regular: s.isFile(), directory: s.isDirectory(), symlink: s.isSymbolicLink(), nlink: String(s.nlink), dev: String(s.dev), ino: String(s.ino), size: String(s.size), mtimeNs: String(s.mtimeNs), ctimeNs: String(s.ctimeNs) };
  } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return { exists: false }; throw e; }
}
export function bindingDataState(path: string): unknown {
  const before = state(path);
  if (equal(before, { exists: false })) return before;
  const bytes = readRegular(join(ROOT, path), CAPS.receipt);
  requireThat(equal(before, state(path)), "verification-binding-read-drift");
  return { exists: true, metadata: before, bytes: bytes.length, sha256: sha(bytes) };
}
export function productionAbsent(readState: (path: string) => unknown = state): boolean {
  return [OP, RAW, OUTPUT, INVOCATION].every(path => equal(readState(path), { exists: false }));
}
export interface VerificationRun { result: CommandResult | null; thrown: string | null; stdoutBytes: number; stderrBytes: number; stdoutSha256: string | null; stderrSha256: string | null; text: string; readFailure: string | null }
function passed(run: VerificationRun): boolean {
  return run.result?.status === "PASS" && run.result.exitCode === 0 && run.result.failure === null && !run.thrown && !run.readFailure &&
    Number.isSafeInteger(run.stdoutBytes) && run.stdoutBytes >= 0 && Number.isSafeInteger(run.stderrBytes) && run.stderrBytes >= 0 &&
    typeof run.stdoutSha256 === "string" && /^[a-f0-9]{64}$/.test(run.stdoutSha256) && typeof run.stderrSha256 === "string" && /^[a-f0-9]{64}$/.test(run.stderrSha256) &&
    run.result.stdoutBytes === run.stdoutBytes && run.result.stderrBytes === run.stderrBytes;
}
export function assessVerification(tests: VerificationRun, typecheck: VerificationRun, readchecksMatch: boolean, absent: boolean, captureProofMatchesSource: boolean) {
  const count = (label: "pass" | "fail"): number | null => {
    const matches = [...tests.text.matchAll(new RegExp(`^\\s*(\\d+) ${label}\\s*$`, "gm"))];
    const value = matches.length === 1 ? Number(matches[0]![1]) : NaN;
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  };
  const testsPassed = count("pass"), testsFailed = count("fail");
  const status = passed(tests) && passed(typecheck) && readchecksMatch && absent && captureProofMatchesSource && testsPassed !== null && testsPassed > 0 && testsFailed === 0 ? "PASS_OFFLINE_ONLY" : "FAIL_OFFLINE_ONLY";
  return { testsPassed, testsFailed, status };
}
export async function verifyInvocation(): Promise<string> { return verify("caller"); }
if (import.meta.main) {
  try { await verifyInvocation(); }
  catch (e) { process.stderr.write(`${e instanceof Error ? e.message : "invocation-verification-failed"}\n`); process.exitCode = 1; }
}
