import { ECONOMIC_NAMES, POSITION_NAMES, PROMOTION_CHANNELS, PROMOTION_KERNELS, QUEUE_NAMES } from "../economic/contracts";
import type { FeatureBlocksV3, FeatureManifestV3, ManifestEntry, MeaningId, Meter, PromotionName, ScaleId, Scales } from "../economic/contracts";
import { charge, fail } from "../economic/work";

export type FeatureDescriptor = Readonly<{
  index: number; name: string; meaningId: MeaningId; scaleId: ScaleId;
  dtype: "float64"; formula: string; mask: string; low: number; high: number;
}>;
export const SCALES_V3: Scales = Object.freeze({
  minerals: 12, gas: 3, turn: 45, ccLives: 3, maxSpawn: 9, paid: 3072, replacement: 2304,
  coords: 7, squares: 64, actions: 4, pairs: 6, relationPairs: 4096, visionOverlap: 256, files: 8,
});
const QUEUE_SCALES: readonly ScaleId[] = [
  "unit", "actions", "minerals", "gas", "actions", "actions", "actions", "minerals", "gas", "paid", "replacement",
  "squares", "squares", "squares", "unit", "pairs", "pairs", "pairs", "pairs", "pairs", "pairs", "visionOverlap",
  "meanCosts*paid", "relationPairs*paid", "relationPairs*replacement", "squares*squares", "squares*ccComplement",
  "pairs*squares", "meanCosts*turn", "ccComplement", "actions*gas", "relationPairs", "meanCosts*paid", "actions*paid",
];
const POSITION_SCALES: readonly ScaleId[] = [
  "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit",
  "coords", "coords", "unit", "coords", "coords",
  "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit",
  "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit",
  "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "turn",
  "minerals", "gas", "minerals", "minerals", "unit", "unit", "unit", "unit",
  "squares", "squares", "squares", "squares", "coords", "squares", "squares", "squares", "unit", "squares", "unit",
  "minerals*minerals", "gas*gas", "minerals", "squares*minerals", "squares*minerals", "squares*minerals",
  "squares*replacement", "ccComplement", "squares", "coords", "coords*turn", "squares*paid",
];
const QUEUE_FORMULAS = [
  "I(n=0)", "n/4", "totalRequestedMinerals/12", "totalRequestedGas/3", "BCount/4", "CCount/4", "FCount/4",
  "(bank-totalRequestedMinerals)/12", "(gas-totalRequestedGas)/3",
  "sumDistinctCrushedCurrentLineagePaidBasis/3072", "sumDistinctCrushedCurrentLineageReplacement/2304",
  "cardinality(N_Q)/64", "knownObservedEnemyRelationsToFinalOwnCC/64", "possibleObservedEnemyRelationsToFinalOwnCC/64",
  "I(baselineCCKnownExposed AND NOT finalCCKnownExposed)", "sameActorPairs/6", "sameActorBCPairs/6", "sameActorCFPairs/6",
  "sameActorMineClassicalRelocationPairs/6", "BDeployChildClassicalPairs/6", "authoredPhaseInversionPairs/6",
  "(sum_i cardinality(N_i)-cardinality(N_Q))/256", "s*D", "PK*EP", "PK*ER", "NL*U", "(CK+CP)*Cv",
  "pair.mineRelocate*U", "s*turn/45", "pass*Cv", "(deployCount/4)*gasIncome/3", "PK*I(enemyLoss.upper='unknown')", "s*W", "(deployCount/4)*W",
];
const POSITION_FORMULAS = [
  "I(actualOwnLineageMatchesActorToken)", "I(noActorToken)", "I(actorDiffersFromCurrent OR hypotheticalBirth OR unknownDependentRewrite)", "I(existingActualOwnLineage)",
  "I(nominalActorType=p)", "I(nominalActorType=n)", "I(nominalActorType=b)", "I(nominalActorType=r)", "I(nominalActorType=q)", "I(nominalActorType=k)",
  "I(actorType=r AND ownTankModeKnown)", "I(actorType=r AND nominalTankMode=siege)",
  "I(noAuthoredTarget)", "I(authoredTargetUnknown)", "I(authoredTargetKnownEmpty)", "I(authoredTargetOwn)", "I(authoredTargetEnemy)",
  "I(currentObservedTargetType=p)", "I(currentObservedTargetType=n)", "I(currentObservedTargetType=b)", "I(currentObservedTargetType=r)", "I(currentObservedTargetType=q)", "I(currentObservedTargetType=k)",
  "I(enemyMemoryAtAuthoredTarget)", "(turn-targetMemoryObservedTurn)/45", "requestedActionMinerals/12", "requestedActionGas/3",
  "confirmedActorPaidBasis/12", "nominalActorReplacementExcludingCC/12",
  "I(classicalSlidingRay)", "I(applicableRayKnownOpen)", "I(applicableRayKnownBlocked)", "I(applicableRayUncertain)",
  "effectiveRayKnownEmptyIntermediates/64", "effectiveRayKnownOccupiedIntermediates/64", "effectiveRayUnknownIntermediates/64",
  "cardinality(N_i)/64", "positiveChebyshevReductionToSelectedStaleSquare/7", "knownObservedEnemySourcesToActorAfter/64", "possibleObservedEnemySourcesToActorAfter/64",
  "knownDistinctObservedNonCCTargetsFromActorAfter/64", "I(knownObservedEnemyCCRelationFromActorAfter)", "positiveThreatenedOwnNonCCTokenReduction/64", "I(beforeCCKnownExposed AND NOT afterCCKnownExposed)",
  "cost.minerals*B", "cost.gas*A", "I(kind=deploy)*MM", "exposure.known*actor.paid*actor.paidKnown", "exposure.possible*actor.paid*actor.paidKnown",
  "exposure.known*actor.replacement", "pressure.units*ER", "pressure.cc*Cv", "nominal.newlyLit*I(nominalActorType=b)",
  "ray.uncertain*effectiveChebyshevDistance/7", "nominal.staleApproach*selectedStaleMemoryAge", "protection.units*D",
];
const ECONOMIC_FORMULAS = ["S*b", "S*u", "A*b", "A*u", "T*b", "T*u", "P*b", "P*u", "S", "A", "T", "P"];
const ECONOMIC_SCALES: readonly ScaleId[] = ["meanCosts*unit", "meanCosts*unit", "minerals*unit", "minerals*unit", "minerals*unit", "minerals*unit", "minerals*unit", "minerals*unit", "meanCosts", "minerals", "minerals", "minerals"];
const ECONOMIC_DOMAINS = [[-576, 576], [0, 288], [-27648, 27648], [-13824, 288], [-1728, 1728], [-864, 216], [-27648, 27648], [0, 13824], [0, 1], [-48, 1], [-3, .75], [0, 48]] as const;
const PROMOTION_FORMULAS = [
  "distinctFiles(candidateCompatible AND noCandidateOwnBlockerContacts AND someCompatiblePromotedTypeKnownOrPossibleAttacksSurvivingOwnUnitIncludingCC)/8",
  "distinctFiles(someRoute: B_Q\\B_0 nonempty)/8", "distinctFiles(someRoute: B_0\\B_Q nonempty)/8",
  "distinctFiles(someRoute: C_Q\\C_0 nonempty)/8", "distinctFiles(someRoute: C_0\\C_Q nonempty)/8", "distinctFiles(someRoute: V_Q\\V_0 nonempty)/8",
];

export const promotionNamesV3 = (meter: Meter): readonly PromotionName[] => {
  charge(meter, 2, "$.work.feature.manifest.promotionNamesAllocate");
  const result: PromotionName[] = [];
  for (const kernel of PROMOTION_KERNELS) for (const channel of PROMOTION_CHANNELS) for (const h of [1, 2, 3] as const) {
    charge(meter, 14, "$.work.feature.manifest.promotionNameVisit");
    result.push(`${kernel}.${channel}.h${h}`);
  }
  charge(meter, 37, "$.work.feature.manifest.promotionNamesFreeze");
  return Object.freeze(result);
};

export const featureRegistryV3 = (meter: Meter): readonly FeatureDescriptor[] => {
  charge(meter, 2, "$.work.feature.manifest.registryAllocate");
  const entries: FeatureDescriptor[] = [];
  const add = (name: string, meaningId: MeaningId, scaleId: ScaleId, formula: string, mask: string, low = 0, high = 1): void => {
    charge(meter, 34 + name.length + meaningId.length, "$.work.feature.manifest.descriptorAllocate");
    entries.push(Object.freeze({ index: entries.length, name, meaningId, scaleId, dtype: "float64", formula, mask, low, high }));
  };
  for (let k = 0; k < 34; k++) {
    charge(meter, 14, "$.work.feature.manifest.queueVisit");
    add(`queue.${QUEUE_NAMES[k]}`, `q:${k}`, QUEUE_SCALES[k], QUEUE_FORMULAS[k], "none", k === 7 || k === 8 ? -1 : 0, k === 23 ? 0 : 1);
  }
  for (let i = 0; i < 4; i++) for (let k = 0; k < 84; k++) {
    charge(meter, 54 + POSITION_NAMES[k].length * 2, "$.work.feature.manifest.positionFormulaAndMask");
    const name = POSITION_NAMES[k];
    const formula = k === 0 ? "I(actionPresent)" : k <= 10 ? `I(${name.replace(".", "=")})` : k <= 15 ?
      ["authoredFromFile/7", "authoredFromRank/7", "I(authoredToPresent)", "authoredToFile/7", "authoredToRank/7"][k - 11] :
      k <= 27 ? `I(${name.replace(".", "=")})` : POSITION_FORMULAS[k - 28];
    const mask = k === 0 ? "none" : k === 14 || k === 15 ? "present=1 && to.present=1" :
      k === 52 ? "present=1 && target.memory.present=1" : k === 55 ? "present=1 && actor.paidKnown=1" :
      k >= 61 && k <= 63 ? "present=1 && ray.applicable=1" :
      k >= 32 && k <= 39 || k === 56 || k >= 65 && k <= 71 ? "present=1 && actor.absent=0" : "present=1";
    add(`position.${i}.${name}`, `p:${k}`, POSITION_SCALES[k], formula, mask, k === 74 ? -1 : 0);
  }
  for (let k = 0; k < 12; k++) {
    charge(meter, 12, "$.work.feature.manifest.economicVisit");
    add(`economic.${ECONOMIC_NAMES[k]}`, `e:${k}`, ECONOMIC_SCALES[k], ECONOMIC_FORMULAS[k], "none", ECONOMIC_DOMAINS[k][0], ECONOMIC_DOMAINS[k][1]);
  }
  for (let k = 0; k < 6; k++) for (let c = 0; c < 2; c++) for (const h of [1, 2, 3] as const) {
    charge(meter, 17, "$.work.feature.manifest.promotionVisit");
    add(`promotion.${PROMOTION_KERNELS[k]}.${PROMOTION_CHANNELS[c]}.h${h}`, `promo:${k}:${c}:${h}`, "files", PROMOTION_FORMULAS[k], `arrivalWithin<=${h}Opportunities`);
  }
  charge(meter, 419, "$.work.feature.manifest.registryFreeze");
  return Object.freeze(entries);
};

export const featureManifestV3 = (meter: Meter): FeatureManifestV3 => {
  const registry = featureRegistryV3(meter);
  charge(meter, 4, "$.work.feature.manifest.arraysAllocate");
  const names: string[] = [], entries: ManifestEntry[] = [];
  for (const descriptor of registry) {
    charge(meter, 17, "$.work.feature.manifest.entryVisit");
    names.push(descriptor.name); entries.push(Object.freeze({ name: descriptor.name, meaningId: descriptor.meaningId, scaleId: descriptor.scaleId }));
  }
  charge(meter, 12 + 2 * registry.length, "$.work.feature.manifest.recordFreeze");
  return Object.freeze({ version: "challenge-feature-manifest-v3", dimension: 418, names: Object.freeze(names), entries: Object.freeze(entries), scales: SCALES_V3 });
};

const equal = (actual: number, expected: number, meter: Meter, path: string): void => {
  charge(meter, 2, "$.work.feature.flatten.derivedEquality");
  if (actual !== expected) fail(path, "DERIVED");
};
const lattice = (value: number, divisor: number, meter: Meter, path: string): void => {
  charge(meter, 10, "$.work.feature.flatten.lattice");
  const n = Math.round(value * divisor);
  if (!Number.isSafeInteger(n) || n / divisor !== value) fail(path, "NUMBER");
};

export const flattenFeatureBlocksV3 = (blocks: FeatureBlocksV3, meter: Meter): Float64Array => {
  charge(meter, 12, "$.work.feature.flatten.header");
  if (blocks.version !== "challenge-features-v3") fail("$.version", "VERSION");
  if (blocks.positions.length !== 4) fail("$.positions", "CARDINALITY");
  const registry = featureRegistryV3(meter), promotionNames = promotionNamesV3(meter);
  charge(meter, 3 + 418, "$.work.feature.flatten.bufferAllocate");
  const result = new Float64Array(418);
  const append = (block: Readonly<Record<string, number>>, names: readonly string[], start: number, path: string): void => {
    for (let k = 0; k < names.length; k++) {
      charge(meter, 23, "$.work.feature.flatten.valueVisit");
      const name = names[k], descriptor = Object.getOwnPropertyDescriptor(block, name), domain = registry[start + k];
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) fail(`${path}.${name}`, "SCHEMA");
      const value: number = descriptor.value;
      if (typeof value !== "number" || !Number.isFinite(value)) fail(`${path}.${name}`, "NONFINITE");
      if (value < domain.low || value > domain.high) fail(`${path}.${name}`, "NUMBER");
      result[start + k] = value;
    }
  };
  append(blocks.queue, QUEUE_NAMES, 0, "$.queue");
  for (let i = 0; i < 4; i++) {
    charge(meter, 4, "$.work.feature.flatten.positionVisit");
    const p = blocks.positions[i];
    if (!p) fail(`$.positions[${i}]`, "ARRAY");
    append(p, POSITION_NAMES, 34 + 84 * i, `$.positions[${i}]`);
    for (let k = 0; k < 84; k++) {
      charge(meter, 24, "$.work.feature.flatten.positionDomainVisit");
      const value = result[34 + 84 * i + k];
      if (p.present === 0 && value !== 0) fail(`$.positions[${i}]`, "DERIVED");
      const indicator = k <= 10 || k === 13 || k >= 16 && k <= 51 || k >= 57 && k <= 60 || k === 69 || k === 71;
      if (indicator && value !== 0 && value !== 1) fail(`$.positions[${i}].${POSITION_NAMES[k]}`, "NUMBER");
    }
    if (p.present === 0) continue;
    for (const [lo, hi] of [[1, 8], [8, 11], [16, 22], [22, 28], [40, 45]] as const) {
      charge(meter, 4, "$.work.feature.flatten.oneHotSetup");
      let sum = 0;
      for (let k = lo; k < hi; k++) { charge(meter, 5, "$.work.feature.flatten.oneHotVisit"); sum += result[34 + 84 * i + k]; }
      equal(sum, 1, meter, `$.positions[${i}]`);
    }
    charge(meter, 34, "$.work.feature.flatten.positionDerived");
    equal(p["actor.known"] + p["actor.absent"], p["actor.nominal"] && !p["actor.known"] ? 0 : 1, meter, `$.positions[${i}].actor`);
    equal(p["actor.paidKnown"], p["actor.known"], meter, `$.positions[${i}].actor.paidKnown`);
    equal(p["ray.open"] + p["ray.blocked"] + p["ray.uncertain"], p["ray.applicable"], meter, `$.positions[${i}].ray`);
    equal(p["timing.C"], p["kind.classical"], meter, `$.positions[${i}].timing`);
    equal(p["ix.exposurePaidKnown"], p["exposure.known"] * p["actor.paid"] * p["actor.paidKnown"], meter, `$.positions[${i}].ix.exposurePaidKnown`);
    equal(p["ix.exposurePaidPossible"], p["exposure.possible"] * p["actor.paid"] * p["actor.paidKnown"], meter, `$.positions[${i}].ix.exposurePaidPossible`);
    equal(p["ix.exposureReplacement"], p["exposure.known"] * p["actor.replacement"], meter, `$.positions[${i}].ix.exposureReplacement`);
  }
  append(blocks.economic, ECONOMIC_NAMES, 370, "$.economic"); append(blocks.promotion, promotionNames, 382, "$.promotion");
  for (const name of promotionNames) {
    charge(meter, 3, "$.work.feature.flatten.promotionVisit");
    lattice(blocks.promotion[name], 8, meter, `$.promotion.${name}`);
  }
  charge(meter, 20, "$.work.feature.flatten.queueSpend");
  const q = blocks.queue, e = blocks.economic;
  equal(e.spend, .5 * (q.requestedMinerals + q.requestedGas), meter, "$.economic.spend");
  for (const name of ["deploy", "trade", "protection"] as const) { charge(meter, 3, "$.work.feature.flatten.economicVisit"); lattice(e[name], 12, meter, `$.economic.${name}`); }
  if (q["timing.CCount"] === 0) equal(e.trade, 0, meter, "$.economic.trade");
  charge(meter, 1, "$.work.feature.flatten.return");
  return result;
};
