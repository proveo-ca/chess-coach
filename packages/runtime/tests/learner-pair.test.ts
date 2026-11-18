// SPEC: _spec/learning-runtime.puml, _spec/checkpoint-runtime.puml
import { createHash } from "node:crypto";
import { expect, test } from "bun:test";
import { NativeLearner } from "../src/native-learner";
import { LearnerPair } from "../src/learner-pair";
import type { AckedDecision } from "../src/policy-session";
import type { LearningReply, LearningRequest } from "../../contracts/src/learning-channel";
import type { OwnedTransport } from "../src/native-session";
import { deriveStream, drawStream } from "../src/rng";
import { cleanExit } from "./fixture";

class SyntheticLearnerPort implements OwnedTransport {
  samples = 0;
  terminated = 0;
  finishReceipt = cleanExit();
  alter: ((result: LearningReply["result"]) => void) | null = null;
  delay: Promise<void> | null = null;
  async exchange(json: string) {
    if (this.delay) await this.delay;
    const request: LearningRequest = JSON.parse(json);
    let result: LearningReply["result"];
    switch (request.command.kind) {
      case "begin": result = { kind: "begun" }; break;
      case "score": result = { kind: "scored", response: { version: "chess-coach.inference.v1", featureVersion: "chess-coach.features.v1", modelId: request.modelId, requestId: request.command.request.requestId, logits: Array(request.command.request.rows).fill(0) } }; break;
      case "acknowledge": result = { kind: "acknowledged", journalDigest: request.command.journalDigest, sampledDecisions: ++this.samples }; break;
      case "finish": {
        const record = Array.from(Buffer.from("synthetic-record-not-a-burn-model")), recordSha256 = createHash("sha256").update(Uint8Array.from(record)).digest("hex");
        result = this.samples ? { kind: "proposed", record, config: { version: "chess-coach.model-config.v1", architecture: "mlp-relu-32", featureVersion: "chess-coach.features.v1", inputFeatures: 2271, hiddenUnits: 32, recordSha256 },
          parameterSha256: "b".repeat(64), sampledDecisions: this.samples, objective: 0.1, nonzeroPolicyGradient: true } : { kind: "diagnostic" };
        break;
      }
      case "close": result = { kind: "closed" }; break;
    }
    this.alter?.(result);
    return { json: JSON.stringify({ version: request.version, sessionId: request.sessionId, ordinal: request.ordinal, modelId: request.modelId, result }), receivedNs: 0n };
  }
  async finish() { return this.finishReceipt; }
  async terminate() { this.terminated++; }
}
function setup() {
  const first = new SyntheticLearnerPort(), second = new SyntheticLearnerPort();
  const a = new NativeLearner("first", "a".repeat(64), first, () => 0n, 10_000_000_000n, 13_000_000_000n);
  const b = new NativeLearner("second", "a".repeat(64), second, () => 0n, 10_000_000_000n, 13_000_000_000n);
  return { first, second, a, b, pair: new LearnerPair(a, b) };
}
function syntheticAck(): AckedDecision {
  const before = deriveStream(101, "policy-sampling"), draw = drawStream(before);
  const journal: AckedDecision["journal"] = { version: "chess-coach.decision.v1", attemptId: "synthetic", permitId: "synthetic:plan:0:w", planningOrdinal: 0,
    side: "w", modelId: "a".repeat(64), historyDigest: "c".repeat(64), featureVersion: "chess-coach.features.v1", enumerationVersion: "chess-coach.enumeration.v1",
    orderedCandidateDigest: "d".repeat(64), mode: "sample", selectedIndex: 0, selectedKey: "[]", actions: [], requestedSpend: { minerals: 0, gas: 0 },
    uniform: draw.uniform, selectedLogProbability: -Math.log(2), samplingBefore: before, samplingAfter: draw.after };
  return { journal, digest: createHash("sha256").update(JSON.stringify(journal)).digest("hex"), features: { featureVersion: "chess-coach.features.v1", rows: 2, values: new Float64Array(2 * 2271) } };
}

test("synthetic owned learner pair compares uncommitted proposals and closes both naturally", async () => {
  const env = setup();
  await env.pair.begin(0); await env.pair.accumulate(syntheticAck());
  const result = await env.pair.propose(1);
  expect(result.kind).toBe("proposed");
  expect(env.first.samples).toBe(1); expect(env.second.samples).toBe(1);
  await env.pair.close();
  expect(env.first.terminated).toBe(0); expect(env.second.terminated).toBe(0);
});

for (const field of ["parameterSha256", "objective", "sampledDecisions", "nonzeroPolicyGradient"] as const) {
  test(`learner pair rejects mismatched ${field} without selecting another result`, async () => {
    const env = setup();
    env.second.alter = result => { if (result.kind === "proposed") Reflect.set(result, field, field === "parameterSha256" ? "c".repeat(64) : field === "objective" ? 0.2 : field === "sampledDecisions" ? 2 : false); };
    await env.pair.begin(0); await env.pair.accumulate(syntheticAck());
    await expect(env.pair.propose(1)).rejects.toThrow();
    expect(env.first.terminated).toBe(1); expect(env.second.terminated).toBe(1);
    await expect(env.pair.begin(0)).rejects.toThrow("PHASE");
  });
}

test("pair rejects shared transports and incomplete close receipts", async () => {
  const env = setup();
  expect(() => new LearnerPair(env.a, env.a)).toThrow("OWNED_CHANNELS");
  const alias = new NativeLearner("alias", "a".repeat(64), env.first, () => 0n, 10n, 20n);
  expect(() => new LearnerPair(env.a, alias)).toThrow("OWNED_CHANNELS");
  await env.pair.begin(0); expect(await env.pair.propose(0)).toEqual({ kind: "diagnostic" });
  env.second.finishReceipt.reaped = false;
  await expect(env.pair.close()).rejects.toThrow("CLEAN_CLOSE");
  expect(env.first.terminated).toBe(1);
});

test("concurrent revocation cannot resurrect a pair after pending begin completes", async () => {
  const env = setup();
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  env.first.delay = wait; env.second.delay = wait;
  const first = env.pair.begin(0);
  await expect(env.pair.begin(0)).rejects.toThrow("PHASE");
  release();
  await expect(first).rejects.toThrow();
  expect(env.first.terminated).toBe(1); expect(env.second.terminated).toBe(1);
});
