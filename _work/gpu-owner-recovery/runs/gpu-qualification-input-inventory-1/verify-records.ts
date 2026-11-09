// SPEC: _spec/gpu-qualification.puml
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const p = "_work/gpu-owner-recovery/";
const directory = p + "runs/gpu-qualification-input-inventory-1";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const requireValue = (value: boolean, label: string) => { if (!value) throw Error(label); };
const receipt = JSON.parse(await readFile(directory + "/receipt.json", "utf8"));
requireValue(receipt.status === "PASS_METADATA_ONLY" && receipt.invocationsConsumed === 1 && receipt.remainingInvocations === 0 && receipt.sourceChanged === false, "METADATA_RESULT");
const raw = await readFile(directory + "/command.stdout");
const lines = raw.toString().trimEnd().split("\n");
const summary = JSON.parse(lines.pop()!);
const rows = lines.map(line => JSON.parse(line));
requireValue(summary.complete === true && JSON.stringify(summary) === JSON.stringify(receipt.summary), "SUMMARY_MISMATCH");
requireValue(rows.length === 2684 && rows.length === summary.entries && new Set(rows.map(row => row.path)).size === rows.length, "ENTRY_COUNT");
requireValue(rows.filter(row => row.kind === "file").reduce((total, row) => total + row.bytes, 0) === 329242172, "APPARENT_BYTE_SUM");
requireValue(Buffer.byteLength(lines.join("\n") + "\n") === summary.metadataBytes && raw.length === 332260, "OUTPUT_SIZE");
requireValue(raw.length < 10485760 && rows.length <= 20000 && summary.payloadsRead === false && summary.nestedSymlinksFollowed === false, "INVENTORY_LIMITS");
let streamsChecked = 0;
const sourceReceipt = JSON.parse(await readFile(p + "runs/gpu-input-inventory-source-3/receipt.json", "utf8"));
requireValue(sourceReceipt.status === "PASS_INPUT_SOURCE_ONLY" && sourceReceipt.fishSyntaxChecked === true && sourceReceipt.results.every((result: { exitCode: number }) => result.exitCode === 0), "HELPER_SOURCE_RESULT");
for (const stream of [...receipt.streams, ...sourceReceipt.results.flatMap((result: { streams: unknown[] }) => result.streams)]) {
  const bytes = await readFile(stream.path);
  requireValue(bytes.length === stream.bytes && hash(bytes) === stream.sha256, "STREAM_CHANGED:" + stream.path);
  streamsChecked++;
}
const inventorySources = JSON.parse(await readFile(directory + "/sources.json", "utf8"));
const qualifiedSources = JSON.parse(await readFile(p + "runs/gpu-qualification-source-2/sources.json", "utf8"));
for (const entry of [...inventorySources, ...sourceReceipt.sources, ...qualifiedSources]) requireValue(hash(await readFile(entry.path)) === entry.sha256, "SOURCE_CHANGED:" + entry.path);
const index = JSON.parse(await readFile("_spec/.spec-index.json", "utf8"));
for (const path of ["_spec/gpu-build.puml", "_spec/gpu-qualification.puml"]) {
  const diagram = await readFile(path, "utf8");
  const covers = [...diagram.matchAll(/^' covers: (.+)$/gm)].map(match => match[1]);
  requireValue(JSON.stringify(covers) === JSON.stringify(index.specs.find((entry: { spec: string }) => entry.spec === path).covers), "SPEC_INDEX_DRIFT");
}
const script = p + "qualification/inspect-builder.fish";
const outcome = { version: "chess-coach.input-inventory-outcome.v1", status: "CODING_METADATA_COMPLETE_OPERATOR_HOST_PACKET_PENDING",
  executionReceipt: directory + "/receipt.json", sourceReceipt: p + "runs/gpu-input-inventory-source-3/receipt.json",
  entries: rows.length, apparentRegularFileBytes: summary.apparentRegularFileBytes, apparentBytesCountEachDirectoryEntry: true, allocatedStorageEstablished: false,
  metadataInvocationConsumed: 1, metadataInvocationsRemaining: 0, llvmExecuted: false, prefixPayloadsRead: false, prefixSelected: false, prefixStaged: false,
  operator: { status: "APPROVED_NOT_EXECUTED_BY_AGENT", script, scriptSha256: hash(await readFile(script)), scriptAvailabilityOnHostEstablished: false,
    maximumPullInvocations: 1, maximumContainers: 1, pullDeadlineSeconds: 600, combinedInspectionDeadlineSeconds: 60, cleanupDeadlineSeconds: 30,
    sourceTransferOrPublishingAuthorized: false, originalHostEvidenceReceived: false },
  compiledBuilderAbiQualified: false, linkingQualified: false, libdeviceSelected: false, cudaBindingSelected: false, imageBuilt: false, gpuQualified: false, trainingReady: false };
await writeFile(directory + "/outcome.json", JSON.stringify(outcome, null, 2) + "\n", { flag: "wx" });
const stdout = `PASS: ${rows.length} metadata records, ${summary.apparentRegularFileBytes} apparent regular-file bytes, ${streamsChecked} captured streams; source hashes unchanged; operator packet remains unexecuted\n`;
await writeFile(directory + "/integrity-check.stdout", stdout, { flag: "wx" });
await writeFile(directory + "/integrity-check.stderr", "", { flag: "wx" });
const sources = await Promise.all([directory + "/receipt.json", directory + "/outcome.json", directory + "/verify-records.ts", p + "runs/gpu-input-inventory-source-3/receipt.json",
  "_spec/gpu-qualification.puml", "_spec/gpu-build.puml", "_spec/.spec-index.json", "_spec/gpu-readiness.md", "_spec/gate-closure.md"].map(async path => ({ path, sha256: hash(await readFile(path)) })));
await writeFile(directory + "/integrity-check.json", JSON.stringify({ version: "chess-coach.input-inventory-integrity.v1", status: "PASS_CAPTURED_RECORDS_ONLY", sources,
  metadataRecordsChecked: rows.length, streamHashesChecked: streamsChecked, inventorySourceHashesChecked: inventorySources.length, helperSourceHashesChecked: sourceReceipt.sources.length,
  unchangedQualificationSourceHashesChecked: qualifiedSources.length, diagramIndexMatches: 2, payloadsReadFromPrefix: false, llvmQueriesRepeated: false,
  metadataInventoryRepeated: false, operatorHostPacketExecuted: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(stdout.trim());
