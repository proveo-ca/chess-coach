// SPEC: _spec/packages/starchess-core/sc-moves.puml, _spec/packages/starchess-core/scfen-queue.puml, _spec/packages/starchess-core/gas-phase-vacancy.puml
import { describe, expect, it } from "vitest";
import { matchedMarineDouble, nativeClassicalChecks, nativeClassicalEligibility, type NativeClassicalContext } from "../rules/nativeClassical";
import { orderBHeadsFirst } from "../rules/planning-order";
import type { ScPiece } from "../board/placement";
import type { ScAction, ScActionInput } from "../model/types";
import type { Square } from "../model/square";

const context = (entries: readonly (readonly [Square, ScPiece["type"]])[], sieged: Square[] = []): NativeClassicalContext => ({
  ownUnits: new Map(entries.map(([at, type]) => [at, { type, color: "w" }])), ownSieged: new Set(sieged),
});
const outcome = (ctx: NativeClassicalContext, inputs: readonly ScActionInput[]) => {
  const actions: ScAction[] = inputs.map((a, seq) => ({ ...a, seq }));
  const c = actions.find((a): a is Extract<ScAction, { timing: "C" }> => a.timing === "C")!;
  return nativeClassicalEligibility(ctx, actions, c);
};
const c = (from: Square, to: Square): ScActionInput => ({ timing: "C", kind: "classical", color: "w", from, to });
const stim = (from: Square, to: Square): ScActionInput => ({ timing: "B", kind: "stimStep", color: "w", from, to });
const birth = (from: Square, to: Square, unit: "p" | "n" | "b" | "r" | "q"): ScActionInput =>
  ({ timing: "B", kind: "deploy", color: "w", from, to, unit });

describe("bounded own classical dependency fold", () => {
  it("keeps insertion and resulting actor/siege contexts separate", () => {
    const promotionActions: ScAction[] = [c("e7", "e8"), birth("d7", "e7", "r")].map((a, seq) => ({ ...a, seq }));
    const promotionC = promotionActions[0]!;
    if (promotionC.timing !== "C") throw new Error("expected C fixture");
    const promotion = nativeClassicalChecks(context([["d7", "k"], ["e7", "p"]]), promotionActions, promotionC);
    expect(promotion.insertion.actor?.type).toBe("p");
    expect(promotion.resulting.actor?.type).toBe("r");
    expect(promotion.insertion.diagnostic).toBeUndefined();
    expect(promotion.resulting.diagnostic).toBeUndefined();
    const siegeActions: ScAction[] = [c("e2", "e4"), birth("d2", "e2", "p")].map((a, seq) => ({ ...a, seq }));
    const siegeC = siegeActions[0]!;
    if (siegeC.timing !== "C") throw new Error("expected C fixture");
    const siege = nativeClassicalChecks(context([["d2", "k"], ["e2", "r"]], ["e2"]), siegeActions, siegeC);
    expect(siege.insertion.actor?.type).toBe("r");
    expect(siege.resulting.actor?.type).toBe("p");
    expect(siege.insertion.sieged.has("e2")).toBe(true);
    expect(siege.resulting.sieged.has("e2")).toBe(true);
  });

  it.each(["w", "b"] as const)("requires a genuine single-step B even with matching transfer identity for %s", color => {
    const from: Square = color === "w" ? "e2" : "e7";
    const authoredTo: Square = color === "w" ? "e4" : "e5";
    const validArrival: Square = color === "w" ? "e3" : "e6";
    const validTarget: Square = color === "w" ? "e5" : "e4";
    const invalidTarget: Square = color === "w" ? "e6" : "e3";
    const actor = { id: "native:transferred", type: "p" as const, color };
    const classical: Extract<ScAction, { timing: "C" }> = { timing: "C", kind: "classical", color, from, to: authoredTo, seq: 1 };
    const valid: ScAction = { timing: "B", kind: "stimStep", color, from, to: validArrival, seq: 0 };
    expect(matchedMarineDouble([valid, classical], classical, { from: validArrival, to: validTarget }, actor,
      { actor: { ...actor }, from, to: validArrival })).toBe(true);
    const invalid: ScAction = { ...valid, to: authoredTo };
    expect(matchedMarineDouble([invalid, classical], classical, { from: authoredTo, to: invalidTarget }, actor,
      { actor: { ...actor }, from, to: authoredTo })).toBe(false);
  });

  it("refuses the projected double after a directly injected two-rank B", () => {
    const result = outcome(context([["e2", "p"]]), [stim("e2", "e4"), c("e2", "e4")]);
    expect(result.diagnostic?.code).toBe("SC_BASELINE_FEN");
  });

  it("uses the single ordered heads predicate rather than kind sorting or insertion order", () => {
    const actions: ScActionInput[] = [stim("e2", "e3"), birth("d3", "e3", "r"), stim("e3", "e4"), c("e3", "e4")];
    expect(orderBHeadsFirst(actions.slice(0, 3).map((a, seq) => ({ ...a, seq }))).map(a => a.seq)).toStrictEqual([1, 2, 0]);
    const result = outcome(context([["e2", "p"], ["e3", "p"], ["d3", "k"]]), actions);
    expect(result).toMatchObject({ kind: "LIVE", from: "e4", to: "e5", actor: { type: "r", id: "b:1" } });
    expect(result.diagnostic).toBeUndefined();
  });

  it("preserves cycles and self-exclusion with own-blocked relocation", () => {
    const first: ScActionInput = { timing: "B", kind: "tacticalJump", color: "w", from: "e2", to: "e3" };
    const second: ScActionInput = { ...first, from: "e3", to: "e2" };
    const cycle = outcome(context([["e2", "q"], ["e3", "q"]]), [first, second, c("e2", "f3")]);
    expect(cycle).toMatchObject({ kind: "LIVE", from: "e2", to: "f3", actor: { type: "q", id: "u:0" } });
    expect(cycle.diagnostic).toBeUndefined();
    const self = { ...first, to: "e2", seq: 0 } as ScAction;
    const deploy = { ...birth("d2", "f2", "n"), seq: 1 } as ScAction;
    expect(orderBHeadsFirst([self, deploy]).map(a => a.seq)).toStrictEqual([0, 1]);
  });

  it("uses fresh birth identities and preserves relocation type/identity", () => {
    const result = outcome(context([["d2", "k"], ["e2", "p"]]),
      [birth("d2", "e2", "p"), stim("e2", "e3"), c("e2", "e4")]);
    expect(result).toMatchObject({ kind: "LIVE", from: "e3", to: "e5", actor: { type: "p", id: "b:0" } });
    expect(result.diagnostic).toBeUndefined();
    const wrong = outcome(context([["d2", "k"], ["e2", "p"]]),
      [birth("d2", "e2", "n"), stim("e2", "e3"), c("e2", "e4")]);
    expect(wrong.actor).toMatchObject({ type: "n", id: "b:0" });
    expect(wrong.diagnostic?.code).toBe("SC_BASELINE_FEN");
  });

  it("applies last-write replacement and origin refill without granting a departed identity", () => {
    const result = outcome(context([["d2", "k"], ["f2", "k"], ["e2", "p"]]),
      [birth("d2", "e2", "b"), birth("f2", "e2", "n"), c("e2", "f4")]);
    expect(result.actor).toMatchObject({ type: "n", id: "b:1" });
    expect(result.diagnostic).toBeUndefined();
    const refilled = outcome(context([["d5", "k"], ["e5", "p"]]),
      [stim("e5", "e6"), c("e5", "e7"), birth("d5", "e5", "p")]);
    expect(refilled.kind).toBe("LIVE");
    expect(refilled.diagnostic?.code).toBe("SC_BASELINE_FEN");
  });

  it("toggles siege only for the current own Tank", () => {
    const toggle: ScActionInput = { timing: "B", kind: "siegeMode", color: "w", from: "e2" };
    const ignored = outcome(context([["d2", "k"], ["e2", "r"]], ["e2"]),
      [birth("d2", "e2", "n"), toggle, c("e2", "g3")]);
    expect(ignored.sieged.has("e2")).toBe(true);
    expect(ignored.actor?.type).toBe("n");
    expect(ignored.diagnostic).toBeUndefined();
    const unsieged = outcome(context([["e2", "r"]], ["e2"]), [toggle, c("e2", "e4")]);
    expect(unsieged.sieged.has("e2")).toBe(false);
  });

  it.each(["p", "n", "b", "r", "q"] as const)("retains lawful held-promotion drops despite a replacement (%s)", unit => {
    const step: ScActionInput = { ...stim("e7", "e8"), promotion: "q" };
    const result = outcome(context([["e7", "p"], ["f7", "k"]]), [step, birth("f7", "e8", unit),
      { ...c("e7", "f8"), promotion: "q" }]);
    expect(result.kind).toBe("NATIVE_DROP");
    expect(result.diagnostic).toBeUndefined();
  });

  it("applies immediate gas promotion without replacing identity", () => {
    const result = outcome(context([["e7", "p"]]), [{ ...stim("e7", "e8"), promotion: "n" }, c("e8", "g7")]);
    expect(result).toMatchObject({ kind: "LIVE", actor: { type: "n", id: "u:0" }, from: "e8", to: "g7" });
    expect(result.diagnostic).toBeUndefined();
  });

  it("does not query extras, opponent actions, vision, mines or mutate own inputs", () => {
    const own = context([["e2", "p"]]);
    const forbidden = () => { throw new Error("forbidden prospective query"); };
    const restricted = Object.assign(Object.create(null), own);
    for (const key of ["placement", "mines", "opponentQueue", "visibility", "scores"]) {
      Object.defineProperty(restricted, key, { get: forbidden });
    }
    const before = [...own.ownUnits].map(([at, actor]) => [at, { ...actor }]);
    const inputs = [stim("e2", "e3"), c("e2", "e4")];
    const actionsBefore = structuredClone(inputs);
    expect(outcome(restricted, inputs).diagnostic).toBeUndefined();
    expect([...own.ownUnits]).toStrictEqual(before);
    expect([...own.ownSieged]).toStrictEqual([]);
    expect(inputs).toStrictEqual(actionsBefore);
  });
});
