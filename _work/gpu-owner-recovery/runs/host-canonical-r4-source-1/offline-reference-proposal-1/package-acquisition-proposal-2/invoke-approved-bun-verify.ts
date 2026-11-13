// SPEC: _spec/runtime-protocol.puml
import * as fs from "node:fs";
import { join } from "node:path";
import { ROOT, OP, RAW, OUTPUT, CAPS, readRegular, sha, equal, requireThat } from "../package-acquisition-bun-source2/capture.ts";
import { INVOCATION } from "./invoke-approved-bun.ts";
import { verify } from "../package-acquisition-bun-source2/verify.ts";
export { assessVerification } from "../package-acquisition-bun-source2/verify.ts";
export type { VerificationRun } from "../package-acquisition-bun-source2/verify.ts";

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
export async function verifyInvocation(): Promise<string> { return verify("caller"); }
if (import.meta.main) {
  try { await verifyInvocation(); }
  catch (e) { process.stderr.write(`${e instanceof Error ? e.message : "invocation-verification-failed"}\n`); process.exitCode = 1; }
}
