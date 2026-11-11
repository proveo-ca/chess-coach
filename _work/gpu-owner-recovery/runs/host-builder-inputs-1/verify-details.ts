// SPEC: _spec/gpu-qualification.puml, _spec/gpu-input-transfer.puml
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const directory = "_work/gpu-owner-recovery/runs/host-builder-inputs-1";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: boolean, label: string) => { if (!value) throw Error(label); };
const paste = await readFile(directory + "/operator-details-paste.txt", "utf8");
const details = JSON.parse(await readFile(directory + "/operator-details.json", "utf8"));
const imageLine = paste.split("\n")[0]!.match(/^(linux)\/(amd64) (sha256:[a-f0-9]{64}) (\[.*\])$/)!;
check(Boolean(imageLine), "IMAGE_HEADER");
check(details.image.reportedOs === imageLine[1] && details.image.reportedArchitecture === imageLine[2] && details.image.reportedImageId === imageLine[3], "IMAGE_FACTS");
check(JSON.stringify(details.image.reportedRepoDigests) === JSON.stringify(JSON.parse(imageLine[4]!)), "REPORTED_REPO_DIGESTS");
const metadata = JSON.parse(await readFile("_work/gpu-owner-recovery/gpu-functional-base-image-metadata.json", "utf8"));
const registry = metadata.images.find((image: { reference: string }) => image.reference === details.image.reference);
check(registry?.configDigest === details.image.retainedRegistryConfigDigest && registry?.declaredVersion === details.image.registryDeclaredRustVersion, "RETAINED_REGISTRY_METADATA");
check(details.image.reportedImageId !== registry.configDigest && details.image.wrongImageEstablished === false, "UNEXPLAINED_IDENTITY_FIELDS");
check(details.image.executableRustVersion === null && details.image.executableCargoVersion === null, "UNQUERIED_EXECUTABLE_VERSIONS");
const commands = [...paste.matchAll(/^COMMAND= (.+)\n([\s\S]*?)^COMMAND_EXIT=(\d+)$/gm)];
const expected = ["command -v cc", "command -v c++", "command -v ar", "command -v ld", "command -v getconf", "command -v readelf",
  "cc --version", "c++ --version", "ar --version", "ld --version", "getconf GNU_LIBC_VERSION", "cat /etc/os-release"];
check(JSON.stringify(commands.map(command => command[1])) === JSON.stringify(expected), "COMMAND_FRAME_ORDER");
check(commands.length === details.commandFramesReported && commands.every(command => command[3] === "0") && details.allCommandFrameExitCodesReportedZero, "COMMAND_FRAME_EXITS");
const output = (command: string) => commands.find(frame => frame[1] === command)![2]!.trim();
for (const [tool, field] of [["cc", "cc"], ["c++", "cxx"], ["ar", "ar"], ["ld", "ld"], ["getconf", "getconf"], ["readelf", "readelf"]]) {
  check(output("command -v " + tool) === details.tools[field!].path, "TOOL_PATH:" + tool);
}
for (const [tool, field] of [["cc", "cc"], ["c++", "cxx"], ["ar", "ar"], ["ld", "ld"]]) {
  check(output(tool + " --version").split("\n")[0]!.endsWith(details.tools[field!].reportedVersion), "TOOL_VERSION:" + tool);
}
check(output("getconf GNU_LIBC_VERSION") === "glibc " + details.libc.reportedVersion, "LIBC_VERSION");
check(output("cat /etc/os-release").includes('PRETTY_NAME="' + details.osRelease.prettyName + '"'), "OS_RELEASE");
check(paste.includes("CXX_LIBRARY_EXIT=0\nCXX_LIBRARY=" + details.cxxLibraryPath + "\n"), "CXX_LIBRARY_QUERY");
check(paste.endsWith("COMPILATION_PERFORMED=false\nGPU_EXECUTION_PERFORMED=false\n"), "NO_COMPILE_OR_GPU_REPORTED");
check(details.originalHostFilesReceived === false && details.individualHostStreamBoundariesEstablished === false && details.trainingReady === false, "EVIDENCE_SCOPE");
const transfer = JSON.parse(await readFile("_work/gpu-owner-recovery/qualification/input-transfer-proposal.json", "utf8"));
for (const key of ["payloadReadHashOrCopyApproved", "acquisitionApproved", "stagingApproved", "sourceCommitPushApproved", "releaseOrUploadApproved", "hostBuildOrExecutionApproved", "gpuExecutionApproved", "trainingApproved"]) check(transfer[key] === false, "UNSELECTED_AUTHORITY:" + key);
check(transfer.selectedTransport === null && transfer.releaseMustRemainDraft === true, "UNSELECTED_TRANSPORT");
const proofDirectory = "_work/gpu-owner-recovery/runs/gpu-qualification-source-4";
const proof = JSON.parse(await readFile(proofDirectory + "/receipt.json", "utf8"));
const sourceBytes = await readFile(proofDirectory + "/sources.json");
check(proof.status === "PASS_SOURCE_ONLY" && proof.sourceChanged === false && hash(sourceBytes) === proof.sourceManifestSha256, "CURRENT_SOURCE_PROOF");
const boundSources = JSON.parse(sourceBytes.toString());
for (const source of boundSources) check(hash(await readFile(source.path)) === source.sha256, "CURRENT_SOURCE_CHANGED:" + source.path);
let streamsChecked = 0;
for (const result of proof.results) for (const stream of result.streams) {
  const bytes = await readFile(stream.path);
  check(bytes.length === stream.bytes && hash(bytes) === stream.sha256, "SOURCE_STREAM_CHANGED");
  streamsChecked++;
}
const index = JSON.parse(await readFile("_spec/.spec-index.json", "utf8"));
const diagrams = ["_spec/gpu-build.puml", "_spec/gpu-qualification.puml", "_spec/gpu-input-transfer.puml"];
for (const path of diagrams) {
  const diagram = await readFile(path, "utf8");
  const covers = [...diagram.matchAll(/^' covers: (.+)$/gm)].map(match => match[1]);
  check(JSON.stringify(covers) === JSON.stringify(index.specs.find((entry: { spec: string }) => entry.spec === path).covers), "SPEC_INDEX_DRIFT:" + path);
}
const paths = [directory + "/operator-details-paste.txt", directory + "/operator-details.json", directory + "/verify-details.ts", proofDirectory + "/receipt.json",
  "_work/gpu-owner-recovery/qualification/runtime-request.json", "_work/gpu-owner-recovery/qualification/libdevice-proposal.json",
  "_work/gpu-owner-recovery/qualification/host-build-proposal.json", "_work/gpu-owner-recovery/qualification/input-transfer-proposal.json",
  ...diagrams, "_spec/.spec-index.json", "_spec/gpu-readiness.md", "_spec/gate-closure.md"];
const sources = await Promise.all(paths.map(async path => ({ path, sha256: hash(await readFile(path)) })));
const stdout = `PASS: 12 operator-reported metadata frames, current source-4 ${boundSources.length} source hashes/${streamsChecked} streams, three diagram/index inventories; no native build, staging, upload or host operation\n`;
await writeFile(directory + "/details-check.stdout", stdout, { flag: "wx" });
await writeFile(directory + "/details-check.stderr", "", { flag: "wx" });
await writeFile(directory + "/details-check.json", JSON.stringify({ version: "chess-coach.builder-details-and-packaging-record-check.v1", status: "PASS_REPORTED_DETAILS_AND_SOURCE_RECORDS_ONLY", sources,
  commandFramesChecked: commands.length, sourceHashesChecked: boundSources.length, sourceStreamsChecked: streamsChecked, diagramIndexMatches: diagrams.length,
  originalHostFilesReceived: false, identityFieldDiscrepancyCauseEstablished: false, operationalTransferApproved: false, metadataOrCompilerQueriesRepeated: false,
  archivePayloadDownloaded: false, prefixPayloadReadOrCopied: false, compilationPerformed: false, hostGpuExecutionPerformed: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(stdout.trim());
