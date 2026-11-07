// SPEC: _spec/checkpoint-runtime.puml, _spec/match-runtime.puml
import { Database } from "bun:sqlite";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { expect, test } from "bun:test";
import { TrainingCoordinator } from "../src/training-coordinator";
import type { AttemptSetup } from "../src/training-coordinator";
import { MatchWorker } from "../src/match-worker";
import type { MatchClock } from "../src/match-session";
import { SyntheticMatchLearners, SyntheticMatchScorer, SyntheticMatchTransport, syntheticCorpus } from "./match-fixture";
import { bindings, syntheticRecord } from "./training-fixture";

function setup() {
  const root = `${mkdtempSync("/tmp/opencode/chess-coach-ii-coordinator-")}/state`, coordinator = new TrainingCoordinator(root, bindings());
  const initial = syntheticRecord("synthetic-initial-not-a-burn-model");
  coordinator.initializeMaster(101, initial);
  const clock: MatchClock = { clockNs: () => 0n, originNs: 0n, startupDeadlineNs: 10_000_000_000n, workDeadlineNs: 297_000_000_000n, cleanupDeadlineNs: 300_000_000_000n };
  const create: AttemptSetup = ({ descriptor, rng, model }) => {
    const inspection = new Database(`${root}/private.sqlite`, { readonly: true });
    expect(inspection.query<{ status: string }, []>("SELECT status FROM attempts").get()?.status).toBe("STARTED");
    inspection.close();
    expect(rng.selection.drawCount).toBe(17);
    const corpus = syntheticCorpus(0), scorer = new SyntheticMatchScorer(clock.clockNs), learners = new SyntheticMatchLearners();
    const worker = new MatchWorker(descriptor.attemptId, { corpus, strategic: null, scorer, modelId: model.config.recordSha256, clockNs: clock.clockNs, workDeadlineNs: clock.workDeadlineNs });
    return { corpus, strategic: null, verifier: scorer, learners, transport: new SyntheticMatchTransport(worker, clock.clockNs) };
  };
  return { root, coordinator, clock, create, initial };
}

test("coordinator persists STARTED before process creation and commits only owner-verified retained completion bytes", async () => {
  const env = setup();
  try {
    const state = await env.coordinator.runAttempt(101, "synthetic", env.clock, env.create);
    expect(state.counters.started).toBe(1);
    expect(state.counters.verifiedCompleted).toBe(1);
    expect(state.counters.updates).toBe(0);
    expect(state.journalRef!.byteLength).toBeGreaterThan(0);
    expect(state.journalRef!.lastRecordOrdinal).toBeGreaterThan(0);
    expect(state.historyRefs).toHaveLength(1);
    expect(state.modelId).toBe(env.initial.config.recordSha256);
  } finally { env.coordinator.close(); }
});

test("coordinator retains the initial record and config outside mutable SQLite master rows", () => {
  const env = setup();
  try {
    const directory = `${env.root}/packet-00/attempt-initial-master-101`;
    const files = readdirSync(directory).sort();
    expect(files).toEqual(["000000-initial-native-record.bin", "000001-initial-model-config.bin"]);
    expect(readFileSync(`${directory}/${files[0]}`)).toEqual(Buffer.from(env.initial.record));
    expect(JSON.parse(readFileSync(`${directory}/${files[1]}`, "utf8"))).toEqual(env.initial.config);
  } finally { env.coordinator.close(); }
});

test("coordinator releases scratch only after verified lifecycle closure and before completion publication", async () => {
  const env = setup();
  let released = false;
  try {
    await env.coordinator.runAttempt(101, "synthetic", env.clock, async input => ({ ...await env.create(input), releaseInputs: () => {
      expect(env.coordinator.snapshot(101).counters.verifiedCompleted).toBe(0);
      released = true;
    } }));
    expect(released).toBe(true);
    expect(env.coordinator.snapshot(101).counters.verifiedCompleted).toBe(1);
  } finally { env.coordinator.close(); }
});

test("failed scratch release aborts publication without advancing counters or permitting a replacement", async () => {
  const env = setup();
  try {
    await expect(env.coordinator.runAttempt(101, "synthetic", env.clock, async input => ({ ...await env.create(input),
      releaseInputs: () => { throw new Error("synthetic scratch refusal"); } }))).rejects.toThrow("scratch refusal");
    expect(env.coordinator.snapshot(101).counters).toMatchObject({ started: 1, verifiedCompleted: 0 });
    await expect(env.coordinator.runAttempt(101, "retry", env.clock, env.create)).rejects.toThrow("CLOSED");
  } finally { env.coordinator.close(); }
});

test("failed match lifecycle preserves scratch instead of invoking successful-close release", async () => {
  const env = setup();
  let released = false;
  try {
    await expect(env.coordinator.runAttempt(101, "synthetic", env.clock, async input => {
      const dependencies = await env.create(input);
      dependencies.transport.exchange = async () => { throw new Error("synthetic lifecycle failure"); };
      return { ...dependencies, releaseInputs: () => { released = true; } };
    })).rejects.toThrow("lifecycle failure");
    expect(released).toBe(false);
    expect(env.coordinator.snapshot(101).counters.verifiedCompleted).toBe(0);
  } finally { env.coordinator.close(); }
});

test("durable publication transaction failure preserves STARTED, private proof bytes and abort-all state", async () => {
  const env = setup();
  const db = new Database(`${env.root}/private.sqlite`);
  db.run("CREATE TRIGGER synthetic_failure BEFORE UPDATE ON masters WHEN NEW.pending IS NULL BEGIN SELECT RAISE(ABORT,'synthetic publication failure'); END");
  db.close();
  try {
    await expect(env.coordinator.runAttempt(101, "synthetic", env.clock, env.create)).rejects.toThrow("publication failure");
    expect(env.coordinator.snapshot(101).counters).toMatchObject({ started: 1, verifiedCompleted: 0, updates: 0 });
    const inspection = new Database(`${env.root}/private.sqlite`, { readonly: true });
    expect(inspection.query<{ aborted: number }, []>("SELECT aborted FROM control").get()?.aborted).toBe(1);
    inspection.close();
    await expect(env.coordinator.runAttempt(101, "retry", env.clock, env.create)).rejects.toThrow("CLOSED");
  } finally { env.coordinator.close(); }
});

test("publication cannot renew the original clock even after an actual SQL commit becomes visible", async () => {
  const env = setup();
  const original = env.clock.clockNs;
  env.clock.clockNs = () => env.coordinator.snapshot(101).counters.verifiedCompleted > 0 ? env.clock.workDeadlineNs : original();
  try {
    await expect(env.coordinator.runAttempt(101, "synthetic", env.clock, env.create)).rejects.toThrow("ORIGINAL_DEADLINE");
    expect(env.coordinator.snapshot(101).counters.verifiedCompleted).toBe(1);
    await expect(env.coordinator.runAttempt(101, "retry", env.clock, env.create)).rejects.toThrow("CLOSED");
  } finally { env.coordinator.close(); }
});

test("concurrent coordinator entry revokes the original attempt rather than resurrecting it", async () => {
  const env = setup();
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const first = env.coordinator.runAttempt(101, "synthetic", env.clock, async input => { await wait; return env.create(input); });
  try {
    await expect(env.coordinator.runAttempt(101, "other", env.clock, env.create)).rejects.toThrow("CLOSED_OR_PENDING");
    release();
    await expect(first).rejects.toThrow();
    expect(env.coordinator.snapshot(101).counters).toMatchObject({ started: 1, verifiedCompleted: 0, updates: 0 });
  } finally { release(); env.coordinator.close(); }
});
