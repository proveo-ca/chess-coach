// SPEC: _spec/gpu-input-transfer.puml
import { createHash } from "node:crypto";
import { lstat, readFile, readlink, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import request from "../../qualification/transfer/request.json";
import { checkSourceGate, hashFile, nativeDestination } from "../../qualification/transfer/prepare";

const directory = request.evidence;
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: boolean, label: string) => { if (!value) throw Error(label); };
const parent = JSON.parse(await readFile(directory + "/receipt.json", "utf8"));
const prepared = JSON.parse(await readFile(directory + "/preparation.json", "utf8"));
check(parent.status === "PASS_PREPARATION_ONLY_PUBLICATION_PENDING" && parent.publicationContinuationAuthorized === true, "PREPARATION_CONTINUATION");
check(parent.downloadInvocationsConsumed === 1 && parent.preparationInvocationsConsumed === 1 && parent.publicationPerformed === false, "CONSUMED_ALLOWANCES");
const gate = await checkSourceGate(parent.sourceGate.path);
check(gate.sha256 === parent.sourceGate.sha256, "FROZEN_SOURCE_GATE");
const manifestBytes = await readFile(prepared.contextManifest);
check(hash(manifestBytes) === prepared.contextManifestSha256, "CONTEXT_MANIFEST_HASH");
type Row = { path: string; kind: string; bytes: number; sha256?: string; target?: string };
const rows = JSON.parse(manifestBytes.toString()) as Row[];
check(new Set(rows.map(row => row.path)).size === rows.length, "UNIQUE_CONTEXT_INPUTS");
const deadline = performance.now() + 120_000;
let contextBytes = 0, files = 0, directories = 0, links = 0;
for (const row of rows) {
  const path = resolve(prepared.context, row.path), metadata = await lstat(path);
  if (row.kind === "file") {
    check(metadata.isFile() && metadata.size === row.bytes, "CONTEXT_FILE_SIZE:" + row.path);
    const actual = await hashFile(path, deadline);
    check(actual.bytes === row.bytes && actual.sha256 === row.sha256, "CONTEXT_FILE_HASH:" + row.path);
    files++;
  } else if (row.kind === "directory") {
    check(metadata.isDirectory() && row.bytes === 0, "CONTEXT_DIRECTORY:" + row.path); directories++;
  } else {
    check(row.kind === "symlink" && metadata.isSymbolicLink() && await readlink(path) === row.target, "CONTEXT_LINK:" + row.path); links++;
  }
  contextBytes += row.bytes;
}
const listed = new Map(rows.map(row => [row.path, row]));
async function inspect(path = "") {
  for (const entry of await readdir(resolve(prepared.context, path), { withFileTypes: true })) {
    const child = path ? path + "/" + entry.name : entry.name;
    if (entry.isDirectory()) await inspect(child);
    else check(listed.has(child), "UNLISTED_CONTEXT_PAYLOAD:" + child);
  }
}
await inspect();
check(contextBytes === prepared.contextBytes && contextBytes <= request.limits.contextBytes, "CONTEXT_BYTE_BOUND");
for (const source of prepared.nativeSourceInventory) check(listed.get(nativeDestination(source.path))?.sha256 === source.sha256, "NATIVE_INPUT_BINDING:" + source.path);
check(prepared.nativeSourceInventory.length === 65 && prepared.nativeSourceCount === 65, "NATIVE_INPUT_COUNT");
const nativeManifest = JSON.parse(await readFile(prepared.context + "/qualification-tools/qualification/source-manifest.json", "utf8"));
check(JSON.stringify(nativeManifest) === JSON.stringify(prepared.nativeSourceInventory), "EMBEDDED_NATIVE_MANIFEST");
const bundle = await hashFile(prepared.bundle.path, deadline);
check(bundle.bytes === prepared.bundle.bytes && bundle.sha256 === prepared.bundle.sha256 && bundle.bytes <= request.limits.bundleBytes, "BUNDLE_HASH_AND_BOUND");
check(prepared.llvmBytes <= request.llvm.maximumPayloadBytes && prepared.cargoBytes <= request.cargo.maximumPayloadBytes && prepared.sourceBytes <= request.limits.sourceBytes
  && prepared.workspacePayloadBytes <= request.limits.workspaceBytes, "INDIVIDUAL_AND_WORKSPACE_BOUNDS");
let sourceStreams = 0;
for (const attempt of parent.attempts) for (const stream of attempt.streams) {
  const bytes = await readFile(stream.path);
  check(bytes.length === stream.bytes && hash(bytes) === stream.sha256, "PREPARATION_CAPTURE_HASH"); sourceStreams++;
}
const index = JSON.parse(await readFile("_spec/.spec-index.json", "utf8"));
for (const path of ["_spec/gpu-input-transfer.puml", "_spec/gpu-qualification.puml", "_spec/gpu-build.puml"]) {
  const diagram = await readFile(path, "utf8");
  const covers = [...diagram.matchAll(/^' covers: (.+)$/gm)].map(match => match[1]);
  check(JSON.stringify(covers) === JSON.stringify(index.specs.find((entry: { spec: string }) => entry.spec === path).covers), "SPEC_INDEX:" + path);
}
const stdout = `PASS: ${files} context files, ${directories} recorded directories, ${links} links; ${contextBytes} context bytes; bundle ${bundle.bytes} bytes / ${bundle.sha256}; no native execution\n`;
await writeFile(directory + "/prepared-check.stdout", stdout, { flag: "wx" });
await writeFile(directory + "/prepared-check.stderr", "", { flag: "wx" });
await writeFile(directory + "/prepared-check.json", JSON.stringify({ version: "chess-coach.prepared-input-record-verification.v1", status: "PASS_PREPARED_INPUT_BYTES_ONLY", sourceGate: { path: gate.path, sha256: gate.sha256 },
  contextManifestSha256: prepared.contextManifestSha256, contextFiles: files, recordedDirectories: directories, links, contextBytes, bundle, preparationStreamsChecked: sourceStreams,
  nativeInputs: prepared.nativeSourceCount, cachedCrateArchives: prepared.cachedCrateArchives, missingArchives: prepared.missingArchives.length, missingMetadata: prepared.missingMetadata.length,
  completeOfflineBuildCoverageQualified: false, publicationPerformed: false, compilationPerformed: false, hostOrGpuExecuted: false, trainingReady: false,
  checkerSha256: hash(await readFile(directory + "/verify-prepared.ts")) }, null, 2) + "\n", { flag: "wx" });
console.log(stdout.trim());
