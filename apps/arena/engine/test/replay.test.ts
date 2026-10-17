// SPEC: _spec/apps/arena/burn-compat.puml
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseScFen } from "@chess-coach/starchess-core";
import { NativeReplay } from "../replay";
import { PrivateSession } from "../session";
import { EngineErrorV2, type Action, type FixtureId, type Pair, type SessionOpen } from "../wire-v2";

function planningV2(value: SessionOpen): Extract<SessionOpen, { kind: "planning" }> {
  assert.equal(value.kind, "planning");
  if (value.kind !== "planning") throw new Error("Expected planning");
  return value;
}

for (const fixture of ["tiny-v1", "standard-v1", "all-actors-v1"] as const) {
  test(`v2 independent replay matches every pass/pass native transition for ${fixture}`, () => {
    const live = new PrivateSession();
    const replay = new NativeReplay();
    const initial = live.start(fixture);
    assert.deepEqual(replay.start(fixture), initial);
    const windows = fixture === "all-actors-v1" ? 24 : 45;
    for (let ordinal = 0; ordinal < windows; ordinal++) {
      const opened = live.open(1, ordinal);
      assert.deepEqual(replay.open(1, ordinal), opened);
      if (opened.kind !== "planning") break;
      const settled = live.commit(opened.context, { w: [], b: [] });
      assert.deepEqual(replay.commit(opened.context, { w: [], b: [] }), settled);
      if (settled.settlement.outcome) break;
    }
    const end = live.close(1);
    assert.deepEqual(replay.close(1), end);
    assert.ok(end.outcome);
  });
}

const familyQueuesV2: Record<string, Pair<Action[]>> = {
  classical: {
    w: [{ kind: "classical", timing: "C", color: "w", from: "b1", to: "c3" }],
    b: [{ kind: "classical", timing: "C", color: "b", from: "b8", to: "c6" }],
  },
  deploy: {
    w: [{ kind: "deploy", timing: "B", color: "w", from: "e1", to: "d2", unit: "p" }],
    b: [{ kind: "deploy", timing: "F", color: "b", from: "e8", to: "d7", unit: "p" }],
  },
  stimStep: {
    w: [{ kind: "stimStep", timing: "B", color: "w", from: "e2", to: "e3" }],
    b: [{ kind: "stimStep", timing: "F", color: "b", from: "e7", to: "e6" }],
  },
  spiderMine: {
    w: [{ kind: "spiderMine", timing: "B", color: "w", from: "b1" }],
    b: [{ kind: "spiderMine", timing: "F", color: "b", from: "b8" }],
  },
  charonMissiles: {
    w: [{ kind: "charonMissiles", timing: "B", color: "w", from: "c1", to: "d2" }],
    b: [{ kind: "charonMissiles", timing: "F", color: "b", from: "c8", to: "d7" }],
  },
  siegeMode: {
    w: [{ kind: "siegeMode", timing: "B", color: "w", from: "d1" }],
    b: [{ kind: "siegeMode", timing: "F", color: "b", from: "d8" }],
  },
  tacticalJump: {
    w: [{ kind: "tacticalJump", timing: "B", color: "w", from: "f1", to: "a3" }],
    b: [{ kind: "tacticalJump", timing: "F", color: "b", from: "f8", to: "a6" }],
  },
};

for (const [family, queues] of Object.entries(familyQueuesV2)) {
  test(`v2 independent replay stages both colors for native ${family}`, () => {
    const live = new PrivateSession();
    const replay = new NativeReplay();
    assert.deepEqual(live.start("all-actors-v1"), replay.start("all-actors-v1"));
    const opened = planningV2(live.open(1, 0));
    assert.deepEqual(replay.open(1, 0), opened);
    const settlement = live.commit(opened.context, queues);
    assert.deepEqual(replay.commit(opened.context, queues), settlement);
    assert.deepEqual(replay.close(1), live.close(1));
  });
}

test("v2 replay independently resolves B births, rewritten promotions and F mine anchors", () => {
  const scenarios: { scfen: string; queues: Pair<Action[]> }[] = [
    { scfen: "SCFEN|4k3/8/8/8/8/8/8/4K3|21|33|P|G:33:33|B:12:12|Q:w:;b:", queues: {
      w: [{ kind: "deploy", timing: "B", color: "w", from: "e1", to: "d2", unit: "p" }, { kind: "classical", timing: "C", color: "w", from: "d2", to: "d3" }], b: [],
    } },
    { scfen: "SCFEN|4k3/8/P7/8/8/8/8/4K3|21|33|P|G:33:33|B:12:12|Q:w:;b:", queues: {
      w: [{ kind: "stimStep", timing: "B", color: "w", from: "a6", to: "a7" }, { kind: "classical", timing: "C", color: "w", from: "a6", to: "a7", promotion: "q" }], b: [],
    } },
    { scfen: "SCFEN|4k3/8/8/8/8/8/8/1N2K3|21|33|P|G:33:33|B:12:12|Q:w:;b:", queues: {
      w: [{ kind: "classical", timing: "C", color: "w", from: "b1", to: "c3" }, { kind: "spiderMine", timing: "F", color: "w", from: "b1" }], b: [],
    } },
  ];
  for (const scenario of scenarios) {
    const state = parseScFen(scenario.scfen);
    const live = PrivateSession.fromSnapshotForTest(state);
    const replay = NativeReplay.fromSnapshotForTest(state);
    assert.deepEqual(replay.start("tiny-v1"), live.start("tiny-v1"));
    const opened = planningV2(live.open(1, 0));
    assert.deepEqual(replay.open(1, 0), opened);
    assert.deepEqual(replay.commit(opened.context, scenario.queues), live.commit(opened.context, scenario.queues));
    assert.deepEqual(replay.close(1), live.close(1));
  }
});

test("v2 replay independently reproduces rejection witnesses and refuses rescue", () => {
  const live = new PrivateSession();
  const replay = new NativeReplay();
  live.start("tiny-v1"); replay.start("tiny-v1");
  const opened = planningV2(live.open(1, 0));
  assert.deepEqual(replay.open(1, 0), opened);
  const queues: Pair<Action[]> = { w: [{ kind: "deploy", timing: "B", color: "w", from: "e1", to: "d1", unit: "p" }],
    b: [{ kind: "classical", timing: "C", color: "b", from: "a8", to: "a7" }] };
  const capture = (engine: PrivateSession | NativeReplay) => {
    try { engine.commit(opened.context, queues); } catch (error) { assert.ok(error instanceof EngineErrorV2); return error.packet; }
    throw new Error("Expected rejection");
  };
  const refusal = capture(live);
  assert.deepEqual(capture(replay), refusal);
  assert.throws(() => replay.commit(opened.context, { w: [], b: [] }), error => error instanceof EngineErrorV2 && error.packet.code === "STATE");
  assert.deepEqual(replay.close(1), live.close(1));
});

test("v2 independent replay retains trailing begins and terminal chips without income", () => {
  for (const raw of [
    "SCFEN|4k3/8/8/8/8/8/8/4K3|11|33|P|G:00:22|B:3:3|Q:w:;b:",
    "SCFEN|8/8/8/8/8/8/8/Kk6|10|11|P|G:11:11|B:3:3|Q:w:;b:",
    "SCFEN|4k3/8/8/8/8/8/8/4K3|45|23|P|G:33:33|B:3:3|Q:w:;b:",
  ]) {
    const state = parseScFen(raw);
    const live = PrivateSession.fromSnapshotForTest(state);
    const replay = NativeReplay.fromSnapshotForTest(state);
    assert.deepEqual(replay.start("tiny-v1"), live.start("tiny-v1"));
    assert.deepEqual(replay.open(1, 0), live.open(1, 0));
    assert.deepEqual(replay.close(1), live.close(1));
  }
});

test("v2 independent replay detects changed native transcript fields by reconstruction", () => {
  const live = new PrivateSession();
  const replay = new NativeReplay();
  live.start("standard-v1"); replay.start("standard-v1");
  const opened = planningV2(live.open(1, 0));
  replay.open(1, 0);
  const actual = replay.commit(opened.context, { w: [], b: [] });
  const recorded = live.commit(opened.context, { w: [], b: [] });
  assert.deepEqual(actual, recorded);
  const mutations: ((record: typeof recorded) => void)[] = [
    r => { r.begin.before.scfen += " "; }, r => { r.begin.after.bank.w++; },
    r => { r.begin.rawBegin = null; }, r => { r.settlement.rawResolve = null; },
    r => { r.settlement.committed.bank.b++; }, r => { r.settlement.after.scfen += " "; },
    r => { r.settlement.grants.w++; }, r => { r.settlement.outcome = { winner: "w", draw: false }; },
    r => { r.settlement.requests.w.push({ kind: "classical", timing: "C", color: "w", from: "e1", to: "d1" }); },
  ];
  for (const mutate of mutations) {
    const altered = structuredClone(recorded);
    mutate(altered);
    assert.notDeepEqual(actual, altered);
  }
  replay.close(1); live.close(1);
});

test("v2 replay has no dependency on the live session, admission or legacy reducers", async () => {
  const source = await readFile(new URL("../replay.ts", import.meta.url), "utf8");
  assert.ok(!/commitWindow|run_match|from\s+["'][^"']*(?:session|admission|starchess-arena|starchess-training)/.test(source));
  const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(imports, ["@chess-coach/starchess-core", "./fixtures", "./wire-v2"]);
  const replay = new NativeReplay();
  assert.throws(() => replay.start("authored" as FixtureId), error => error instanceof EngineErrorV2 && error.packet.code === "BAD_REQUEST");
});
