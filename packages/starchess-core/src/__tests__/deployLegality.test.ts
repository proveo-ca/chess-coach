// SPEC: _spec/packages/starchess-core/sc-moves.puml, _spec/packages/starchess-core/scfen-queue.puml, _spec/packages/starchess-core/resolve.puml, _spec/packages/starchess-core/gas-phase-vacancy.puml
import { describe, expect, it, vi } from "vitest";
import * as publicCore from "../index";
import * as publicPlanning from "../planning-v1";
import {
  AddScActionError, ScValidateError, addScAction, assertClassicalBaseline, beginScTurn,
  beginTurnWithProvenance, endTurnWithProvenance, initializeProvenance, endScTurn, mapToPlacement,
  parseScFen, placementToMap, removeScAction, resolveTurn, formatScFen,
  type ActionBindings, type ScActionInput, type ScFenSnapshot, type ScPiece, type Square,
} from "../index";

const original = "SCFEN|4kb2/8/7R/8/8/8/8/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";
const birth: ScActionInput = { timing: "B", kind: "deploy", color: "b", from: "e8", to: "f8", unit: "n" };
const stale: ScActionInput = { timing: "C", kind: "classical", color: "b", from: "f8", to: "h6" };
const queue = (snapshot: ScFenSnapshot, actions: readonly ScActionInput[]) =>
  actions.reduce((s, action) => addScAction({ snapshot: s, action }).snapshot, snapshot);
const injected = (snapshot: ScFenSnapshot, actions: readonly ScActionInput[]): ScFenSnapshot =>
  ({ ...snapshot, queue: { actions: actions.map((a, seq) => ({ ...a, seq })) } });
const refuses = (run: () => unknown, family: typeof AddScActionError | typeof ScValidateError = ScValidateError,
  code = "SC_BASELINE_FEN") => {
  let caught: unknown;
  try { run(); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(family);
  expect(caught).toMatchObject({ code });
};
const board = (entries: readonly (readonly [Square, ScPiece])[]): ScFenSnapshot => ({
  placement: mapToPlacement(new Map(entries)), turn: 21, phase: "P", ccLives: { w: 3, b: 3 },
  gas: { w: 3, b: 3 }, gasIncome: { w: 3, b: 3 }, stored: { w: 12, b: 12 }, queue: { actions: [] },
});
const c = (from: Square, to: Square, color: "w" | "b" = "w"): ScActionInput =>
  ({ timing: "C", kind: "classical", color, from, to });

describe("native effective classical actor", () => {
  it.each(["w", "b"] as const)("does not let a later B replacement hide illegal insertion promotion for %s", color => {
    const from: Square = color === "w" ? "e7" : "e2";
    const to: Square = color === "w" ? "e8" : "e1";
    const cc: Square = color === "w" ? "d7" : "d2";
    const enemy: Square = color === "w" ? "h1" : "h8";
    const start = board([[cc, { type: "k", color }], [enemy, { type: "k", color: color === "w" ? "b" : "w" }],
      [from, { type: "p", color }]]);
    const replacement: ScActionInput = { timing: "B", kind: "deploy", color, from: cc, to: from, unit: "r" };
    const snapshot = injected(start, [c(from, to, color), replacement]);
    snapshot.gas = { ...start.gas, [color]: 2 };
    const before = structuredClone(snapshot);
    for (const input of [snapshot, parseScFen(formatScFen(snapshot))]) {
      for (const opts of [undefined, { skipTurnStartChecks: true }]) {
        refuses(() => endScTurn(input, opts), ScValidateError, "SC_SPECIAL");
        expect(input).toStrictEqual(before);
      }
    }
    const action = snapshot.queue!.actions[0]!;
    if (action.timing !== "C") throw new Error("expected C fixture");
    refuses(() => assertClassicalBaseline(snapshot, action), ScValidateError, "SC_SPECIAL");
  });

  it("returns no provenance companion when a later replacement masks unlawful insertion promotion", () => {
    const opening = board([["d7", { type: "k", color: "w" }], ["h1", { type: "k", color: "b" }],
      ["e7", { type: "p", color: "w" }]]);
    const initialized = initializeProvenance(opening);
    const began = beginTurnWithProvenance({ snapshot: opening, provenance: initialized });
    const snapshot = injected(began.nativeResult.next, [c("e7", "e8"),
      { timing: "B", kind: "deploy", color: "w", from: "d7", to: "e7", unit: "r" }]);
    snapshot.gas = { ...snapshot.gas, w: 2 };
    const actionBindings: ActionBindings = snapshot.queue!.actions.map((a, ordinal) => ({
      sourceActionSeq: a.seq, side: a.color, actionRef: { planningOrdinal: 0, acceptedActionOrdinal: ordinal },
    }));
    const before = structuredClone({ opening, initialized, began, snapshot, actionBindings });
    let returned: unknown;
    refuses(() => { returned = endTurnWithProvenance({ snapshot, provenance: began.provenance, actionBindings }); },
      ScValidateError, "SC_SPECIAL");
    expect(returned).toBeUndefined();
    expect({ opening, initialized, began, snapshot, actionBindings }).toStrictEqual(before);
  });

  it("retains insertion siege constraints before a later non-Tank replacement", () => {
    const start = { ...board([["d2", { type: "k", color: "w" }], ["h8", { type: "k", color: "b" }],
      ["e2", { type: "r", color: "w" }]]), siegedTanks: ["e2" as Square],
      mines: [{ at: "e4" as Square, color: "w" as const }] };
    const replacement: ScActionInput = { timing: "B", kind: "deploy", color: "w", from: "d2", to: "e2", unit: "p" };
    const snapshot = injected(start, [c("e2", "e4"), replacement]);
    for (const opts of [undefined, { skipTurnStartChecks: true }]) {
      refuses(() => endScTurn(snapshot, opts), ScValidateError, "SC_SPECIAL");
    }
    const legal = queue(start, [replacement, c("e2", "e4")]);
    expect(placementToMap(endScTurn(legal, { skipTurnStartChecks: true }).next.placement).get("e4"))
      .toStrictEqual({ type: "p", color: "w" });
  });

  it("keeps insertion geometry refusal ahead of a later actor's promotion requirement", () => {
    const start = board([["d7", { type: "k", color: "w" }], ["h1", { type: "k", color: "b" }],
      ["e7", { type: "n", color: "w" }]]);
    const snapshot = injected(start, [c("e7", "e8"),
      { timing: "B", kind: "deploy", color: "w", from: "d7", to: "e7", unit: "p" }]);
    for (const opts of [undefined, { skipTurnStartChecks: true }]) refuses(() => endScTurn(snapshot, opts));
  });

  it.each(["w", "b"] as const)("preserves B-first replacement type without a dead Marine promotion requirement for %s", color => {
    const from: Square = color === "w" ? "e7" : "e2";
    const to: Square = color === "w" ? "e8" : "e1";
    const cc: Square = color === "w" ? "d7" : "d2";
    const enemy: Square = color === "w" ? "h1" : "h8";
    const start = board([[cc, { type: "k", color }], [enemy, { type: "k", color: color === "w" ? "b" : "w" }],
      [from, { type: "p", color }]]);
    const snapshot = queue(start, [{ timing: "B", kind: "deploy", color, from: cc, to: from, unit: "r" }, c(from, to, color)]);
    for (const opts of [undefined, { skipTurnStartChecks: true }]) {
      expect(placementToMap(endScTurn(snapshot, opts).next.placement).get(to)).toStrictEqual({ type: "r", color });
    }
  });

  it.each(["w", "b"] as const)("rejects an injected two-rank matched B witness in direct/wire End for %s", color => {
    const from: Square = color === "w" ? "e2" : "e7";
    const to: Square = color === "w" ? "e4" : "e5";
    const start = board([["a1", { type: "k", color: "w" }], ["h8", { type: "k", color: "b" }], [from, { type: "p", color }]]);
    const snapshot = injected(start, [{ timing: "B", kind: "stimStep", color, from, to }, c(from, to, color)]);
    snapshot.gas = { ...start.gas, [color]: 2 };
    for (const input of [snapshot, parseScFen(formatScFen(snapshot))]) {
      const before = structuredClone(input);
      for (const opts of [undefined, { skipTurnStartChecks: true }]) {
        refuses(() => endScTurn(input, opts));
        expect(input).toStrictEqual(before);
      }
    }
  });

  it.each(["p", "n"] as const)("preserves an own siege flag produced by legal F replacement %s", unit => {
    const start = { ...board([["d2", { type: "k", color: "w" }], ["h8", { type: "k", color: "b" }],
      ["e2", { type: "r", color: "w" }]]), siegedTanks: ["e2" as Square],
      mines: [{ at: "e4" as Square, color: "w" as const }] };
    const afterF = endScTurn(queue(beginScTurn(start).next, [
      { timing: "F", kind: "deploy", color: "w", from: "d2", to: "e2", unit },
    ]), { skipTurnStartChecks: true }).next;
    expect(placementToMap(afterF.placement).get("e2")).toStrictEqual({ type: unit, color: "w" });
    expect(afterF.siegedTanks).toStrictEqual(["e2"]);
    const next = beginScTurn(afterF).next;
    const replacement: ScActionInput = { timing: "B", kind: "deploy", color: "w", from: "d2", to: "e2", unit: "r" };
    const replaced = queue(next, [replacement]);
    const before = structuredClone(replaced);
    refuses(() => queue(replaced, [c("e2", "e4")]), AddScActionError, "SC_SPECIAL");
    expect(replaced).toStrictEqual(before);
    const shelling = endScTurn(queue(replaced, [c("e2", "e3")]), { skipTurnStartChecks: true });
    expect(shelling.resolved.attacks).toContainEqual(expect.objectContaining({ kind: "shelling", from: "e2", to: "e3" }));
    expect(placementToMap(shelling.next.placement).get("e2")).toStrictEqual({ type: "r", color: "w" });
    const differentType = queue(next, [c("e2", unit === "p" ? "e3" : "g3")]);
    expect(placementToMap(endScTurn(differentType, { skipTurnStartChecks: true }).next.placement)
      .get(unit === "p" ? "e3" : "g3")).toStrictEqual({ type: unit, color: "w" });
  });

  it("keeps native eligibility and double issuance outside both public entry points", () => {
    for (const entry of [publicCore, publicPlanning]) {
      for (const name of ["nativeClassicalChecks", "nativeClassicalEligibility", "matchedMarineDouble", "consumeNativeClassicalDoubles",
        "assertActionAdmission", "assertNativeClassicalDependencies"]) expect(Object.hasOwn(entry, name)).toBe(false);
    }
  });

  it.each([true, false])("rejects the original replacement capture in either append order (birth first=%s)", first => {
    const start = parseScFen(original);
    const accepted = queue(start, [first ? birth : stale]);
    const before = structuredClone(accepted);
    refuses(() => queue(accepted, [first ? stale : birth]), AddScActionError);
    expect(accepted).toStrictEqual(before);
    expect(start).toStrictEqual(parseScFen(original));
  });

  it.each([true, false])("rejects the mirrored White replacement capture in either append order (birth first=%s)", first => {
    const start = board([["e1", { type: "k", color: "w" }], ["e8", { type: "k", color: "b" }],
      ["f1", { type: "b", color: "w" }], ["h3", { type: "r", color: "b" }]]);
    const replacement: ScActionInput = { timing: "B", kind: "deploy", color: "w", from: "e1", to: "f1", unit: "n" };
    const old = c("f1", "h3");
    const accepted = queue(start, [first ? replacement : old]);
    const before = structuredClone(accepted);
    refuses(() => queue(accepted, [first ? old : replacement]), AddScActionError);
    expect(accepted).toStrictEqual(before);
  });

  it.each([undefined, { skipTurnStartChecks: true }])("rejects direct/wire End before settlement in both modes (%j)", opts => {
    const snapshot = injected(parseScFen(original), [birth, stale]);
    snapshot.gas = { w: 1, b: 0 };
    for (const input of [snapshot, parseScFen(formatScFen(snapshot))]) {
      const before = structuredClone(input);
      refuses(() => endScTurn(input, opts));
      expect(input).toStrictEqual(before);
    }
  });

  it("refuses essential birth removal atomically, then refunds after C removal", () => {
    const start = parseScFen(original.replace("4kb2", "4k3"));
    const snapshot = queue(start, [birth, c("f8", "h7", "b")]);
    const before = structuredClone(snapshot);
    refuses(() => removeScAction({ snapshot, seq: 0 }));
    expect(snapshot).toStrictEqual(before);
    const withoutC = removeScAction({ snapshot, seq: 1 }).snapshot;
    const empty = removeScAction({ snapshot: withoutC, seq: 0 }).snapshot;
    expect(empty.gas).toStrictEqual(start.gas);
    expect(empty.queue?.actions).toStrictEqual([]);
  });

  it.each([false, true])("guards both direct C actors before any visibility callback (reverse=%s)", reverse => {
    const snapshot = reverse
      ? board([["e1", { type: "k", color: "w" }], ["e8", { type: "k", color: "b" }],
        ["f1", { type: "n", color: "w" }], ["a7", { type: "r", color: "b" }]])
      : board([["e1", { type: "k", color: "w" }], ["e8", { type: "k", color: "b" }],
        ["a2", { type: "r", color: "w" }], ["f8", { type: "n", color: "b" }]]);
    const isTargetVisible = vi.fn(() => true);
    refuses(() => resolveTurn({ placement: snapshot.placement, ccLives: snapshot.ccLives,
      white: reverse ? { color: "w", from: "f1", to: "h3" } : { color: "w", from: "a2", to: "a3" },
      black: reverse ? { color: "b", from: "a7", to: "a6" } : { color: "b", from: "f8", to: "h6" },
      isTargetVisible }));
    expect(isTargetVisible).not.toHaveBeenCalled();
  });

  it("rejects caller extra-step entitlement", () => {
    refuses(() => resolveTurn({ placement: "7k/8/8/8/8/4P3/8/K7", ccLives: { w: 3, b: 3 },
      white: { color: "w", from: "e3", to: "e5", extraStepFrom: "e3", extraStepTo: "e6" }, black: null }));
  });

  it("does not fabricate a double witness for an equal-type/square replacement moved by Black", () => {
    const snapshot = queue(parseScFen("SCFEN|7k/8/8/8/3Kp3/8/4P3/8|11|33|P|G:22:22|B:3:3|Q:w:;b:"), [
      { timing: "B", kind: "stimStep", color: "w", from: "e2", to: "e3" },
      { timing: "B", kind: "deploy", color: "w", from: "d4", to: "e4", unit: "p" },
      c("e2", "e4"),
      { timing: "B", kind: "stimStep", color: "b", from: "e4", to: "e3" },
    ]);
    const before = structuredClone(snapshot);
    refuses(() => endScTurn(snapshot, { skipTurnStartChecks: true }));
    expect(snapshot).toStrictEqual(before);
  });

  it.each(["w", "b"] as const)("preserves matched translated Marine double for %s", color => {
    const from = color === "w" ? "e2" : "e7";
    const to = color === "w" ? "e3" : "e6";
    const target = color === "w" ? "e4" : "e5";
    const final = color === "w" ? "e5" : "e4";
    const snapshot = board([["a1", { type: "k", color: "w" }], ["h8", { type: "k", color: "b" }],
      [from, { type: "p", color }]]);
    for (const actions of [[{ timing: "B", kind: "stimStep", color, from, to } as ScActionInput, c(from, target, color)],
      [c(from, target, color), { timing: "B", kind: "stimStep", color, from, to } as ScActionInput]]) {
      const result = endScTurn(queue(snapshot, actions), { skipTurnStartChecks: true });
      expect(placementToMap(result.next.placement).get(final)).toStrictEqual({ type: "p", color });
      expect(result.resolved.moves).toStrictEqual([{ piece: "p", color, from: to, to: final }]);
    }
  });

  it("accepts newborn L geometry and preserves old Mecha before an F replacement", () => {
    const newborn = endScTurn(queue(parseScFen(original), [birth, c("f8", "h7", "b")]), { skipTurnStartChecks: true });
    expect(placementToMap(newborn.next.placement).get("h7")).toStrictEqual({ type: "n", color: "b" });
    const retained = endScTurn(queue(parseScFen(original), [stale, { ...birth, timing: "F" }]), { skipTurnStartChecks: true });
    expect(placementToMap(retained.next.placement).get("h6")).toStrictEqual({ type: "b", color: "b" });
    const captureStart = parseScFen(original.replace("8/7R", "7R/8"));
    const capture = endScTurn(queue(captureStart, [birth, c("f8", "h7", "b")]), { skipTurnStartChecks: true });
    expect(capture.resolved.attacks).toContainEqual(expect.objectContaining({ kind: "capture", piece: "n", from: "f8", to: "h7" }));
    refuses(() => queue(queue(parseScFen(original.replace("7R", "8")), [birth]), [stale]), AddScActionError);
  });

  it.each(["w", "b"] as const)("preserves B-first non-start fizzle but rejects C-first and B removal for %s", color => {
    const from = color === "w" ? "e5" : "e4";
    const to = color === "w" ? "e6" : "e3";
    const target = color === "w" ? "e7" : "e2";
    const start = board([["a1", { type: "k", color: "w" }], ["h8", { type: "k", color: "b" }],
      [from, { type: "p", color }]]);
    refuses(() => queue(start, [c(from, target, color)]), AddScActionError);
    const snapshot = queue(start, [{ timing: "B", kind: "stimStep", color, from, to }, c(from, target, color)]);
    const before = structuredClone(snapshot);
    refuses(() => removeScAction({ snapshot, seq: 0 }));
    expect(snapshot).toStrictEqual(before);
    const result = endScTurn(snapshot, { skipTurnStartChecks: true });
    expect(result.resolved.moves).toStrictEqual([]);
    expect(placementToMap(result.next.placement).get(to)).toStrictEqual({ type: "p", color });
  });

  it("rejects a later refill of a non-start fizzle origin without undoing the accepted prefix", () => {
    const start = board([["d5", { type: "k", color: "w" }], ["h8", { type: "k", color: "b" }],
      ["e5", { type: "p", color: "w" }]]);
    const snapshot = queue(start, [{ timing: "B", kind: "stimStep", color: "w", from: "e5", to: "e6" }, c("e5", "e7")]);
    const before = structuredClone(snapshot);
    refuses(() => queue(snapshot, [{ timing: "B", kind: "deploy", color: "w", from: "d5", to: "e5", unit: "p" }]), AddScActionError);
    expect(snapshot).toStrictEqual(before);
  });

  it("does not let a newborn at a blocked matched stim arrival inherit a double", () => {
    const start = board([["d3", { type: "k", color: "w" }], ["h8", { type: "k", color: "b" }],
      ["e2", { type: "p", color: "w" }]]);
    const snapshot = queue(start, [{ timing: "B", kind: "deploy", color: "w", from: "d3", to: "e3", unit: "p" },
      { timing: "B", kind: "stimStep", color: "w", from: "e2", to: "e3" }]);
    refuses(() => queue(snapshot, [c("e2", "e4")]), AddScActionError);
  });

  it("allows replacement Marines actually taking the eligible matched B step", () => {
    const start = board([["d2", { type: "k", color: "w" }], ["h8", { type: "k", color: "b" }],
      ["e2", { type: "p", color: "w" }]]);
    const snapshot = queue(start, [{ timing: "B", kind: "deploy", color: "w", from: "d2", to: "e2", unit: "p" },
      { timing: "B", kind: "stimStep", color: "w", from: "e2", to: "e3" }, c("e2", "e4")]);
    const result = endScTurn(snapshot, { skipTurnStartChecks: true });
    expect(result.resolved.moves).toStrictEqual([{ piece: "p", color: "w", from: "e3", to: "e5" }]);
  });

  it("transfers current replacement type rather than granting the stim descriptor's Marine shape", () => {
    const start = board([["d2", { type: "k", color: "w" }], ["h8", { type: "k", color: "b" }],
      ["e2", { type: "p", color: "w" }]]);
    const snapshot = queue(start, [{ timing: "B", kind: "deploy", color: "w", from: "d2", to: "e2", unit: "n" },
      { timing: "B", kind: "stimStep", color: "w", from: "e2", to: "e3" }]);
    refuses(() => queue(snapshot, [c("e2", "e4")]), AddScActionError);
    const valid = queue(snapshot, [c("e3", "f5")]);
    expect(placementToMap(endScTurn(valid, { skipTurnStartChecks: true }).next.placement).get("f5"))
      .toStrictEqual({ type: "n", color: "w" });
  });

  it("does not apply dead Marine last-rank promotion or dead Tank siege obligations to a replacement", () => {
    const marine = board([["f7", { type: "k", color: "w" }], ["a8", { type: "k", color: "b" }],
      ["g7", { type: "p", color: "w" }]]);
    const promotedType = queue(marine, [{ timing: "B", kind: "deploy", color: "w", from: "f7", to: "g7", unit: "n" },
      c("g7", "e8")]);
    expect(placementToMap(endScTurn(promotedType, { skipTurnStartChecks: true }).next.placement).get("e8"))
      .toStrictEqual({ type: "n", color: "w" });
    const tank = { ...board([["d2", { type: "k", color: "w" }], ["h8", { type: "k", color: "b" }],
      ["e2", { type: "r", color: "w" }]]), siegedTanks: ["e2" as Square] };
    const unsiegedType = queue(tank, [{ timing: "B", kind: "deploy", color: "w", from: "d2", to: "e2", unit: "n" }, c("e2", "g3")]);
    expect(placementToMap(endScTurn(unsiegedType, { skipTurnStartChecks: true }).next.placement).get("g3"))
      .toStrictEqual({ type: "n", color: "w" });
  });

  it("allows same-origin shared-shape fallback on removal with stable retained sequences", () => {
    const start = board([["d2", { type: "k", color: "w" }], ["h8", { type: "k", color: "b" }],
      ["e2", { type: "q", color: "w" }], ["b1", { type: "n", color: "w" }]]);
    const snapshot = queue(start, [{ timing: "B", kind: "deploy", color: "w", from: "d2", to: "e2", unit: "b" },
      c("e2", "g4"), { timing: "F", kind: "spiderMine", color: "w", from: "b1" }]);
    const result = removeScAction({ snapshot, seq: 0 }).snapshot;
    expect(result.queue?.actions.map(a => a.seq)).toStrictEqual([1, 2]);
    expect(result.gas.w).toBe(2);
    expect(placementToMap(endScTurn(result, { skipTurnStartChecks: true }).next.placement).get("g4"))
      .toStrictEqual({ type: "q", color: "w" });
  });

  it("refuses removal when the original same-side fallback has the wrong shape", () => {
    const start = board([["d2", { type: "k", color: "w" }], ["h8", { type: "k", color: "b" }],
      ["e2", { type: "p", color: "w" }]]);
    const snapshot = queue(start, [{ timing: "B", kind: "deploy", color: "w", from: "d2", to: "e2", unit: "n" }, c("e2", "g3")]);
    const before = structuredClone(snapshot);
    refuses(() => removeScAction({ snapshot, seq: 0 }));
    expect(snapshot).toStrictEqual(before);
  });

  it("rejects essential arrival removal and future-B authorship borrowing", () => {
    const start = board([["a1", { type: "k", color: "w" }], ["h8", { type: "k", color: "b" }],
      ["e2", { type: "p", color: "w" }]]);
    const step: ScActionInput = { timing: "B", kind: "stimStep", color: "w", from: "e2", to: "e3" };
    const move = c("e3", "e4");
    refuses(() => queue(start, [move]), AddScActionError);
    refuses(() => endScTurn(injected(start, [move, step]), { skipTurnStartChecks: true }));
    const snapshot = queue(start, [step, move]);
    const before = structuredClone(snapshot);
    refuses(() => removeScAction({ snapshot, seq: 0 }));
    expect(snapshot).toStrictEqual(before);
  });

  it("retains F append-time anchors and never reruns their legality under later C", () => {
    const start = { ...board([["a1", { type: "k", color: "w" }], ["h8", { type: "k", color: "b" }],
      ["b1", { type: "n", color: "w" }]]), mines: [{ at: "c3" as Square, color: "w" as const }] };
    const snapshot = queue(start, [{ timing: "F", kind: "spiderMine", color: "w", from: "b1" }, c("b1", "c3")]);
    expect(snapshot.queue?.actions.map(a => a.seq)).toStrictEqual([0, 1]);
    expect(snapshot.gas.w).toBe(2);
    expect(removeScAction({ snapshot, seq: 1 }).snapshot.queue?.actions.map(a => a.seq)).toStrictEqual([0]);
  });

  it("preserves existing queue/gas refusals ahead of later B dependency invalidation", () => {
    const authored = queue(parseScFen(original), [stale]);
    const noGas = { ...authored, gas: { w: 1, b: 0 } };
    refuses(() => queue(noGas, [birth]), AddScActionError, "SC_GAS");
    const duplicate = queue(authored, [{ ...birth, timing: "F" }]);
    refuses(() => queue(duplicate, [birth]), AddScActionError, "SC_QUEUE_SHAPE");
    refuses(() => queue(duplicate, [c("f8", "h7", "b")]), AddScActionError, "SC_QUEUE_SHAPE");
  });

  it("preflights an invalid queue before an early turn-open terminal result", () => {
    const start = board([["a1", { type: "k", color: "w" }], ["a8", { type: "k", color: "b" }],
      ["a7", { type: "r", color: "w" }], ["f8", { type: "n", color: "b" }]]);
    const snapshot = injected({ ...start, ccLives: { w: 3, b: 1 } }, [stale]);
    refuses(() => endScTurn(snapshot));
  });

  it.each(["p", "n", "b", "r", "q"] as const)("keeps native held promotion ownership for replacement %s", unit => {
    const start = parseScFen("SCFEN|k4p2/4PK2/8/8/8/8/8/8|21|33|P|G:33:33|B:12:12|Q:w:;b:");
    const snapshot = queue(start, [{ timing: "B", kind: "stimStep", color: "w", from: "e7", to: "e8", promotion: "q" },
      { timing: "B", kind: "deploy", color: "w", from: "f7", to: "e8", unit },
      { ...c("e7", "f8"), promotion: "q" }]);
    const result = endScTurn(snapshot, { skipTurnStartChecks: true });
    expect(placementToMap(result.next.placement).get("e8")).toStrictEqual({ color: "w", type: unit === "p" ? "q" : unit });
    expect(result.resolved.moves).toStrictEqual([]);
    expect(result.resolved.promotions).toStrictEqual(unit === "p" ? [{ color: "w", from: "e7", at: "e8", unit: "q" }] : []);
  });

  it.each(["w", "b"] as const)("keeps shifted promotion errors at End and blocked drops for %s", color => {
    const from: Square = color === "w" ? "e6" : "e3";
    const to: Square = color === "w" ? "e7" : "e2";
    const last: Square = color === "w" ? "e8" : "e1";
    const entries: [Square, ScPiece][] = [["a1", { type: "k", color: "w" }], ["h8", { type: "k", color: "b" }],
      [from, { type: "p", color }]];
    const actions: ScActionInput[] = [{ timing: "B", kind: "stimStep", color, from, to }, c(from, to, color)];
    const snapshot = queue(board(entries), actions);
    let error: unknown;
    try { endScTurn(snapshot, { skipTurnStartChecks: true }); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ScValidateError);
    expect((error as Error).message).toBe(`endScTurn: classical last-rank ${to}→${last} needs promotion`);
    const blocked = queue(board([...entries, [last, { type: "r", color: color === "w" ? "b" : "w" }]]), actions);
    const result = endScTurn(blocked, { skipTurnStartChecks: true });
    expect(result.resolved.moves).toStrictEqual([]);
    expect(placementToMap(result.next.placement).get(to)).toStrictEqual({ type: "p", color });
    const promoted = queue(board(entries), [actions[0]!, { ...actions[1]!, promotion: "n" }]);
    expect(placementToMap(endScTurn(promoted, { skipTurnStartChecks: true }).next.placement).get(last))
      .toStrictEqual({ type: "n", color });
  });

  it("checks an actual own replacement even when prospective C was a native drop", () => {
    const snapshot = injected(board([["d6", { type: "k", color: "w" }], ["h8", { type: "k", color: "b" }],
      ["e5", { type: "p", color: "w" }], ["e6", { type: "p", color: "b" }]]), [
      { timing: "B", kind: "stimStep", color: "w", from: "e5", to: "e6" }, c("e5", "e7"),
      { timing: "B", kind: "deploy", color: "w", from: "d6", to: "e6", unit: "p" },
      { timing: "B", kind: "stimStep", color: "b", from: "e6", to: "e5" },
    ]);
    refuses(() => endScTurn(snapshot, { skipTurnStartChecks: true }));
  });

  it("does not confuse duplicate caller sequences with the exact matched native operation", () => {
    const start = board([["d2", { type: "k", color: "w" }], ["h8", { type: "k", color: "b" }],
      ["e2", { type: "p", color: "w" }]]);
    const snapshot = injected(start, [{ timing: "B", kind: "stimStep", color: "w", from: "e2", to: "e3" },
      { timing: "B", kind: "deploy", color: "w", from: "d2", to: "e2", unit: "p" }, c("e2", "e4"),
      { timing: "B", kind: "stimStep", color: "b", from: "e2", to: "e3" }]);
    snapshot.queue = { actions: snapshot.queue!.actions.map(a => a.color === "b" ? { ...a, seq: 0 } : a) };
    refuses(() => endScTurn(snapshot, { skipTurnStartChecks: true }));
  });

  it("cannot carry native double entitlement into a later direct call", () => {
    const start = board([["a1", { type: "k", color: "w" }], ["h8", { type: "k", color: "b" }],
      ["e2", { type: "p", color: "w" }]]);
    const native = endScTurn(queue(start, [{ timing: "B", kind: "stimStep", color: "w", from: "e2", to: "e3" }, c("e2", "e4")]),
      { skipTurnStartChecks: true });
    expect(native.resolved.moves).toStrictEqual([{ piece: "p", color: "w", from: "e3", to: "e5" }]);
    refuses(() => resolveTurn({ placement: native.afterB.placement, ccLives: start.ccLives,
      white: { color: "w", from: "e3", to: "e5" }, black: null }));
  });

  it.each(["w", "b"] as const)("uses captured legal coordinates when a visibility callback mutates the caller's %s plan", color => {
    const start = board([["a1", { type: "k", color: "w" }], ["h8", { type: "k", color: "b" }],
      ["d4", { type: "n", color: "w" }], ["d5", { type: "n", color: "b" }]]);
    const white = { color: "w" as const, from: "d4" as Square, to: "f5" as Square };
    const black = { color: "b" as const, from: "d5" as Square, to: "f4" as Square };
    const isTargetVisible = vi.fn((viewer: "w" | "b") => {
      if (viewer !== color) {
        if (color === "w") white.to = "f6";
        else black.to = "f3";
      }
      return true;
    });
    const result = resolveTurn({ placement: start.placement, ccLives: start.ccLives, white, black, isTargetVisible });
    expect(isTargetVisible).toHaveBeenCalled();
    expect(color === "w" ? white.to : black.to).toBe(color === "w" ? "f6" : "f3");
    expect(result.moves).toStrictEqual([{ piece: "n", color: "w", from: "d4", to: "f5" },
      { piece: "n", color: "b", from: "d5", to: "f4" }]);
    expect(placementToMap(result.afterAll.placement).get("f5")).toStrictEqual({ type: "n", color: "w" });
    expect(placementToMap(result.afterAll.placement).get("f4")).toStrictEqual({ type: "n", color: "b" });
    expect(placementToMap(result.afterAll.placement).has(color === "w" ? "f6" : "f3")).toBe(false);
  });

  it("preserves missing/foreign direct drops and legal empty Marine diagonals", () => {
    for (const placement of ["7k/8/8/8/8/8/8/K7", "5N1k/8/8/8/8/8/8/K7"]) {
      const result = resolveTurn({ placement, ccLives: { w: 3, b: 3 }, white: null,
        black: { color: "b", from: "f8", to: "h6" } });
      expect(result.moves).toStrictEqual([]);
      expect(result.attacks).toStrictEqual([]);
    }
    const start = board([["a1", { type: "k", color: "w" }], ["h8", { type: "k", color: "b" }],
      ["e2", { type: "p", color: "w" }]]);
    expect(endScTurn(queue(start, [c("e2", "f3")]), { skipTurnStartChecks: true }).resolved.moves).toStrictEqual([]);
  });
});

describe("native side-aware quiet/capture geometry", () => {
  const shapes: readonly (readonly [ScPiece["type"], Square, Square, Square])[] = [
    ["p", "d4", "d5", "e5"], ["n", "d4", "f5", "f5"], ["b", "d4", "f6", "f6"],
    ["r", "d4", "d6", "d6"], ["q", "d4", "f6", "f6"], ["k", "d4", "e5", "e5"],
  ];
  for (const [type, from, quiet, capture] of shapes) {
    it.each(["w", "b"] as const)(`admits ${type} quiet/capture shapes and rejects a no-op for %s`, color => {
      const mirror = (at: Square): Square => color === "w" ? at : `${at[0]}${9 - Number(at[1])}` as Square;
      const origin = mirror(from);
      const entries: [Square, ScPiece][] = [["a1", { type: "k", color: "w" }], ["h8", { type: "k", color: "b" }]];
      if (type === "k") entries[color === "w" ? 0 : 1] = [origin, { type, color }];
      else entries.push([origin, { type, color }]);
      const start = board(entries);
      refuses(() => queue(start, [c(origin, origin, color)]), AddScActionError);
      const invalid = mirror(type === "n" ? "d5" : type === "b" ? "d6" : type === "r" ? "f6" :
        type === "q" ? "f5" : type === "k" ? "d6" : "d3");
      refuses(() => queue(start, [c(origin, invalid, color)]), AddScActionError);
      const visibility = vi.fn(() => true);
      const plan = { color, from: origin, to: invalid };
      refuses(() => resolveTurn({ placement: start.placement, ccLives: start.ccLives, isTargetVisible: visibility,
        white: color === "w" ? plan : null, black: color === "b" ? plan : null }));
      expect(visibility).not.toHaveBeenCalled();
      for (const isCapture of [false, true]) {
        const to = mirror(isCapture ? capture : quiet);
        const snapshot = isCapture ? board([...entries, [to, { type: "n", color: color === "w" ? "b" : "w" }]]) : start;
        const result = endScTurn(queue(snapshot, [c(origin, to, color)]), { skipTurnStartChecks: true });
        expect(placementToMap(result.next.placement).get(to)).toStrictEqual({ type, color });
        if (isCapture) expect(result.resolved.attacks).toContainEqual(expect.objectContaining({ kind: "capture", from: origin, to }));
      }
    });
  }
});
