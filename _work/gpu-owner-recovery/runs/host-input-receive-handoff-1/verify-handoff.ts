// SPEC: _spec/gpu-host-receive.puml
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { renderHostReceive } from "../../qualification/host-receive/bootstrap";

const directory = "_work/gpu-owner-recovery/runs/host-input-receive-handoff-1";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: boolean, label: string) => { if (!value) throw Error(label); };
const original = JSON.parse(await readFile(directory + "/publication.json", "utf8"));
const final = JSON.parse(await readFile(directory + "/continuation.json", "utf8"));
const handoff = JSON.parse(await readFile(directory + "/handoff.json", "utf8"));
check(original.attempts.commit === 0 && original.attempts.push === 0 && final.attempts.commit === 1 && final.attempts.push === 1, "JOINT_SINGLE_COMMIT_PUSH_COUNTS");
check(final.status === "PASS_SOURCE_PUBLISHED_OPERATOR_OUTPUT_PENDING" && final.pushedCommit === handoff.helperSourceCommit, "SUCCESSFUL_HANDOFF_SOURCE_PUSH");
const bytes = await readFile(directory + "/host-command.fish");
check(hash(bytes) === handoff.commandSha256 && bytes.toString() === renderHostReceive(handoff.helperSourceCommit, handoff.helper.sha256) + "\n", "EXACT_APPROVED_COMMAND");
const helper = Bun.spawnSync(["/usr/bin/git", "cat-file", "blob", handoff.helperSourceCommit + ":" + handoff.helper.path], { env: { PATH: "/usr/bin:/bin", GIT_NO_LAZY_FETCH: "1" }, stdout: "pipe", stderr: "pipe", timeout: 1000 });
check(helper.exitCode === 0 && helper.stdout.length === handoff.helper.bytes && hash(helper.stdout) === handoff.helper.sha256, "PUSHED_HELPER_BYTES");
let streams = 0;
for (const result of [original, final]) for (const operation of result.operations) for (const stream of operation.streams ?? []) {
  const capture = await readFile(stream.path); check(capture.length === stream.bytes && hash(capture) === stream.sha256, "SOURCE_PUBLICATION_CAPTURE_CHANGED"); streams++;
}
const index = JSON.parse(await readFile("_spec/.spec-index.json", "utf8"));
for (const path of ["_spec/gpu-host-receive.puml", "_spec/gpu-input-transfer.puml", "_spec/gpu-qualification.puml", "_spec/gpu-build.puml"]) {
  const text = await readFile(path, "utf8"), covers = [...text.matchAll(/^' covers: (.+)$/gm)].map(match => match[1]);
  check(JSON.stringify(covers) === JSON.stringify(index.specs.find((entry: { spec: string }) => entry.spec === path).covers), "SPEC_INDEX_DRIFT");
}
await writeFile(directory + "/handoff-check.json", JSON.stringify({ version: "chess-coach.pinned-host-command-verification.v1", status: "PASS_PINNED_HANDOFF_RECORDS_ONLY",
  helperSourceCommit: handoff.helperSourceCommit, assetSourceCommit: handoff.assetSourceCommit, helperSha256: handoff.helper.sha256, commandSha256: handoff.commandSha256,
  sourcePublicationCaptureStreamsChecked: streams, diagramIndexMatches: 4, sourcePublicationAllowanceConsumed: true,
  operatorInvocationApproved: true, operatorInvocationObserved: false, fishSyntaxValidated: false, compilationPerformed: false, gpuExecuted: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: "PASS_PINNED_HANDOFF_RECORDS_ONLY", helperCommit: handoff.helperSourceCommit, helperSha256: handoff.helper.sha256, commandSha256: handoff.commandSha256, operatorOutputRequired: true }));
