// SPEC: _spec/gpu-input-transfer.puml
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import request from "./request.json";
import { checkSourceGate, evidence, hashFile, workspace } from "./prepare";
import { publication, runPublisher } from "./publish";
import { repository } from "../../provision";

async function main() {
  if (Bun.argv.length !== 2 || resolve(process.cwd()) !== resolve(repository) || request.draftReleaseAndTwoUploadsAuthorized !== true
    || request.repository !== publication.repository || request.releaseTag !== publication.tag || request.releaseDraftRequired !== true) throw Error("APPROVED_PUBLISHER_CONTEXT_REQUIRED");
  const parent = JSON.parse(await readFile(resolve(evidence, "receipt.json"), "utf8"));
  const prepared = JSON.parse(await readFile(resolve(evidence, "preparation.json"), "utf8"));
  if (parent.status !== "PASS_PREPARATION_ONLY_PUBLICATION_PENDING" || parent.publicationContinuationAuthorized !== true
    || prepared.status !== "PASS_INPUT_PREPARATION_ONLY" || prepared.bundle.name !== publication.bundleName || prepared.bundle.bytes > request.limits.bundleBytes
    || prepared.contextBytes > request.limits.contextBytes) throw Error("COMPLETE_PREPARATION_REQUIRED");
  const bundle = { path: resolve(repository, prepared.bundle.path), bytes: prepared.bundle.bytes as number, sha256: prepared.bundle.sha256 as string };
  const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  const manifestPath = resolve(workspace, publication.manifestName);
  const result = await runPublisher({ repositoryDirectory: repository, bundle }, {
    validateFrozen: async (commit, remainingMs) => {
      const deadline = performance.now() + remainingMs;
      const gate = await checkSourceGate(parent.sourceGate.path);
      if (gate.sha256 !== parent.sourceGate.sha256) return false;
      const contextBytes = await readFile(resolve(repository, prepared.contextManifest));
      if (hash(contextBytes) !== prepared.contextManifestSha256) return false;
      const actual = await hashFile(bundle.path, deadline);
      if (actual.bytes !== bundle.bytes || actual.sha256 !== bundle.sha256) return false;
      if (commit !== null) {
        for (const source of gate.sources) {
          const remaining = Math.floor(deadline - performance.now());
          if (remaining <= 0) return false;
          const object = Bun.spawnSync(["/usr/bin/git", "cat-file", "blob", `${commit}:${source.path}`], { cwd: repository,
            env: { PATH: "/usr/bin:/bin", GIT_NO_LAZY_FETCH: "1" }, stdout: "pipe", stderr: "pipe", timeout: remaining });
          if (object.exitCode !== 0 || hash(object.stdout) !== source.sha256) return false;
        }
      }
      return performance.now() < deadline;
    },
    commitManifest: async (commit, remainingMs) => {
      const deadline = performance.now() + remainingMs;
      const contextBytes = await readFile(resolve(repository, prepared.contextManifest));
      if (hash(contextBytes) !== prepared.contextManifestSha256) throw Error("CONTEXT_MANIFEST_CHANGED");
      const actual = await hashFile(bundle.path, deadline);
      if (actual.bytes !== bundle.bytes || actual.sha256 !== bundle.sha256) throw Error("PREPARED_BUNDLE_CHANGED");
      const value = { version: "chess-coach.host-feasibility-input-asset-manifest.v1", sourceCommit: commit, sourceGate: { path: parent.sourceGate.path, sha256: parent.sourceGate.sha256 },
        bundle: { name: publication.bundleName, ...actual }, contextManifestSha256: prepared.contextManifestSha256, files: JSON.parse(contextBytes.toString()),
        nativeSourceInventory: prepared.nativeSourceInventory, providerArchive: prepared.providerArchive, libdevice: prepared.libdevice, licenses: prepared.licenses,
        cachedCrateArchives: prepared.cachedCrateArchives, registryMetadataFiles: prepared.registryMetadataFiles, missingArchives: prepared.missingArchives, missingMetadata: prepared.missingMetadata,
        completeOfflineBuildCoverageQualified: false, operatorDownloadOrExtractionAuthorized: false, compilationPerformed: false, gpuExecutionPerformed: false, trainingReady: false };
      const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n");
      if (bytes.length > 4 * 1024 * 1024 || prepared.workspacePayloadBytes + bytes.length > request.limits.workspaceBytes || performance.now() >= deadline) throw Error("ASSET_MANIFEST_BUDGET");
      await writeFile(manifestPath, bytes, { flag: "wx", mode: 0o600 });
      return { bundle, manifest: { path: manifestPath, bytes: bytes.length, sha256: hash(bytes) } };
    },
  });
  console.log(JSON.stringify({ status: result.status, failedStep: result.failedStep, failure: result.failure, sourceCommit: result.sourceCommit, releaseId: result.releaseId,
    uploadedAssets: result.uploadedAssets, trainingReady: false }));
  process.exitCode = result.status === "PASS" ? 0 : 1;
}

if (import.meta.main) await main();
