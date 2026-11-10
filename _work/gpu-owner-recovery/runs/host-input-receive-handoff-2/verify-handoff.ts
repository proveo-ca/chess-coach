// SPEC: _spec/gpu-host-receive.puml
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { renderHostReceive2 } from "../../qualification/host-receive/bootstrap";

const directory = "_work/gpu-owner-recovery/runs/host-input-receive-handoff-2";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: boolean, label: string) => { if (!value) throw Error(label); };
const publication = JSON.parse(await readFile(directory + "/publication/publication.json", "utf8"));
const handoff = JSON.parse(await readFile(directory + "/handoff.json", "utf8"));
check(publication.status === "PASS" && publication.publicationScope === "SOURCE_ONLY" && publication.elapsedMs < 600000, "BOUNDED_SOURCE_PUBLICATION_PASS");
check(publication.attempts.commit === 1 && publication.attempts.push === 1 && publication.attempts.createRelease === 0 && publication.attempts.upload === 0
  && publication.attempts.commitManifest === 0 && publication.assets.length === 0 && publication.releaseId === null, "SOURCE_ONLY_MUTATION_COUNTS");
check(publication.sourceCommit === publication.pushedCommit && publication.pushedCommit === handoff.helperSourceCommit, "PUSHED_HELPER_COMMIT_BINDING");
const command = await readFile(directory + "/host-command.fish");
check(hash(command) === handoff.commandSha256 && command.toString() === renderHostReceive2(handoff.helperSourceCommit, handoff.helper.sha256) + "\n", "EXACT_RUN2_COMMAND_BINDING");
const proofBytes = await readFile(handoff.sourceProof.path), proof = JSON.parse(proofBytes.toString());
check(hash(proofBytes) === handoff.sourceProof.sha256 && proof.status === "PASS_HOST_RECEIVE_SOURCE_ONLY" && proof.sourceChanged === false, "FRESH_SOURCE_PROOF");
for (const source of proof.sources) {
  check(hash(await readFile(source.path)) === source.sha256, "WORKTREE_SOURCE_CHANGED:" + source.path);
  const blob = Bun.spawnSync(["/usr/bin/git", "cat-file", "blob", handoff.helperSourceCommit + ":" + source.path], { env: { PATH: "/usr/bin:/bin", GIT_NO_LAZY_FETCH: "1" }, stdout: "pipe", stderr: "pipe", timeout: 1000 });
  check(blob.exitCode === 0 && hash(blob.stdout) === source.sha256, "COMMITTED_SOURCE_CHANGED:" + source.path);
}
const captures = [];
for (const entry of await readdir(directory + "/publication", { withFileTypes: true })) {
  const paths = entry.isDirectory() ? [directory + "/publication/" + entry.name + "/command.stdout", directory + "/publication/" + entry.name + "/command.stderr"] : [directory + "/publication/" + entry.name];
  for (const path of paths) { const bytes = await readFile(path); captures.push({ path, bytes: bytes.length, sha256: hash(bytes) }); }
}
const index = JSON.parse(await readFile("_spec/.spec-index.json", "utf8"));
for (const path of ["_spec/gpu-host-receive.puml", "_spec/gpu-input-transfer.puml", "_spec/gpu-qualification.puml", "_spec/gpu-build.puml"]) {
  const text = await readFile(path, "utf8"), covers = [...text.matchAll(/^' covers: (.+)$/gm)].map(match => match[1]);
  check(JSON.stringify(covers) === JSON.stringify(index.specs.find((entry: { spec: string }) => entry.spec === path).covers), "SPEC_INDEX_DRIFT");
}
await writeFile(directory + "/handoff-check.json", JSON.stringify({ version: "chess-coach.mise-run2-published-handoff-verification.v1", status: "PASS_PUBLISHED_MISE_RUN2_HANDOFF_RECORDS_ONLY",
  helperSourceCommit: handoff.helperSourceCommit, assetSourceCommit: handoff.assetSourceCommit, helper: handoff.helper, commandSha256: handoff.commandSha256,
  committedSourceHashesChecked: proof.sources.length, captures, diagramIndexMatches: 4, sourcePublicationAllowanceConsumed: true,
  operatorRun2Approved: true, operatorRun2Observed: false, installationPerformedByCodingAgent: false, fishSyntaxValidated: false, compilationPerformed: false, gpuExecuted: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: "PASS_PUBLISHED_MISE_RUN2_HANDOFF_RECORDS_ONLY", helperCommit: handoff.helperSourceCommit, commandSha256: handoff.commandSha256, operatorOutputRequired: true }));
