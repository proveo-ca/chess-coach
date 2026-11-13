// SPEC: _spec/runtime-protocol.puml
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BUN, ROOT, SOURCE, R, OP, RAW, OUTPUT, validateEligibility, sourceHashes, equal, encoded, sha } from "../../package-acquisition-bun-source1/capture.ts";

const output = `${R}/capture-eligibility-check-1`;
const roots = [OP, RAW, OUTPUT, `${R}/acquisition-invocation-1`];
function requireValue(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
function absent(path: string): void {
  try { lstatSync(join(ROOT, path)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
  throw new Error(`production-root-exists:${path}`);
}
function binding(path: string): { path: string; bytes: number; sha256: string } {
  const info = lstatSync(join(ROOT, path));
  requireValue(info.isFile() && !info.isSymbolicLink() && info.size <= 65536, "bounded-record");
  const data = readFileSync(join(ROOT, path));
  return { path, bytes: data.length, sha256: createHash("sha256").update(data).digest("hex") };
}
function save(name: string, value: unknown): void { writeFileSync(join(ROOT, output, name), encoded(value), { flag: "wx" }); }
requireValue(process.cwd() === ROOT && process.execPath === BUN && Bun.version === "1.4.0", "pinned-proof-runtime");
for (const path of roots) absent(path);
const before = sourceHashes();
const reviewRecords = ["backend", "devops", "adversarial", "security"].map(role => {
  const path = `${SOURCE}/review-5/${role}.json`;
  const review = JSON.parse(readFileSync(join(ROOT, path), "utf8"));
  requireValue(review.status === "READY_SOURCE_ONLY_FULL_SOURCE_AND_CLOCK_SCOPE" && review.remainingFindings.length === 0 && review.verification === "verification-10/receipt.json", `review:${role}`);
  return binding(path);
});
const identity = validateEligibility();
requireValue(equal(identity.sourceHashes, before) && equal(sourceHashes(), before), "source-drift");
for (const path of roots) absent(path);
save("eligibility-snapshot.json", identity);
save("source-manifest.json", [binding(`${output}/proof.ts`), binding(`${SOURCE}/execution-binding1.json`), binding(`${SOURCE}/verification-10/receipt.json`), ...reviewRecords]);
save("receipt.json", { status: "PASS_READ_ONLY_CAPTURE_ELIGIBILITY_AND_FOUR_REVIEW_BINDINGS_ONLY", identitySha256: sha(encoded(identity)), sourceHashes: before, productionRootsRemainAbsent: roots, nonAuthorizingBindingValidated: true, operationalPreflightPerformed: false, actualCaptureEntryOrWorkerInvoked: false, actualGetRequests: 0, combinedAttemptClaimed: false, grantConsumedOrRenewed: false, callerReadinessGranted: false, trainingReady: false });
console.log(JSON.stringify({ status: "PASS_READ_ONLY_CAPTURE_ELIGIBILITY_AND_FOUR_REVIEW_BINDINGS_ONLY", identitySha256: sha(encoded(identity)) }));
