// SPEC: _spec/gpu-input-transfer.puml
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { checkSourceGate } from "../../qualification/transfer/prepare";

const directory = "_work/gpu-owner-recovery/runs/host-feasibility-publication-3";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: boolean, label: string) => { if (!value) throw Error(label); };
const receipt = JSON.parse(await readFile(directory + "/publication.json", "utf8"));
check(receipt.status === "PASS" && receipt.commitSucceeded === true && receipt.elapsedMs < 600000, "BOUNDED_PUBLICATION_PASS");
check(receipt.attempts.commit === 1 && receipt.attempts.push === 1 && receipt.attempts.createRelease === 1 && receipt.attempts.upload === 2, "EXACT_MUTATION_COUNTS");
const commit = "f3e277dbbf33c0aa69172cca1890792656d4cd09";
check(receipt.sourceCommit === commit && receipt.pushedCommit === commit && receipt.releaseDraft === true && receipt.releaseId === 439935095, "COMMIT_AND_DRAFT_BINDING");
const final = JSON.parse(await readFile(directory + "/publish-16/command.stdout", "utf8"));
check(final.id === receipt.releaseId && final.draft === true && final.published_at === null && final.target_commitish === commit
  && final.tag_name === "gpu-feasibility-inputs-20261110-1" && final.assets.length === 2, "RETAINED_FINAL_GITHUB_RESPONSE");
for (const asset of receipt.assets) {
  const name = asset.path.split("/").at(-1);
  const remote = final.assets.find((entry: { name: string }) => entry.name === name);
  check(remote?.size === asset.bytes && remote?.digest === "sha256:" + asset.sha256 && remote?.state === "uploaded", "REMOTE_ASSET_METADATA:" + name);
}
const manifestAsset = receipt.assets.find((asset: { path: string }) => asset.path.endsWith(".manifest.json"));
const manifestBytes = await readFile(manifestAsset.path), manifest = JSON.parse(manifestBytes.toString());
check(manifestBytes.length === manifestAsset.bytes && hash(manifestBytes) === manifestAsset.sha256 && manifest.sourceCommit === commit, "EXTERNAL_MANIFEST_BINDING");
const gate = await checkSourceGate("_work/gpu-owner-recovery/runs/gpu-input-transfer-source-6/receipt.json");
check(manifest.sourceGate.path === gate.path && manifest.sourceGate.sha256 === gate.sha256, "CURRENT_PUBLISHER_SOURCE_GATE");
function git(args: string[]) {
  const output = Bun.spawnSync(["/usr/bin/git", ...args], { env: { PATH: "/usr/bin:/bin", GIT_NO_LAZY_FETCH: "1" }, stdout: "pipe", stderr: "pipe", timeout: 1000 });
  check(output.exitCode === 0, "LOCAL_GIT_READ"); return output.stdout;
}
check(git(["rev-parse", "HEAD"]).toString().trim() === commit, "CURRENT_HEAD");
for (const source of gate.sources) check(hash(git(["cat-file", "blob", commit + ":" + source.path])) === source.sha256, "COMMITTED_SOURCE:" + source.path);
const auditPath = "_work/gpu-owner-recovery/runs/gpu-input-transfer-source-6/stage-audit.json";
const audit = JSON.parse(await readFile(auditPath, "utf8"));
const changed = git(["diff-tree", "--no-commit-id", "--name-only", "-r", "-z", commit]).toString().split("\0").filter(Boolean).sort();
check(JSON.stringify(changed) === JSON.stringify([...audit.sources.map((source: { path: string }) => source.path), auditPath].sort()), "CONTROLLED_COMMIT_PATHS");
const captures = [];
for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
  const paths = entry.isDirectory() ? [directory + "/" + entry.name + "/command.stdout", directory + "/" + entry.name + "/command.stderr"] : [directory + "/" + entry.name];
  for (const path of paths) { const bytes = await readFile(path); captures.push({ path, bytes: bytes.length, sha256: hash(bytes) }); }
}
const finalTag = (await readFile(directory + "/publish-17/command.stdout", "utf8")).trim();
const stdout = `PASS: HTTPS-pushed ${commit}; draft ${receipt.releaseId}; two assets match retained GitHub size/SHA-256 metadata; ${gate.sources.length} committed source hashes; ${changed.length} controlled text paths; no host/GPU execution\n`;
await writeFile(directory + "/outcome-check.stdout", stdout, { flag: "wx" });
await writeFile(directory + "/outcome-check.stderr", "", { flag: "wx" });
await writeFile(directory + "/outcome-check.json", JSON.stringify({ version: "chess-coach.qualification-draft-publication-verification.v1", status: "PASS_RETAINED_PUBLICATION_EVIDENCE_ONLY",
  captures, sourceCommit: commit, pushTransport: "EXPLICIT_HTTPS", releaseId: final.id, releaseUrl: final.html_url, releaseTag: final.tag_name, draft: final.draft,
  sourceGate: { path: gate.path, sha256: gate.sha256 }, committedSourceHashesChecked: gate.sources.length, controlledCommittedTextPaths: changed.length,
  assets: final.assets.map((asset: { id: number; name: string; size: number; digest: string }) => ({ id: asset.id, name: asset.name, bytes: asset.size, digest: asset.digest })),
  tagLookupResult: finalTag === "" ? "ABSENT_WHILE_DRAFT" : "RESOLVES_TO_PUSHED_COMMIT_AS_RECORDED_BY_PUBLISHER",
  liveGithubQueriesRepeated: false, payloadDownloadCopyOrRepackPerformed: false, publicationGrantConsumed: true, automaticRetryAuthorized: false,
  operatorDownloadOrExtractionAuthorized: false, offlineBuildQualified: false, compilationPerformed: false, hostOrGpuExecuted: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(stdout.trim());
