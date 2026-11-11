// SPEC: _spec/gpu-host-receive.puml
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { renderHostToolchainAlignment } from "../../qualification/host-toolchain/render";

const directory = "_work/gpu-owner-recovery/runs/host-toolchain-align-handoff-1";
const request = JSON.parse(await readFile(directory + "/request.json", "utf8"));
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: boolean, label: string) => { if (!value) throw Error(label); };
const command = await readFile(request.command);
check(hash(command) === request.commandSha256 && command.toString() === renderHostToolchainAlignment() + "\n", "APPROVED_COMMAND_CHANGED");
const proof = JSON.parse(await readFile(request.sourceProof, "utf8"));
check(proof.status === "PASS_HOST_TOOLCHAIN_ALIGNMENT_SOURCE_ONLY" && proof.sourceChanged === false, "REVIEWED_SOURCE_PROOF_REQUIRED");
for (const source of proof.sources) check(hash(await readFile(source.path)) === source.sha256, "REVIEWED_SOURCE_CHANGED:" + source.path);
const index = JSON.parse(await readFile("_spec/.spec-index.json", "utf8"));
for (const path of ["_spec/gpu-host-receive.puml", "_spec/gpu-input-transfer.puml", "_spec/gpu-qualification.puml", "_spec/gpu-build.puml"]) {
  const text = await readFile(path, "utf8"), covers = [...text.matchAll(/^' covers: (.+)$/gm)].map(match => match[1]);
  check(JSON.stringify(covers) === JSON.stringify(index.specs.find((entry: { spec: string }) => entry.spec === path).covers), "SPEC_INDEX_DRIFT");
}
await writeFile(directory + "/handoff-check.json", JSON.stringify({ version: "chess-coach.approved-alignment-handoff-record-check.v1", status: "PASS_APPROVED_ALIGNMENT_COMMAND_RECORDS_ONLY",
  command: request.command, commandSha256: request.commandSha256, sourceHashesChecked: proof.sources.length, diagramIndexMatches: 4,
  operatorAlignmentApproved: true, operatorResultsReceived: false, hostInstallationOrVersionQueriesPerformedByCodingAgent: false,
  fishSyntaxValidated: false, receiverReplayAuthorized: false, sourcePublicationPerformed: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: "PASS_APPROVED_ALIGNMENT_COMMAND_RECORDS_ONLY", commandSha256: request.commandSha256, hostOutputRequired: true }));
