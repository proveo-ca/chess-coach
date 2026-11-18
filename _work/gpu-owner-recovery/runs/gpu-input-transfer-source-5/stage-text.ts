// SPEC: _spec/gpu-input-transfer.puml
import { createHash } from "node:crypto";
import { lstat, readFile, writeFile } from "node:fs/promises";
import { checkSourceGate } from "../../qualification/transfer/prepare";

const directory = "_work/gpu-owner-recovery/runs/gpu-input-transfer-source-5";
const originalAuditPath = "_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/stage-audit.json";
const original = JSON.parse(await readFile(originalAuditPath, "utf8"));
const originalPaths: string[] = [...original.sources.map((source: { path: string }) => source.path), originalAuditPath].sort();
function git(args: string[]) {
  const output = Bun.spawnSync(["/usr/bin/git", ...args], { stdout: "pipe", stderr: "pipe", env: { PATH: "/usr/bin:/bin", GIT_NO_LAZY_FETCH: "1" } });
  if (output.exitCode !== 0) throw Error("LOCAL_GIT_COMMAND_FAILED");
  return output.stdout;
}
const split = (bytes: Uint8Array) => Buffer.from(bytes).toString().split("\0").filter(Boolean);
const stagedBefore = split(git(["diff", "--cached", "--name-only", "-z"])).sort();
if (JSON.stringify(stagedBefore) !== JSON.stringify(originalPaths)) throw Error("PREEXISTING_STAGED_PATHS_CHANGED");
const paths = [...new Set([...split(git(["diff", "HEAD", "--name-only", "-z"])), ...split(git(["ls-files", "--others", "--exclude-standard", "-z"]))])].sort();
const sources = [];
let textBytes = 0;
for (const path of paths) {
  const newAllowed = path === "_work/gpu-owner-recovery/qualification/transfer/https-publication-request.json"
    || path === "_work/gpu-owner-recovery/qualification/transfer/publish-https.ts"
    || path.startsWith("_work/gpu-owner-recovery/runs/gpu-input-transfer-source-4/") || path.startsWith(directory + "/")
    || /^_work\/gpu-owner-recovery\/runs\/host-feasibility-inputs-1\/(publication\.(json|operation)|publish-0[12]\/command\.(stdout|stderr))$/.test(path);
  if (!originalPaths.includes(path) && !newAllowed) throw Error("UNAPPROVED_TEXT_PATH:" + path);
  if (/(^|\/)(cache|home|tmp|node_modules|target)(\/|$)/.test(path)) throw Error("PAYLOAD_OR_CACHE_PATH:" + path);
  const metadata = await lstat(path), bytes = await readFile(path);
  if (!metadata.isFile() || bytes.includes(0) || bytes.length > 4 * 1024 * 1024) throw Error("BOUNDED_TEXT_REQUIRED:" + path);
  new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  textBytes += bytes.length;
  sources.push({ path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
}
if (textBytes > 16 * 1024 * 1024) throw Error("TEXT_STAGE_BYTE_LIMIT");
const gate = await checkSourceGate("_work/gpu-owner-recovery/runs/gpu-input-transfer-source-5/receipt.json");
const index = JSON.parse(await readFile("_spec/.spec-index.json", "utf8"));
for (const path of ["_spec/gpu-input-transfer.puml", "_spec/gpu-qualification.puml", "_spec/gpu-build.puml"]) {
  const text = await readFile(path, "utf8");
  const covers = [...text.matchAll(/^' covers: (.+)$/gm)].map(match => match[1]);
  if (JSON.stringify(covers) !== JSON.stringify(index.specs.find((entry: { spec: string }) => entry.spec === path).covers)) throw Error("SPEC_INDEX_DRIFT:" + path);
}
const record = directory + "/stage-audit.json";
await writeFile(record, JSON.stringify({ version: "chess-coach.https-publication-text-stage-audit.v1", status: "PASS_CONTROLLED_TEXT_AUDIT",
  originalAudit: originalAuditPath, originalStagedPathsPreserved: stagedBefore.length, sources, textBytes,
  sourceGate: { path: gate.path, sha256: gate.sha256 }, binaryOrCacheIncluded: false, originalFailurePreserved: true,
  commitOrPushPerformed: false, freshPublicationPerformed: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
git(["add", "--", ...paths, record]);
const staged = split(git(["diff", "--cached", "--name-only", "-z"])).sort();
if (JSON.stringify(staged) !== JSON.stringify([...paths, record].sort())) throw Error("STAGED_PATH_SET_MISMATCH");
for (const source of sources) {
  const blob = git(["cat-file", "blob", ":" + source.path]);
  if (createHash("sha256").update(blob).digest("hex") !== source.sha256) throw Error("STAGED_TEXT_DIFFERS:" + source.path);
}
console.log(JSON.stringify({ status: "PASS_CONTROLLED_TEXT_STAGED", paths: staged.length, textBytes, originalStagedPathsPreserved: stagedBefore.length }));
