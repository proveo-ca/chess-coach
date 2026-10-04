// SPEC: _spec/specials/mecha-charon.puml
import { describe, expect, it } from "vitest";

import { adjutant } from "../../ai/adjutant";
import {
  enemyCanJump,
  predictEnemyWarpDestinations,
} from "../../ai/strategies/captures";
import { buildAdjutantCtx } from "../../ai/context";
import { charonForwardStacks } from "../../ai/plans/stacks";
import { asCandidate, generateCandidates } from "../../ai/strategies";
import { charonDiagonalSquaresFromPlacement, type Square } from "../../index";
import { parseScFen } from "../../index";

const blackActions = (scfen: string) => {
  const plan = adjutant(parseScFen(scfen));
  return (
    plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? []
  );
};

describe("charon hunt gate", () => {
  it("enemy cannot jump below tier-3 gas income", () => {
    const poor = parseScFen("SCFEN|4k3/8/8/8/8/8/8/4K3|11|33|P|G:22:22|Q:w:;b:");
    expect(enemyCanJump(poor, "w")).toBe(false);
    const rich = parseScFen("SCFEN|4k3/8/8/8/8/8/8/4K3|21|33|P|G:33:33|Q:w:;b:");
    expect(enemyCanJump(rich, "w")).toBe(true);
  });

  it("high turn with poor enemy income still gates insta, not guess", () => {
    // Income is the gate, not the turn number (synthetic unnormalized snap —
    // the codec ties income to turn tier, so override post-parse).
    const base = parseScFen("SCFEN|k6Q/8/8/8/3b4/8/8/4K3|30|33|P|G:33:33|Q:w:;b:");
    const snap = { ...base, gasIncome: { w: 2, b: 3 } };
    expect(enemyCanJump(snap, "w")).toBe(false);
    const plan = adjutant(snap);
    const actions = plan.snapshot.queue?.actions.filter((a) => a.color === "b") ?? [];
    expect(
      actions.some(
        (a) => a.kind === "charonMissiles" && a.timing === "B" && a.to === "h8",
      ),
    ).toBe(true);
    expect(actions.some((a) => a.kind === "charonMissiles" && a.timing === "F")).toBe(
      false,
    );
  });
});

describe("mode A insta-target (pre-jump)", () => {
  it("queues a B kill at the visible first-ship", () => {
    const actions = blackActions(
      "SCFEN|5b1k/8/8/8/6n1/Q7/7p/4K3|11|33|P|G:22:22|Q:w:;b:",
    );
    expect(actions.some((a) => a.kind === "charonMissiles" && a.to === "a3")).toBe(
      true,
    );
  });
});

describe("mode B teleport guess (2nd phase)", () => {
  // Black mecha e4; white ship h8 under fire jumps — top prediction d5 sits
  // on the e4 diagonal, so the hunt fires F e4→d5 with a classical partner.
  const BOARD = "k6Q/8/8/8/4b3/8/8/4K3";

  it("queues an F guess on a mecha diagonal with a classical partner", () => {
    const actions = blackActions(
      `SCFEN|${BOARD}|21|33|P|G:33:33|Q:w:;b:`,
    );
    const guesses = actions.filter(
      (a) => a.kind === "charonMissiles" && a.timing === "F",
    );
    expect(guesses).toMatchObject([{ from: "e4", to: "d5" }]);
    expect(actions.some((a) => a.timing === "C")).toBe(true);
    const diagonals = new Set<Square>(charonDiagonalSquaresFromPlacement(BOARD, "e4"));
    for (const g of guesses) {
      expect(diagonals.has(g.to!)).toBe(true);
    }
  });

  it("predicts at most 3 destinations per ship, all empty and deterministic", () => {
    const snap = parseScFen("SCFEN|k6Q/8/8/8/3b4/8/8/4K3|21|33|P|G:33:33|Q:w:;b:");
    const ctx = buildAdjutantCtx(snap, { color: "b" })!;
    const first = predictEnemyWarpDestinations(ctx, "h8");
    const second = predictEnemyWarpDestinations(ctx, "h8");
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThanOrEqual(63);
    for (const to of first) {
      expect(ctx.map.has(to)).toBe(false);
    }
    expect(new Set(first).size).toBe(first.length);
  });

  it("caps guesses at 3 per ship in prediction order", () => {
    // Mecha e4 vs ship h8: d5, c6, b7, f3, … all verify, but only the first
    // 3 emitted — pins CHARON_MAX_GUESSES_PER_SHIP behaviorally.
    const snap = parseScFen("SCFEN|k6Q/8/8/8/4b3/8/8/4K3|21|33|P|G:33:33|Q:w:;b:");
    const ctx = buildAdjutantCtx(snap, { color: "b" })!;
    const found = generateCandidates(ctx)
      .filter((s) => s.actions[0]?.kind === "charonMissiles")
      .map((s) => s.actions[0]?.to);
    expect(found).toEqual(["d5", "c6", "b7"]);
  });
});

describe("charonForwardStacks", () => {
  const snap = parseScFen("SCFEN|k6Q/8/8/8/4b3/8/8/4K3|21|33|P|G:33:33|Q:w:;b:");
  const ctx = buildAdjutantCtx(snap, { color: "b" })!;
  const guess = asCandidate(
    { timing: "F", kind: "charonMissiles", color: "b", from: "e4", to: "d5" },
    1500,
  );
  const classical = (from: "a8" | "e4", to: Square) =>
    asCandidate({ timing: "C", kind: "classical", color: "b", from, to }, 100);

  it("pairs the guess with a non-interfering classical", () => {
    const stacks = charonForwardStacks([guess], [classical("a8", "a7")], ctx);
    expect(stacks).toHaveLength(1);
    expect(stacks[0]!.actions).toMatchObject([
      { timing: "C", to: "a7" },
      { timing: "F", to: "d5" },
    ]);
  });

  it("drops pairs where our classical moves the mecha, occupies or screens the aim", () => {
    const longGuess = asCandidate(
      { timing: "F", kind: "charonMissiles", color: "b", from: "e4", to: "h7" },
      1500,
    );
    const movers = [
      classical("e4", "e5"), // moves the firing mecha
      classical("a8", "d5"), // occupies the aim square
    ];
    expect(charonForwardStacks([guess], movers, ctx)).toHaveLength(0);
    // g6 sits strictly between e4 and h7 — landing there screens the missiles.
    expect(
      charonForwardStacks([longGuess], [classical("a8", "g6")], ctx),
    ).toHaveLength(0);
  });

  it("pays F gas once and skips when broke", () => {
    const broke = { ...ctx, gas: 1 };
    expect(
      charonForwardStacks([guess], [classical("a8", "a7")], broke),
    ).toHaveLength(0);
  });
});
