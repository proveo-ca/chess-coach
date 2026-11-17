// SPEC: _spec/runtime-protocol.puml
import { afterAll, expect, spyOn, test } from "bun:test";
import { cleanExit, SyntheticTransport } from "../../packages/runtime/tests/fixture";
const spawn = spyOn(Bun, "spawn").mockImplementation(() => { throw new Error("FORBIDDEN_PROCESS_SPAWN"); });
const qualification = await import("./qualification");
const { observeCanonical, R4_PREPARATION } = qualification;
afterAll(() => { try { expect(spawn).not.toHaveBeenCalled(); } finally { spawn.mockRestore(); } });
function setup() {
  const clockNs = () => 19n, main = new SyntheticTransport("main", "native-proof", clockNs), reference = new SyntheticTransport("reference", "native-proof", clockNs);
  const input: Parameters<typeof observeCanonical>[0] = { sessionId: "synthetic-session", clockNs, createPort: role => role === "main" ? main : reference };
  return { input, main, reference };
}
test("import exposes the default-capable observer without launching a process", () => {
  expect(typeof observeCanonical).toBe("function"); expect(spawn).not.toHaveBeenCalled(); expect("observeR4" in qualification).toBe(false);
});
test("invalid supplied factories still reject before clock or process acquisition", async () => {
  let calls = 0;
  for (const value of [null, false, 0, "", {}]) await expect(observeCanonical({ sessionId: "synthetic-session", clockNs: () => { calls++; return 0n; },
    createPort: value as unknown as NonNullable<Parameters<typeof observeCanonical>[0]["createPort"]> })).rejects.toThrow("PORT_FACTORY");
  expect(calls).toBe(0); expect(spawn).not.toHaveBeenCalled();
});
test("constructor clock failure rejects instead of fabricating an operational observation", async () => {
  const env = setup(); env.input.clockNs = () => { throw new Error("source clock failed"); };
  await expect(observeCanonical(env.input)).rejects.toThrow("source clock failed");
  expect(env.main.requests).toEqual([]); expect(env.reference.requests).toEqual([]);
});
test("MOCK current-driver peers retain fourteen exchanges, three BOTH boundaries and independent natural finishes", async () => {
  const env = setup(), result = await observeCanonical(env.input), { receipt, observed } = result;
  expect(result.status).toBe("PASS"); expect(result.error).toBeNull();
  expect(receipt).toMatchObject({ execution: "MOCK", scope: "FIXED_NATIVE_PROOF_ONLY", success: true, phase: "complete", trainingExecuted: false,
    trainingReady: false, independentReferenceQualified: false, hostProofQualified: false, referenceInputDelivery: "REFERENCE_INPUT_DELIVERY_UNSELECTED",
    originNs: "19", workDeadlineNs: "10000000019", cleanupDeadlineNs: "300000000019" });
  expect(JSON.parse(receipt.boot!.json).kind).toBe("boot");
  expect(JSON.parse(receipt.start!.json)).toEqual({ version: "chess-coach.job.v1", sessionId: "synthetic-session", operation: "native-proof" });
  expect(observed.exchangeCount).toBe(14); expect(observed.boundaryKinds).toEqual(["initial", "opened", "settled"]);
  for (const [index, role] of (["main", "reference"] as const).entries()) {
    expect(observed.peers[index]).toEqual({ role, operations: ["init", "commit", "open", "commit", "settle", "commit", "close"], finish: cleanExit() });
    expect(receipt.exchanges.filter(item => item.role === role).map(item => item.ordinal)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(env[role].finished).toBe(1); expect(env[role].terminated).toBe(0);
  }
  expect(receipt.lifecycle[0]!.finish).not.toBe(receipt.lifecycle[1]!.finish);
});
test("MOCK failed lifecycle returns FAIL without losing the completed protocol or other finish receipt", async () => {
  const env = setup(); env.reference.finish = async () => { throw new Error("synthetic finish failed"); };
  const result = await observeCanonical(env.input); expect(result.status).toBe("FAIL"); expect(result.error).toContain("synthetic finish failed");
  expect(result.receipt).toMatchObject({ execution: "MOCK", success: false, reply: null, trainingReady: false, hostProofQualified: false, cleanup: "COMPLETE" });
  expect(result.receipt.exchanges).toHaveLength(14); expect(result.receipt.boundaries).toHaveLength(3);
  expect(result.receipt.lifecycle[0]!.finish).toEqual(cleanExit()); expect(result.receipt.lifecycle[1]).toMatchObject({ finish: null, finishError: "Error: synthetic finish failed" });
  expect(result.receipt.failures.length).toBeGreaterThan(0); expect(env.main.terminated).toBe(1); expect(env.reference.terminated).toBe(1);
});
test("MOCK exchange failure retains its failed exchange alongside the successful peer reply", async () => {
  const env = setup(); env.reference.exchange = async () => { throw new Error("synthetic exchange failed"); };
  const result = await observeCanonical(env.input); expect(result.status).toBe("FAIL"); expect(result.error).toContain("synthetic exchange failed");
  expect(result.receipt.execution).toBe("MOCK"); expect(result.receipt.exchanges).toHaveLength(2);
  expect(result.receipt.exchanges[0]!.reply?.kind).toBe("staged"); expect(result.receipt.exchanges[1]!.error).toContain("synthetic exchange failed");
  expect(result.observed.boundaryKinds).toEqual([]); expect(result.observed.peers.map(peer => peer.finish)).toEqual([null, null]);
});
test("R4 preparation names only the existing APIs, two attempts and original per-phase budgets without execution", () => {
  expect(R4_PREPARATION).toMatchObject({ status: "BLOCKED", scope: "R4_PREPARATION_ONLY", executed: false, master: 101, reuse: "SAME_COORDINATOR_AND_CREATE_OWNED",
    requiredApproval: "FRESH_HOST_QUALIFICATION_NOT_TRAINING_CAMPAIGN", perPhaseDeadlineOffsetsNs: { startup: "10000000000", work: "297000000000", cleanup: "300000000000" } });
  expect(R4_PREPARATION.attempts).toEqual([{ startedOrdinal: 0, scheduleKind: "corpus" }, { startedOrdinal: 1, scheduleKind: "live" }]);
  expect(R4_PREPARATION.coordinator).toEqual({ source: "packages/runtime/src/training-coordinator.ts", api: "TrainingCoordinator", methods: ["initializeMaster", "runAttempt", "snapshot", "close"] });
  expect(R4_PREPARATION.factory).toEqual({ source: "packages/runtime/src/fixed-attempt.ts", api: "FixedAttemptFactory.create" });
  expect(R4_PREPARATION.entrypoints).toEqual(["/app/packages/runtime/src/match-worker-main.ts", "/usr/local/bin/policy-channel", "/usr/local/bin/policy-score"]);
  expect(R4_PREPARATION.requiredInputs).toEqual(["actual TrainingCoordinator instance", "initialRecord: NativeRecord", "createOwned: AttemptSetup from FixedAttemptFactory.create", "clockNs: () => bigint"]);
  expect(R4_PREPARATION.requiredEvidence).toEqual(["nonzero actual-native scores", "context", "recipient", "economics", "paired proposal", "reload", "retained completion"]);
});
