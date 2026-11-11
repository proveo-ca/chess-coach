// SPEC: _spec/learning-runtime.puml, _spec/policy-runtime.puml
import { mkdtempSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { expect, test } from "bun:test";
import { canonicalInitialObservation } from "../../contracts/src/initialization";
import { decodeScoreResponse, encodeScoreRequest } from "../../contracts/src/inference";
import { NativeLearner } from "../src/native-learner";
import { ProcessTransport } from "../src/process-transport";
import { PolicySession, PolicyWorker } from "../src/policy-session";
import type { PolicyContext } from "../src/policy-session";
import { deriveStream } from "../src/rng";

function setup() {
  const root = mkdtempSync("/tmp/opencode/chess-coach-ii-native-channel-"), base = fileURLToPath(new URL("../../../target/debug/", import.meta.url));
  const native = Bun.spawnSync([`${base}examples/initial-record`], { env: { RAYON_NUM_THREADS: "2" }, stdout: "pipe", stderr: "pipe", timeout: 10_000 });
  if (native.exitCode !== 0) throw new Error(new TextDecoder().decode(native.stderr));
  const modelId = createHash("sha256").update(native.stdout).digest("hex"), config = { version: "chess-coach.model-config.v1", architecture: "mlp-relu-32",
    featureVersion: "chess-coach.features.v1", inputFeatures: 2271, hiddenUnits: 32, recordSha256: modelId };
  writeFileSync(`${root}/frozen.bpk`, native.stdout, { mode: 0o600, flag: "wx" });
  writeFileSync(`${root}/config.json`, JSON.stringify(config), { mode: 0o600, flag: "wx" });
  const start = process.hrtime.bigint(), clock = process.hrtime.bigint;
  const port = new ProcessTransport({ runtime: "native", executable: `${base}policy-channel`, arguments: [`${root}/config.json`, `${root}/frozen.bpk`, "synthetic"], cwd: root },
    { frameBytes: 8 * 1024 * 1024, stdoutBytes: 16 * 1024 * 1024, stderrBytes: 65536 }, clock);
  const learner = new NativeLearner("synthetic", modelId, port, clock, start + 25_000_000_000n, start + 28_000_000_000n);
  return { root, base, learner, port, start, clock, modelId };
}

test("synthetic policy ACK crosses the fixed Burn process, accumulates once and reloads the uncommitted proposal", async () => {
  const env = setup();
  try {
    await env.learner.begin(0);
    const observation = structuredClone(canonicalInitialObservation("w"));
    Reflect.set(observation.own, "minerals", 0); Reflect.set(observation.own, "gas", 0);
    const now = env.clock();
    const context: PolicyContext = { modelId: env.modelId, mode: "sample", observationJson: JSON.stringify(observation), sampling: deriveStream(101, "policy-sampling"),
      clockNs: env.clock, workDeadlineNs: env.start + 25_000_000_000n, permit: { version: "chess-coach.plan-permit.v1", attemptId: "synthetic", permitId: "synthetic:plan:0:w",
        planningOrdinal: 0, turn: 0, side: "w", role: "candidate", issuedNs: String(now), deadlineNs: String(now + 10_000_000_000n) } };
    const worker = new PolicyWorker(context, env.learner), owner = new PolicySession(context, env.learner);
    const json = await worker.plan(JSON.stringify(context.permit)), receivedNs = env.clock();
    const accepted = await owner.acknowledge({ json, receivedNs });
    worker.acceptAck(accepted.digest);
    await env.learner.accumulate(accepted);
    const proposal = await env.learner.propose(1);
    expect(proposal.kind).toBe("proposed");
    if (proposal.kind !== "proposed") throw new Error("fixture");
    expect(proposal.sampledDecisions).toBe(1);
    expect(proposal.nonzeroPolicyGradient).toBe(true);
    writeFileSync(`${env.root}/proposed.bpk`, Uint8Array.from(proposal.record), { mode: 0o600, flag: "wx" });
    writeFileSync(`${env.root}/proposed.json`, JSON.stringify(proposal.config), { mode: 0o600, flag: "wx" });
    await env.learner.close();
    const request = { version: "chess-coach.inference.v1" as const, featureVersion: accepted.features.featureVersion, requestId: "reload",
      modelId: proposal.config.recordSha256, rows: accepted.features.rows, values: Array.from(accepted.features.values) };
    const scored = Bun.spawnSync([`${env.base}policy-score`, `${env.root}/proposed.json`, `${env.root}/proposed.bpk`], {
      env: { RAYON_NUM_THREADS: "2" }, stdin: Buffer.from(encodeScoreRequest(request)), stdout: "pipe", stderr: "pipe", timeout: 10_000 });
    expect(scored.exitCode).toBe(0);
    expect(decodeScoreResponse(new TextDecoder().decode(scored.stdout), request).logits.some(value => value !== 0)).toBe(true);
    writeFileSync(`${env.root}/result.json`, JSON.stringify({ scope: "BOUNDED_SYNTHETIC_CHANNEL_ONLY", status: "PASS", eligibleEpisode: false, checkpointCommitted: false }), { flag: "wx" });
  } finally { await env.port.terminate(new Error("synthetic fixture cleanup")); }
}, 30_000);

test("empty synthetic completion emits no record and native identity failure cannot be retried", async () => {
  const env = setup();
  try {
    await env.learner.begin(0.5);
    expect(await env.learner.propose(-1)).toEqual({ kind: "diagnostic" });
    await env.learner.close();
  } finally { await env.port.terminate(new Error("synthetic fixture cleanup")); }
  const wrong = setup();
  try {
    await wrong.learner.begin(0);
    const request = { version: "chess-coach.inference.v1" as const, featureVersion: "chess-coach.features.v1", requestId: "wrong", modelId: "0".repeat(64), rows: 1, values: Array(2271).fill(0) };
    await expect(wrong.learner.score(encodeScoreRequest(request))).rejects.toThrow();
    await expect(wrong.learner.propose(1)).rejects.toThrow("FINISH_PHASE");
  } finally { await wrong.port.terminate(new Error("synthetic fixture cleanup")); }
}, 30_000);
