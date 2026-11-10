// SPEC: _spec/gpu-input-transfer.puml
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import request from "./https-publication-request.json";
import originalRequest from "./request.json";
import { checkSourceGate, hashFile } from "./prepare";
import { publication, runPublisher } from "./publish";
import { repository } from "../../provision";
import { sourceInventory } from "../../../../tooling/runtime/qualification";

type Source = { path: string; sha256: string };
export function requireUnchangedNative(original: Source[], current: Source[], reviewed: Source[]) {
  const sort = (sources: Source[]) => [...sources].sort((a, b) => a.path.localeCompare(b.path));
  if (original.length !== request.nativeInputs || JSON.stringify(sort(original)) !== JSON.stringify(sort(current))) throw Error("PREPARED_NATIVE_INPUTS_CHANGED");
  const accepted = new Map(reviewed.map(source => [source.path, source.sha256]));
  if (original.some(source => accepted.get(source.path) !== source.sha256)) throw Error("PREPARED_NATIVE_INPUTS_NOT_IN_NEW_GATE");
}

export async function publishPreparedHttps(activeRequest: typeof request & { priorFailure?: string } = request) {
  const request = activeRequest;
  if (Bun.argv.length !== 2 || resolve(process.cwd()) !== resolve(repository) || request.httpsUrl !== publication.httpsUrl || request.deadlineMs !== publication.deadlineMs
    || request.repository !== publication.repository || request.branch !== publication.branch || request.releaseTag !== publication.tag || request.releaseDraftRequired !== true) throw Error("FRESH_HTTPS_PUBLICATION_CONTEXT_REQUIRED");
  const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  const preparedBytes = await readFile(resolve(repository, request.preparedEvidence, "preparation.json"));
  const prepared = JSON.parse(preparedBytes.toString());
  if (prepared.status !== "PASS_INPUT_PREPARATION_ONLY" || prepared.bundle.bytes !== request.bundleBytes || prepared.bundle.sha256 !== request.bundleSha256
    || prepared.contextManifestSha256 !== request.contextManifestSha256 || prepared.bundle.path !== originalRequest.workspace + "/" + publication.bundleName) throw Error("APPROVED_PREPARED_BUNDLE_REQUIRED");
  const bundle = { path: resolve(repository, prepared.bundle.path), bytes: request.bundleBytes, sha256: request.bundleSha256 };
  const manifestPath = resolve(repository, originalRequest.workspace, publication.manifestName);
  const directory = resolve(repository, request.evidence);
  let reuseWritten = false;
  const result = await runPublisher({ repositoryDirectory: repository, bundle, receiptDirectory: directory }, {
    validateFrozen: async (commit, remainingMs) => {
      const deadline = performance.now() + remainingMs;
      const gate = await checkSourceGate(request.sourceGate);
      const oldGateBytes = await readFile(resolve(repository, request.preparedEvidence, "source-gate.json"));
      const oldGate = JSON.parse(oldGateBytes.toString());
      const oldReceipt = JSON.parse(await readFile(resolve(repository, request.preparedEvidence, "receipt.json"), "utf8"));
      const failureBytes = await readFile(resolve(repository, request.closedFailure));
      const failed = JSON.parse(failureBytes.toString());
      if (request.priorFailure !== undefined) {
        const prior = JSON.parse(await readFile(resolve(repository, request.priorFailure), "utf8"));
        if (prior.status !== "FAIL" || prior.failedStep !== "commit" || prior.attempts.commit !== 1 || prior.attempts.push !== 0 || prior.attempts.createRelease !== 0 || prior.attempts.upload !== 0) return false;
      }
      if (failed.status !== "FAIL" || failed.failure !== "PUBLICATION_ORIGIN_MISMATCH" || failed.failedStep !== "origin-fetch"
        || Object.values(failed.attempts).some(value => value !== 0) || failed.sourceCommit !== null || failed.releaseId !== null
        || oldReceipt.status !== "PASS_PREPARATION_ONLY_PUBLICATION_PENDING" || oldReceipt.sourceGate.sha256 !== oldGate.sha256
        || hash(await readFile(resolve(repository, oldGate.path))) !== oldGate.sha256 || hash(await readFile(resolve(repository, request.preparedEvidence, "preparation.json"))) !== hash(preparedBytes)) return false;
      requireUnchangedNative(prepared.nativeSourceInventory, await sourceInventory(repository), gate.sources);
      const contextBytes = await readFile(resolve(repository, prepared.contextManifest));
      if (hash(contextBytes) !== request.contextManifestSha256) return false;
      const actual = await hashFile(bundle.path, deadline);
      if (actual.bytes !== bundle.bytes || actual.sha256 !== bundle.sha256) return false;
      if (commit !== null) for (const source of gate.sources) {
        const remaining = Math.floor(deadline - performance.now());
        if (remaining <= 0) return false;
        const blob = Bun.spawnSync(["/usr/bin/git", "cat-file", "blob", `${commit}:${source.path}`], { cwd: repository,
          env: { PATH: "/usr/bin:/bin", GIT_NO_LAZY_FETCH: "1" }, stdout: "pipe", stderr: "pipe", timeout: remaining });
        if (blob.exitCode !== 0 || hash(blob.stdout) !== source.sha256) return false;
      }
      if (!reuseWritten) {
        await writeFile(resolve(directory, "reuse.json"), JSON.stringify({ version: "chess-coach.qualification-prepared-reuse.v1", status: "PASS_UNCHANGED_PREPARED_BYTES_AND_CURRENT_PUBLISHER",
          originalPreparation: request.preparedEvidence + "/preparation.json", originalPreparationSha256: hash(preparedBytes), originalSourceGate: { path: oldGate.path, sha256: oldGate.sha256 },
          originalFailure: request.closedFailure, originalFailureSha256: hash(failureBytes), currentSourceGate: { path: gate.path, sha256: gate.sha256 }, bundle,
          priorFailure: request.priorFailure ?? null,
          contextManifestSha256: request.contextManifestSha256, nativeInputs: request.nativeInputs, downloadCopyOrRepackPerformed: false, compilationPerformed: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
        reuseWritten = true;
      }
      return performance.now() < deadline;
    },
    commitManifest: async (commit, remainingMs) => {
      const deadline = performance.now() + remainingMs;
      const gate = await checkSourceGate(request.sourceGate);
      const contextBytes = await readFile(resolve(repository, prepared.contextManifest));
      if (hash(contextBytes) !== request.contextManifestSha256) throw Error("PREPARED_CONTEXT_MANIFEST_CHANGED");
      const actual = await hashFile(bundle.path, deadline);
      if (actual.bytes !== bundle.bytes || actual.sha256 !== bundle.sha256) throw Error("PREPARED_BUNDLE_CHANGED");
      const value = { version: "chess-coach.host-feasibility-input-asset-manifest.v1", sourceCommit: commit,
        sourceGate: { path: gate.path, sha256: gate.sha256 }, originalPreparationEvidence: request.preparedEvidence, originalPreparationSha256: hash(preparedBytes),
        originalSourceGate: JSON.parse(await readFile(resolve(repository, request.preparedEvidence, "source-gate.json"), "utf8")).path,
        publicationRequest: request.priorFailure === undefined ? "_work/gpu-owner-recovery/qualification/transfer/https-publication-request.json" : "_work/gpu-owner-recovery/qualification/transfer/identity-publication-request.json", bundle: { name: publication.bundleName, ...actual },
        contextManifestSha256: request.contextManifestSha256, files: JSON.parse(contextBytes.toString()), nativeSourceInventory: prepared.nativeSourceInventory,
        providerArchive: prepared.providerArchive, libdevice: prepared.libdevice, licenses: prepared.licenses,
        cachedCrateArchives: prepared.cachedCrateArchives, registryMetadataFiles: prepared.registryMetadataFiles, missingArchives: prepared.missingArchives, missingMetadata: prepared.missingMetadata,
        completeOfflineBuildCoverageQualified: false, operatorDownloadOrExtractionAuthorized: false, compilationPerformed: false, gpuExecutionPerformed: false, trainingReady: false };
      const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n");
      if (bytes.length > 4 * 1024 * 1024 || prepared.workspacePayloadBytes + bytes.length > originalRequest.limits.workspaceBytes || performance.now() >= deadline) throw Error("PUBLICATION_MANIFEST_BUDGET");
      await writeFile(manifestPath, bytes, { flag: "wx", mode: 0o600 });
      return { bundle, manifest: { path: manifestPath, bytes: bytes.length, sha256: hash(bytes) } };
    },
  });
  console.log(JSON.stringify({ status: result.status, failure: result.failure, failedStep: result.failedStep, sourceCommit: result.sourceCommit, releaseId: result.releaseId,
    uploadedAssets: result.uploadedAssets, receipt: request.evidence + "/publication.json", trainingReady: false }));
  process.exitCode = result.status === "PASS" ? 0 : 1;
}

if (import.meta.main) await publishPreparedHttps();
