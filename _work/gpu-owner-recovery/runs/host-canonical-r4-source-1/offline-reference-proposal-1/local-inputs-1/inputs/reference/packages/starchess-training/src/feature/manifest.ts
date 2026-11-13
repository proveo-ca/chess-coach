// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { ECONOMIC_NAMES, POSITION_NAMES, PROMOTION_CHANNELS, PROMOTION_KERNELS, QUEUE_NAMES } from "../economic/contracts";
import type { FeatureBlocksV3, FeatureManifestV3, MeaningId, Meter, PromotionName, ScaleId, Scales } from "../economic/contracts";
import { allocateFloat64, charge } from "../economic/work";
import { consumeWorkBlock, makeCanonicalManifestV3, type StartupArtifactContext } from "../economic/ownedKernel";
import { requireFeatureBlocks, requireManifest } from "../economic/ownedGuards";

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

const buildPromotionNames = (): readonly PromotionName[] => {
  const result: PromotionName[] = [];
  for (const kernel of PROMOTION_KERNELS) for (const channel of PROMOTION_CHANNELS) for (const h of [1, 2, 3] as const) {
    result.push(`${kernel}.${channel}.h${h}`);
  }
  return Object.freeze(result);
};

const buildRegistry = (): readonly FeatureDescriptor[] => {
  const entries: FeatureDescriptor[] = [];
  const add = (name: string, meaningId: MeaningId, scaleId: ScaleId, formula: string, mask: string, low = 0, high = 1): void => {
    entries.push(Object.freeze({ index: entries.length, name, meaningId, scaleId, dtype: "float64", formula, mask, low, high }));
  };
  for (let k = 0; k < 34; k++) {
    add(`queue.${QUEUE_NAMES[k]}`, `q:${k}`, QUEUE_SCALES[k], QUEUE_FORMULAS[k], "none", k === 7 || k === 8 ? -1 : 0, k === 23 ? 0 : 1);
  }
  for (let i = 0; i < 4; i++) for (let k = 0; k < 84; k++) {
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
    add(`economic.${ECONOMIC_NAMES[k]}`, `e:${k}`, ECONOMIC_SCALES[k], ECONOMIC_FORMULAS[k], "none", ECONOMIC_DOMAINS[k][0], ECONOMIC_DOMAINS[k][1]);
  }
  for (let k = 0; k < 6; k++) for (let c = 0; c < 2; c++) for (const h of [1, 2, 3] as const) {
    add(`promotion.${PROMOTION_KERNELS[k]}.${PROMOTION_CHANNELS[c]}.h${h}`, `promo:${k}:${c}:${h}`, "files", PROMOTION_FORMULAS[k], `arrivalWithin<=${h}Opportunities`);
  }
  return Object.freeze(entries);
};

const PROMOTION_NAMES_V3 = buildPromotionNames();
const FEATURE_REGISTRY_V3 = buildRegistry();
export const promotionNamesV3 = (meter: Meter): readonly PromotionName[] => {
  charge(meter, 8, "$.work.feature.manifest.promotionNames");
  return PROMOTION_NAMES_V3;
};
export const featureRegistryV3 = (meter: Meter): readonly FeatureDescriptor[] => {
  charge(meter, 8, "$.work.feature.manifest.registry");
  return FEATURE_REGISTRY_V3;
};
export const featureManifestV3 = (context: StartupArtifactContext): FeatureManifestV3 => requireManifest(makeCanonicalManifestV3(context));

export const flattenFeatureBlocksV3 = (blocks: FeatureBlocksV3, meter: Meter): Float64Array => {
  charge(meter, 12, "$.work.feature.flatten.header");
  requireFeatureBlocks(blocks);
  const result = allocateFloat64(418, meter, "$.work.feature.flatten.bufferAllocate");
  consumeWorkBlock(meter, "float64-store", 418, "$.work.feature.flatten.stores418");
  charge(meter, 32 + 8 * 418 + 4 * 8, "$.work.feature.flatten.laneVisits418");
  const append = (block: Readonly<Record<string, number>>, names: readonly string[], start: number): void => {
    for (let k = 0; k < names.length; k++) {
      result[start + k] = block[names[k]!]!;
    }
  };
  append(blocks.queue, QUEUE_NAMES, 0);
  for (let i = 0; i < 4; i++) {
    append(blocks.positions[i]!, POSITION_NAMES, 34 + 84 * i);
  }
  append(blocks.economic, ECONOMIC_NAMES, 370); append(blocks.promotion, PROMOTION_NAMES_V3, 382);
  return result;
};
