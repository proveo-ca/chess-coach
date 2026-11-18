// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { describe, expect, it } from "vitest";
import { decodeCandidate } from "@chess-coach/starchess-arena/intent-codec-v1";
import type { AuthorizedHistory } from "@chess-coach/starchess-arena/observations";
import type { Meter } from "../economic/contracts";
import { encodeHistorical370 } from "../feature/encoder";
import { economicFeatures } from "../feature/economic";
import { promotionFeatures } from "../feature/promotion";
import { projectOwn } from "../feature/projection";
import * as k from "../economic/ownedKernel";
import { featureMeter, ownHistory, ownCandidate } from "./featurePrefix370.test";
import { featureManifestV3, featureRegistryV3, flattenFeatureBlocksV3 } from "../feature/manifest";
import { observation } from "./fixtures";

const passBlocks = () => {
  const o = observation([["a1", "k"]]);
  const economic = { version: "challenge-economic-ledger-v1" as const, side: o.side, ownPaidDebits: 0, ownPaidSurviving: 0,
    ownPaidDestroyed: 0, ownPaidWasted: 0, ownReplacementDestroyed: 0, receipts: [], retiredOwnIds: [],
    enemyLoss: { confirmedUnitCount: 0, replacementLowerBound: 0, paidLowerBound: 0 as const, upper: "unknown" as const, completeness: "witnessed-only" as const } };
  const h: AuthorizedHistory = { version: "challenge-history-v2", economicState: economic, everLit: o.cells.map(cell => cell.square),
    currentAuthorizedSnapshotV2: { ...o, version: "challenge-observation-v2", economicState: economic,
      ownUnitLineage: [{ id: "w:unit:opening:a1", square: "a1", type: "k", paidBasis: 0, replacementValue: 0 }], ownMineLineage: [] } };
  const meter = featureMeter(), candidate = ownCandidate([], "w", meter), owned = ownHistory(h, meter);
  const projection = projectOwn(owned, candidate, meter), prefix = encodeHistorical370(owned, candidate, projection, meter);
  return k.makeFeatureBlocks(meter, prefix.queue, ...prefix.positions, economicFeatures(projection, candidate, { balance: 2, uncertainty: 3 }, meter),
    promotionFeatures(projection, { witnessed: [], unlocated: [] }, "w", 21, meter));
};

describe("exact historical370 + append12 + append36 registry", () => {
  it("pins names, meaning IDs, scale pipelines, and historical promotion p", () => {
    const m = featureManifestV3(k.createStartupArtifactContext()), registry = featureRegistryV3(featureMeter());
    expect(m.dimension).toBe(418); expect(m.names).toHaveLength(418); expect(new Set(m.names).size).toBe(418);
    expect(m.entries[0]).toEqual({ name: "queue.pass", meaningId: "q:0", scaleId: "unit" });
    expect(m.entries[33]).toEqual({ name: "queue.ix.deployOwnPaidWaste", meaningId: "q:33", scaleId: "actions*paid" });
    expect(m.entries[34]).toEqual({ name: "position.0.present", meaningId: "p:0", scaleId: "unit" });
    expect(m.entries[34 + 23]).toEqual({ name: "position.0.promotion.p", meaningId: "p:23", scaleId: "unit" });
    expect(m.entries[369]).toEqual({ name: "position.3.ix.protectionPaidLoss", meaningId: "p:83", scaleId: "squares*paid" });
    expect(m.entries.slice(370, 382).map(e => e.name)).toEqual([
      "economic.ix.spendBalance", "economic.ix.spendUncertainty", "economic.ix.deployBalance", "economic.ix.deployUncertainty",
      "economic.ix.tradeBalance", "economic.ix.tradeUncertainty", "economic.ix.protectionBalance", "economic.ix.protectionUncertainty",
      "economic.spend", "economic.deploy", "economic.trade", "economic.protection",
    ]);
    expect(m.entries.slice(370, 382).map(e => e.meaningId)).toEqual(Array.from({ length: 12 }, (_, i) => `e:${i}`));
    expect(m.entries.slice(370, 382).map(e => e.scaleId)).toEqual(["meanCosts*unit", "meanCosts*unit", ...new Array(6).fill("minerals*unit"), "meanCosts", "minerals", "minerals", "minerals"]);
    expect(m.entries[382]).toEqual({ name: "promotion.exposure.witnessed.h1", meaningId: "promo:0:0:1", scaleId: "files" });
    expect(m.entries[417]).toEqual({ name: "promotion.visionAdded.unlocated.h3", meaningId: "promo:5:1:3", scaleId: "files" });
    expect(registry.map(r => r.name)).toEqual(m.names);
    expect(featureRegistryV3(featureMeter())).toBe(registry);
    expect(registry[31].formula).toContain("PK"); expect(m.scales.relationPairs).toBe(4096);
    expect(registry[382].formula).toContain("IncludingCC");
    expect(Object.isFrozen(m.entries[0])).toBe(true); expect(Object.isFrozen(m.names)).toBe(true);
  });

  it("rejects nonfinite numbers, malformed masks, nonlattice promotion and missing position values", () => {
    const blocks = passBlocks();
    const badEconomic = { ...blocks, economic: { ...blocks.economic, spend: NaN } };
    expect(() => flattenFeatureBlocksV3(badEconomic, featureMeter())).toThrow("PROVENANCE");
    const badPromotion = { ...blocks, promotion: { ...blocks.promotion, "exposure.witnessed.h1": .1 } };
    expect(() => flattenFeatureBlocksV3(badPromotion, featureMeter())).toThrow("PROVENANCE");
    const badMask = structuredClone(blocks); Object.assign(badMask.positions[0], { "actor.known": 1 });
    expect(() => flattenFeatureBlocksV3(badMask, featureMeter())).toThrow("PROVENANCE");
    const missing = structuredClone(blocks); Reflect.deleteProperty(missing.positions[0], "ray.open");
    expect(() => flattenFeatureBlocksV3(missing, featureMeter())).toThrow("PROVENANCE");
    const economicMeter = featureMeter(), economic = k.beginEconomic12(economicMeter);
    expect(() => k.putEconomic12(economicMeter, economic, 0, NaN)).toThrow("NUMBER");
    const promotionMeter = featureMeter(), promotion = k.beginPromotion36(promotionMeter);
    expect(() => k.putPromotion36(promotionMeter, promotion, 0, .1)).toThrow("NUMBER");
    const maskMeter = featureMeter(), position = k.beginPosition84(maskMeter);
    for (let i = 0; i < 84; i++) k.putPosition84(maskMeter, position, i, i === 28 ? 1 : 0);
    expect(() => k.finishPosition84(maskMeter, position)).toThrow("DERIVED");
    const missingMeter = featureMeter(), incomplete = k.beginPosition84(missingMeter);
    expect(() => k.finishPosition84(missingMeter, incomplete)).toThrow("CARDINALITY");
  });
});
