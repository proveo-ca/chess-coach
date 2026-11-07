// SPEC: _spec/match-runtime.puml, _spec/checkpoint-runtime.puml
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";
import { MatchProcess } from "../src/match-process";
import { Database } from "bun:sqlite";
import { TrainingCoordinator } from "../src/training-coordinator";
import { NativeLearner } from "../src/native-learner";
import { LearnerPair } from "../src/learner-pair";
import { ProcessTransport } from "../src/process-transport";
import { bindings } from "./training-fixture";
import { syntheticCorpus } from "./match-fixture";
import { ModelInputs } from "../src/model-inputs";

test("actual whole synthetic child and two Burn learners commit retained completion only after verified close/reap", async () => {
  const root = mkdtempSync("/tmp/opencode/chess-coach-ii-whole-match-"), base = fileURLToPath(new URL("../../../target/debug/", import.meta.url));
  const initial = Bun.spawnSync([`${base}policy-initialize`, "101"], { env: { RAYON_NUM_THREADS: "2" }, stdout: "pipe", stderr: "pipe", timeout: 10_000 });
  expect(initial.exitCode).toBe(0);
  const modelId = createHash("sha256").update(initial.stdout).digest("hex");
  const modelConfig = { version: "chess-coach.model-config.v1" as const, architecture: "mlp-relu-32" as const, featureVersion: "chess-coach.features.v1", inputFeatures: 2271, hiddenUnits: 32 as const, recordSha256: modelId };
  const inputs = new ModelInputs(root, "synthetic-match", { config: modelConfig, record: initial.stdout }), { config, record } = inputs;
  const coordinator = new TrainingCoordinator(`${root}/state`, bindings());
  coordinator.initializeMaster(101, { config: modelConfig, record: initial.stdout });
  const clock = process.hrtime.bigint, origin = clock(), work = origin + 297_000_000_000n, cleanup = origin + 300_000_000_000n;
  const ports: ProcessTransport[] = [];
  const learner = (id: string) => {
    const port = new ProcessTransport({ runtime: "native", executable: `${base}policy-channel`, arguments: [config, record, id], cwd: root },
      { frameBytes: 8 * 1024 * 1024, stdoutBytes: 64 * 1024 * 1024, stderrBytes: 65536 }, clock);
    ports.push(port);
    return new NativeLearner(id, modelId, port, clock, work, cleanup);
  };
  const children: MatchProcess[] = [];
  const entrypoint = fileURLToPath(new URL("./fixtures/match-child.ts", import.meta.url));
  try {
    const result = await coordinator.runAttempt(101, "synthetic-match", { clockNs: clock, originNs: origin, startupDeadlineNs: origin + 10_000_000_000n,
      workDeadlineNs: work, cleanupDeadlineNs: cleanup }, () => {
      const first = learner("synthetic-first"), second = learner("synthetic-second"), pair = new LearnerPair(first, second);
      const child = new MatchProcess({ executable: process.execPath, entrypoint, arguments: [modelId, String(work - clock()), config, record, `${base}policy-score`], cwd: root }, clock, cleanup);
      children.push(child);
       return { corpus: syntheticCorpus(), strategic: null, verifier: first, learners: pair, transport: child, releaseInputs: inputs.release };
    });
    expect(result.counters).toMatchObject({ started: 1, verifiedCompleted: 1, eligibleCompleted: 1, updates: 1, baselineCount: 1, baselineSum: -1 });
    expect(result.rng["policy-sampling"].drawCount).toBe(1);
    expect(result.journalRef!.lastRecordOrdinal).toBeGreaterThan(0);
    expect(existsSync(config)).toBe(false);
    expect(existsSync(record)).toBe(false);
    expect(readFileSync(`${root}/state/packet-00/attempt-initial-master-101/000000-initial-native-record.bin`)).toEqual(Buffer.from(initial.stdout));
    const inspection = new Database(`${root}/state/private.sqlite`, { readonly: true });
    const completed = inspection.query<{ status: string; completion: string }, []>("SELECT status,completion FROM attempts").get()!;
    expect(completed.status).toBe("COMPLETED");
    expect(JSON.parse(completed.completion).reason).toBe("trace-exhaustion");
    const saved = inspection.query<{ record: Uint8Array; config: string }, []>("SELECT record,config FROM masters").get()!;
    expect(createHash("sha256").update(saved.record).digest("hex")).toBe(result.modelId);
    inspection.close();
    writeFileSync(`${root}/result.json`, JSON.stringify({ scope: "BOUNDED_SYNTHETIC_WHOLE_MATCH_SQL_ONLY", reason: "trace-exhaustion",
      actualCorpusRollout: false, genuineStrategicRollout: false, completionTransactionCommitted: true, periodicCheckpointPublished: false, runtimeQualification: false }), { mode: 0o600, flag: "wx" });
  } catch (error) {
    const stderr = new TextDecoder().decode(children[0]?.stderr());
    writeFileSync(`${root}/failure.json`, JSON.stringify({ scope: "BOUNDED_SYNTHETIC_WHOLE_MATCH_ONLY", error: String(error), stderr }), { mode: 0o600, flag: "wx" });
    throw new Error(`${String(error)}\n${stderr}`, { cause: error });
  } finally {
    await Promise.allSettled([...children.map(child => child.terminate(new Error("synthetic fixture cleanup"))), ...ports.map(port => port.terminate(new Error("synthetic fixture cleanup")))]);
    coordinator.close();
  }
}, 60_000);
