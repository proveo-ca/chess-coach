// SPEC: _spec/packages/starchess-core/submit-turn-activity.puml, _spec/packages/starchess-core/resolve-turn-activity.puml
import { describe, expect, it } from "vitest";
import {
  addScAction, beginScTurn, beginTurnWithProvenance, endScTurn, endTurnWithProvenance,
  initializeProvenance, parseScFen, placementToMap, scMovesFor, type ActionBindings, type EngineProvenance,
  type ScActionInput, type ScFenSnapshot,
} from "../index";
import { validateProvenance } from "../resolve/provenance-validation";

function run(fen: string, actions: ScActionInput[]) {
  const opening = parseScFen(fen);
  const initialized = initializeProvenance(opening);
  const began = beginTurnWithProvenance({ snapshot: opening, provenance: initialized });
  expect(began.nativeResult).toStrictEqual(beginScTurn(opening));
  let snapshot = began.nativeResult.next;
  for (const action of actions) snapshot = addScAction({ snapshot, action }).snapshot;
  const accepted = { w: 0, b: 0 };
  const bindings: ActionBindings = (snapshot.queue?.actions ?? []).map(a => ({ sourceActionSeq: a.seq, side: a.color, actionRef: { planningOrdinal: 0, acceptedActionOrdinal: accepted[a.color]++ } }));
  const unchanged = structuredClone({ opening, snapshot, initialized, began });
  const ended = endTurnWithProvenance({ snapshot, provenance: began.provenance, actionBindings: bindings });
  expect(ended.nativeResult).toStrictEqual(endScTurn(snapshot, { skipTurnStartChecks: true }));
  expect({ opening, snapshot, initialized, began }).toStrictEqual(unchanged);
  expect(Object.keys(ended).sort()).toStrictEqual(["frames", "nativeResult", "provenance", "visibilityCheckpoints", "visibilityImages"]);
  expect(Object.isFrozen(ended.provenance)).toBe(true);
  expect(Object.isFrozen(ended.nativeResult)).toBe(false);
  expect(ended.visibilityImages).toHaveLength(2 * ended.frames.length);
  expect(ended.visibilityCheckpoints).toHaveLength(2 * ended.frames.length);
  for (let i = 0; i < ended.frames.length; i++) {
    const frame = ended.frames[i]!;
    expect(frame.sourceEffectKey).toBe(`engine:call:2:frame:${i}`);
    expect(ended.visibilityImages[2 * i]).toStrictEqual({ key: frame.beforeVisibilityKey, ordinal: 2 * i, turn: opening.turn, phase: frame.phase, state: frame.before });
    expect(ended.visibilityImages[2 * i + 1]?.state).toStrictEqual(frame.after);
    expect(ended.visibilityCheckpoints[2 * i]).toStrictEqual({ ordinal: 2 * i, imageKey: frame.beforeVisibilityKey, frameKey: frame.sourceEffectKey, point: "before-frame" });
    expect(Object.isFrozen(frame.before.entities)).toBe(true);
  }
  return { opening, initialized, began, snapshot, ended };
}

describe("native provenance lifecycle", () => {
  it("endows canonical IDs while preserving the native mine occurrence order", () => {
    const snapshot = parseScFen("SCFEN|7k/8/8/8/8/8/4R3/K7|0|33|P|G:11:11|Q:w:;b:");
    snapshot.mines = [{ color: "b", at: "a3" }, { color: "w", at: "h4" }, { color: "w", at: "a3" }];
    snapshot.siegedTanks = ["e2"];
    const provenance = initializeProvenance(snapshot);
    expect(provenance.entities).toStrictEqual([
      { id: "engine:mine:1", kind: "mine", side: "w", square: "a3" },
      { id: "engine:mine:2", kind: "mine", side: "w", square: "h4" },
      { id: "engine:mine:3", kind: "mine", side: "b", square: "a3" },
      { id: "engine:unit:1", kind: "unit", side: "w", type: "k", square: "a1", tankMode: null },
      { id: "engine:unit:2", kind: "unit", side: "w", type: "r", square: "e2", tankMode: "siege" },
      { id: "engine:unit:3", kind: "unit", side: "b", type: "k", square: "h8", tankMode: null },
    ]);
    expect(provenance.nativeMineOrder).toStrictEqual(["engine:mine:3", "engine:mine:2", "engine:mine:1"]);
    snapshot.mines[0]!.at = "b3";
    expect(provenance.entities[2]?.square).toBe("a3");
  });

  it("keeps empty calls empty and supports continuation to terminal turn 45", () => {
    const { ended } = run("SCFEN|7k/8/8/8/8/8/8/K7|44|33|P|G:33:33|Q:w:;b:", []);
    expect(ended.frames).toStrictEqual([]);
    expect(ended.provenance).toMatchObject({ turn: 45, stage: "terminal", initialTurn: 44, callOrdinal: 2 });
    expect(() => beginTurnWithProvenance({ snapshot: ended.nativeResult.next, provenance: ended.provenance })).toThrow("SEQUENCE");
    const terminal = initializeProvenance(ended.nativeResult.next);
    expect(terminal).toMatchObject({ stage: "terminal", callOrdinal: 0, initialTurn: 45 });
  });

  it("records real automatic Begin chips and a terminal Begin without a query", () => {
    const snapshot = parseScFen("SCFEN|8/8/8/8/8/8/8/Kk6|12|11|P|G:22:22|Q:w:;b:");
    const provenance = initializeProvenance(snapshot);
    const began = beginTurnWithProvenance({ snapshot, provenance });
    expect(began.nativeResult).toStrictEqual(beginScTurn(snapshot));
    expect(began.provenance).toMatchObject({ turn: 13, stage: "terminal", callOrdinal: 1, ccLives: { w: 0, b: 0 }, lastCall: { queries: [], consumedFacts: [] } });
    expect(began.frames.map(f => f.effects)).toStrictEqual([
      [{ kind: "cc-lives-change", side: "b", before: 1, after: 0, sourceActionSeq: null }],
      [{ kind: "cc-lives-change", side: "w", before: 1, after: 0, sourceActionSeq: null }],
    ]);
  });

  it("rejects a turn-cap-only terminal Begin while accepting the actual terminal End", () => {
    const { ended } = run("SCFEN|7k/8/8/8/8/8/8/K7|44|33|P|G:33:33|Q:w:;b:", []);
    expect(() => validateProvenance(ended.provenance)).not.toThrow();
    const forged: EngineProvenance = { ...ended.provenance, callOrdinal: 1 };
    expect(forged).toMatchObject({ initialTurn: 44, turn: 45, callOrdinal: 1, stage: "terminal", ccLives: { w: 3, b: 3 } });
    const unchanged = structuredClone(forged);
    expect(() => validateProvenance(forged)).toThrow("SEQUENCE: $.provenance.stage");
    expect(forged).toStrictEqual(unchanged);
  });

  it.each([
    { initialLives: "31", expectedLives: { w: 2, b: 0 } },
    { initialLives: "13", expectedLives: { w: 0, b: 2 } },
    { initialLives: "11", expectedLives: { w: 0, b: 0 } },
  ])("accepts a real terminal Begin at turn 44 with lives $initialLives", ({ initialLives, expectedLives }) => {
    const snapshot = parseScFen(`SCFEN|8/8/8/8/8/8/8/Kk6|44|${initialLives}|P|G:33:33|Q:w:;b:`);
    const began = beginTurnWithProvenance({ snapshot, provenance: initializeProvenance(snapshot) });
    expect(began.nativeResult).toStrictEqual(beginScTurn(snapshot));
    expect(began.provenance).toMatchObject({ initialTurn: 44, turn: 45, callOrdinal: 1, stage: "terminal", ccLives: expectedLives });
    expect(() => validateProvenance(began.provenance)).not.toThrow();
    expect(began.provenance.lastCall).toStrictEqual({ queries: [], consumedFacts: [] });
  });

  it("clears previous End query references on the next Begin", () => {
    const { ended } = run("SCFEN|4k3/8/p7/8/8/8/8/R3K3|0|33|P|G:11:11|Q:w:;b:", [
      { kind: "classical", timing: "C", color: "w", from: "a1", to: "a8" },
    ]);
    const next = beginTurnWithProvenance({ snapshot: ended.nativeResult.next, provenance: ended.provenance });
    expect(next.provenance.lastCall).toStrictEqual({ queries: [], consumedFacts: [] });
    expect(next.provenance.resolvedActions).toStrictEqual([]);
    expect(next.nativeResult).toStrictEqual(beginScTurn(ended.nativeResult.next));
  });
});

describe("actual identity effects", () => {
  it("records atomic crush/birth, then a live newborn's separate mine death", () => {
    const { ended } = run("SCFEN|4k3/8/8/8/8/8/4n3/4K3|21|33|P|G:33:33|B:3:3|Q:w:;b:|M:w:;b:e2", [
      { kind: "deploy", timing: "B", color: "w", from: "e1", to: "e2", unit: "p" },
    ]);
    expect(ended.frames).toHaveLength(2);
    const birth = ended.frames[0]!; const death = ended.frames[1]!;
    expect(birth.effects.map(e => e.kind)).toStrictEqual(["unit-destroy", "unit-create", "deployment-disposition"]);
    expect(birth.effects[0]).toMatchObject({ entity: { id: "engine:unit:2", type: "n", side: "b", square: "e2" }, sourceActionSeq: 0 });
    expect(birth.effects[1]).toMatchObject({ entity: { id: "engine:unit:4", type: "p", side: "w", square: "e2" }, sourceActionSeq: 0 });
    expect(death.before.entities).toContainEqual({ id: "engine:unit:4", kind: "unit", type: "p", side: "w", square: "e2", tankMode: null });
    expect(death.effects.map(e => e.kind)).toStrictEqual(["mine-remove", "unit-destroy"]);
    expect(ended.provenance.unitCounter).toBe(4);
    expect(ended.provenance.entities.filter(e => e.kind === "unit").map(e => e.id)).toStrictEqual(["engine:unit:1", "engine:unit:3"]);
  });

  it("transforms the purchased own replacement and retires the original", () => {
    const { ended } = run("SCFEN|k4p2/4PK2/8/8/8/8/8/8|11|33|P|G:22:22|B:3:3|Q:w:;b:", [
      { kind: "stimStep", timing: "B", color: "w", from: "e7", to: "e8", promotion: "q" },
      { kind: "deploy", timing: "B", color: "w", from: "f7", to: "e8", unit: "p" },
      { kind: "classical", timing: "C", color: "w", from: "e7", to: "f8", promotion: "q" },
    ]);
    expect(ended.frames.flatMap(f => f.effects).filter(e => e.kind === "unit-transform")).toStrictEqual([{ kind: "unit-transform", entityId: "engine:unit:5", fromType: "p", toType: "q", sourceActionSeq: 0 }]);
    expect(ended.provenance.entities).not.toContainEqual(expect.objectContaining({ id: "engine:unit:2" }));
    expect(ended.provenance.resolvedActions.map(a => a.effectiveActorId)).toStrictEqual(["engine:unit:2", null, null]);
  });

  it("keeps the held opponent replacement intact with no ownership effect", () => {
    const { ended } = run("SCFEN|5p2/4Pk2/8/8/8/8/8/K7|0|33|P|G:11:11|B:3:3|Q:w:;b:", [
      { kind: "stimStep", timing: "B", color: "w", from: "e7", to: "e8", promotion: "q" },
      { kind: "classical", timing: "C", color: "w", from: "e7", to: "f8", promotion: "q" },
      { kind: "deploy", timing: "B", color: "b", from: "f7", to: "e8", unit: "p" },
    ]);
    expect(ended.frames).toHaveLength(2);
    expect(ended.provenance.entities).toContainEqual({ id: "engine:unit:5", kind: "unit", type: "p", side: "b", square: "e8", tankMode: null });
    expect(ended.frames.flatMap(f => f.effects).filter(e => e.kind === "unit-transform")).toStrictEqual([]);
  });

  it("uses a common live preimage for the C removal wave", () => {
    const { ended } = run("SCFEN|7k/8/8/8/8/3p4/4P3/K7|0|33|P|G:11:11|Q:w:;b:", [
      { kind: "classical", timing: "C", color: "w", from: "e2", to: "d3" },
      { kind: "classical", timing: "C", color: "b", from: "d3", to: "e2" },
    ]);
    expect(ended.frames).toHaveLength(1);
    expect(ended.frames[0]?.phase).toBe("C-attack");
    const effects = ended.frames[0]!.effects;
    expect(effects).toHaveLength(2);
    expect(effects.map(e => e.kind)).toStrictEqual(["unit-destroy", "unit-destroy"]);
    expect(ended.frames[0]?.before.entities.filter(e => e.kind === "unit")).toHaveLength(4);
    for (const effect of effects) if (effect.kind === "unit-destroy") expect(effect.causalBeforeVisibilityKey).toBe(ended.frames[0]?.beforeVisibilityKey);
  });

  it("records a deferred reciprocal swap atomically and preserves stale native afterMove", () => {
    const { ended } = run("SCFEN|r3k3/8/8/8/8/8/8/R3K3|1|33|P|G:11:11|Q:w:;b:|S:a1a8", [
      { kind: "classical", timing: "C", color: "w", from: "a1", to: "a8" },
      { kind: "classical", timing: "C", color: "b", from: "a8", to: "a1" },
    ]);
    expect(ended.frames).toHaveLength(1);
    expect(ended.frames[0]?.effects).toStrictEqual([
      { kind: "unit-move", entityId: "engine:unit:1", from: "a1", to: "a8", sourceActionSeq: 0 },
      { kind: "unit-move", entityId: "engine:unit:2", from: "a8", to: "a1", sourceActionSeq: 1 },
    ]);
    expect(ended.provenance.lastCall.consumedFacts).toStrictEqual([]);
  });

  it("binds a guard-skipped own replacement actor in F", () => {
    const { ended } = run("SCFEN|7k/8/8/8/8/8/4R3/4K3|21|33|P|G:33:33|B:3:3|Q:w:;b:", [
      { kind: "siegeMode", timing: "F", color: "w", from: "e2" },
      { kind: "deploy", timing: "B", color: "w", from: "e1", to: "e2", unit: "p" },
    ]);
    expect(ended.provenance.resolvedActions[0]?.effectiveActorId).toBe("engine:unit:4");
    expect(ended.frames.flatMap(f => f.effects).filter(e => e.kind === "tank-mode-change")).toStrictEqual([]);
  });

  it("records a native mode write and rewritten C/F Marine movement sources", () => {
    const { ended } = run("SCFEN|7k/8/8/8/8/8/R3P3/4K3|21|33|P|G:33:33|Q:w:;b:", [
      { kind: "siegeMode", timing: "B", color: "w", from: "a2" },
      { kind: "classical", timing: "C", color: "w", from: "e2", to: "e3" },
      { kind: "stimStep", timing: "F", color: "w", from: "e2", to: "e3" },
    ]);
    expect(ended.frames.flatMap(f => f.effects)).toStrictEqual([
      { kind: "tank-mode-change", entityId: "engine:unit:1", before: "tank", after: "siege", sourceActionSeq: 0 },
      { kind: "unit-move", entityId: "engine:unit:3", from: "e2", to: "e3", sourceActionSeq: 1 },
      { kind: "unit-move", entityId: "engine:unit:3", from: "e3", to: "e4", sourceActionSeq: 2 },
    ]);
    expect(ended.provenance.resolvedActions.map(a => a.effectiveActorId)).toStrictEqual(["engine:unit:1", "engine:unit:3", "engine:unit:3"]);
  });

  it("keeps both jumping collision victims in one atomic preimage", () => {
    const { ended } = run("SCFEN|q2k4/8/8/8/8/8/8/4K3|21|33|P|G:33:33|B:8:8|Q:w:;b:", [
      { kind: "deploy", timing: "B", color: "w", from: "e1", to: "e2", unit: "p" },
      { kind: "tacticalJump", timing: "B", color: "b", from: "a8", to: "e2" },
    ]);
    expect(ended.frames).toHaveLength(2);
    expect(ended.frames[1]?.before.entities).toContainEqual({ id: "engine:unit:4", kind: "unit", type: "p", side: "w", square: "e2", tankMode: null });
    expect(ended.frames[1]?.effects.map(e => e.kind)).toStrictEqual(["unit-destroy", "unit-destroy"]);
    expect(ended.frames[1]?.effects.map(e => e.sourceActionSeq)).toStrictEqual([1, 1]);
    expect(ended.frames.flatMap(f => f.effects).filter(e => e.kind === "unit-move")).toStrictEqual([]);
  });

  it("records mutual collision without movement or spending the untouched mine", () => {
    const { ended } = run("SCFEN|4k3/8/8/8/4p3/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:|M:w:e3;b:", [
      { kind: "classical", timing: "C", color: "w", from: "e2", to: "e3" },
      { kind: "classical", timing: "C", color: "b", from: "e4", to: "e3" },
    ]);
    expect(ended.frames).toHaveLength(1);
    expect(ended.frames[0]?.effects.map(e => e.kind)).toStrictEqual(["unit-destroy", "unit-destroy"]);
    expect(ended.provenance.nativeMineOrder).toStrictEqual(["engine:mine:1"]);
    expect(ended.frames[0]?.before.entities.filter(e => e.kind === "unit" && e.type === "p").map(e => e.square)).toStrictEqual(["e2", "e4"]);
  });

  it.each([false, true])("commits a CC contact capture and relocation atomically with mine=%s", mined => {
    const { ended } = run(`SCFEN|7k/8/8/8/8/8/4r3/3K4|0|33|P|G:11:11|Q:w:;b:${mined ? "|M:w:;b:d2" : ""}`, [
      { kind: "classical", timing: "C", color: "w", from: "d1", to: "d2" },
      { kind: "classical", timing: "C", color: "b", from: "e2", to: "a2" },
    ]);
    expect(ended.nativeResult.next.placement).toBe("7k/8/8/8/8/8/3K4/8");
    expect(ended.frames).toHaveLength(1);
    const frame = ended.frames[0]!;
    expect(frame.phase).toBe("C-move");
    expect(frame.before.entities).toStrictEqual([
      ...(mined ? [{ id: "engine:mine:1", kind: "mine", side: "b", square: "d2" }] : []),
      { id: "engine:unit:1", kind: "unit", side: "w", type: "k", square: "d1", tankMode: null },
      { id: "engine:unit:2", kind: "unit", side: "b", type: "r", square: "e2", tankMode: "tank" },
      { id: "engine:unit:3", kind: "unit", side: "b", type: "k", square: "h8", tankMode: null },
    ]);
    expect(frame.effects).toStrictEqual([
      ...(mined ? [{ kind: "mine-remove", entityId: "engine:mine:1", sourceActionSeq: 0 }] : []),
      { kind: "unit-move", entityId: "engine:unit:1", from: "d1", to: "d2", sourceActionSeq: 0 },
      { kind: "unit-destroy", entity: { id: "engine:unit:2", kind: "unit", side: "b", type: "r", square: "e2", tankMode: "tank" }, sourceActionSeq: 0, causalBeforeVisibilityKey: "engine:call:2:image:0" },
    ]);
    expect(frame.after.entities).toStrictEqual([
      { id: "engine:unit:1", kind: "unit", side: "w", type: "k", square: "d2", tankMode: null },
      { id: "engine:unit:3", kind: "unit", side: "b", type: "k", square: "h8", tankMode: null },
    ]);
    expect(ended.visibilityImages.map(image => image.state)).toStrictEqual([frame.before, frame.after]);
    expect(frame.before.nativeMineOrder).toStrictEqual(mined ? ["engine:mine:1"] : []);
    expect(frame.after.nativeMineOrder).toStrictEqual([]);
    expect(ended.nativeResult.next.mines).toBeUndefined();
    expect(ended.provenance.lastCall.consumedFacts).toStrictEqual([]);
  });

  it("retains a fire-and-forget source after its Mecha dies", () => {
    const { ended } = run("SCFEN|6k1/8/8/3q4/2p5/1B6/8/K7|21|33|P|G:33:33|Q:w:;b:", [
      { kind: "charonMissiles", timing: "F", color: "w", from: "b3", to: "d5" },
      { kind: "classical", timing: "C", color: "b", from: "c4", to: "b3" },
    ]);
    const destruction = ended.frames.flatMap(f => f.effects).filter(e => e.kind === "unit-destroy");
    expect(destruction).toHaveLength(2);
    expect(destruction[1]).toMatchObject({ sourceActionSeq: 0, entity: { type: "q", square: "d5", side: "b" } });
    expect(ended.provenance.resolvedActions[0]?.effectiveActorId).toBe("engine:unit:3");
  });

  it("disposes a paid F deployment at the terminal C skip with no actor lookup", () => {
    const { ended } = run("SCFEN|8/8/k7/8/8/8/8/R3K3|21|31|P|G:33:33|B:3:3|Q:w:;b:", [
      { kind: "classical", timing: "C", color: "w", from: "a1", to: "a8" },
      { kind: "deploy", timing: "F", color: "w", from: "e1", to: "d2", unit: "p" },
    ]);
    expect(ended.provenance.stage).toBe("terminal");
    expect(ended.frames.at(-1)?.effects).toStrictEqual([{ kind: "deployment-disposition", materializedEntityId: null, sourceActionSeq: 1 }]);
    expect(ended.frames.at(-1)?.phase).toBe("F");
    expect(ended.provenance.resolvedActions[1]?.effectiveActorId).toBeNull();
    expect(ended.provenance.unitCounter).toBe(3);
  });

  it("reconciles every native move pair in fixed fog/contact/collision boards", () => {
    const fixtures = [
      "4k3/8/p7/8/8/8/8/R3K3", "r3k3/8/8/8/8/8/8/R3K3",
      "4bk2/8/5n2/4p3/8/2R5/3P4/4K3", "4k3/8/8/2b5/4p3/8/4P3/4K3",
    ];
    let checked = 0;
    for (const placement of fixtures) {
      const snapshot = parseScFen(`SCFEN|${placement}|0|33|P|G:11:11|Q:w:;b:`);
      const began = beginTurnWithProvenance({ snapshot, provenance: initializeProvenance(snapshot) });
      const board = placementToMap(began.nativeResult.next.placement);
      const inputs = (side: "w" | "b"): (ScActionInput | null)[] => [null, ...scMovesFor(board, side).map(m => ({
        kind: "classical" as const, timing: "C" as const, color: side, from: m.from, to: m.to,
        ...(m.promotes ? { promotion: "q" as const } : {}),
      }))];
      for (const white of inputs("w")) for (const black of inputs("b")) {
        let committed = began.nativeResult.next;
        for (const action of [white, black]) if (action) committed = addScAction({ snapshot: committed, action }).snapshot;
        const actionBindings = (committed.queue?.actions ?? []).map(a => ({ sourceActionSeq: a.seq, side: a.color, actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 } }));
        try {
          const ended = endTurnWithProvenance({ snapshot: committed, provenance: began.provenance, actionBindings });
          expect(ended.nativeResult).toStrictEqual(endScTurn(committed, { skipTurnStartChecks: true }));
          checked++;
        } catch (error) {
          throw new Error(`${placement} ${JSON.stringify([white, black])}`, { cause: error });
        }
      }
    }
    expect(checked).toBe(882);
  }, 30_000);
});

describe("closed native companion preflight", () => {
  const opening = () => parseScFen("SCFEN|7k/8/8/8/8/8/8/K7|0|33|P|G:11:11|Q:w:;b:");
  it("rejects queue/stage/action-binding mismatches", () => {
    const snapshot = opening(); const provenance = initializeProvenance(snapshot);
    expect(() => endTurnWithProvenance({ snapshot, provenance, actionBindings: [] })).toThrow("SEQUENCE");
    const began = beginTurnWithProvenance({ snapshot, provenance });
    const committed = addScAction({ snapshot: began.nativeResult.next, action: { kind: "deploy", timing: "B", color: "w", from: "a1", to: "a2", unit: "p" } }).snapshot;
    expect(() => initializeProvenance(committed)).toThrow("SEQUENCE");
    expect(() => endTurnWithProvenance({ snapshot: committed, provenance: began.provenance, actionBindings: [] })).toThrow("CARDINALITY");
    expect(() => endTurnWithProvenance({ snapshot: committed, provenance: began.provenance, actionBindings: [{ sourceActionSeq: 0, side: "b", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 } }] })).toThrow("SEQUENCE");
    expect(() => endTurnWithProvenance({ snapshot: committed, provenance: began.provenance, actionBindings: [{ sourceActionSeq: 0, side: "w", actionRef: { planningOrdinal: 1, acceptedActionOrdinal: 0 } }] })).toThrow("SEQUENCE");
  });
  it.each(["extra", "getter", "sparse", "counter", "identity", "turn", "inherited"])("rejects %s provenance without mutating the input", variant => {
    const snapshot = opening(); const good = initializeProvenance(snapshot); const bad = structuredClone(good) as unknown as Record<string, unknown>;
    if (variant === "extra") bad.extra = true;
    if (variant === "getter") Object.defineProperty(bad, "turn", { get: () => { throw new Error("getter executed"); }, enumerable: true });
    if (variant === "sparse") bad.entities = new Array(2);
    if (variant === "counter") bad.unitCounter = 155;
    if (variant === "identity") (bad.entities as { id: string }[])[1]!.id = "engine:unit:1";
    if (variant === "turn") bad.turn = 1;
    if (variant === "inherited") delete bad.turn;
    expect(() => beginTurnWithProvenance({ snapshot, provenance: bad as unknown as EngineProvenance })).toThrow(/SCHEMA|CARDINALITY|ARRAY|NUMBER|ORDER|SEQUENCE/);
    expect(snapshot).toStrictEqual(opening());
  });
  it("keeps actual native promotion errors exact", () => {
    const snapshot = parseScFen("SCFEN|k7/4P3/8/8/8/8/8/K7|11|33|P|G:22:22|Q:w:;b:");
    const began = beginTurnWithProvenance({ snapshot, provenance: initializeProvenance(snapshot) });
    const malformed: ScFenSnapshot = { ...began.nativeResult.next, queue: { actions: [{ kind: "classical", timing: "C", color: "w", from: "e7", to: "e8", seq: 0 }] } };
    let nativeError: unknown;
    try { endScTurn(malformed, { skipTurnStartChecks: true }); } catch (error) { nativeError = error; }
    expect(() => endTurnWithProvenance({ snapshot: malformed, provenance: began.provenance, actionBindings: [{ sourceActionSeq: 0, side: "w", actionRef: { planningOrdinal: 0, acceptedActionOrdinal: 0 } }] })).toThrow(nativeError as Error);
  });
});
