// SPEC: _spec/gpu-host-receive.puml
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { repository } from "../../provision";
import { publication, runPublisher } from "../transfer/publish";
import { sourceInventory } from "../../../../tooling/runtime/qualification";
import { renderHostReceive2 } from "./bootstrap";
import { receivePlan } from "./receive";

export type Receive2Approval = { version: string; status: string; sourceProof: { path: string; sha256: string }; helper: { path: string; bytes: number; sha256: string };
  sourcePublication: { maximumCommits: number; maximumHttpsPushes: number; deadlineMs: number; url: string; branch: string }; operatorCommand: { maximumInvocations: number; maximumHelperDownloads: number; maximumAssetDownloads: number; maximumExtractions: number; totalMs: number } };
export function validateReceive2Approval(value: unknown): Receive2Approval {
  const approval = value as Receive2Approval | null;
  const proofLabel = /^_work\/gpu-owner-recovery\/runs\/host-input-receive-source-([1-9][0-9]*)\/receipt\.json$/.exec(approval?.sourceProof?.path ?? "");
  const proofRevision = Number(proofLabel?.[1]);
  if (!approval || approval.version !== "chess-coach.approved-mise-host-receive-run2.v1" || approval.status !== "APPROVED_ONE_SOURCE_PUBLICATION_AND_ONE_OPERATOR_RECEIVE_RUN2"
    || !proofLabel || !Number.isSafeInteger(proofRevision) || proofRevision < 3 || !/^[a-f0-9]{64}$/.test(approval.sourceProof?.sha256 ?? "")
    || approval.helper?.path !== "_work/gpu-owner-recovery/qualification/host-receive/receive.ts" || !Number.isSafeInteger(approval.helper.bytes) || approval.helper.bytes <= 0 || approval.helper.bytes > 131072 || !/^[a-f0-9]{64}$/.test(approval.helper.sha256)
    || approval.sourcePublication?.maximumCommits !== 1 || approval.sourcePublication.maximumHttpsPushes !== 1 || approval.sourcePublication.deadlineMs !== 600000 || approval.sourcePublication.url !== publication.httpsUrl || approval.sourcePublication.branch !== publication.branch
    || approval.operatorCommand?.maximumInvocations !== 1 || approval.operatorCommand.maximumHelperDownloads !== 1 || approval.operatorCommand.maximumAssetDownloads !== 2 || approval.operatorCommand.maximumExtractions !== 1 || approval.operatorCommand.totalMs !== 900000) throw Error("APPROVED_RECEIVE_RUN2_REQUEST_REQUIRED");
  return approval;
}

async function main() {
  if (Bun.argv.length !== 2 || resolve(process.cwd()) !== resolve(repository)) throw Error("RECEIVE_RUN2_SOURCE_PUBLICATION_CONTEXT_REQUIRED");
  const root = resolve(repository, "_work/gpu-owner-recovery/runs/host-input-receive-handoff-2");
  const approval = validateReceive2Approval(JSON.parse(await readFile(resolve(root, "request.json"), "utf8")));
  const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  const validateFrozen = async (commit: string | null, remainingMs: number) => {
    const deadline = performance.now() + remainingMs;
    const proofBytes = await readFile(resolve(repository, approval.sourceProof.path));
    if (hash(proofBytes) !== approval.sourceProof.sha256) return false;
    const proof = JSON.parse(proofBytes.toString());
    if (proof.status !== "PASS_HOST_RECEIVE_SOURCE_ONLY" || proof.sourceChanged !== false || proof.helper.path !== approval.helper.path || proof.helper.bytes !== approval.helper.bytes || proof.helper.sha256 !== approval.helper.sha256) return false;
    for (const source of proof.sources) {
      if (performance.now() >= deadline || hash(await readFile(resolve(repository, source.path))) !== source.sha256) return false;
      if (commit !== null) {
        const remaining = Math.floor(deadline - performance.now()); if (remaining <= 0) return false;
        const blob = Bun.spawnSync(["/usr/bin/git", "cat-file", "blob", commit + ":" + source.path], { cwd: repository, env: { PATH: "/usr/bin:/bin", GIT_NO_LAZY_FETCH: "1" }, stdout: "pipe", stderr: "pipe", timeout: remaining });
        if (blob.exitCode !== 0 || hash(blob.stdout) !== source.sha256) return false;
      }
    }
    const prepared = JSON.parse(await readFile(resolve(repository, "_work/gpu-owner-recovery/runs/host-feasibility-inputs-1/preparation.json"), "utf8"));
    return JSON.stringify(await sourceInventory(repository)) === JSON.stringify(prepared.nativeSourceInventory) && performance.now() < deadline;
  };
  const result = await runPublisher({ repositoryDirectory: repository, sourceOnly: true, receiptDirectory: resolve(root, "publication"), bundle: { path: "", bytes: receivePlan.bundle.bytes, sha256: receivePlan.bundle.sha256 } }, {
    validateFrozen, commitManifest: async () => { throw Error("ASSET_PUBLICATION_NOT_AUTHORIZED"); },
  });
  if (result.status === "PASS" && result.pushedCommit !== null) {
    const command = renderHostReceive2(result.pushedCommit, approval.helper.sha256) + "\n";
    await writeFile(resolve(root, "host-command.fish"), command, { flag: "wx" });
    await writeFile(resolve(root, "handoff.json"), JSON.stringify({ status: "READY_FOR_ONE_APPROVED_MISE_OPERATOR_RECEIVE_RUN2", helperSourceCommit: result.pushedCommit, assetSourceCommit: receivePlan.assetSourceCommit,
      helper: approval.helper, sourceProof: approval.sourceProof, commandSha256: hash(Buffer.from(command)), command: "_work/gpu-owner-recovery/runs/host-input-receive-handoff-2/host-command.fish",
      expectedReceipt: "_work/gpu-owner-recovery/runs/host-input-receive-2/receipt.json", expectedStatus: "PASS_HOST_RECEIVE_AND_EXTRACT_ONLY", hostExecuted: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
  }
  console.log(JSON.stringify({ status: result.status, failure: result.failure, sourceCommit: result.sourceCommit, pushedCommit: result.pushedCommit, hostOutputRequired: true }));
  process.exitCode = result.status === "PASS" ? 0 : 1;
}

if (import.meta.main) await main();
