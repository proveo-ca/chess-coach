// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { describe, expect, it } from "vitest";
import type { AuthorizedHistory, ReconciledBoundaryState } from "@chess-coach/starchess-arena/observations";
import type { EncodedCandidate } from "@chess-coach/starchess-arena/intent-codec-v1";
import type { Candidate, CheckedBoundary, Configuration418, FeatureBlocksV3, History, Meter, Versions418 } from "../economic/contracts";
import { featureManifestV3, featureRegistryV3, promotionNamesV3, validateFeatureBlocksV3, validateFeatureManifestV3 } from "../feature/manifest";
import { ContractError } from "../economic/work";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Exact<T extends true> = T;
type HistoryAlias = Exact<Equal<History, AuthorizedHistory>>;
type BoundaryAlias = Exact<Equal<CheckedBoundary, ReconciledBoundaryState>>;
type CandidateAlias = Exact<Equal<Candidate, EncodedCandidate>>;
type ConfigurationKeys = Exact<Equal<keyof Configuration418,
  "profiles" | "horizon" | "dimension" | "uniqueCap" | "workCap" | "maxGeneratedActions" | "familyCapacity" | "compositionCapacity" | "passCapacity" |
  "maxStartedPerMaster" | "masters" | "checkpointCadence" | "initialization" | "arithmetic" | "optimizer" | "learningRate" | "temperature" | "l2" |
  "clipping" | "baseline" | "emptyDecision" | "abortPolicy" | "primaryMaster" | "openingRef" | "hostLimits" | "validation"
>>;
type VersionKeys = Exact<Equal<keyof Versions418,
  "snapshot" | "observationCodec" | "history" | "batch" | "ledger" | "provenance" | "candidateCodec" | "generator" | "projection" | "features" |
  "featureManifest" | "comparator" | "rng" | "episodeProtocol" | "checkpoint" | "artifact" | "optimizer" | "loss" | "eligibility" | "recipe" | "hostConfig"
>>;
const m = (): Meter => ({ limit: 1048576, used: 0 });
type MutableManifest = { version: string; dimension: number; names: string[]; entries: Record<string,string>[]; scales: Record<string,number> };
type MutableBlocks = { version: string; queue: Record<string,number>; positions: Record<string,number>[]; economic: Record<string,number>; promotion: Record<string,number> };
const Q = `pass actionCount requestedMinerals requestedGas timing.BCount timing.CCount timing.FCount mineralMargin gasMargin
nominal.deployCrushOwnPaid nominal.deployCrushOwnReplacement nominal.newlyLit nominal.ccExposureKnown nominal.ccExposurePossible nominal.ccProtection
pair.sameActor pair.BC pair.CF pair.mineRelocate pair.deployMove pair.timingInversions nominal.visionOverlap ix.spendOwnPaidLoss
ix.tradeEnemyPaidBound ix.tradeEnemyReplacementBound ix.noveltyUnknown ix.ccExposureVulnerability ix.mineRelocateUnknown ix.spendTurn
ix.passVulnerability ix.deployGasIncome ix.pressureLossUncertainty ix.spendOwnPaidWaste ix.deployOwnPaidWaste`.split(/\s+/);
const P = `present kind.classical kind.deploy kind.stimStep kind.spiderMine kind.charonMissiles kind.siegeMode kind.tacticalJump timing.B timing.C timing.F
from.file from.rank to.present to.file to.rank deployUnit.none deployUnit.p deployUnit.n deployUnit.b deployUnit.r deployUnit.q
promotion.none promotion.p promotion.n promotion.b promotion.r promotion.q actor.known actor.absent actor.nominal actor.paidKnown
actor.type.p actor.type.n actor.type.b actor.type.r actor.type.q actor.type.k actor.tankMode.known actor.tankMode.sieged
target.absent target.unknown target.knownEmpty target.own target.enemy target.type.p target.type.n target.type.b target.type.r target.type.q target.type.k
target.memory.present target.memory.age cost.minerals cost.gas actor.paid actor.replacement ray.applicable ray.open ray.blocked ray.uncertain
path.knownEmpty path.knownOccupied path.unknown nominal.newlyLit nominal.staleApproach exposure.known exposure.possible pressure.units pressure.cc protection.units protection.cc
ix.spendLiquidity ix.gasAvailability ix.deployMargin ix.exposurePaidKnown ix.exposurePaidPossible ix.exposureReplacement ix.tradeEnemyLoss ix.ccPressureRisk
ix.noveltyReveal ix.uncertainRayDistance ix.staleApproachAge ix.protectionPaidLoss`.split(/\s+/);
const E = `ix.spendBalance ix.spendUncertainty ix.deployBalance ix.deployUncertainty ix.tradeBalance ix.tradeUncertainty ix.protectionBalance ix.protectionUncertainty spend deploy trade protection`.split(" ");
const kernels = ["exposure", "blockerAdded", "blockerRemoved", "attackCoverAdded", "attackCoverRemoved", "visionAdded"];
const channels = ["witnessed", "unlocated"];
const expectedNames = [
  ...Q.map(name => `queue.${name}`), ...[0,1,2,3].flatMap(slot => P.map(name => `position.${slot}.${name}`)),
  ...E.map(name => `economic.${name}`), ...kernels.flatMap(kernel => channels.flatMap(channel => [1,2,3].map(h => `promotion.${kernel}.${channel}.h${h}`))),
];
const QS = `unit actions minerals gas actions actions actions minerals gas paid replacement squares squares squares unit pairs pairs pairs pairs pairs pairs visionOverlap
meanCosts*paid relationPairs*paid relationPairs*replacement squares*squares squares*ccComplement pairs*squares meanCosts*turn ccComplement actions*gas relationPairs meanCosts*paid actions*paid`.split(/\s+/);
const positionScale = (k: number): string => {
  if ([11,12,14,15,65,81].includes(k)) return "coords";
  if (k === 52) return "turn";
  if ([53,55,56,74].includes(k)) return "minerals";
  if (k === 54) return "gas";
  if ([61,62,63,64,66,67,68,70,80].includes(k)) return "squares";
  return ({72:"minerals*minerals",73:"gas*gas",75:"squares*minerals",76:"squares*minerals",77:"squares*minerals",78:"squares*replacement",79:"ccComplement",82:"coords*turn",83:"squares*paid"} as Record<number,string>)[k] ?? "unit";
};
const ES = ["meanCosts*unit", "meanCosts*unit", ...Array.from({ length: 6 }, () => "minerals*unit"), "meanCosts", "minerals", "minerals", "minerals"];
const expectedScales = {
  minerals:12, gas:3, turn:45, ccLives:3, maxSpawn:9, paid:3072, replacement:2304,
  coords:7, squares:64, actions:4, pairs:6, relationPairs:4096, visionOverlap:256, files:8,
};
const fixture = (): FeatureBlocksV3 => ({
  version: "challenge-features-v3",
  queue: Object.fromEntries(Q.map(name => [name, name === "pass" ? 1 : 0])) as FeatureBlocksV3["queue"],
  positions: Array.from({ length: 4 }, () => Object.fromEntries(P.map(name => [name, 0]))) as unknown as FeatureBlocksV3["positions"],
  economic: Object.fromEntries(E.map(name => [name, 0])) as FeatureBlocksV3["economic"],
  promotion: Object.fromEntries(expectedNames.slice(382).map(name => [name.slice(10), 0])) as FeatureBlocksV3["promotion"],
});
const presentFixture = (): MutableBlocks => {
  const a = structuredClone(fixture()) as unknown as MutableBlocks;
  Object.assign(a.queue, { pass:0, actionCount:.25, "timing.CCount":.25 });
  Object.assign(a.positions[0], {
    present:1, "kind.classical":1, "timing.C":1, "deployUnit.none":1, "promotion.none":1,
    "actor.known":1, "actor.paidKnown":1, "actor.type.p":1, "actor.replacement":1/12,
    "to.present":1, "from.file":2/7, "from.rank":1/7, "to.file":2/7, "to.rank":2/7, "target.unknown":1,
  });
  return a;
};
const spendingFixture = (): MutableBlocks => {
  const a = presentFixture();
  a.positions[1] = { ...a.positions[0] };
  Object.assign(a.positions[0], {
    "kind.classical":0, "kind.deploy":1, "timing.C":0, "timing.B":1, "deployUnit.none":0, "deployUnit.p":1,
    "actor.type.p":0, "actor.type.k":1, "actor.replacement":0, "from.file":4/7, "from.rank":0,
    "cost.minerals":1/12, "cost.gas":1/3, "ix.spendLiquidity":1/48, "ix.gasAvailability":1/9, "ix.deployMargin":2/12,
  });
  Object.assign(a.queue, { actionCount:.5, "timing.BCount":.25, requestedMinerals:1/12, requestedGas:1/3, mineralMargin:2/12 });
  return a;
};

describe("frozen V3 registry", () => {
  it("matches all 418 independently declared names, indices, meanings and scales in order", () => {
    const manifest = featureManifestV3(m()), registry = featureRegistryV3(m());
    expect(manifest.version).toBe("challenge-feature-manifest-v3"); expect(manifest.dimension).toBe(418);
    expect(manifest.names).toEqual(expectedNames); expect(new Set(manifest.names).size).toBe(418);
    const entries = [
      ...Q.map((name,j) => ({ name:`queue.${name}`, meaningId:`q:${j}`, scaleId:QS[j] })),
      ...[0,1,2,3].flatMap(slot => P.map((name,k) => ({ name:`position.${slot}.${name}`, meaningId:`p:${k}`, scaleId:positionScale(k) }))),
      ...E.map((name,j) => ({ name:`economic.${name}`, meaningId:`e:${j}`, scaleId:ES[j] })),
      ...kernels.flatMap((kernel,k) => channels.flatMap((channel,c) => [1,2,3].map(h => ({ name:`promotion.${kernel}.${channel}.h${h}`, meaningId:`promo:${k}:${c}:${h}`, scaleId:"files" })))),
    ];
    expect(manifest.entries).toEqual(entries); expect(manifest.scales).toEqual(expectedScales);
    for (let i = 0; i < 418; i++) {
      expect(registry[i]).toMatchObject({ ...entries[i], index:i, dtype:"float64" });
      expect(Object.keys(manifest.entries[i]!).sort()).toEqual(["meaningId","name","scaleId"]);
    }
  });
  it("preserves the four historical prefix slots and the six promotion one-hots including p", () => {
    const names = featureManifestV3(m()).names;
    for (let slot = 0; slot < 4; slot++) {
      expect(names.slice(34+84*slot, 34+84*(slot+1))).toEqual(P.map(name => `position.${slot}.${name}`));
      expect(names.slice(34+84*slot+22, 34+84*slot+28)).toEqual(["none","p","n","b","r","q"].map(type => `position.${slot}.promotion.${type}`));
    }
    expect(names[369]).toBe("position.3.ix.protectionPaidLoss");
    expect(names[370]).toBe("economic.ix.spendBalance"); expect(names[381]).toBe("economic.protection");
    expect(names[382]).toBe("promotion.exposure.witnessed.h1"); expect(names[417]).toBe("promotion.visionAdded.unlocated.h3");
  });
  it("preserves every queue formula independently of registry construction", () => {
    const expected = [
      "I(n=0)","n/4","totalRequestedMinerals/12","totalRequestedGas/3","BCount/4","CCount/4","FCount/4","(bank-totalRequestedMinerals)/12","(gas-totalRequestedGas)/3",
      "sumDistinctCrushedCurrentLineagePaidBasis/3072","sumDistinctCrushedCurrentLineageReplacement/2304","cardinality(N_Q)/64",
      "knownObservedEnemyRelationsToFinalOwnCC/64","possibleObservedEnemyRelationsToFinalOwnCC/64","I(baselineCCKnownExposed AND NOT finalCCKnownExposed)",
      "sameActorPairs/6","sameActorBCPairs/6","sameActorCFPairs/6","sameActorMineClassicalRelocationPairs/6","BDeployChildClassicalPairs/6","authoredPhaseInversionPairs/6",
      "(sum_i cardinality(N_i)-cardinality(N_Q))/256","s*D","PK*EP","PK*ER","NL*U","(CK+CP)*Cv","pair.mineRelocate*U","s*turn/45","pass*Cv",
      "(deployCount/4)*gasIncome/3","PK*I(enemyLoss.upper='unknown')","s*W","(deployCount/4)*W",
    ];
    expect(featureRegistryV3(m()).slice(0,34).map(row => row.formula)).toEqual(expected);
    expect(featureRegistryV3(m()).slice(0,34).every(row => row.mask === "none")).toBe(true);
  });
  it("preserves all 84 position formulas and the declared conditional masks", () => {
    const expected = [
      "I(actionPresent)", ...["classical","deploy","stimStep","spiderMine","charonMissiles","siegeMode","tacticalJump"].map(kind => `I(kind=${kind})`),
      ...["B","C","F"].map(timing => `I(timing=${timing})`),
      "authoredFromFile/7","authoredFromRank/7","I(authoredToPresent)","authoredToFile/7","authoredToRank/7",
      ...["deployUnit","promotion"].flatMap(family => ["none","p","n","b","r","q"].map(type => `I(${family}=${type})`)),
      "I(actualOwnLineageMatchesActorToken)","I(noActorToken)","I(actorDiffersFromCurrent OR hypotheticalBirth OR unknownDependentRewrite)","I(existingActualOwnLineage)",
      ...["p","n","b","r","q","k"].map(type => `I(nominalActorType=${type})`),
      "I(actorType=r AND ownTankModeKnown)","I(actorType=r AND nominalTankMode=siege)",
      "I(noAuthoredTarget)","I(authoredTargetUnknown)","I(authoredTargetKnownEmpty)","I(authoredTargetOwn)","I(authoredTargetEnemy)",
      ...["p","n","b","r","q","k"].map(type => `I(currentObservedTargetType=${type})`),
      "I(enemyMemoryAtAuthoredTarget)","(turn-targetMemoryObservedTurn)/45","requestedActionMinerals/12","requestedActionGas/3","confirmedActorPaidBasis/12","nominalActorReplacementExcludingCC/12",
      "I(classicalSlidingRay)","I(applicableRayKnownOpen)","I(applicableRayKnownBlocked)","I(applicableRayUncertain)",
      "effectiveRayKnownEmptyIntermediates/64","effectiveRayKnownOccupiedIntermediates/64","effectiveRayUnknownIntermediates/64","cardinality(N_i)/64","positiveChebyshevReductionToSelectedStaleSquare/7",
      "knownObservedEnemySourcesToActorAfter/64","possibleObservedEnemySourcesToActorAfter/64","knownDistinctObservedNonCCTargetsFromActorAfter/64","I(knownObservedEnemyCCRelationFromActorAfter)",
      "positiveThreatenedOwnNonCCTokenReduction/64","I(beforeCCKnownExposed AND NOT afterCCKnownExposed)",
      "cost.minerals*B","cost.gas*A","I(kind=deploy)*MM","exposure.known*actor.paid*actor.paidKnown","exposure.possible*actor.paid*actor.paidKnown",
      "exposure.known*actor.replacement","pressure.units*ER","pressure.cc*Cv","nominal.newlyLit*I(nominalActorType=b)","ray.uncertain*effectiveChebyshevDistance/7",
      "nominal.staleApproach*selectedStaleMemoryAge","protection.units*D",
    ];
    const masks = Array.from({ length:84 }, () => "present=1"); masks[0] = "none";
    for (const k of [14,15]) masks[k] = "present=1 && to.present=1";
    masks[52] = "present=1 && target.memory.present=1"; masks[55] = "present=1 && actor.paidKnown=1";
    for (const k of [32,33,34,35,36,37,38,39,56,65,66,67,68,69,70,71]) masks[k] = "present=1 && actor.absent=0";
    for (const k of [61,62,63]) masks[k] = "present=1 && ray.applicable=1";
    const registry = featureRegistryV3(m());
    for (let slot = 0; slot < 4; slot++) {
      expect(registry.slice(34+84*slot,34+84*(slot+1)).map(row => row.formula)).toEqual(expected);
      expect(registry.slice(34+84*slot,34+84*(slot+1)).map(row => row.mask)).toEqual(masks);
    }
  });
  it("declares raw-unit economic products and destination-file pooling", () => {
    const registry = featureRegistryV3(m());
    expect(registry.slice(370,382).map(row => row.formula)).toEqual(["S*b","S*u","A*b","A*u","T*b","T*u","P*b","P*u","S","A","T","P"]);
    expect(registry.slice(370,382).map(row => [row.low,row.high])).toEqual([[-576,576],[0,288],[-27648,27648],[-13824,288],[-1728,1728],[-864,216],[-27648,27648],[0,13824],[0,1],[-48,1],[-3,.75],[0,48]]);
    for (let k = 0; k < 6; k++) for (let c = 0; c < 2; c++) for (let h = 1; h <= 3; h++) {
      const index = 382 + 6*k + 3*c + h-1;
      expect(registry[index]).toMatchObject({ index, name:`promotion.${kernels[k]}.${channels[c]}.h${h}`, meaningId:`promo:${k}:${c}:${h}`, scaleId:"files", formula:"qualifyingDistinctPromotionDestinationFiles/8", mask:"none", low:0, high:1 });
    }
  });
  it("freezes detached manifest results and meters each construction", () => {
    const meter = m(), a = featureManifestV3(meter), used = meter.used, b = featureManifestV3(meter);
    expect(meter.used).toBe(2*used); expect(a).toEqual(b); expect(a).not.toBe(b); expect(a.names).not.toBe(b.names);
    expect(Object.isFrozen(a)).toBe(true); expect(Object.isFrozen(a.entries[0])).toBe(true); expect(Object.isFrozen(a.scales)).toBe(true);
    expect(Object.keys(a).sort()).toEqual(["dimension","entries","names","scales","version"]);
  });
  it("rejects artifact-defined names, entries, scale substitutions and legacy dimensions", () => {
    const original = featureManifestV3(m());
    for (const mutate of [
      (a: MutableManifest) => { a.names[370] = "economic.custom"; },
      (a: MutableManifest) => { a.entries[0].meaningId = "q:1"; },
      (a: MutableManifest) => { a.entries[370].scaleId = "replacement"; },
      (a: MutableManifest) => { a.entries[0].dtype = "float64"; },
      (a: MutableManifest) => { a.scales.files = 9; },
      (a: MutableManifest) => { a.scales.unit = 1; },
      (a: MutableManifest) => { a.dimension = 370; },
      (a: MutableManifest) => { a.version = "challenge-feature-manifest-v2"; },
    ]) { const a = structuredClone(original) as unknown as MutableManifest; mutate(a); expect(() => validateFeatureManifestV3(a, m())).toThrow(ContractError); }
    expect(validateFeatureManifestV3(original, m())).toEqual(original);
  });
});

describe("exact literal local feature blocks", () => {
  it.each([
    ["queue pass", (a: MutableBlocks) => { a.queue.pass = .5; }],
    ["actor nominal", (a: MutableBlocks) => { a.positions[0]["actor.nominal"] = .5; }],
    ["coordinate lattice", (a: MutableBlocks) => { a.positions[0]["from.file"] = .1; }],
    ["source-count lattice", (a: MutableBlocks) => { a.positions[0]["exposure.known"] = .1; }],
    ["absent coordinates", (a: MutableBlocks) => { a.positions[0]["to.present"] = 0; a.positions[0]["to.file"] = 1; }],
    ["unknown target type", (a: MutableBlocks) => { a.positions[0]["target.type.q"] = 1; }],
    ["absent actor type", (a: MutableBlocks) => { a.positions[0]["actor.absent"] = 1; a.positions[0]["actor.known"] = 0; }],
    ["non-Tank mode", (a: MutableBlocks) => { a.positions[0]["actor.tankMode.known"] = 1; }],
    ["unknown paid basis", (a: MutableBlocks) => { a.positions[0]["actor.paidKnown"] = 0; a.positions[0]["actor.paid"] = 1/12; }],
    ["absent memory age", (a: MutableBlocks) => { a.positions[0]["target.memory.age"] = 1/45; }],
    ["nonray path", (a: MutableBlocks) => { a.positions[0]["path.unknown"] = 1/64; }],
    ["zero spend interaction", (a: MutableBlocks) => { a.economic["ix.spendBalance"] = 1; }],
    ["zero exposure interaction", (a: MutableBlocks) => { a.positions[0]["ix.exposurePaidKnown"] = .25; }],
    ["zero queue novelty", (a: MutableBlocks) => { a.queue["ix.noveltyUnknown"] = .25; }],
  ] as const)("rejects the reviewed %s inconsistency", (_name, mutate) => {
    const a = presentFixture(); mutate(a); expect(() => validateFeatureBlocksV3(a, m())).toThrow(ContractError);
  });
  it("accepts present unknown, absent-target and known-enemy controls", () => {
    const a = presentFixture(); expect(validateFeatureBlocksV3(a, m())).toEqual(a);
    Object.assign(a.positions[0], { "to.present":0, "to.file":0, "to.rank":0, "target.unknown":0, "target.absent":1 });
    expect(validateFeatureBlocksV3(a, m())).toEqual(a);
    Object.assign(a.positions[0], { "to.present":1, "to.file":2/7, "to.rank":2/7, "target.absent":0, "target.enemy":1, "target.type.q":1 });
    expect(validateFeatureBlocksV3(a, m())).toEqual(a);
  });
  it("rejects incompatible economic balance and uncertainty ratios across nonzero measurements", () => {
    const a = spendingFixture();
    const spend = .5 * (1/12 + 1/3);
    Object.assign(a.economic, { spend, deploy:1/12, "ix.spendBalance":spend*4, "ix.deployBalance":1/12*5 });
    expect(() => validateFeatureBlocksV3(a, m())).toThrow(ContractError);
    Object.assign(a.economic, { "ix.deployBalance":1/12*4, "ix.spendUncertainty":spend*2, "ix.deployUncertainty":1/12*3 });
    expect(() => validateFeatureBlocksV3(a, m())).toThrow(ContractError);
  });
  it("accepts consistent economic products with negative trade and legitimate binary64 rounding", () => {
    const a = spendingFixture(), spend = .5 * (1/12 + 1/3), balance = 1/3, uncertainty = 1.5;
    for (const [name, coefficient] of [["spend",spend],["deploy",1/12],["trade",-1/12],["protection",5/12]] as const) {
      a.economic[name] = coefficient;
      a.economic[`ix.${name}Balance`] = coefficient * balance;
      a.economic[`ix.${name}Uncertainty`] = coefficient * uncertainty;
    }
    expect(validateFeatureBlocksV3(a, m())).toEqual(a);
  });
  it("recovers integer resources before validating liquidity products across cancellation", () => {
    const a = spendingFixture();
    Object.assign(a.positions[0], { "deployUnit.p":0, "deployUnit.n":1, "cost.minerals":3/12, "ix.spendLiquidity":(3/12)*(1/12), "ix.deployMargin":-2/12 });
    Object.assign(a.queue, { requestedMinerals:3/12, mineralMargin:-2/12 });
    a.economic.spend = .5 * (3/12 + 1/3);
    expect(validateFeatureBlocksV3(a, m())).toEqual(a);
  });
  it("accepts dense four-slot absent blocks and promotion file fractions", () => {
    const a = structuredClone(fixture());
    for (const name of promotionNamesV3(m())) Object.assign(a.promotion, { [name]: .375 });
    const result = validateFeatureBlocksV3(a, m()); expect(result).toEqual(a);
    expect(Object.keys(result.queue)).toEqual(Q); expect(Object.keys(result.positions[0])).toEqual(P);
    expect(Object.keys(result.economic)).toEqual(E); expect(Object.keys(result.promotion)).toEqual(expectedNames.slice(382).map(name => name.slice(10)));
    expect(Object.isFrozen(result.positions[0])).toBe(true);
  });
  it("rejects extra/nested keys, sparse slots, live values in absent slots and nonfinite values", () => {
    for (const mutate of [
      (a: MutableBlocks) => Object.assign(a.queue, { timing: { BCount:0 } }),
      (a: MutableBlocks) => { a.positions.pop(); },
      (a: MutableBlocks) => { delete a.positions[0]; },
      (a: MutableBlocks) => { a.positions[0]["promotion.none"] = 1; },
      (a: MutableBlocks) => { a.economic.spend = NaN; },
      (a: MutableBlocks) => { a.promotion["exposure.witnessed.h1"] = .1; },
      (a: MutableBlocks) => { a.economic["ix.spendBalance"] = 577; },
      (a: MutableBlocks) => { a.version = "challenge-features-v2"; },
    ]) { const a = structuredClone(fixture()) as unknown as MutableBlocks; mutate(a); expect(() => validateFeatureBlocksV3(a, m())).toThrow(ContractError); }
  });
  it("rejects getters without executing them", () => {
    let reads = 0; const a = structuredClone(fixture());
    Object.defineProperty(a.positions[0], "present", { enumerable:true, get() { reads++; return 0; } });
    expect(() => validateFeatureBlocksV3(a, m())).toThrow(ContractError); expect(reads).toBe(0);
  });
});
