// SPEC: _spec/gpu-host-receive.puml
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { receivePlan, selectReceivePaths } from "../../qualification/host-receive/receive";

const directory = "_work/gpu-owner-recovery/runs/host-input-receive-observation-2";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: boolean, label: string) => { if (!value) throw Error(label); };
const observation = JSON.parse(await readFile(directory + "/observation.json", "utf8"));
const paste = await readFile(observation.paste, "utf8"), lines = paste.trimEnd().split("\n");
check(lines.slice(0, 4).join("\n") === "BOOTSTRAP_STARTED\nFETCH_EXIT=0\nHELPER_HASH_VERIFIED\nRECEIVE_EXIT=0" && lines.at(-1) === "HOST_COMMAND_EXIT=0", "SUCCESS_FRAMES_REQUIRED");
const summary = JSON.parse(lines[4]!);
const receiptText = lines.slice(5, -1).join("\n") + "\n", receipt = JSON.parse(receiptText);
const request = JSON.parse(await readFile(observation.request, "utf8")), handoff = JSON.parse(await readFile(observation.handoff, "utf8"));
const selected = selectReceivePaths(receipt.grant);
check(request.operatorReceiveApproved === true && receipt.grant === "--approved-host-receive-2" && receipt.workspace === selected.workspace && receipt.evidence === selected.evidence, "APPROVED_RUN2_PATHS");
check(receipt.status === "PASS_HOST_RECEIVE_AND_EXTRACT_ONLY" && summary.status === receipt.status && receipt.failure === null && summary.failure === null && receipt.stage === "complete", "RECEIVE_ONLY_PASS");
check(summary.receipt === selected.evidence + "/receipt.json" && summary.trainingReady === false, "SUMMARY_SCOPE");
check(receipt.helperSourceCommit === handoff.helperSourceCommit && summary.helperSourceCommit === receipt.helperSourceCommit && receipt.helperSha256 === handoff.helper.sha256, "HELPER_LINEAGE");
check(receipt.assetSourceCommit === receivePlan.assetSourceCommit && summary.assetSourceCommit === receipt.assetSourceCommit && receipt.releaseId === receivePlan.releaseId, "ASSET_LINEAGE");
check(JSON.stringify(receipt.attempts) === JSON.stringify({ downloads: 2, listing: 1, extraction: 1, verification: 1 }) && receipt.elapsedMs > 0 && receipt.elapsedMs < receivePlan.limits.totalMs, "BOUNDED_REPORTED_ATTEMPTS");
check(JSON.stringify(receipt.assets) === JSON.stringify([receivePlan.manifest, receivePlan.bundle].map(({ name, bytes, sha256 }) => ({ name, bytes, sha256 }))), "REPORTED_EXACT_ASSETS");
check(JSON.stringify(receipt.context) === JSON.stringify({ bytes: 429218730, files: 3800, directories: 137, links: 2, nativeInputs: 65, nativeManifestSha256: "9141aaefa2fab3f3a812aeabec4bdfdd818415333f9e5cba6d5ef822dac90863" }), "REPORTED_CONTEXT_TOTALS");
const prepared = JSON.parse(await readFile("_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/preparation.json", "utf8"));
check(receipt.missingArchives.length === 103 && new Set(receipt.missingArchives).size === 103 && receipt.missingMetadata.length === 0, "OFFLINE_LIMITATION_PRESERVED");
const discrepancy = { reportedOnly: receipt.missingArchives.filter((name: string) => !prepared.missingArchives.includes(name)), preparedOnly: prepared.missingArchives.filter((name: string) => !receipt.missingArchives.includes(name)) };
check(JSON.stringify(discrepancy) === JSON.stringify(observation.missingArchiveListDiscrepancy) && observation.reportedMissingArchiveListExactlyMatchesPreparation === false, "KNOWN_ARCHIVE_LIST_DISCREPANCY_RETAINED");
for (const field of ["completeOfflineBuildCoverageQualified", "compilationPerformed", "llvmOrCargoExecuted", "gpuExecuted", "trainingReady", "automaticRetryAuthorized", "workspaceIsFilesystemQuota"]) check(receipt[field] === false, "SCOPE_FALSE:" + field);
check(receipt.artifacts.length === 8 && receipt.artifacts.every((row: { exitCode: number; bytes: number; sha256: string; path: string }) => row.exitCode === 0 && Number.isSafeInteger(row.bytes) && row.bytes >= 0 && /^[a-f0-9]{64}$/.test(row.sha256) && (row.path.startsWith(selected.workspace + "/") || row.path.startsWith(selected.evidence + "/"))), "REPORTED_ARTIFACT_METADATA");
for (const asset of receipt.assets) check(receipt.artifacts.some((row: { path: string; bytes: number; sha256: string }) => row.path === selected.workspace + "/" + asset.name && row.bytes === asset.bytes && row.sha256 === asset.sha256), "REPORTED_ASSET_ARTIFACT");
check(observation.functionalReceiveAndExtractionFactsAccepted === true && observation.remainingHostInvocations === 0 && observation.originalHostFilesReceived === false, "REPORT_ACCEPTANCE_AND_CONSUMPTION");
const paths = [observation.paste, directory + "/observation.json", directory + "/verify-report.ts", observation.request, observation.handoff];
const sources = await Promise.all(paths.map(async path => ({ path, sha256: hash(await readFile(path)) })));
await writeFile(directory + "/reported-receipt.json", receiptText, { flag: "wx" });
await writeFile(directory + "/record-check.json", JSON.stringify({ status: "PASS_OPERATOR_REPORTED_RECEIVE2_RECORDS_WITH_LIST_DISCREPANCY", sources, reportedReceiptSha256: hash(Buffer.from(receiptText)), discrepancy,
  reportedArtifactMetadataCount: 8, actualHostArtifactBytesRehashed: false, reportedFactsAccepted: true, originalHostFilesReceived: false, remainingHostInvocations: 0,
  sourcePublicationPerformed: false, hostOrNativeOrGpuOperationsPerformed: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log("PASS_OPERATOR_REPORTED_RECEIVE2_RECORDS_WITH_LIST_DISCREPANCY: lineage/context accepted; ntapi list mismatch retained; invocation consumed");
