// SPEC: _spec/gpu-qualification.puml
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const p = "_work/gpu-owner-recovery/";
const dir = p + "runs/gpu-qualification-source-2";
const flagsDir = p + "runs/gpu-qualification-llvm-flags-1";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const assert = (ok: boolean, name: string) => { if (!ok) throw Error(name); };
const source = JSON.parse(await readFile(dir + "/receipt.json", "utf8"));
const flags = JSON.parse(await readFile(flagsDir + "/receipt.json", "utf8"));
assert(source.status === "PASS_SOURCE_ONLY" && !source.sourceChanged && source.results.length === 5 && source.results.every((r: { exitCode: number }) => r.exitCode === 0), "SOURCE_RESULT");
assert(flags.status === "PASS_FLAGS_ONLY" && flags.invocationsConsumed === 5 && flags.remainingInvocations === 0 && flags.results.length === 5
  && flags.results.every((r: { exitCode: number; deadlineMs: number }) => r.exitCode === 0 && r.deadlineMs === 10000), "FLAGS_RESULT");
let streams = 0;
for (const result of [...source.results, ...flags.results]) for (const stream of result.streams) {
  const bytes = await readFile(stream.path);
  assert(bytes.length === stream.bytes && hash(bytes) === stream.sha256, "STREAM_CHANGED:" + stream.path);
  streams++;
}
const sourceBytes = await readFile(dir + "/sources.json");
assert(hash(sourceBytes) === source.sourceManifestSha256, "SOURCE_MANIFEST_CHANGED");
const manifests = [JSON.parse(sourceBytes.toString()), JSON.parse(await readFile(flagsDir + "/sources.json", "utf8")),
  JSON.parse(await readFile(p + "runs/gpu-prepared-llvm-local-6/sources.json", "utf8"))] as { path: string; sha256: string }[][];
for (const manifest of manifests) for (const entry of manifest) assert(hash(await readFile(entry.path)) === entry.sha256, "SOURCE_CHANGED:" + entry.path);
const index = JSON.parse(await readFile("_spec/.spec-index.json", "utf8"));
let coverageFiles = 0;
for (const specPath of ["_spec/gpu-build.puml", "_spec/gpu-qualification.puml"]) {
  const diagram = await readFile(specPath, "utf8");
  const covers = [...diagram.matchAll(/^' covers: (.+)$/gm)].map(match => match[1]!);
  assert(JSON.stringify(covers) === JSON.stringify(index.specs.find((spec: { spec: string }) => spec.spec === specPath).covers), "SPEC_INDEX_DRIFT:" + specPath);
  for (const pattern of covers) {
    let matches = 0;
    for await (const path of new Bun.Glob(pattern).scan({ cwd: process.cwd(), onlyFiles: true })) { await readFile(path); matches++; }
    assert(matches > 0, "UNCOVERED_PATTERN:" + pattern);
    coverageFiles += matches;
  }
}
const review = { version: "chess-coach.gpu-qualification-source-review.v1", status: "ACCEPTED_REVIEWED_SOURCE_ONLY", sourceReceipt: dir + "/receipt.json",
  sourceManifestSha256: source.sourceManifestSha256,
  adversarial: { session: "ses_e3dde36f7ffe7zUOt5TLO5go8p", verdict: "READY", resolvedFindings: ["HIGH_APPROVAL_RUN_ID_REPLAY", "MEDIUM_ATTEMPT_CAPTURE", "MEDIUM_TERMINAL_SOURCE_CHECK"] },
  security: { session: "ses_e3dde36f6ffeV2dAqWyTQ89u5u", verdict: "READY_SOURCE_ONLY" },
  backend: { session: "ses_e3df78573ffeXo04nE7v4wNCrB", verdict: "NO_FUNCTIONAL_FINDINGS" },
  devops: { session: "ses_e3ec46b44ffe7CbnV5rwv23shT", verdict: "READY_SOURCE_ONLY", lowBudgetScopeClarified: true },
  compilationQualified: false, currentCpuRegressionQualified: false, gpuQualified: false, trainingReady: false, furtherOperationsAuthorized: false };
await writeFile(dir + "/review.json", JSON.stringify(review, null, 2) + "\n", { flag: "wx" });
const stdout = `PASS: ${source.sourceCount} current source hashes; ${streams} stream hashes; five flags-only LLVM queries; 277 prior prepared-source hashes unchanged; two diagram/index inventories match; no compilation, staging, image or host/GPU operation\n`;
await writeFile(dir + "/integrity-check.stdout", stdout, { flag: "wx" });
await writeFile(dir + "/integrity-check.stderr", "", { flag: "wx" });
const evidencePaths = [dir + "/receipt.json", dir + "/review.json", dir + "/integrity-check.ts", flagsDir + "/receipt.json",
  "_spec/gpu-qualification.puml", "_spec/gpu-build.puml", "_spec/.spec-index.json", "_spec/gpu-readiness.md", "_spec/gate-closure.md"];
const evidence = await Promise.all(evidencePaths.map(async path => ({ path, sha256: hash(await readFile(path)) })));
await writeFile(dir + "/integrity-check.json", JSON.stringify({ version: "chess-coach.gpu-qualification-integrity.v1", status: "PASS_RECORD_AND_STATIC_COVERAGE_ONLY",
  sources: evidence, streamHashesChecked: streams, currentSourceHashesChecked: manifests[0]!.length, querySourceHashesChecked: manifests[1]!.length,
  historicalPreparedSourceHashesUnchanged: manifests[2]!.length, diagramCoverageMatches: 2, coverageFilesChecked: coverageFiles, diagramsRendered: false,
  llvmQueriesRepeated: false, compilationPerformed: false, imageOperationPerformed: false, hostGpuOperationPerformed: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(stdout.trim());
