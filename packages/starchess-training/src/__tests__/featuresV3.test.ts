import { describe, expect, it } from "vitest";
import { decodeCandidate, requestedSpend } from "@chess-coach/starchess-arena/intent-codec-v1";
import type { AuthorizedHistory } from "@chess-coach/starchess-arena/observations";
import type { Meter } from "../economic/contracts";
import type { ScActionInput, Square } from "@chess-coach/starchess-core/planning-v1";
import { economicFeatures } from "../feature/economic";
import { encodeFeatureBlocksV3 } from "../feature/encoder";
import { flattenFeatureBlocksV3 } from "../feature/manifest";
import { projectOwn } from "../feature/projection";
import { c, s, observation, type FixtureOptions } from "./fixtures";

const featureMeter = (): Meter => ({ limit: 1048576, used: 0 });
const featureHistory = (own: Parameters<typeof observation>[0], options: FixtureOptions = {}, paid: Partial<Record<Square, number>> = {}): AuthorizedHistory => {
  const o = observation(own, options), surviving = Object.values(paid).reduce((a, b) => a + b, 0);
  const economic = { version: "challenge-economic-ledger-v1" as const, side: o.side, ownPaidDebits: surviving, ownPaidSurviving: surviving,
    ownPaidDestroyed: 0, ownPaidWasted: 0, ownReplacementDestroyed: 0, receipts: [], retiredOwnIds: [],
    enemyLoss: { confirmedUnitCount: 0, replacementLowerBound: 0, paidLowerBound: 0 as const, upper: "unknown" as const, completeness: "witnessed-only" as const } };
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 } as const;
  return { version: "challenge-history-v2", economicState: economic, everLit: o.cells.filter(cell => cell.visibility === "lit").map(cell => cell.square),
    currentAuthorizedSnapshotV2: { ...o, version: "challenge-observation-v2", economicState: economic,
      ownUnitLineage: o.own.pieces.map(({ square, piece }) => ({ id: `w:unit:opening:${square}`, square, type: piece.type, paidBasis: paid[square] ?? 0, replacementValue: values[piece.type] })), ownMineLineage: [] } };
};
const featureCandidate = (actions: readonly ScActionInput[]) => decodeCandidate({ version: "challenge-candidate-codec-v1", actions,
  key: JSON.stringify(actions.map(action => Object.fromEntries(Object.entries(action).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)))), ownSpend: requestedSpend(actions) }, "w");

const economics = (h: ReturnType<typeof featureHistory>, actions: Parameters<typeof featureCandidate>[0], balance = 2, uncertainty = 3) => {
  const meter = featureMeter(), candidate = featureCandidate(actions);
  const projection = projectOwn(h, candidate, meter);
  return economicFeatures(projection, candidate, { balance, uncertainty }, meter);
};

describe("amended economic append12", () => {
  it("credits only the authored observed classical destination and charges immediate risk", () => {
    const h = featureHistory([["a1", "k"], ["c3", "n"]], { enemy: [["d5", "p"], ["d8", "r"], ["b5", "q"]] });
    const e = economics(h, [c("c3", "d5")]);
    expect(e.trade).toBe((1 - 3) / 12);
    expect(e["ix.tradeBalance"]).toBe(-1 / 3);
    expect(e["ix.tradeUncertainty"]).toBe(-.5);
    expect(e.spend).toBe(0);
  });

  it("counts special actors as risk only and makes no-classical trade exactly zero", () => {
    const h = featureHistory([["a1", "k"], ["c3", "b"], ["d3", "n"]], { enemy: [["h8", "q"], ["c8", "r"], ["d8", "r"]] });
    const special = s("charonMissiles", "c3", "h8");
    expect(economics(h, [special]).trade).toBe(0);
    expect(economics(h, [special, c("d3", "f4")]).trade).toBe(-3 / 12);
  });

  it("deduplicates the actor token with maximum replacement risk across promotion checkpoints", () => {
    const h = featureHistory([["a1", "k"], ["e6", "p"]], { enemy: [["d8", "p"], ["a7", "r"], ["h8", "r"]] });
    const e = economics(h, [s("stimStep", "e6", "e7"), { ...c("e7", "d8"), promotion: "q" }]);
    expect(e.trade).toBe((1 - 9) / 12);
  });

  it("excludes unknown, stale, CC, and upstream-blocker targets from credit", () => {
    const h = featureHistory([["a1", "k"], ["a2", "r"]], { unknown: ["a5"], enemy: [["a7", "q"], ["a6", "p"], ["h7", "r"]] });
    expect(economics(h, [c("a2", "a7")]).trade).toBe(-5 / 12);
    const cc = featureHistory([["a1", "k"], ["a2", "r"]], { enemy: [["a7", "k"]] });
    expect(economics(cc, [c("a2", "a7")]).trade).toBe(0);
  });

  it("protects only baseline exposed survivors and values deploy crushing separately", () => {
    const h = featureHistory([["b2", "k"], ["b3", "q"]], { enemy: [["b8", "r"]] }, { b3: 1 });
    const move = economics(h, [c("b3", "c4")]);
    expect(move.protection).toBe(9 / 12);
    const crush = economics(h, [{ ...s("deploy", "b2", "b3"), unit: "p" }]);
    expect(crush.deploy).toBe((1 - 9) / 12);
    expect(crush.protection).toBe(0);
    expect(crush.spend).toBe(.5 * (1 / 12 + 1 / 3));
    expect(crush["ix.deployBalance"]).toBe(-4 / 3);
  });

  it("uses possible exposure for both risk and baseline survivor protection", () => {
    const h = featureHistory([["a1", "k"], ["d3", "n"]], { unknown: ["d6"], enemy: [["d8", "r"]] });
    expect(economics(h, [c("d3", "e5")]).protection).toBe(3 / 12);
  });
});

describe("typed numerical V3 foundation", () => {
  it("encodes 418 finite fields and allocates fresh caller-owned flat copies", () => {
    const h = featureHistory([["a1", "k"], ["b2", "p"]]);
    const before = JSON.stringify(h), candidate = featureCandidate([c("b2", "b4")]);
    const meter = featureMeter();
    const blocks = encodeFeatureBlocksV3(h, candidate, { balance: 0, uncertainty: 2, witnessed: [], unlocated: [] }, meter);
    const first = flattenFeatureBlocksV3(blocks, meter), second = flattenFeatureBlocksV3(blocks, meter);
    expect(first).toHaveLength(418); expect([...first].every(Number.isFinite)).toBe(true);
    expect(first).toEqual(second); first[0] = 100; expect(second[0]).toBe(0);
    expect(Object.isFrozen(blocks.positions[0])).toBe(true); expect(JSON.stringify(h)).toBe(before);
    expect(meter.used).toBeGreaterThan(0); expect(meter.used).toBeLessThan(1048576);
  });

  it("rejects fifth actions before numerical work and prepaid exhaustion before allocation", () => {
    const h = featureHistory([["a1", "k"]]), candidate = featureCandidate([c("a1", "a2"), c("a1", "b1"), c("a1", "b2"), c("a1", "a2"), c("a1", "b1")]);
    expect(() => projectOwn(h, candidate, featureMeter())).toThrow("CARDINALITY: $.actions");
    const meter = { limit: 1048576 as const, used: 1048576 };
    expect(() => projectOwn(h, featureCandidate([]), meter)).toThrow(); expect(meter.used).toBe(1048576);
  });
});
