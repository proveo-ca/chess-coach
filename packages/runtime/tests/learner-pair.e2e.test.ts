// SPEC: _spec/learning-runtime.puml, _spec/checkpoint-runtime.puml
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";
import { canonicalInitialObservation } from "../../contracts/src/initialization";
import { LearnerPair } from "../src/learner-pair";
import { NativeLearner } from "../src/native-learner";
import { ProcessTransport } from "../src/process-transport";
import { PolicySession, PolicyWorker } from "../src/policy-session";
import type { PolicyContext } from "../src/policy-session";
import { deriveStream } from "../src/rng";

test("two actual fixed Burn children compare the full F64 synthetic proposal and reload digest", async () => {
  const root = mkdtempSync("/tmp/opencode/chess-coach-ii-learner-pair-"), base = fileURLToPath(new URL("../../../target/debug/", import.meta.url));
  const initial = Bun.spawnSync([`${base}policy-initialize`, "101"], { env: { RAYON_NUM_THREADS: "2" }, stdout: "pipe", stderr: "pipe", timeout: 10_000 });
  expect(initial.exitCode).toBe(0);
  const modelId = createHash("sha256").update(initial.stdout).digest("hex");
  writeFileSync(`${root}/initial.bpk`, initial.stdout, { flag: "wx", mode: 0o600 });
  writeFileSync(`${root}/config.json`, JSON.stringify({ version: "chess-coach.model-config.v1", architecture: "mlp-relu-32", featureVersion: "chess-coach.features.v1", inputFeatures: 2271, hiddenUnits: 32, recordSha256: modelId }), { flag: "wx", mode: 0o600 });
  const clock = process.hrtime.bigint, start = clock(), ports: ProcessTransport[] = [];
  const spawn = (sessionId: string) => {
    const port = new ProcessTransport({ runtime: "native", executable: `${base}policy-channel`, arguments: [`${root}/config.json`, `${root}/initial.bpk`, sessionId], cwd: root },
      { frameBytes: 8 * 1024 * 1024, stdoutBytes: 16 * 1024 * 1024, stderrBytes: 65536 }, clock);
    ports.push(port);
    return new NativeLearner(sessionId, modelId, port, clock, start + 25_000_000_000n, start + 28_000_000_000n);
  };
  try {
    const first = spawn("synthetic-first"), second = spawn("synthetic-second"), pair = new LearnerPair(first, second);
    await pair.begin(0);
    const observation = structuredClone(canonicalInitialObservation("w"));
    Reflect.set(observation.own, "minerals", 0); Reflect.set(observation.own, "gas", 0);
    const now = clock();
    const context: PolicyContext = { modelId, mode: "sample", observationJson: JSON.stringify(observation), sampling: deriveStream(101, "policy-sampling"), clockNs: clock,
      workDeadlineNs: start + 25_000_000_000n, permit: { version: "chess-coach.plan-permit.v1", attemptId: "synthetic", permitId: "synthetic:plan:0:w", planningOrdinal: 0,
        turn: 0, side: "w", role: "candidate", issuedNs: String(now), deadlineNs: String(now + 10_000_000_000n) } };
    const worker = new PolicyWorker(context, first), owner = new PolicySession(context, first);
    const json = await worker.plan(JSON.stringify(context.permit)), receivedNs = clock();
    const accepted = await owner.acknowledge({ json, receivedNs });
    worker.acceptAck(accepted.digest);
    await pair.accumulate(accepted);
    const proposed = await pair.propose(1);
    expect(proposed.kind).toBe("proposed");
    if (proposed.kind !== "proposed") throw new Error("fixture");
    expect(proposed.parameterSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(proposed.sampledDecisions).toBe(1);
    expect(proposed.nonzeroPolicyGradient).toBe(true);
    await pair.close();
    writeFileSync(`${root}/proposal.bpk`, Uint8Array.from(proposed.record), { flag: "wx", mode: 0o600 });
    writeFileSync(`${root}/result.json`, JSON.stringify({ scope: "BOUNDED_SYNTHETIC_REDUNDANT_BURN_PROPOSAL_ONLY", parameterSha256: proposed.parameterSha256,
      selectedRecordSha256: proposed.config.recordSha256, eligibleEpisode: false, checkpointCommitted: false, runtimeQualification: false }), { flag: "wx", mode: 0o600 });
  } finally { await Promise.allSettled(ports.map(port => port.terminate(new Error("synthetic fixture cleanup")))); }
}, 30_000);
