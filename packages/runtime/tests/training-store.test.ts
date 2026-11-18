// SPEC: _spec/checkpoint-runtime.puml
import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { TrainingStore } from "../src/training-store";
import { bindings, storeFixture, syntheticCompletion, syntheticRecord } from "./training-fixture";

test("synthetic SQL completion commits model, frozen-baseline counters and stream state once", () => {
  const { store, selected } = storeFixture();
  try {
    store.initializeMaster(101, selected);
    const first = store.start(101, "first");
    expect(first.frozenBaseline).toBe(0);
    const consumed = store.snapshot(101);
    expect(consumed.counters.started).toBe(1);
    expect(consumed.counters.verifiedCompleted).toBe(0);
    const proposal = syntheticRecord("synthetic-proposal-1");
    const completed = store.complete(101, "first", syntheticCompletion(consumed, 1, 1, proposal), proposal);
    expect(completed.counters).toEqual({ started: 1, verifiedCompleted: 1, eligibleCompleted: 1, updates: 1, nonzeroPGUpdates: 1, baselineCount: 1, baselineSum: 1 });
    expect(completed.modelId).toBe(proposal.config.recordSha256);
    expect(completed.rng["policy-sampling"].drawCount).toBe(1);
    expect(store.start(101, "second").frozenBaseline).toBe(1);
    const next = syntheticRecord("synthetic-proposal-2");
    const second = store.complete(101, "second", syntheticCompletion(store.snapshot(101), 1, -1, next), next);
    expect(second.counters.baselineSum).toBe(0);
    expect(second.counters.baselineCount).toBe(2);
    const detached = store.inferenceRecord(101);
    detached.record[0] = 0;
    expect(store.inferenceRecord(101).record).toEqual(next.record);
    expect(detached).not.toHaveProperty("rng");
    expect(() => store.primaryRecord()).toThrow("INCOMPLETE_EXPERIMENT");
  } finally { store.close(); }
});

test("zero-choice due slot delays checkpoint until eligible actual epoch 101", () => {
  const { store, selected, path } = storeFixture();
  try {
    store.initializeMaster(101, selected);
    for (let i = 0; i < 100; i++) {
      const id = `diagnostic-${i}`;
      store.start(101, id);
      store.complete(101, id, syntheticCompletion(store.snapshot(101), 0, 0, null), null);
    }
    const diagnostic = store.snapshot(101);
    expect(diagnostic.counters.updates).toBe(0);
    expect(diagnostic.counters.baselineCount).toBe(0);
    expect(diagnostic.control.dueBucket).toBe(1);
    expect(diagnostic.control.fulfilledBucket).toBe(0);
    const inspection = new Database(path, { readonly: true });
    expect(inspection.query<{ n: number }, []>("SELECT count(*) AS n FROM checkpoints").get()?.n).toBe(0);
    store.start(101, "eligible-101");
    const proposal = syntheticRecord("synthetic-delayed-checkpoint");
    store.complete(101, "eligible-101", syntheticCompletion(store.snapshot(101), 1, 1, proposal), proposal);
    const saved = inspection.query<{ epoch: number; state: string }, []>("SELECT epoch,state FROM checkpoints").get()!;
    expect(saved.epoch).toBe(101);
    expect(JSON.parse(saved.state).control.fulfilledBucket).toBe(1);
    expect(store.snapshot(101).control.fulfilledBucket).toBe(1);
    inspection.close();
  } finally { store.close(); }
}, 15_000);

test("SQLite failure preserves STARTED and atomically withholds model/counters/checkpoint", () => {
  const { store, selected, path } = storeFixture();
  try {
    store.initializeMaster(101, selected);
    store.start(101, "failing");
    const trigger = new Database(path);
    trigger.run("CREATE TRIGGER synthetic_failure BEFORE UPDATE ON masters WHEN NEW.pending IS NULL BEGIN SELECT RAISE(ABORT,'synthetic transaction failure'); END");
    trigger.close();
    const proposal = syntheticRecord("synthetic-withheld-model");
    expect(() => store.complete(101, "failing", syntheticCompletion(store.snapshot(101), 1, 1, proposal), proposal)).toThrow("synthetic transaction failure");
    const retained = store.snapshot(101);
    expect(retained.counters.started).toBe(1);
    expect(retained.counters.verifiedCompleted).toBe(0);
    expect(retained.counters.updates).toBe(0);
    expect(retained.modelId).toBe(selected.config.recordSha256);
    expect(() => store.start(101, "retry")).toThrow("CLOSED");
    const diagnostic = new Database(path, { readonly: true });
    expect(diagnostic.query<{ status: string }, []>("SELECT status FROM attempts").get()?.status).toBe("STARTED");
    expect(diagnostic.query<{ aborted: number }, []>("SELECT aborted FROM control").get()?.aborted).toBe(1);
    diagnostic.close();
  } finally { store.close(); }
});

for (const kind of ["duplicate", "stale", "rng", "empty-proposal", "missing-proposal", "native-ref"] as const) {
  test(`private synthetic store rejects ${kind} completion without another update`, () => {
    const { store, selected } = storeFixture();
    try {
      store.initializeMaster(101, selected); store.start(101, "attempt");
      const proposal = syntheticRecord("synthetic-proposal"), values = syntheticCompletion(store.snapshot(101), 1, 1, proposal);
      if (kind === "duplicate") {
        store.complete(101, "attempt", values, proposal);
        expect(() => store.complete(101, "attempt", values, proposal)).toThrow("STALE");
        expect(store.snapshot(101).counters.updates).toBe(1);
      } else {
        if (kind === "rng") values.rngAfter["policy-sampling"] = store.snapshot(101).rng["policy-sampling"];
        if (kind === "empty-proposal") values.sampledDecisions = 0;
        if (kind === "native-ref") values.proposalRef!.sha256 = "0".repeat(64);
        expect(() => store.complete(101, kind === "stale" ? "other" : "attempt", values, kind === "missing-proposal" ? null : proposal)).toThrow();
        expect(store.snapshot(101).counters.updates).toBe(0);
      }
      expect(() => store.start(101, "retry")).toThrow("CLOSED");
    } finally { store.close(); }
  });
}

test("store refuses existing files, interleaved masters and recovery after an infrastructure abort", () => {
  const first = storeFixture();
  try {
    expect(() => new TrainingStore(first.path, bindings())).toThrow();
    first.store.initializeMaster(101, first.selected);
    expect(() => first.store.initializeMaster(102, first.selected)).toThrow("SERIAL_MASTERS");
  } finally { first.store.close(); }
  const second = storeFixture();
  try {
    second.store.initializeMaster(101, second.selected); second.store.start(101, "aborted");
    second.store.abort(101, "aborted", { byteLength: 1, sha256: "f".repeat(64) });
    expect(second.store.snapshot(101).counters.started).toBe(1);
    expect(() => second.store.start(101, "replacement")).toThrow("CLOSED");
  } finally { second.store.close(); }
});
