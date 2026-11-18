// SPEC: _spec/recipient-production.puml, _spec/representation.puml, _spec/policy-io.puml
import { createHash } from "node:crypto";
import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";
import { decodeScoreResponse, encodeScoreRequest } from "@chess-coach/contracts";
import type { ScoreRequest } from "@chess-coach/contracts";
import { openGame, seedGame, settleGame } from "@chess-coach/contracts/game-session";
import { FEATURES, encodeFeatures, enumerateCandidates } from "../src";
import { causalBoard } from "../../contracts/tests/causal-fixture";

test("actual hidden-state twins preserve continuing planning, features and native frozen Burn scores", () => {
  const snapshot = causalBoard([["a1", "b", "w"], ["h1", "k", "w"], ["a8", "k", "b"], ["g7", "p", "b"], ["f5", "n", "b"]]);
  const initial = openGame(seedGame(snapshot, { w: 12, b: 12 })).session;
  const twins = (["d4", "d6"] as const).map(to => {
    const ended = settleGame(initial, { w: [{ kind: "classical", timing: "C", color: "w", from: "a1", to: "h8" }],
      b: [{ kind: "classical", timing: "C", color: "b", from: "f5", to }] }).session;
    return openGame(ended).session;
  });
  expect(twins[0]!.snapshot.placement).not.toBe(twins[1]!.snapshot.placement);
  const observations = twins.map(twin => JSON.stringify(twin.batches.w.observation));
  expect(observations[0]).toBe(observations[1]);
  const candidates = observations.map(observation => enumerateCandidates(observation));
  expect(candidates[0]).toEqual(candidates[1]);
  const features = observations.map((observation, index) => encodeFeatures(observation,
    candidates[index]!.candidates.slice(0, 8).map(candidate => JSON.stringify(candidate))));
  expect(features[0]!.values).toEqual(features[1]!.values);
  const scorer = fileURLToPath(new URL("../../../target/debug/policy-score", import.meta.url));
  const generator = fileURLToPath(new URL("../../../target/debug/examples/initial-record", import.meta.url));
  const record = Bun.spawnSync([generator], { stdout: "pipe", stderr: "pipe", timeout: 10_000, env: { ...process.env, RAYON_NUM_THREADS: "2" } });
  expect(record.exitCode).toBe(0);
  const root = mkdtempSync("/tmp/opencode/chess-coach-ii-recipient-policy-"), model = `${root}/fixture.bpk`, config = `${root}/config.json`;
  const modelId = createHash("sha256").update(record.stdout).digest("hex");
  writeFileSync(model, record.stdout, { mode: 0o600 });
  writeFileSync(config, JSON.stringify({ version: "chess-coach.model-config.v1", architecture: "mlp-relu-32",
    featureVersion: features[0]!.featureVersion, inputFeatures: FEATURES, hiddenUnits: 32, recordSha256: modelId }), { mode: 0o600 });
  try {
    const scores = features.map(feature => {
      const input: ScoreRequest = { version: "chess-coach.inference.v1", requestId: "recipient-twin", modelId,
        featureVersion: feature.featureVersion, rows: feature.rows, values: Array.from(feature.values) };
      const output = Bun.spawnSync([scorer, config, model], { stdin: new TextEncoder().encode(encodeScoreRequest(input)), stdout: "pipe", stderr: "pipe",
        timeout: 10_000, env: { ...process.env, RAYON_NUM_THREADS: "2" } });
      expect(output.exitCode).toBe(0);
      return decodeScoreResponse(new TextDecoder().decode(output.stdout), input);
    });
    expect(scores[0]).toEqual(scores[1]);
  } finally {
    unlinkSync(config);
    unlinkSync(model);
    rmdirSync(root);
  }
}, 30_000);
