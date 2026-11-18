// SPEC: _spec/gpu-host-receive.puml
import { expect, test } from "bun:test";
import { validateReceive2Approval } from "./publish-run2";

const request = () => ({ version: "chess-coach.approved-mise-host-receive-run2.v1", status: "APPROVED_ONE_SOURCE_PUBLICATION_AND_ONE_OPERATOR_RECEIVE_RUN2",
  sourceProof: { path: "_work/gpu-owner-recovery/runs/host-input-receive-source-3/receipt.json", sha256: "a".repeat(64) }, helper: { path: "_work/gpu-owner-recovery/qualification/host-receive/receive.ts", bytes: 20000, sha256: "b".repeat(64) },
  sourcePublication: { maximumCommits: 1, maximumHttpsPushes: 1, deadlineMs: 600000, url: "https://github.com/proveo-ca/chess-coach.git", branch: "feat-ml-adjuntant-ii" },
  operatorCommand: { maximumInvocations: 1, maximumHelperDownloads: 1, maximumAssetDownloads: 2, maximumExtractions: 1, totalMs: 900000 } });

test("source publication requires a fresh exact run-2 approval and current helper proof", () => {
  const value = request(); expect(validateReceive2Approval(value)).toBe(value);
  for (const revision of [10, 29, 30]) {
    const fresh = request(); fresh.sourceProof.path = `_work/gpu-owner-recovery/runs/host-input-receive-source-${revision}/receipt.json`;
    expect(validateReceive2Approval(fresh)).toBe(fresh);
  }
  for (const invalid of [null, {}, { ...value, status: "PROPOSAL" }, { ...value, sourceProof: { ...value.sourceProof, path: "_work/gpu-owner-recovery/runs/host-input-receive-source-2/receipt.json" } },
    { ...value, helper: { ...value.helper, path: "other.ts" } }, { ...value, helper: { ...value.helper, bytes: 131073 } }]) expect(() => validateReceive2Approval(invalid)).toThrow("APPROVED_RECEIVE_RUN2_REQUEST_REQUIRED");
});

test("larger mutation budgets and alternate transport targets cannot widen run-2 scope", () => {
  for (const change of [{ maximumCommits: 2 }, { maximumHttpsPushes: 2 }, { deadlineMs: 600001 }, { url: "git@github.com:proveo-ca/chess-coach.git" }, { branch: "main" }]) {
    const value = request(); Object.assign(value.sourcePublication, change); expect(() => validateReceive2Approval(value)).toThrow();
  }
  for (const change of [{ maximumInvocations: 2 }, { maximumHelperDownloads: 2 }, { maximumAssetDownloads: 3 }, { maximumExtractions: 2 }, { totalMs: 900001 }]) {
    const value = request(); Object.assign(value.operatorCommand, change); expect(() => validateReceive2Approval(value)).toThrow();
  }
});
