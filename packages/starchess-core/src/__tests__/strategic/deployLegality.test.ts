import { describe, expect, it } from "vitest";

import {
  endScTurn,
  mapToPlacement,
  parseScFen,
  placementToMap,
  UNIT_COST,
  type PieceColor,
  type SpawnPiece,
} from "../../index";
import type { Square } from "chess.js";
import type { ScPiece } from "../../board/placement";
import { buildAdjutantCtx, mulberry32, type Candidate } from "../../ai/context";
import { spawnCaptureStacks, spawnStacks } from "../../ai/plans/stacks";
import {
  applyCandidate,
  strategicAdjutant,
  strategicCandidates,
} from "../../ai/strategic";
import { EQUAL_TRADE_ATTACK } from "../../ai/strategies/captures";

const TYPES: readonly SpawnPiece[] = ["p", "n", "b", "r", "q"];
const COLORS: readonly PieceColor[] = ["w", "b"];
const REPLACEMENTS = COLORS.flatMap((color) =>
  TYPES.map((unit) => ({ color, unit })),
);
const ORIGINAL =
  "SCFEN|4kb2/8/7R/8/8/8/8/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";

const deploy = (
  unit: SpawnPiece,
  to: Square = "f8",
  color: PieceColor = "b",
  timing: "B" | "F" = "B",
): Candidate => ({
  actions: [{ timing, kind: "deploy", color, from: color === "b" ? "e8" : "e1", to, unit }],
  score: 1,
  spendMinerals: UNIT_COST[unit],
});

const classical = (
  from: Square,
  to: Square,
  color: PieceColor = "b",
): Candidate => ({
  actions: [{ timing: "C", kind: "classical", color, from, to }],
  score: 1,
});

const geometric = (
  type: ScPiece["type"],
  from: Square,
  to: Square,
  color: PieceColor,
): boolean => {
  const df = Math.abs(to.charCodeAt(0) - from.charCodeAt(0));
  const dr = Number(to[1]) - Number(from[1]);
  const distance = Math.abs(dr);
  if (df === 0 && distance === 0) return false;
  switch (type) {
    case "p": {
      const forward = color === "w" ? 1 : -1;
      const doubleBand = color === "w" ? Number(from[1]) <= 2 : Number(from[1]) >= 7;
      return (dr === forward && df <= 1) || (df === 0 && dr === 2 * forward && doubleBand);
    }
    case "n":
      return (df === 1 && distance === 2) || (df === 2 && distance === 1);
    case "b":
      return df === distance;
    case "r":
      return df === 0 || distance === 0;
    case "q":
      return df === distance || df === 0 || distance === 0;
    case "k":
      return Math.max(df, distance) === 1;
  }
};

const captureFixture = (color: PieceColor, unit: SpawnPiece) => {
  const from: Square = color === "b" ? "f7" : "f2";
  const targets: Record<PieceColor, Record<SpawnPiece, Square>> = {
    b: { p: "g6", n: "h6", b: "h5", r: "f5", q: "h5" },
    w: { p: "g3", n: "h3", b: "h4", r: "f4", q: "h4" },
  };
  const to = targets[color][unit];
  const enemy = color === "b" ? "w" : "b";
  const map = new Map<Square, ScPiece>([
    [color === "b" ? "e8" : "e1", { type: "k", color }],
    [color === "b" ? "a1" : "a8", { type: "k", color: enemy }],
    [from, { type: "b", color }],
    [to, { type: "r", color: enemy }],
  ]);
  const snap = parseScFen(`SCFEN|${mapToPlacement(map)}|0|33|P|G:11:11|Q:w:;b:`);
  return { from, to, snap };
};

describe("B deploy stack provenance", () => {
  it.each([
    { name: "original capture", scfen: ORIGINAL, victim: { type: "r", color: "w" } },
    { name: "quiet destination", scfen: ORIGINAL.replace("7R", "8"), victim: undefined },
  ])("excludes old Mecha f8→h6 for a newborn Hoverbike: $name", ({ scfen, victim }) => {
    const map = placementToMap(parseScFen(scfen).placement);
    expect(map.get("f8")).toEqual({ type: "b", color: "b" });
    expect(map.get("h6")).toEqual(victim);
    expect(geometric("b", "f8", "h6", "b")).toBe(true);
    expect(geometric("n", "f8", "h6", "b")).toBe(false);
    expect(spawnStacks([deploy("n")], [classical("f8", "h6")])).toEqual([]);
  });

  it.each(REPLACEMENTS)("excludes stale origins for $color replacement $unit", ({ color, unit }) => {
    const from: Square = color === "b" ? "f7" : "f2";
    const to: Square = color === "b" ? "h5" : "h4";
    expect(geometric("b", from, to, color)).toBe(true);
    expect(spawnStacks([deploy(unit, from, color)], [classical(from, to, color)])).toEqual([]);
  });

  it("excludes a same-type old Hoverbike even when the newborn shares its legal L", () => {
    const snap = parseScFen("SCFEN|4kn2/7R/8/8/8/8/8/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:");
    const ctx = buildAdjutantCtx(snap)!;
    const birth = deploy("n");
    expect(ctx.map.get("f8")).toEqual({ type: "n", color: "b" });
    expect(geometric("n", "f8", "h7", "b")).toBe(true);
    expect(spawnStacks([birth], [classical("f8", "h7")])).toEqual([]);
    expect(spawnCaptureStacks([birth], ctx)).toEqual([
      expect.objectContaining({ actions: [...birth.actions, ...classical("f8", "h7").actions] }),
    ]);
  });

  it.each([undefined, 0, 3])("preserves unrelated actions, score and spend=%s", (spendMinerals) => {
    const birth = {
      ...deploy("n"),
      score: 12,
      ...(spendMinerals === undefined ? {} : { spendMinerals }),
    };
    if (spendMinerals === undefined) delete birth.spendMinerals;
    const move: Candidate = {
      ...classical("a2", "a1"),
      actions: [{ timing: "C", kind: "classical", color: "b", from: "a2", to: "a1", promotion: "q" }],
      score: 7,
    };
    const before = structuredClone({ birth, move });
    expect(spawnStacks([birth], [move])).toEqual([{
      actions: [birth.actions[0], move.actions[0]],
      score: 19,
      ...(spendMinerals === undefined ? {} : { spendMinerals }),
    }]);
    expect({ birth, move }).toEqual(before);
  });

  it("retains the destination exclusion and ignores nondeploy/nonclassical partners", () => {
    const birth = deploy("n");
    const unrelated = classical("e8", "d8");
    const special: Candidate = {
      actions: [{ timing: "B", kind: "spiderMine", color: "b", from: "f8" }],
      score: 4,
    };
    expect(spawnStacks([birth, special, { actions: [], score: 0 }], [
      classical("e8", "f8"), unrelated, special, { actions: [], score: 0 },
    ])).toEqual([{
      actions: [birth.actions[0], unrelated.actions[0]], score: 2, spendMinerals: 3,
    }]);
  });

  it("retains old-actor C before an F replacement", () => {
    const birth = deploy("n", "f8", "b", "F");
    const move = classical("f8", "h6");
    const stacks = spawnStacks([birth], [move]);
    expect(stacks).toEqual([{
      actions: [birth.actions[0], move.actions[0]], score: 2, spendMinerals: 3,
    }]);
    const committed = applyCandidate(parseScFen(ORIGINAL), stacks[0]!, "b");
    expect(committed).not.toBeNull();
    const after = placementToMap(endScTurn(committed!.snapshot, { skipTurnStartChecks: true }).next.placement);
    expect(after.get("h6")).toEqual({ type: "b", color: "b" });
    expect(after.get("f8")).toEqual({ type: "n", color: "b" });
  });
});

describe("fresh newborn capture generation", () => {
  it.each(REPLACEMENTS)("generates $color $unit captures from the replaced map", ({ color, unit }) => {
    const { from, to, snap } = captureFixture(color, unit);
    const ctx = buildAdjutantCtx(snap, { color })!;
    const before = structuredClone(ctx.map);
    const birth = deploy(unit, from, color);
    const stacks = spawnCaptureStacks([birth], ctx);
    expect(stacks).toHaveLength(1);
    for (const stack of stacks) {
      const move = stack.actions[1]!;
      expect(move).toEqual({ timing: "C", kind: "classical", color, from, to });
      expect(move.timing === "C" && geometric(unit, move.from, move.to, color)).toBe(true);
      expect(stack.spendMinerals).toBe(UNIT_COST[unit]);
      expect(ctx.tactical.checkers.has(to)).toBe(false);
      expect(stack.score).toBe(
        birth.score + ctx.weights.trade * (1 + UNIT_COST.r) +
        (UNIT_COST.r >= UNIT_COST[unit] ? EQUAL_TRADE_ATTACK : 0),
      );
    }
    expect(ctx.map).toEqual(before);
  });
});

describe("seeded strategic deploy legality", () => {
  it("omits the stale witness while keeping seed 7's different legal plan", () => {
    const snap = parseScFen(ORIGINAL);
    const built = strategicCandidates(snap, { color: "b", storedFor: () => 3, rng: mulberry32(7) })!;
    expect(built.candidates.some((candidate) => candidate.actions.length === 1 &&
      candidate.actions[0]?.kind === "deploy" && candidate.actions[0].unit === "n" &&
      candidate.actions[0].to === "f8")).toBe(true);
    let newborns = 0;
    for (const candidate of built.candidates) {
      const birth = candidate.actions.find((action) => action.timing === "B" && action.kind === "deploy");
      const move = candidate.actions.find((action) => action.timing === "C");
      if (!birth || birth.kind !== "deploy" || !birth.unit || !birth.to ||
          !move || move.timing !== "C" || move.from !== birth.to) continue;
      newborns += 1;
      expect(geometric(birth.unit, move.from, move.to, built.us)).toBe(true);
    }
    expect(newborns).toBeGreaterThan(0);
    expect(built.candidates.some((candidate) => candidate.actions.length === 1 &&
      candidate.actions[0]?.timing === "C" && candidate.actions[0].from === "f8" &&
      candidate.actions[0].to === "h6")).toBe(true);
    const selected = strategicAdjutant(snap, { color: "b", storedFor: () => 3, rng: mulberry32(7) });
    expect(selected.snapshot.queue?.actions).toEqual([
      expect.objectContaining({ timing: "B", kind: "deploy", unit: "p", to: "d7" }),
      expect.objectContaining({ timing: "C", kind: "classical", from: "f8", to: "g7" }),
    ]);
    expect(selected.spendMinerals).toEqual({ color: "b", amount: 1 });
    expect(() => endScTurn(selected.snapshot, { skipTurnStartChecks: true })).not.toThrow();
  });

  it("generates and commits a genuine newborn Hoverbike capture", () => {
    const snap = parseScFen("SCFEN|4kb2/7R/8/8/8/8/8/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:");
    const built = strategicCandidates(snap, { color: "b", storedFor: () => 3, rng: mulberry32(7) })!;
    const capture = built.candidates.find((candidate) => {
      const [birth, move] = candidate.actions;
      return birth?.timing === "B" && birth.kind === "deploy" && birth.unit === "n" &&
        birth.to === "f8" && move?.timing === "C" && move.from === "f8" && move.to === "h7";
    });
    expect(capture).toBeDefined();
    expect(geometric("b", "f8", "h7", "b")).toBe(false);
    expect(geometric("n", "f8", "h7", "b")).toBe(true);
    const committed = applyCandidate(snap, capture!, built.us);
    expect(committed).not.toBeNull();
    expect(committed!.spendMinerals).toEqual({ color: "b", amount: 3 });
    const after = placementToMap(endScTurn(committed!.snapshot, { skipTurnStartChecks: true }).next.placement);
    expect(after.get("h7")).toEqual({ type: "n", color: "b" });
    expect(after.has("f8")).toBe(false);
  });
});
