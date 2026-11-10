// SPEC: _spec/gpu-host-receive.puml
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { renderHostToolchainAlignment } from "../../qualification/host-toolchain/render";

const directory = "_work/gpu-owner-recovery/runs/host-toolchain-align-source-1";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: boolean, label: string) => { if (!value) throw Error(label); };
const receipt = JSON.parse(await readFile(directory + "/receipt.json", "utf8"));
check(receipt.status === "PASS_HOST_TOOLCHAIN_ALIGNMENT_SOURCE_ONLY" && receipt.sourceChanged === false, "SOURCE_PROOF_REQUIRED");
for (const source of receipt.sources) check(hash(await readFile(source.path)) === source.sha256, "SOURCE_CHANGED:" + source.path);
let streams = 0;
for (const result of receipt.results) for (const stream of result.streams) {
  const bytes = await readFile(stream.path); check(result.status === "PASS" && bytes.length === stream.bytes && hash(bytes) === stream.sha256, "CAPTURE_MISMATCH"); streams++;
}
const command = await readFile(receipt.command.path);
check(command.toString() === renderHostToolchainAlignment() + "\n" && hash(command) === receipt.command.sha256, "HOST_COMMAND_CHANGED");
const index = JSON.parse(await readFile("_spec/.spec-index.json", "utf8"));
for (const path of ["_spec/gpu-host-receive.puml", "_spec/gpu-input-transfer.puml", "_spec/gpu-qualification.puml", "_spec/gpu-build.puml"]) {
  const text = await readFile(path, "utf8"), covers = [...text.matchAll(/^' covers: (.+)$/gm)].map(match => match[1]);
  check(JSON.stringify(covers) === JSON.stringify(index.specs.find((entry: { spec: string }) => entry.spec === path).covers), "SPEC_INDEX_DRIFT");
}
await writeFile(directory + "/record-check.json", JSON.stringify({ version: "chess-coach.host-toolchain-alignment-record-check.v1", status: "PASS_ALIGNMENT_COMMAND_RECORDS_ONLY",
  sourceHashesChecked: receipt.sources.length, captureStreamsChecked: streams, diagramIndexMatches: 4, commandSha256: receipt.command.sha256,
  hostExecutionApproved: false, hostInstallationOrVersionQueryPerformed: false, fishSyntaxValidated: false, receiverRetried: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: "PASS_ALIGNMENT_COMMAND_RECORDS_ONLY", commandSha256: receipt.command.sha256, hostDecisionRequired: true }));
