// SPEC: _spec/packages/starchess-core/mine-contact.puml, _spec/packages/starchess-core/resolve-turn-activity.puml, _spec/packages/starchess-core/submit-turn-activity.puml
import { describe, expect, it } from "vitest";
import {
  addScAction, beginScTurn, beginTurnWithProvenance, endScTurn, endTurnWithProvenance,
  initializeProvenance, parseScFen, type EngineProvenance, type ScActionInput, type ScFenSnapshot,
} from "../index";

function window(snapshot: ScFenSnapshot, provenance: EngineProvenance, actions: ScActionInput[]) {
  const began = beginTurnWithProvenance({ snapshot, provenance });
  expect(began.nativeResult).toStrictEqual(beginScTurn(snapshot));
  let committed = began.nativeResult.next;
  for (const action of actions) committed = addScAction({ snapshot: committed, action }).snapshot;
  const own = { w: 0, b: 0 };
  const ended = endTurnWithProvenance({ snapshot: committed, provenance: began.provenance, actionBindings: (committed.queue?.actions ?? []).map(a => ({ sourceActionSeq: a.seq, side: a.color, actionRef: { planningOrdinal: Math.floor(provenance.callOrdinal / 2), acceptedActionOrdinal: own[a.color]++ } })) });
  expect(ended.nativeResult).toStrictEqual(endScTurn(committed, { skipTurnStartChecks: true }));
  return ended;
}

describe("native mine occurrence provenance", () => {
  it("rejects duplicate same-side opening squares before ID issuance", () => {
    const snapshot = parseScFen("SCFEN|7k/8/8/8/8/8/8/K7|21|33|P|G:33:33|Q:w:;b:|M:w:c3c3;b:");
    expect(() => initializeProvenance(snapshot)).toThrow("DUPLICATE");
  });

  it("issues an ID for each duplicate append and removes every occurrence in native square-filter order", () => {
    const initial = parseScFen("SCFEN|7k/8/8/8/5p2/8/2N5/K7|21|33|P|G:33:33|Q:w:;b:|M:w:e3;b:e3");
    const duplicate = [
      { kind: "spiderMine", timing: "F", color: "w", from: "c2", to: "c2" },
      { kind: "classical", timing: "C", color: "w", from: "c2", to: "e3" },
    ] satisfies ScActionInput[];
    const first = window(initial, initializeProvenance(initial), duplicate);
    expect(first.provenance.nativeMineOrder).toStrictEqual(["engine:mine:1", "engine:mine:2", "engine:mine:3"]);
    expect(first.frames.flatMap(f => f.effects).filter(e => e.kind === "mine-create")).toStrictEqual([{ kind: "mine-create", entity: { id: "engine:mine:3", kind: "mine", side: "w", square: "e3" }, sourceActionSeq: 0 }]);
    const returned = window(first.nativeResult.next, first.provenance, [{ kind: "classical", timing: "C", color: "w", from: "e3", to: "c2" }]);
    const second = window(returned.nativeResult.next, returned.provenance, duplicate);
    expect(second.provenance.nativeMineOrder).toStrictEqual(["engine:mine:1", "engine:mine:2", "engine:mine:3", "engine:mine:4"]);
    expect(second.nativeResult.next.mines).toStrictEqual([{ color: "w", at: "e3" }, { color: "b", at: "e3" }, { color: "w", at: "e3" }, { color: "w", at: "e3" }]);
    const third = window(second.nativeResult.next, second.provenance, [{ kind: "classical", timing: "C", color: "b", from: "f4", to: "e3" }]);
    expect(third.frames[0]?.effects.filter(e => e.kind === "mine-remove").map(e => e.entityId)).toStrictEqual(["engine:mine:1", "engine:mine:2", "engine:mine:3", "engine:mine:4"]);
    expect(third.frames[0]?.before.nativeMineOrder).toStrictEqual(second.provenance.nativeMineOrder);
    expect(third.frames[0]?.after.nativeMineOrder).toStrictEqual([]);
    expect(third.nativeResult.next.mines).toBeUndefined();
    expect(third.provenance.mineCounter).toBe(4);
    expect(third.provenance.nativeMineOrder).toStrictEqual([]);
    expect(third.provenance.resolvedActions[0]?.actionRef.planningOrdinal).toBe(3);
  });

  it.each([true, false])("respects the first occurrence with friendly-first=%s", friendlyFirst => {
    const initial = parseScFen("SCFEN|7k/8/8/8/8/8/4P3/K7|21|33|P|G:33:33|Q:w:;b:");
    initial.mines = friendlyFirst ? [{ color: "w", at: "e3" }, { color: "b", at: "e3" }] : [{ color: "b", at: "e3" }, { color: "w", at: "e3" }];
    const ended = window(initial, initializeProvenance(initial), [{ kind: "stimStep", timing: "B", color: "w", from: "e2", to: "e3" }]);
    expect(ended.nativeResult.next.mines ?? []).toStrictEqual(friendlyFirst ? initial.mines : []);
    expect(ended.frames).toHaveLength(friendlyFirst ? 1 : 2);
    if (!friendlyFirst) expect(ended.frames[1]?.effects.map(e => e.kind)).toStrictEqual(["mine-remove", "mine-remove", "unit-destroy"]);
    expect(ended.provenance.nativeMineOrder).toStrictEqual(friendlyFirst ? ["engine:mine:1", "engine:mine:2"] : []);
  });

  it("records landed-live deaths after an atomic delayed swap and keeps survivor order", () => {
    const initial = parseScFen("SCFEN|r3k3/8/8/8/8/8/8/R3K3|1|33|P|G:11:11|Q:w:;b:|S:a1a8|M:w:a1h4;b:a8h5");
    const ended = window(initial, initializeProvenance(initial), [
      { kind: "classical", timing: "C", color: "w", from: "a1", to: "a8" },
      { kind: "classical", timing: "C", color: "b", from: "a8", to: "a1" },
    ]);
    expect(ended.frames).toHaveLength(3);
    expect(ended.frames[0]?.effects.map(e => e.kind)).toStrictEqual(["unit-move", "unit-move"]);
    expect(ended.frames[1]?.effects.find(e => e.kind === "unit-destroy")).toMatchObject({ entity: { id: "engine:unit:1", square: "a8" }, sourceActionSeq: 0 });
    expect(ended.frames[2]?.effects.find(e => e.kind === "unit-destroy")).toMatchObject({ entity: { id: "engine:unit:2", square: "a1" }, sourceActionSeq: 1 });
    expect(ended.provenance.nativeMineOrder).toStrictEqual(["engine:mine:2", "engine:mine:4"]);
    expect(ended.nativeResult.next.mines).toStrictEqual([{ color: "w", at: "h4" }, { color: "b", at: "h5" }]);
    expect(ended.frames.flatMap(f => f.effects).filter(e => e.kind === "mine-remove")).toHaveLength(2);
  });

  it("keeps the chase wake distinct from the live victim position", () => {
    const initial = parseScFen("SCFEN|4k3/8/8/8/8/8/4P3/4K3|0|33|P|G:11:11|Q:w:;b:|M:w:;b:e3");
    const ended = window(initial, initializeProvenance(initial), [{ kind: "classical", timing: "C", color: "w", from: "e2", to: "e4" }]);
    expect(ended.frames).toHaveLength(2);
    expect(ended.frames[1]?.before.entities).toContainEqual({ id: "engine:unit:2", kind: "unit", side: "w", type: "p", square: "e4", tankMode: null });
    expect(ended.frames[1]?.before.entities).toContainEqual({ id: "engine:mine:1", kind: "mine", side: "b", square: "e3" });
    expect(ended.nativeResult.resolved.mineTriggers[0]).toMatchObject({ to: "e4", chaseFrom: "e3" });
  });
});
