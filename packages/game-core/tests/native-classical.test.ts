// SPEC: _spec/turn-planning.puml
import { describe, expect, test } from "bun:test";
import { matchedMarineDouble, nativeClassicalChecks, nativeClassicalEligibility, orderBHeadsFirst } from "../src";
import type { NativeClassicalContext, ScAction, ScActionInput, ScPiece, Square } from "../src";

const context = (entries: readonly (readonly [Square, ScPiece["type"]])[], sieged: Square[] = []): NativeClassicalContext => ({
  ownUnits: new Map(entries.map(([at, type]) => [at, { type, color: "w" }])), ownSieged: new Set(sieged),
});
const outcome = (ctx: NativeClassicalContext, inputs: readonly ScActionInput[]) => {
  const actions: ScAction[] = inputs.map((action, seq) => ({ ...action, seq }));
  const classical = actions.find((action): action is Extract<ScAction, { timing: "C" }> => action.timing === "C")!;
  return nativeClassicalEligibility(ctx, actions, classical);
};
const c = (from: Square, to: Square): ScActionInput => ({ timing: "C", kind: "classical", color: "w", from, to });
const stim = (from: Square, to: Square): ScActionInput => ({ timing: "B", kind: "stimStep", color: "w", from, to });
const birth = (from: Square, to: Square, unit: "p" | "n" | "b" | "r" | "q"): ScActionInput =>
  ({ timing: "B", kind: "deploy", color: "w", from, to, unit });

describe("canonical own classical dependency fold", () => {
  test("keeps insertion and resulting actor/siege contexts separate", () => {
    const actions: ScAction[] = [c("e7", "e8"), birth("d7", "e7", "r")].map((action, seq) => ({ ...action, seq }));
    const classical = actions[0]!;
    if (classical.timing !== "C") throw new Error("Expected classical fixture");
    const checks = nativeClassicalChecks(context([["d7", "k"], ["e7", "p"]]), actions, classical);
    expect(checks.insertion.actor?.type).toBe("p");
    expect(checks.resulting.actor?.type).toBe("r");
    expect(checks.insertion.diagnostic).toBeUndefined();
    expect(checks.resulting.diagnostic).toBeUndefined();
    const siegeActions: ScAction[] = [c("e2", "e4"), birth("d2", "e2", "p")].map((action, seq) => ({ ...action, seq }));
    const siegeC = siegeActions[0]!;
    if (siegeC.timing !== "C") throw new Error("Expected classical fixture");
    const siege = nativeClassicalChecks(context([["d2", "k"], ["e2", "r"]], ["e2"]), siegeActions, siegeC);
    expect(siege.insertion.actor?.type).toBe("r");
    expect(siege.resulting.actor?.type).toBe("p");
    expect(siege.insertion.sieged.has("e2")).toBe(true);
    expect(siege.resulting.sieged.has("e2")).toBe(true);
  });

  test.each(["w", "b"] as const)("requires a genuine one-step B with matching transfer identity for %s", color => {
    const from: Square = color === "w" ? "e2" : "e7";
    const authoredTo: Square = color === "w" ? "e4" : "e5";
    const arrival: Square = color === "w" ? "e3" : "e6";
    const target: Square = color === "w" ? "e5" : "e4";
    const invalidTarget: Square = color === "w" ? "e6" : "e3";
    const actor = { id: "fixture:transferred", type: "p" as const, color };
    const classical: Extract<ScAction, { timing: "C" }> = { timing: "C", kind: "classical", color, from, to: authoredTo, seq: 1 };
    const before: ScAction = { timing: "B", kind: "stimStep", color, from, to: arrival, seq: 0 };
    expect(matchedMarineDouble([before, classical], classical, { from: arrival, to: target }, actor,
      { actor: { ...actor }, from, to: arrival })).toBe(true);
    const invalid = { ...before, to: authoredTo };
    expect(matchedMarineDouble([invalid, classical], classical, { from: authoredTo, to: invalidTarget }, actor,
      { actor: { ...actor }, from, to: authoredTo })).toBe(false);
    expect(matchedMarineDouble([before, classical], classical, { from: arrival, to: target }, { ...actor, id: "replacement" },
      { actor: { ...actor }, from, to: arrival })).toBe(false);
  });

  test("refuses the projected double after an injected two-rank B", () => {
    expect(outcome(context([["e2", "p"]]), [stim("e2", "e4"), c("e2", "e4")]).diagnostic?.code).toBe("SC_BASELINE_FEN");
  });

  test("uses heads-first dependencies instead of kind sorting or insertion order", () => {
    const actions = [stim("e2", "e3"), birth("d3", "e3", "r"), stim("e3", "e4"), c("e3", "e4")];
    expect(orderBHeadsFirst(actions.slice(0, 3).map((action, seq) => ({ ...action, seq }))).map(action => action.seq)).toEqual([1, 2, 0]);
    const result = outcome(context([["e2", "p"], ["e3", "p"], ["d3", "k"]]), actions);
    expect(result).toMatchObject({ kind: "LIVE", from: "e4", to: "e5", actor: { type: "r", id: "b:1" } });
    expect(result.diagnostic).toBeUndefined();
  });

  test("preserves cycles and excludes a mover's own origin from head blocking", () => {
    const first: ScActionInput = { timing: "B", kind: "tacticalJump", color: "w", from: "e2", to: "e3" };
    const second = { ...first, from: "e3" as const, to: "e2" as const };
    const cycle = outcome(context([["e2", "q"], ["e3", "q"]]), [first, second, c("e2", "f3")]);
    expect(cycle).toMatchObject({ kind: "LIVE", from: "e2", to: "f3", actor: { type: "q", id: "u:0" } });
    expect(cycle.diagnostic).toBeUndefined();
    const self = { ...first, to: "e2", seq: 0 } as ScAction;
    const deploy = { ...birth("d2", "f2", "n"), seq: 1 } as ScAction;
    expect(orderBHeadsFirst([self, deploy]).map(action => action.seq)).toEqual([0, 1]);
  });

  test("uses fresh birth identities and preserves relocation type and identity", () => {
    const own = context([["d2", "k"], ["e2", "p"]]);
    const result = outcome(own, [birth("d2", "e2", "p"), stim("e2", "e3"), c("e2", "e4")]);
    expect(result).toMatchObject({ kind: "LIVE", from: "e3", to: "e5", actor: { type: "p", id: "b:0" } });
    expect(result.diagnostic).toBeUndefined();
    const wrong = outcome(own, [birth("d2", "e2", "n"), stim("e2", "e3"), c("e2", "e4")]);
    expect(wrong.actor).toMatchObject({ type: "n", id: "b:0" });
    expect(wrong.diagnostic?.code).toBe("SC_BASELINE_FEN");
  });

  test("retains replacement and origin-refill restrictions", () => {
    const result = outcome(context([["d2", "k"], ["f2", "k"], ["e2", "p"]]),
      [birth("d2", "e2", "b"), birth("f2", "e2", "n"), c("e2", "f4")]);
    expect(result.actor).toMatchObject({ type: "n", id: "b:1" });
    expect(result.diagnostic).toBeUndefined();
    const refilled = outcome(context([["d5", "k"], ["e5", "p"]]), [stim("e5", "e6"), c("e5", "e7"), birth("d5", "e5", "p")]);
    expect(refilled.kind).toBe("LIVE");
    expect(refilled.diagnostic?.code).toBe("SC_BASELINE_FEN");
  });

  test("toggles siege only for the current own Tank", () => {
    const toggle: ScActionInput = { timing: "B", kind: "siegeMode", color: "w", from: "e2" };
    const ignored = outcome(context([["d2", "k"], ["e2", "r"]], ["e2"]), [birth("d2", "e2", "n"), toggle, c("e2", "g3")]);
    expect(ignored.sieged.has("e2")).toBe(true);
    expect(ignored.actor?.type).toBe("n");
    expect(ignored.diagnostic).toBeUndefined();
    expect(outcome(context([["e2", "r"]], ["e2"]), [toggle, c("e2", "e4")]).sieged.has("e2")).toBe(false);
  });

  test.each(["p", "n", "b", "r", "q"] as const)("retains lawful held-promotion drops despite replacement by %s", unit => {
    const result = outcome(context([["e7", "p"], ["f7", "k"]]),
      [{ ...stim("e7", "e8"), promotion: "q" }, birth("f7", "e8", unit), { ...c("e7", "f8"), promotion: "q" }]);
    expect(result.kind).toBe("NATIVE_DROP");
    expect(result.diagnostic).toBeUndefined();
  });

  test("promotes immediately without replacing identity", () => {
    const result = outcome(context([["e7", "p"]]), [{ ...stim("e7", "e8"), promotion: "n" }, c("e8", "g7")]);
    expect(result).toMatchObject({ kind: "LIVE", actor: { type: "n", id: "u:0" }, from: "e8", to: "g7" });
    expect(result.diagnostic).toBeUndefined();
  });

  test("ignores forbidden simulator fields and opponent actions without mutating inputs", () => {
    const own = context([["e2", "p"]]);
    const restricted = Object.assign(Object.create(null), own);
    for (const key of ["placement", "mines", "opponentQueue", "visibility", "scores"]) {
      Object.defineProperty(restricted, key, { get: () => { throw new Error("Forbidden simulator query"); } });
    }
    const before = structuredClone(own);
    const inputs = [stim("e2", "e3"), c("e2", "e4"), { ...birth("e8", "e3", "n"), color: "b" as const }];
    const authored = structuredClone(inputs);
    expect(outcome(restricted, inputs).diagnostic).toBeUndefined();
    expect(own).toEqual(before);
    expect(inputs).toEqual(authored);
  });

  test("preserves invalid insertion diagnostics after a later actor replacement", () => {
    const inputs = [c("e2", "f4"), birth("d2", "e2", "n")];
    const actions: ScAction[] = inputs.map((action, seq) => ({ ...action, seq }));
    const classical = actions[0]!;
    if (classical.timing !== "C") throw new Error("Expected classical fixture");
    const checks = nativeClassicalChecks(context([["d2", "k"], ["e2", "p"]]), actions, classical);
    expect(checks.insertion.diagnostic?.code).toBe("SC_BASELINE_FEN");
    expect(checks.resulting.diagnostic).toBeUndefined();
    expect(nativeClassicalEligibility(context([["d2", "k"], ["e2", "p"]]), actions, classical).diagnostic).toEqual(checks.insertion.diagnostic);
  });
});
