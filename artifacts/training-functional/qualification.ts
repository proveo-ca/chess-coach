// SPEC: _spec/runtime-protocol.puml
import { createCanonicalProof } from "../../_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/canonical";

export async function observeCanonical(input: Parameters<typeof createCanonicalProof>[0]) {
  const proof = createCanonicalProof(input);
  let error: string | null = null;
  try {
    proof.boot();
    await proof.run(JSON.stringify({ version: "chess-coach.job.v1", sessionId: input.sessionId, operation: "native-proof" }));
  } catch (reason) { error = String(reason).slice(0, 4096); }
  const receipt = proof.receipt();
  return { status: error === null ? "PASS" as const : "FAIL" as const, error, receipt,
    observed: { exchangeCount: receipt.exchanges.length, boundaryKinds: receipt.boundaries.map(item => item.boundary.kind),
      peers: receipt.lifecycle.map(({ role, finish }) => ({ role,
        operations: receipt.exchanges.filter(item => item.role === role).map(item => item.operation), finish })) } };
}

export const R4_PREPARATION = {
  status: "BLOCKED", scope: "R4_PREPARATION_ONLY", executed: false,
  requiredApproval: "FRESH_HOST_QUALIFICATION_NOT_TRAINING_CAMPAIGN",
  master: 101, attempts: [{ startedOrdinal: 0, scheduleKind: "corpus" }, { startedOrdinal: 1, scheduleKind: "live" }],
  coordinator: { source: "packages/runtime/src/training-coordinator.ts", api: "TrainingCoordinator",
    methods: ["initializeMaster", "runAttempt", "snapshot", "close"] },
  factory: { source: "packages/runtime/src/fixed-attempt.ts", api: "FixedAttemptFactory.create" },
  requiredInputs: ["actual TrainingCoordinator instance", "initialRecord: NativeRecord", "createOwned: AttemptSetup from FixedAttemptFactory.create", "clockNs: () => bigint"],
  reuse: "SAME_COORDINATOR_AND_CREATE_OWNED",
  entrypoints: ["/app/packages/runtime/src/match-worker-main.ts", "/usr/local/bin/policy-channel", "/usr/local/bin/policy-score"],
  perPhaseDeadlineOffsetsNs: { startup: "10000000000", work: "297000000000", cleanup: "300000000000" },
  requiredEvidence: ["nonzero actual-native scores", "context", "recipient", "economics", "paired proposal", "reload", "retained completion"],
} as const;
