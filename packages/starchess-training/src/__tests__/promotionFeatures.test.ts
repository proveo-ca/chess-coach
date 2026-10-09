import { describe, expect, it } from "vitest";
import { decodeCandidate, requestedSpend } from "@chess-coach/starchess-arena/intent-codec-v1";
import type { AuthorizedHistory } from "@chess-coach/starchess-arena/observations";
import type { Meter } from "../economic/contracts";
import type { ScActionInput } from "@chess-coach/starchess-core/planning-v1";
import { marineOpportunities, promotionFeatures, promotionRoutes } from "../feature/promotion";
import { projectOwn } from "../feature/projection";
import { c, observation } from "./fixtures";

const featureMeter = (): Meter => ({ limit: 1048576, used: 0 });
const featureHistory = (own: Parameters<typeof observation>[0]): AuthorizedHistory => {
  const o = observation(own), values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 } as const;
  const economic = { version: "challenge-economic-ledger-v1" as const, side: o.side, ownPaidDebits: 0, ownPaidSurviving: 0,
    ownPaidDestroyed: 0, ownPaidWasted: 0, ownReplacementDestroyed: 0, receipts: [], retiredOwnIds: [],
    enemyLoss: { confirmedUnitCount: 0, replacementLowerBound: 0, paidLowerBound: 0 as const, upper: "unknown" as const, completeness: "witnessed-only" as const } };
  return { version: "challenge-history-v2", economicState: economic, everLit: o.cells.map(cell => cell.square),
    currentAuthorizedSnapshotV2: { ...o, version: "challenge-observation-v2", economicState: economic,
      ownUnitLineage: o.own.pieces.map(({ square, piece }) => ({ id: `w:unit:opening:${square}`, square, type: piece.type, paidBasis: 0, replacementValue: values[piece.type] })), ownMineLineage: [] } };
};
const featureCandidate = (actions: readonly ScActionInput[]) => decodeCandidate({ version: "challenge-candidate-codec-v1", actions,
  key: JSON.stringify(actions.map(action => Object.fromEntries(Object.entries(action).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)))), ownSpend: requestedSpend(actions) }, "w");

describe("corrective A4 native Marine opportunity geometry", () => {
  it("retains original double eligibility and direct B-arrival diagonal bindings", () => {
    const macros = [...marineOpportunities("e6", "w", 1, featureMeter())];
    expect(macros.some(m => m.key.includes("B:diagonalLeft:-:arrival") && m.arrival === "d8" && m.promotion === "q")).toBe(true);
    expect(macros.some(m => m.key.includes("B:diagonalLeft:-:original") && m.arrival === "e7" && m.promotion === null)).toBe(true);
    const doubles = [...marineOpportunities("e2", "w", 1, featureMeter())];
    expect(doubles.some(m => m.key.includes("B:forward2:-:original") && m.arrival === "e5")).toBe(true);
    expect(doubles.some(m => m.key.includes("B:forward2:-:arrival"))).toBe(false);
  });

  it("enumerates both append orders and preserves an unpromoted last-rank arrival", () => {
    const macros = [...marineOpportunities("e6", "w", 1, featureMeter())];
    expect(macros.some(m => m.key === "-:forward1:F:original:FC:p" && m.arrival === "e8" && m.promotion === null)).toBe(true);
    expect(macros.some(m => m.key.startsWith("-:forward1:F:original:CF"))).toBe(false);
    const early = [...marineOpportunities("e4", "w", 1, featureMeter())];
    expect(early.some(m => m.key === "-:forward1:F:original:FC:p")).toBe(true);
    expect(early.some(m => m.key === "-:forward1:F:original:CF:p")).toBe(true);
    const last = [...marineOpportunities("e8", "w", 3, featureMeter())];
    expect(last).toHaveLength(1); expect(last[0]).toMatchObject({ arrival: "e8", promotion: null, entries: [] });
  });

  it("offers n/b/r/q at actual promotion and stops before any post-promotion F step", () => {
    const macros = [...marineOpportunities("e7", "w", 1, featureMeter())];
    const promotions = macros.filter(m => m.key.startsWith("-:forward1:-"));
    expect(promotions.map(m => m.promotion)).toEqual(["n", "b", "r", "q"]);
    expect(promotions.every(m => m.entries.length === 1 && m.entries[0].square === "e8")).toBe(true);
  });
});

describe("promotion route common-family local predicates", () => {
  it("measures local attack-cover and vision gains/removals on the same route family", () => {
    const before = featureHistory([["h8", "k"], ["f4", "n"]]);
    const added = projectOwn(before, featureCandidate([c("f4", "g2")]), featureMeter());
    const addFeatures = promotionFeatures(added, { witnessed: ["e2"], unlocated: [] }, "w", 21, featureMeter());
    expect(addFeatures["attackCoverAdded.witnessed.h1"]).toBe(1 / 8);
    expect(addFeatures["attackCoverRemoved.witnessed.h1"]).toBe(0);
    expect(addFeatures["visionAdded.witnessed.h1"]).toBe(1 / 8);
    const after = featureHistory([["h8", "k"], ["g2", "n"]]);
    const removed = projectOwn(after, featureCandidate([c("g2", "f4")]), featureMeter());
    const removeFeatures = promotionFeatures(removed, { witnessed: ["e2"], unlocated: [] }, "w", 21, featureMeter());
    expect(removeFeatures["attackCoverRemoved.witnessed.h1"]).toBe(1 / 8);
    expect(removeFeatures["attackCoverAdded.witnessed.h1"]).toBe(0);
  });

  it("retains blocked routes and pools additions/removals by destination file", () => {
    const h = featureHistory([["h8", "k"], ["e2", "q"]]);
    const projection = projectOwn(h, featureCandidate([c("e2", "f2")]), featureMeter());
    const routes = [...promotionRoutes(projection, ["e3", "f3"], "b", 21, 1, featureMeter())];
    expect(routes.some(r => r.arrival === "e1" && r.baseline.blockers.has("e2") && !r.candidate.blockers.has("e2"))).toBe(true);
    expect(routes.some(r => r.arrival === "f1" && !r.baseline.blockers.has("f2") && r.candidate.blockers.has("f2"))).toBe(true);
    const meter = featureMeter();
    const features = promotionFeatures(projection, { witnessed: ["e3", "f3"], unlocated: [] }, "w", 21, meter);
    expect(features["blockerAdded.witnessed.h1"]).toBe(1 / 8);
    expect(features["blockerRemoved.witnessed.h1"]).toBe(1 / 8);
    expect(features["blockerAdded.unlocated.h3"]).toBe(0);
    expect(Object.values(features).every(value => Number.isInteger(value * 8) && value >= 0 && value <= 1)).toBe(true);
  });

  it("requires diagonal compatibility in at least one view without treating capturable nonCC as a blocker", () => {
    const h = featureHistory([["h8", "k"], ["d1", "n"]]);
    const projection = projectOwn(h, featureCandidate([c("d1", "f2")]), featureMeter());
    const routes = [...promotionRoutes(projection, ["e2"], "b", 21, 1, featureMeter())];
    const diagonal = routes.find(r => r.arrival === "d1" && r.key.includes("diagonalLeft"));
    expect(diagonal?.baseline.compatible).toBe(true); expect(diagonal?.candidate.compatible).toBe(false);
    expect(diagonal?.baseline.blockers.size).toBe(0);
    expect(routes.some(r => r.arrival === "f1")).toBe(false);
  });

  it("includes CC as candidate promotion exposure risk with no material contribution", () => {
    const h = featureHistory([["f2", "k"]]);
    const projection = projectOwn(h, featureCandidate([]), featureMeter());
    const features = promotionFeatures(projection, { witnessed: ["e2"], unlocated: ["e2"] }, "w", 21, featureMeter());
    expect(features["exposure.witnessed.h1"]).toBe(1 / 8);
    expect(features["exposure.unlocated.h1"]).toBe(1 / 8);
    expect(features["blockerAdded.witnessed.h3"]).toBe(0);
    expect(features["visionAdded.witnessed.h3"]).toBe(0);
  });

  it("uses horizons 1..3 without injecting future births or counting last-rank stays as promotion", () => {
    const h = featureHistory([["f2", "k"]]);
    const projection = projectOwn(h, featureCandidate([]), featureMeter());
    const features = promotionFeatures(projection, { witnessed: [], unlocated: [] }, "w", 21, featureMeter());
    expect(Object.values(features)).toEqual(new Array(36).fill(0));
    expect([...promotionRoutes(projection, ["e1"], "b", 21, 3, featureMeter())]).toEqual([]);
    const routes = [...promotionRoutes(projection, ["e5"], "b", 21, 3, featureMeter())];
    expect(routes.every(r => r.opportunities >= 2 && r.opportunities <= 3)).toBe(true);
    expect(routes.some(r => r.opportunities === 2)).toBe(true);
  });

  it("fails prepaid route work without silently truncating the common support", () => {
    const projection = projectOwn(featureHistory([["h8", "k"]]), featureCandidate([]), featureMeter());
    const meter = { limit: 1048576 as const, used: 1048576 - 100 };
    expect(() => [...promotionRoutes(projection, ["e5"], "b", 21, 3, meter)]).toThrow();
    expect(meter.used).toBeLessThanOrEqual(1048576);
  });
});
