// SPEC: _spec/runtime-protocol.puml
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, SOURCE, R, D, OP, RAW, OUTPUT, BUN, validateEligibility, encoded, sha } from "../package-acquisition-bun-source1/capture.ts";
import { READY, INVOCATION, validateInvocationReady } from "./invoke-approved-bun.ts";

type Binding = { path: string; sha256: string; bytes?: number };
const label = Bun.argv[2], reviewLabel = Bun.argv[3];
if (Bun.argv.length !== 4 || !/^pre-invocation-check-[1-9][0-9]?$/.test(label ?? "") || !/^caller-review-[1-9][0-9]?$/.test(reviewLabel ?? "")) throw new Error("closed-fresh-check-and-review-labels-required");
const directory = `${R}/${label}`;
const documents = ["_spec/.spec-index.json", "_spec/runtime-protocol.puml", "_spec/gpu-qualification.puml", "_spec/gpu-full-qualification.puml", "_spec/gpu-readiness.md", "_spec/gate-closure.md", "_spec/readiness.md"];
function requireValue(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
function local(path: string): string {
  requireValue(path.length > 0 && !path.startsWith("/") && !path.split("/").some(part => ["..", "cache", ".bun"].includes(part)), "bounded-source-path");
  requireValue(!/\.(?:tgz|tar|gz|xz|zip|zst|bpk)$/.test(path), "archive-payload-forbidden");
  return join(ROOT, path);
}
function data(path: string): Buffer {
  const target = local(path), info = lstatSync(target);
  requireValue(info.isFile() && !info.isSymbolicLink() && info.size <= 16 * 1024 * 1024, `bounded-regular:${path}`);
  const result = readFileSync(target);
  requireValue(result.length === info.size, `read-size:${path}`);
  return result;
}
function binding(path: string): Binding { const bytes = data(path); return { path, bytes: bytes.length, sha256: sha(bytes) }; }
function json(path: string): any { return JSON.parse(data(path).toString("utf8")); }
function verifyRows(rows: Binding[], count: number): void {
  requireValue(rows.length === count, "binding-count");
  for (const row of rows) {
    const actual = binding(row.path);
    requireValue(actual.sha256 === row.sha256 && (row.bytes === undefined || actual.bytes === row.bytes), `source-drift:${row.path}`);
  }
}
function absent(path: string): void {
  try { lstatSync(join(ROOT, path)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
  throw new Error(`production-root-not-fresh:${path}`);
}
function save(name: string, value: unknown): void { writeFileSync(local(`${directory}/${name}`), JSON.stringify(value, null, 2) + "\n", { flag: "wx" }); }
function git(name: string, args: string[]): string {
  const result = spawnSync("/usr/bin/git", ["--no-optional-locks", "-c", "core.fsmonitor=false", ...args], { cwd: ROOT, env: { PATH: "/usr/bin:/bin", LANG: "C.UTF-8", GIT_TERMINAL_PROMPT: "0" }, timeout: 10000, maxBuffer: 512 * 1024 });
  writeFileSync(local(`${directory}/${name}.stdout`), result.stdout, { flag: "wx" });
  writeFileSync(local(`${directory}/${name}.stderr`), result.stderr, { flag: "wx" });
  requireValue(!result.error && result.status === 0 && result.signal === null, `git:${name}`);
  return result.stdout.toString("utf8");
}
requireValue(process.cwd() === ROOT && process.execPath === BUN && Bun.version === "1.4.0", "pinned-proof-runtime");
mkdirSync(local(directory));
const checks: Record<string, unknown> = {};
let failure: string | null = null;
let before: Binding[] = [binding(`${R}/pre-invocation-check.ts`)];
try {
  for (const path of [OP, RAW, OUTPUT, INVOCATION]) absent(path);
  const identity = validateEligibility();
  validateInvocationReady(identity);
  const ready = json(READY), callerProofPath: string = ready.invocationProof.path;
  const caller = json(callerProofPath), captureProofPath = `${SOURCE}/verification-10/receipt.json`;
  const capture = json(captureProofPath);
  requireValue(capture.status === "PASS_OFFLINE_ONLY" && capture.testsPassed === 281 && capture.testsFailed === 0 && capture.typecheckExitCode === 0 && capture.readchecksMatch === true, "capture-proof");
  requireValue(caller.status === "PASS_OFFLINE_ONLY" && caller.testsPassed > 0 && caller.testsFailed === 0 && caller.typecheckExitCode === 0 && caller.readchecksMatch === true && caller.bindingDataUnchanged === true && caller.captureProofMatchesSource === true && caller.actualGetRequests === 0 && caller.productionRootsTouched === false, "caller-proof");
  const reviews = ["backend", "devops", "adversarial", "security"].flatMap(role => {
    const helperPath = `${SOURCE}/review-5/${role}.json`, callerPath = `${R}/${reviewLabel}/${role}.json`;
    for (const [path, status, proof] of [[helperPath, "READY_SOURCE_ONLY_FULL_SOURCE_AND_CLOCK_SCOPE", "verification-10/receipt.json"], [callerPath, "READY_CALLER_SOURCE_ONLY", callerProofPath.slice(R.length + 1)]] as const) {
      const record = json(path);
      requireValue(record.status === status && record.remainingFindings.length === 0 && record.verification === proof && record.operationalReadinessGranted === false, `review:${path}`);
    }
    return [helperPath, callerPath];
  });
  const nativeManifest = "_work/gpu-owner-recovery/runs/host-gpu-policy-record-correction-source-2/native-source-manifest.json";
  const frozenManifest = "_work/gpu-owner-recovery/runs/host-gpu-full-source-4/sources.json";
  const protectedManifest = "_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/receipt.json";
  const canonicalManifest = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/verification-4/sources-after.json";
  requireValue(binding(nativeManifest).sha256 === "7e0aa13c178a77e01526d7fa02189c404c1ce3b44666914665cb9ca63a3521ec", "native-manifest-pin");
  for (const [name, rows, count] of [["frozen347", json(frozenManifest), 347], ["protected327", json(protectedManifest).sources, 327], ["native65", json(nativeManifest), 65], ["canonical92", json(canonicalManifest), 92]] as const) {
    verifyRows(rows, count); checks[name] = count;
  }
  let payloadFiles = 0, payloadBytes = 0;
  const inputMetadata: string[] = [];
  for (const [packet, count, bytes] of [["local-inputs-1", 427, 3850400], ["corpus-inputs-1", 2, 671849]] as const) {
    const path = `${D}/${packet}/materialization.json`, materialization = json(path);
    const rows: Binding[] = materialization.files.map((row: Binding) => ({ ...row, path: `${D}/${packet}/inputs/reference/${row.path}` }));
    verifyRows(rows, count);
    const total = rows.reduce((sum, row) => sum + (row.bytes ?? 0), 0);
    requireValue(total === bytes, "payload-byte-count");
    inputMetadata.push(path, `${D}/${packet}/input-manifest.json`, `${D}/${packet}/check.json`);
    payloadFiles += count; payloadBytes += total;
  }
  checks.materializedInputs = { files: payloadFiles, bytes: payloadBytes, assembledRuntimeRoot: false };
  const pythonBaseline = `${R}/bun-transition-baseline-1/source-manifest.json`;
  verifyRows(json(pythonBaseline), 8);
  checks.preservedStoppedPythonFiles = 8;
  const clockProofPath = `${SOURCE}/verification-10/clock-domain-proof.json`;
  const clockProof = json(clockProofPath);
  requireValue(clockProof.status === "PASS_SYNTHETIC_PROCESS_LOCAL_DOMAINS" && clockProof.captureSourceSha256 === identity.sourceHashes["capture.ts"] && clockProof.productionWorkerInvoked === false && clockProof.actualGetRequests === 0, "clock-proof-scope");
  const index = json(documents[0]!);
  requireValue(index.unresolved.length === 0 && index.specs.every((row: { covers: string[] }) => row.covers.length > 0), "spec-index");
  for (const path of documents.slice(1)) {
    const text = data(path).toString("utf8");
    requireValue(text.includes("trainingReady:false") && text.includes("APPROVED_UNUSED"), `current-doc-authority:${path}`);
    if (path.endsWith(".puml")) {
      const entry = index.specs.find((row: { spec: string }) => row.spec === path);
      requireValue((text.match(/@startuml/g) ?? []).length === 1 && (text.match(/@enduml/g) ?? []).length === 1 && entry && JSON.stringify([...text.matchAll(/^' covers: (.+)$/gm)].map(match => match[1])) === JSON.stringify(entry.covers), `diagram:${path}`);
    }
  }
  const paths = [...documents, `${R}/pre-invocation-check.ts`, READY, `${SOURCE}/execution-binding1.json`, captureProofPath, callerProofPath, clockProofPath, nativeManifest, frozenManifest, protectedManifest, canonicalManifest, pythonBaseline, ...inputMetadata, ...reviews, `${R}/approval1.json`, `${R}/request.json`, `${R}/plan.json`, `${R}/bun-clock-selection1.json`, `${R}/bun-design3.json`];
  before = [...new Set(paths)].map(binding);
  requireValue(git("head", ["rev-parse", "HEAD"]).trim() === "6fdc92c7eb90eb625e6d54c6a448009d5db34423", "head-changed");
  requireValue(git("branch", ["symbolic-ref", "--short", "HEAD"]).trim() === "feat-ml-adjuntant-ii", "branch-changed");
  const changed = git("changed", ["diff", "--name-only"]).trim().split("\n");
  requireValue(git("staged", ["diff", "--cached", "--name-only"]).trim() === "" && JSON.stringify(changed.sort()) === JSON.stringify([...documents].sort()), "tracked-change-scope");
  git("whitespace", ["diff", "--check", "--", ...documents]);
  git("spec-diff", ["diff", "--no-ext-diff", "--no-textconv", "HEAD", "--", ...documents]);
  verifyRows(before, before.length);
  requireValue(sha(encoded(validateEligibility())) === sha(encoded(identity)), "final-eligibility-drift");
  validateInvocationReady(identity);
  for (const path of [OP, RAW, OUTPUT, INVOCATION]) absent(path);
  checks.reviewRoles = { helper: 4, caller: 4, operationalPermissionFromReviews: false };
  checks.sourceProofs = { capture: { path: captureProofPath, tests: capture.testsPassed, typecheckExitCode: 0 }, caller: { path: callerProofPath, tests: caller.testsPassed, typecheckExitCode: 0 } };
  checks.readOnlyIdentitySha256 = sha(encoded(identity));
} catch (error) { failure = String(error); }
save("source-manifest.json", before);
const receipt = { status: failure ? "FAIL_PRE_INVOCATION_PACKET_CHECK" : "PASS_PRE_INVOCATION_PACKET_ONLY", failure, checks, sourceManifestSha256: createHash("sha256").update(data(`${directory}/source-manifest.json`)).digest("hex"), actualCaptureEntryOrWorkerInvoked: false, actualGetRequests: 0, operationalPreflightPerformed: false, combinedAttemptClaimed: false, rawArchiveOrCachePayloadRead: false, nativeHostGpuReferenceOrTrainingExecuted: false, gitMutationOrPublicationPerformed: false, acquisitionGrantConsumedOrRenewed: false, qualificationOrTrainingReadinessGranted: false, trainingReady: false };
save("receipt.json", receipt);
console.log(JSON.stringify({ status: receipt.status, failure, receipt: `${directory}/receipt.json` }));
process.exitCode = failure ? 1 : 0;
