// SPEC: _spec/match-runtime.puml, _spec/checkpoint-runtime.puml
import { expect, test } from "bun:test";
import { initializeGame, openGame, settleGame } from "../../contracts/src/game-session";
import { matchJsonSchema, decodeMatchReply } from "../../contracts/src/match";
import { naturalMatchStop } from "../src/match-state";
import { matchFixture } from "./match-fixture";

test("whole child owns a bounded synthetic corpus match and owner proves exhaustion after exact ACK/admission", async () => {
  const env = matchFixture();
  expect(env.scorer.scores).toBe(0);
  const result = await env.session.run();
  expect(result.reason).toBe("trace-exhaustion");
  expect(result.returnValue).toBe(-1);
  expect(result.sampledDecisions).toBe(1);
  expect(result.rngAfter["policy-sampling"].drawCount).toBe(1);
  expect(result.rngAfter.opponent.drawCount).toBe(0);
  expect(env.scorer.scores).toBe(1); expect(env.verifier.scores).toBe(1);
  expect(env.learners.samples).toBe(1); expect(env.learners.closed).toBe(1);
  expect(env.scorer.closed).toBe(1); expect(env.transport.finished).toBe(1);
  expect(env.transport.replies.map(reply => reply.kind)).toEqual(["ready", "opened", "candidate", "settled", "opened", "complete", "closed"]);
  expect(env.transport.requests.filter(request => request.operation === "accept" && request.nextPermit !== null)).toHaveLength(1);
  expect(result.auditJson).not.toContain('"features"');
  expect(result.historyJson).not.toContain("corpusIndex");
  await expect(env.session.run()).rejects.toThrow("NO_RETRY");
}, 20_000);

test("truthful zero-window source exhaustion is diagnostic with no model work or invented draws", async () => {
  const env = matchFixture({ windows: 0 });
  const result = await env.session.run();
  expect(result.reason).toBe("trace-exhaustion");
  expect(result.sampledDecisions).toBe(0);
  expect(result.proposal).toEqual({ kind: "diagnostic" });
  expect(env.scorer.scores).toBe(0); expect(env.verifier.scores).toBe(0);
  expect(result.rngAfter).toEqual(env.rng);
});

test("actual recorded-White native rejection retains the ACKed candidate without substitute play", async () => {
  const env = matchFixture({ rejectWhite: true });
  const result = await env.session.run();
  expect(result.reason).toBe("recorded-white-rejection");
  expect(result.sampledDecisions).toBe(1);
  expect(env.transport.replies.map(reply => reply.kind)).toEqual(["ready", "opened", "candidate", "rejected", "complete", "closed"]);
  expect(result.auditJson).toContain('"code":"SC_BASELINE_FEN"');
  expect(result.auditJson).toContain('"from":"a1"');
}, 20_000);

for (const kind of ["initial", "native", "candidate", "completion", "rng", "replay"] as const) {
  test(`whole-match ${kind} tampering aborts without a proposal or completion`, async () => {
    const env = matchFixture({ windows: kind === "candidate" || kind === "rng" ? 1 : 0 });
    env.transport.alter = reply => {
      if (kind === "initial" && reply.kind === "ready") reply.state.boundary.bank.w++;
      if (kind === "native" && reply.kind === "opened") reply.state.provenanceDigest = "0".repeat(64);
      if (kind === "candidate" && reply.kind === "candidate") reply.journal.selectedLogProbability = -1;
      if (kind === "completion" && reply.kind === "complete") reply.stop = { reason: "core-terminal", returnValue: 1 };
      if (kind === "rng" && reply.kind === "complete") reply.rng.opponent = { ...reply.rng["policy-sampling"] };
      if (kind === "replay" && reply.kind === "opened") reply.ordinal--;
    };
    await expect(env.session.run()).rejects.toThrow();
    expect(env.learners.proposed).toBe(0);
    expect(env.learners.aborted).toBe(1);
    expect(env.transport.stopped).toBe(1);
  }, 20_000);
}

test("learner accumulation or natural-close failure cannot publish an eligible result", async () => {
  for (const kind of ["gradient", "match-close", "learner-close"] as const) {
    const env = matchFixture({ windows: kind === "gradient" ? 1 : 0 });
    if (kind === "gradient") env.learners.failAccumulate = true;
    if (kind === "match-close") env.transport.receipt.reaped = false;
    if (kind === "learner-close") env.learners.failClose = true;
    await expect(env.session.run()).rejects.toThrow();
    expect(env.learners.aborted).toBe(1);
    if (kind !== "learner-close") expect(env.learners.proposed).toBe(0);
  }
}, 20_000);

test("terminal and progress classifications derive from actual state/counters rather than a child label", () => {
  const env = matchFixture();
  let game = initializeGame();
  expect(naturalMatchStop(game, env.descriptor, 0, 0, env.corpus)).toBeNull();
  expect(naturalMatchStop(game, env.descriptor, 64, 0, env.corpus)).toEqual({ reason: "progress-cap", returnValue: -1 });
  expect(naturalMatchStop(game, env.descriptor, 0, 128, env.corpus)).toEqual({ reason: "progress-cap", returnValue: -1 });
  for (let i = 0; i < 45; i++) game = settleGame(openGame(game).session, { w: [], b: [] }).session;
  expect(game.phase).toBe("terminal");
  expect(naturalMatchStop(game, env.descriptor, 45, 45, env.corpus)).toEqual({ reason: "core-terminal", returnValue: 0 });
});

test("match wire is closed, bounded and excludes worker-selected readiness/paths", () => {
  expect(matchJsonSchema.$schema).toContain("2020-12");
  expect(() => decodeMatchReply(JSON.stringify({ version: "chess-coach.match.v1", attemptId: "synthetic", ordinal: 0, kind: "closed", trainingReady: true }))).toThrow();
  expect(() => decodeMatchReply(" ".repeat(16 * 1024 * 1024 + 1))).toThrow("byte limit");
});

test("White-then-Black permits retain only ACKed choices after owned candidate cutoff", async () => {
  const env = matchFixture({ liveSide: "w" });
  env.transport.alter = (reply, request) => {
    if (reply.kind === "candidate" && reply.journal.planningOrdinal === 1 && request.operation === "accept" && request.nextPermit) env.setTime(BigInt(request.nextPermit.deadlineNs));
  };
  const result = await env.session.run();
  expect(result.reason).toBe("candidate-deadline");
  expect(result.sampledDecisions).toBe(1);
  expect(result.rngAfter["policy-sampling"].drawCount).toBe(1);
  expect(result.rngAfter.opponent.drawCount).toBe(1);
  expect(env.transport.cutoffs).toBe(1);
  expect(env.learners.samples).toBe(1);
  expect(env.learners.closed).toBe(1);
  const permits = env.transport.requests.flatMap(request => request.operation === "accept" && request.nextPermit ? [request.nextPermit] : []);
  expect(permits.map(permit => `${permit.planningOrdinal}:${permit.side}:${permit.role}`)).toEqual(["0:w:candidate", "0:b:strategic", "1:w:candidate"]);
}, 30_000);

test("checked strategic White before a zero-choice candidate cutoff keeps its exact known stream", async () => {
  const env = matchFixture({ liveSide: "b" });
  env.transport.alter = (reply, request) => {
    if (reply.kind === "candidate" && request.operation === "accept" && request.nextPermit) env.setTime(BigInt(request.nextPermit.deadlineNs));
  };
  const result = await env.session.run();
  expect(result.reason).toBe("candidate-deadline");
  expect(result.sampledDecisions).toBe(0);
  expect(result.proposal).toEqual({ kind: "diagnostic" });
  expect(result.rngAfter["policy-sampling"].drawCount).toBe(0);
  expect(result.rngAfter.opponent.drawCount).toBe(1);
}, 20_000);

for (const kind of ["opponent", "startup", "group", "fault", "late-binding"] as const) {
  test(`deadline ${kind} cannot be relabeled as an eligible candidate stop`, async () => {
    const env = matchFixture(kind === "opponent" ? { liveSide: "b" } : { windows: 1 });
    env.transport.alter = (reply, request) => {
      if (kind === "startup" && reply.kind === "ready") env.setTime(10_000_000_000n);
      else if ((reply.kind === "candidate" || kind === "opponent" && reply.kind === "strategic") && request.operation === "accept" && request.nextPermit) {
        env.setTime(BigInt(request.nextPermit.deadlineNs));
        if (kind === "late-binding") reply.attemptId = "other";
      }
    };
    if (kind === "group") env.transport.cutoffReceipt.groupGone = false;
    if (kind === "fault") env.transport.cutoffReceipt.fault = true;
    await expect(env.session.run()).rejects.toThrow();
    expect(env.learners.proposed).toBe(0);
    expect(env.learners.aborted).toBe(1);
  }, 20_000);
}
