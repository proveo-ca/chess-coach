// SPEC: _spec/gpu-host-build-reuse.puml
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import base from "../host-build/plan.json";
import { assertNativeGenerationDelta, assertRecordSliceCorrection, nativePath } from "../policy-record-fix/correction";

export const correctionProof = "_work/gpu-owner-recovery/runs/host-gpu-policy-record-correction-source-2/receipt.json";
export async function reusePlan() {
  const proof = JSON.parse(await readFile(correctionProof, "utf8"));
  if (proof.status !== "PASS_POLICY_RECORD_SOURCE_CORRECTION_ONLY" || proof.sourceChanged !== false) throw Error("VERIFIED_POLICY_RECORD_CORRECTION_REQUIRED");
  const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  for (const source of proof.sources) if (hash(await readFile(source.path)) !== source.sha256) throw Error("CORRECTION_SOURCE_CHANGED:" + source.path);
  const correctedUtf8 = await readFile(nativePath, "utf8"), manifestUtf8 = await readFile(proof.generation.path, "utf8");
  if (hash(Buffer.from(manifestUtf8)) !== proof.generation.sha256) throw Error("CORRECTED_MANIFEST_CHANGED");
  const original = JSON.parse(await readFile("_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/preparation.json", "utf8")).nativeSourceInventory;
  const corrected = JSON.parse(manifestUtf8);
  assertNativeGenerationDelta(original, corrected);
  const previousSha256 = original.find((row: { path: string }) => row.path === nativePath)!.sha256;
  const correctedSha256 = corrected.find((row: { path: string }) => row.path === nativePath)!.sha256;
  const before = await readFile("_work/gpu-owner-recovery/runs/host-gpu-policy-record-correction-source-2/baseline-source/command.stdout", "utf8");
  assertRecordSliceCorrection(before, correctedUtf8);
  if (hash(Buffer.from(before)) !== previousSha256 || hash(Buffer.from(correctedUtf8)) !== correctedSha256) throw Error("CORRECTION_OVERLAY_BINDING_REQUIRED");
  return {
    ...base, version: "chess-coach.owned-container-reused-cache-build-proposal.v1", status: "DRAFT_SOURCE_ONLY_HOST_APPROVAL_REQUIRED",
    method: "OWNED_CONTAINER_NATIVE_BUILD_ONLY_RETAINED_CARGO_AND_TARGET_CACHES", runId: "host-gpu-native-build-2", grant: "--approved-host-gpu-native-build-2",
    workspace: "_work/gpu-owner-recovery/cache/host-gpu-native-build-2", evidence: "_work/gpu-owner-recovery/runs/host-gpu-native-build-2",
    retained: { bun: "_work/gpu-owner-recovery/cache/host-gpu-native-build-1/bun", cargo: "_work/gpu-owner-recovery/cache/host-gpu-native-build-1/cargo-home", target: "_work/gpu-owner-recovery/cache/host-gpu-native-build-1/native/target-gpu" },
    previousSourceManifestSha256: base.sourceManifestSha256, sourceManifestSha256: proof.generation.sha256 as string,
    correctionProof: { path: correctionProof, sha256: hash(await readFile(correctionProof)) },
    overlay: { path: nativePath, previousSha256, correctedSha256, correctedUtf8 }, correctedManifest: { sha256: proof.generation.sha256 as string, utf8: manifestUtf8 },
    limits: { ...base.limits, nativeAcceptanceReserveMs: 120000, hostDockerStreamsBytes: 58720256 },
    maximums: { ...base.maximums, donorCreates: 0, donorStarts: 0, bunCopies: 0, containerRemovals: 1, dockerOperations: 7 },
    cacheWritesAuthorized: false, hostExecutionApproved: false, stagingAndNativeCompilationApproved: false,
    publicationAuthorized: false, gpuExecutionAuthorized: false, trainingAuthorized: false, automaticRetryAuthorized: false, trainingReady: false,
  };
}
export type ReusePlan = Awaited<ReturnType<typeof reusePlan>>;
export function reusePaths(root: string, p: ReusePlan) {
  return { context: resolve(root, p.context), workspace: resolve(root, p.workspace), evidence: resolve(root, p.evidence), native: resolve(root, p.workspace, "native"),
    cargo: resolve(root, p.retained.cargo), target: resolve(root, p.retained.target), bun: resolve(root, p.retained.bun) };
}
export type ReusePaths = ReturnType<typeof reusePaths>;
