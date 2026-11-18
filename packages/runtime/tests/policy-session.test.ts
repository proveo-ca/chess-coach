// SPEC: _spec/policy-runtime.puml
import { expect, test } from "bun:test";
import { canonicalInitialObservation } from "../../contracts/src/initialization";
import { initializeGame, openGame, settleGame } from "../../contracts/src/game-session";
import type { DecisionJournal } from "../../contracts/src/episode";
import { deriveStream, drawStream } from "../src/rng";
import { PolicySession, PolicyWorker, distribution, selectedIndex } from "../src/policy-session";
import type { FrozenScorePort, PolicyContext } from "../src/policy-session";

function setup(mode: "sample" | "argmax" = "sample", full = false) {
  let now = 0n, calls = 0;
  let alter: ((reply: Record<string, unknown>) => void) | null = null;
  const clockNs = () => now;
  const scorer: FrozenScorePort = { score: async json => {
    calls++;
    const request = JSON.parse(json);
    const reply: Record<string, unknown> = { version: request.version, featureVersion: request.featureVersion,
      requestId: request.requestId, modelId: request.modelId, logits: Array(request.rows).fill(0) };
    alter?.(reply);
    return { json: JSON.stringify(reply), receivedNs: clockNs() };
  } };
  const observation = structuredClone(canonicalInitialObservation("w"));
  if (!full) { Reflect.set(observation.own, "minerals", 0); Reflect.set(observation.own, "gas", 0); }
  const context: PolicyContext = { mode, modelId: "a".repeat(64), observationJson: JSON.stringify(observation), sampling: deriveStream(101, "policy-sampling"),
    permit: { version: "chess-coach.plan-permit.v1", attemptId: "attempt", permitId: "attempt:plan:0:w", planningOrdinal: 0, turn: 0,
      side: "w", role: "candidate", issuedNs: "0", deadlineNs: "10000000000" }, workDeadlineNs: 100_000_000_000n, clockNs };
  return { context, scorer, setTime: (value: bigint) => { now = value; }, calls: () => calls, alter: (callback: typeof alter) => { alter = callback; } };
}

test("full 512-candidate policy waits for the exact permit and commits one draw only after verified ACK", async () => {
  const env = setup("sample", true), worker = new PolicyWorker(env.context, env.scorer), owner = new PolicySession(env.context, env.scorer);
  expect(env.calls()).toBe(0);
  const before = worker.sampling();
  const json = await worker.plan(JSON.stringify(env.context.permit));
  expect(worker.sampling()).toEqual(before);
  const accepted = await owner.acknowledge({ json, receivedNs: 0n });
  expect(accepted.features.rows).toBe(512);
  expect(accepted.journal.samplingAfter).toEqual(drawStream(before).after);
  expect(env.calls()).toBe(2);
  worker.acceptAck(accepted.digest);
  expect(worker.sampling()).toEqual(accepted.journal.samplingAfter);
  expect(accepted.journal).not.toHaveProperty("features");
}, 15_000);

test("argmax exact ties use key order with no RNG draw and one actual native admission", async () => {
  const env = setup("argmax"), worker = new PolicyWorker(env.context, env.scorer), owner = new PolicySession(env.context, env.scorer);
  const json = await worker.plan(JSON.stringify(env.context.permit));
  const accepted = await owner.acknowledge({ json, receivedNs: 0n });
  expect(accepted.journal.selectedKey).toBe("[]");
  expect(accepted.journal.uniform).toBeNull();
  expect(accepted.journal.samplingAfter).toEqual(env.context.sampling);
  worker.acceptAck(accepted.digest);
  const opened = openGame(initializeGame()).session;
  let admitted = 0;
  const settled = await owner.admit(actions => { admitted++; return settleGame(opened, { w: actions, b: [] }).session; });
  expect(settled.snapshot.turn).toBe(1);
  expect(admitted).toBe(1);
  await expect(owner.admit(() => { admitted++; })).rejects.toThrow("ADMISSION_PHASE");
  expect(admitted).toBe(1);
});

test("wrong permits perform no scoring and rejection creates no retry or rescue admission", async () => {
  const env = setup(), worker = new PolicyWorker(env.context, env.scorer);
  await expect(worker.plan(JSON.stringify({ ...env.context.permit, permitId: "other" }))).rejects.toThrow("PERMIT");
  expect(env.calls()).toBe(0);
  await expect(worker.plan(JSON.stringify(env.context.permit))).rejects.toThrow("WORKER_PHASE");
  const next = setup("argmax"), producer = new PolicyWorker(next.context, next.scorer), owner = new PolicySession(next.context, next.scorer);
  const accepted = await owner.acknowledge({ json: await producer.plan(JSON.stringify(next.context.permit)), receivedNs: 0n });
  producer.acceptAck(accepted.digest);
  let admitted = 0;
  await expect(owner.admit(() => { admitted++; throw new Error("synthetic native denial"); })).rejects.toThrow("synthetic native denial");
  await expect(owner.admit(() => { admitted++; })).rejects.toThrow("ADMISSION_PHASE");
  expect(admitted).toBe(1);
});

for (const field of ["modelId", "historyDigest", "orderedCandidateDigest", "selectedIndex", "selectedKey", "uniform", "selectedLogProbability", "actions", "samplingAfter"] as const) {
  test(`owner reconstruction rejects substituted ${field} before admission`, async () => {
    const env = setup(), worker = new PolicyWorker(env.context, env.scorer), owner = new PolicySession(env.context, env.scorer);
    const journal: DecisionJournal = JSON.parse(await worker.plan(JSON.stringify(env.context.permit)));
    const replacement = field.endsWith("Digest") || field === "modelId" ? "b".repeat(64)
      : field === "selectedIndex" ? (journal.selectedIndex + 1) % 512 : field === "selectedKey" ? "not-a-member"
        : field === "uniform" ? ((journal.uniform ?? 0) + 0.5) % 1 : field === "selectedLogProbability" ? -1
          : field === "actions" ? [{ kind: "classical", timing: "C", color: "w", from: "a1", to: "a8" }]
            : { ...journal.samplingAfter, drawCount: journal.samplingAfter.drawCount + 1 };
    Reflect.set(journal, field, replacement);
    await expect(owner.acknowledge({ json: JSON.stringify(journal), receivedNs: 0n })).rejects.toThrow();
    await expect(owner.admit(() => { throw new Error("must not execute"); })).rejects.toThrow("ADMISSION_PHASE");
    expect(worker.sampling()).toEqual(env.context.sampling);
  });
}

test("native model substitution, nonfinite output and late decisions cannot become accepted samples", async () => {
  for (const kind of ["model", "nonfinite", "late"] as const) {
    const env = setup();
    env.alter(reply => {
      if (kind === "model") reply.modelId = "b".repeat(64);
      else if (kind === "nonfinite") reply.logits = [null];
      else env.setTime(10_000_000_000n);
    });
    const worker = new PolicyWorker(env.context, env.scorer);
    await expect(worker.plan(JSON.stringify(env.context.permit))).rejects.toThrow();
    expect(worker.sampling()).toEqual(env.context.sampling);
  }
});

test("timely receipt permits bounded owner verification without renewing the candidate deadline", async () => {
  const env = setup(), worker = new PolicyWorker(env.context, env.scorer), owner = new PolicySession(env.context, env.scorer);
  const json = await worker.plan(JSON.stringify(env.context.permit));
  env.setTime(2n);
  env.alter(() => env.setTime(12_000_000_000n));
  const accepted = await owner.acknowledge({ json, receivedNs: 1n });
  worker.acceptAck(accepted.digest);
  expect(env.context.permit.deadlineNs).toBe("10000000000");
  expect(worker.sampling().drawCount).toBe(1);
  const late = setup(), lateWorker = new PolicyWorker(late.context, late.scorer), lateOwner = new PolicySession(late.context, late.scorer);
  const lateJson = await lateWorker.plan(JSON.stringify(late.context.permit));
  late.setTime(10_000_000_000n);
  await expect(lateOwner.acknowledge({ json: lateJson, receivedNs: 10_000_000_000n })).rejects.toThrow("DECISION_RECEIPT");
});

test("stable direct log probabilities permit underflow but never rounded-log or invalid fallback", () => {
  expect(distribution([1000, -1000])).toEqual({ probabilities: [1, 0], logProbabilities: [0, -2000] });
  expect(selectedIndex([0, 0], ["z", "a"], "argmax", null)).toBe(1);
  expect(selectedIndex([0], ["[]"], "sample", 0.999)).toBe(0);
  expect(() => selectedIndex([0], ["[]"], "sample", 1)).toThrow("UNIFORM");
  expect(() => distribution([Infinity])).toThrow("NONFINITE");
  expect(() => distribution([Number.MAX_VALUE, -Number.MAX_VALUE])).toThrow("DISTRIBUTION");
});
