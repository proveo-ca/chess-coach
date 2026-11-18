// SPEC: _spec/gpu-input-transfer.puml
import { createHash } from "node:crypto";
import { lstat, readFile, writeFile } from "node:fs/promises";
import { checkSourceGate } from "../../qualification/transfer/prepare";

const directory = "_work/gpu-owner-recovery/runs/host-feasibility-inputs-1";
const allowedFiles = new Set([
  "_spec/.spec-index.json", "_spec/gate-closure.md", "_spec/gpu-build.puml", "_spec/gpu-qualification.puml", "_spec/gpu-readiness.md", "_spec/gpu-input-transfer.puml",
  "_work/gpu-owner-recovery/qualification/verify.ts", "packages/runtime/tests/gpu-qualification.test.ts", "tooling/runtime/Dockerfile.gpu-qualification", "tooling/runtime/qualification.ts",
  ...["host-build-proposal.json", "input-transfer-proposal.json", "libdevice-proposal.json", "runtime-request.json"].map(path => "_work/gpu-owner-recovery/qualification/" + path),
  ...["details-check.json", "details-check.stderr", "details-check.stdout", "operator-details-paste.txt", "operator-details.json", "verify-details.ts"].map(path => "_work/gpu-owner-recovery/runs/host-builder-inputs-1/" + path),
]);
const allowedRoots = ["_work/gpu-owner-recovery/qualification/transfer/", ...["gpu-input-transfer-source-1", "gpu-input-transfer-source-2", "gpu-input-transfer-source-3", "gpu-qualification-source-3", "gpu-qualification-source-4", "host-feasibility-inputs-1"].map(path => "_work/gpu-owner-recovery/runs/" + path + "/")];
function git(args: string[]) {
  const result = Bun.spawnSync(["/usr/bin/git", ...args], { stdout: "pipe", stderr: "pipe", env: { PATH: "/usr/bin:/bin", GIT_NO_LAZY_FETCH: "1" } });
  if (result.exitCode !== 0) throw Error("LOCAL_GIT_COMMAND_FAILED");
  return result.stdout;
}
if (git(["diff", "--cached", "--name-only", "-z"]).length !== 0) throw Error("UNEXPECTED_PREEXISTING_INDEX");
const changed = git(["diff", "--name-only", "-z"]).toString().split("\0").filter(Boolean);
const added = git(["ls-files", "--others", "--exclude-standard", "-z"]).toString().split("\0").filter(Boolean);
const paths = [...new Set([...changed, ...added])].sort();
const sources = [];
let totalBytes = 0;
for (const path of paths) {
  if (!allowedFiles.has(path) && !allowedRoots.some(root => path.startsWith(root))) throw Error("UNAPPROVED_TEXT_PATH:" + path);
  if (/(^|\/)(cache|home|tmp|node_modules|target|target-cpu|target-gpu)(\/|$)/.test(path)) throw Error("CACHE_OR_PAYLOAD_PATH:" + path);
  const metadata = await lstat(path), bytes = await readFile(path);
  if (!metadata.isFile() || bytes.length > 4 * 1024 * 1024 || bytes.includes(0)) throw Error("BOUNDED_TEXT_FILE_REQUIRED:" + path);
  new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  totalBytes += bytes.length;
  sources.push({ path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
}
if (totalBytes > 16 * 1024 * 1024) throw Error("TEXT_COMMIT_BYTE_LIMIT");
const gate = await checkSourceGate("_work/gpu-owner-recovery/runs/gpu-input-transfer-source-3/receipt.json");
const index = JSON.parse(await readFile("_spec/.spec-index.json", "utf8"));
for (const path of ["_spec/gpu-input-transfer.puml", "_spec/gpu-qualification.puml", "_spec/gpu-build.puml"]) {
  const diagram = await readFile(path, "utf8");
  const covers = [...diagram.matchAll(/^' covers: (.+)$/gm)].map(match => match[1]);
  if (JSON.stringify(covers) !== JSON.stringify(index.specs.find((entry: { spec: string }) => entry.spec === path).covers)) throw Error("SPEC_INDEX_DRIFT:" + path);
}
const record = directory + "/stage-audit.json";
await writeFile(record, JSON.stringify({ version: "chess-coach.qualification-text-stage-audit.v1", status: "PASS_CONTROLLED_TEXT_INPUT_AUDIT", sources, textBytes: totalBytes,
  sourceGate: { path: gate.path, sha256: gate.sha256 }, binariesOrDependencyCachesIncluded: false, commitOrPushPerformed: false, publicationPerformed: false,
  trainingReady: false }, null, 2) + "\n", { flag: "wx" });
git(["add", "--", ...paths, record]);
const staged = git(["diff", "--cached", "--name-only", "-z"]).toString().split("\0").filter(Boolean).sort();
if (JSON.stringify(staged) !== JSON.stringify([...paths, record].sort())) throw Error("STAGED_PATH_SET_MISMATCH");
console.log(JSON.stringify({ status: "PASS_CONTROLLED_TEXT_STAGED", files: staged.length, textBytes: totalBytes, audit: record }));
