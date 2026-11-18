// SPEC: _spec/runtime-protocol.puml
import { afterAll, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { initializeGame, openGame, settleGame } from "../../../../packages/contracts/src/game-session";
import { causalBoard } from "../../../../packages/contracts/tests/causal-fixture";
import { recipientRun } from "../../../../packages/contracts/tests/recipient-fixture";
import { matchFixture } from "../../../../packages/runtime/tests/match-fixture";
import { MatchWorker } from "../../../../packages/runtime/src/match-worker";

const results: { name: string; result: unknown }[] = [];
afterAll(async () => {
  const directory = process.env.CANONICAL_R4_LOCAL_EVIDENCE;
  if (directory === undefined) return;
  if (!/^\/home\/gu1lty\/Projects\/proveo\/chess-coach\/_work\/gpu-owner-recovery\/runs\/host-canonical-r4-source-1\/verification-[1-9][0-9]?\/e2e$/.test(directory)) throw new Error("LOCAL_EVIDENCE_CONTEXT");
  await writeFile(`${directory}/r4-selected-pure.json`, JSON.stringify({ scope: "SELECTED_PURE_CONTRACT_CASES_ONLY", execution: "MOCK",
    scoring: "SYNTHETIC_LOGITS", model: "SYNTHETIC_NON_BURN_MODEL", nativeExecuted: false, referenceExecuted: false,
    trainingExecuted: false, trainingReady: false, r4Qualified: false, cases: results },
  (_key, value: unknown) => typeof value === "bigint" ? String(value) : value, 2) + "\n", { flag: "wx", mode: 0o600 });
});

test("NONNATIVE selected economics debits deployment once and credits only settlement income", () => {
  const initial = initializeGame(), opened = openGame(initial).session, before = structuredClone(opened);
  const settled = settleGame(opened, { w: [{ kind: "deploy", timing: "B", color: "w", from: "e1", to: "f1", unit: "n" }], b: [] }).session;
  expect(initial.bank).toEqual({ w: 3, b: 3 });
  expect(opened.bank).toEqual({ w: 3, b: 3 });
  expect(opened).toEqual(before);
  expect(settled.bank).toEqual({ w: 1, b: 4 });
  expect(settled.batches.w.observation.economy).toMatchObject({ ownPaidDebits: 3, ownPaidSurviving: 3, ownPaidDestroyed: 0, ownPaidWasted: 0 });
  expect(settled.batches.b.observation.economy.ownPaidDebits).toBe(0);
  const reopened = openGame(settled).session;
  expect(reopened.bank).toEqual(settled.bank);
  expect(settleGame(reopened, { w: [], b: [] }).session.bank).toEqual({ w: 2, b: 5 });
  results.push({ name: "paid-debit-and-income", result: { bank: settled.bank, economy: settled.batches.w.observation.economy } });
});

test("NONNATIVE selected unaffordable action withholds both-seat settlement without mutating its parent", () => {
  const parent = openGame(initializeGame()).session, before = structuredClone(parent);
  expect(() => settleGame(parent, { w: [{ kind: "deploy", timing: "B", color: "w", from: "e1", to: "f1", unit: "q" }], b: [] })).toThrow("MINERALS");
  expect(parent).toEqual(before);
  expect(parent.history).toHaveLength(1);
  results.push({ name: "unaffordable-settlement-withheld", result: { unchanged: true, historyLength: parent.history.length } });
});

test("NONNATIVE selected hidden opponent move twins preserve identical recipient bytes", () => {
  const opening = causalBoard([["a1", "b", "w"], ["h1", "k", "w"], ["a8", "k", "b"], ["g7", "p", "b"], ["f5", "n", "b"]]);
  const move = (to: "d4" | "d6") => recipientRun(opening, [{ kind: "classical", timing: "C", color: "w", from: "a1", to: "h8" }],
    [{ kind: "classical", timing: "C", color: "b", from: "f5", to }]);
  const left = move("d4"), right = move("d6"), json = JSON.stringify(left.settled.w.batch);
  expect(left.native.ended.result.next.placement).not.toBe(right.native.ended.result.next.placement);
  expect(json).toBe(JSON.stringify(right.settled.w.batch));
  expect(left.settled.w.batch.observation.everLit).not.toContain("d4");
  expect(left.settled.w.batch.observation.everLit).not.toContain("d6");
  for (const key of ["engine:", "discoveryOrdinal", "evaluationActorId", "returnedStep"]) expect(json).not.toContain(key);
  results.push({ name: "hidden-opponent-twins", result: { sameRecipientBytes: true, distinctFullPlacements: true } });
});

test("NONNATIVE MOCK selected match retains exact attempt/model binding and diagnostic zero-window completion", async () => {
  const env = matchFixture({ windows: 0 });
  const result = await env.session.run();
  expect(result.descriptor).toEqual(env.descriptor);
  expect(result.descriptor.attemptId).toBe("synthetic-match");
  expect(result.descriptor.modelId).toBe("a".repeat(64));
  expect(result.descriptor.master).toBe(101);
  expect(result.descriptor.startedOrdinal).toBe(0);
  expect(result.proposal).toEqual({ kind: "diagnostic" });
  expect(result.sampledDecisions).toBe(0);
  expect(result.rngAfter).toEqual(env.rng);
  expect(env.scorer.scores + env.verifier.scores).toBe(0);
  expect(env.transport.finished).toBe(1);
  expect(env.transport.requests[0]).toMatchObject({ operation: "start", attemptId: env.descriptor.attemptId, descriptor: env.descriptor });
  results.push({ name: "bound-zero-window-diagnostic", result: { descriptor: result.descriptor, reason: result.reason, proposal: result.proposal } });
});

for (const kind of ["attempt", "completion", "ordinal"] as const) {
  test(`NONNATIVE MOCK selected ${kind} mismatch withholds an eligible completion`, async () => {
    const env = matchFixture({ windows: 0 });
    env.transport.alter = reply => {
      if (kind === "attempt") reply.attemptId = "other-attempt";
      if (kind === "ordinal") reply.ordinal++;
      if (kind === "completion" && reply.kind === "complete") reply.stop = { reason: "core-terminal", returnValue: 1 };
    };
    await expect(env.session.run()).rejects.toThrow(kind === "completion" ? "COMPLETION_MISMATCH" : "BINDING");
    expect(env.learners.proposed).toBe(0);
    expect(env.learners.aborted).toBe(1);
    expect(env.transport.finished).toBe(0);
    expect(env.transport.stopped).toBe(1);
    results.push({ name: `${kind}-mismatch-withheld`, result: { proposed: env.learners.proposed, aborted: env.learners.aborted, stopped: env.transport.stopped } });
  });
}

test("NONNATIVE MOCK selected worker rejects a descriptor for a different frozen model", async () => {
  const env = matchFixture({ windows: 0 });
  const worker = new MatchWorker(env.descriptor.attemptId, { corpus: env.corpus, strategic: null, scorer: env.scorer,
    modelId: "b".repeat(64), clockNs: () => 0n, workDeadlineNs: 297_000_000_000n });
  await expect(worker.handle(JSON.stringify({ version: "chess-coach.match.v1", operation: "start", attemptId: env.descriptor.attemptId,
    ordinal: 0, descriptor: env.descriptor, rng: env.rng }))).rejects.toThrow();
  expect(env.scorer.scores).toBe(0);
  results.push({ name: "wrong-frozen-model-withheld", result: { scores: env.scorer.scores } });
});
