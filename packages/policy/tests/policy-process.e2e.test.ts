// SPEC: _spec/policy-io.puml
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";
import { decodeScoreResponse, encodeScoreRequest } from "@chess-coach/contracts";
import type { ScoreRequest } from "@chess-coach/contracts";
import { FEATURES, encodeFeatures, enumerateCandidates } from "../src";
import { fixture } from "../../contracts/tests/fixture";

test("TypeScript JSON crosses the native Burn process boundary", () => {
  const scorer = fileURLToPath(new URL("../../../target/debug/policy-score", import.meta.url));
  const generator = fileURLToPath(new URL("../../../target/debug/examples/initial-record", import.meta.url));
  const native = Bun.spawnSync([generator], { stdout: "pipe", stderr: "pipe", timeout: 10_000 });
  expect(native.exitCode).toBe(0);
  const root = mkdtempSync(join(tmpdir(), "chess-coach-policy-e2e-"));
  const path = join(root, "synthetic.bpk");
  const configPath = join(root, "config.json");
  writeFileSync(path, native.stdout, { mode: 0o600 });
  try {
    const observationJson = JSON.stringify(fixture());
    const generated = enumerateCandidates(observationJson);
    expect(generated.candidates.length).toBeGreaterThan(1);
    const features = encodeFeatures(observationJson, generated.candidates.slice(0, 8).map(candidate => JSON.stringify(candidate)));
    const input: ScoreRequest = {
      version: "chess-coach.inference.v1", requestId: "typescript-e2e",
      featureVersion: features.featureVersion,
      modelId: createHash("sha256").update(native.stdout).digest("hex"),
      rows: features.rows, values: Array.from(features.values),
    };
    writeFileSync(configPath, JSON.stringify({
      version: "chess-coach.model-config.v1", architecture: "mlp-relu-32", featureVersion: input.featureVersion,
      inputFeatures: FEATURES, hiddenUnits: 32, recordSha256: input.modelId,
    }), { mode: 0o600 });
    const output = Bun.spawnSync([scorer, configPath, path], {
      stdin: new TextEncoder().encode(encodeScoreRequest(input)), stdout: "pipe", stderr: "pipe", timeout: 10_000,
    });
    expect(output.exitCode).toBe(0);
    expect(decodeScoreResponse(new TextDecoder().decode(output.stdout), input).logits).toEqual(Array(input.rows).fill(0));
    const wrong = Bun.spawnSync([scorer, configPath, path], {
      stdin: new TextEncoder().encode(encodeScoreRequest({ ...input, modelId: "0".repeat(64) })),
      stdout: "pipe", stderr: "pipe", timeout: 10_000,
    });
    expect(wrong.exitCode).not.toBe(0);
    expect(wrong.stdout.byteLength).toBe(0);
  } finally {
    if (existsSync(configPath)) unlinkSync(configPath);
    if (existsSync(path)) unlinkSync(path);
    rmdirSync(root);
  }
});
