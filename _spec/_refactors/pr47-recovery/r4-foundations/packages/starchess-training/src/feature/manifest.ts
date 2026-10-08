// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import {
  QUEUE_NAMES, POSITION_NAMES, ECONOMIC_NAMES, PROMOTION_KERNELS, PROMOTION_CHANNELS,
} from "../economic/contracts";
import type { FeatureBlocksV3, FeatureManifestV3, ManifestEntry, MeaningId, Meter, ScaleId, Scales } from "../economic/contracts";
import { freezeRecord, readArray, readLiteral, readObject } from "../economic/schema";
import { charge, fail } from "../economic/work";

export type FeatureDescriptor = Readonly<{
  index: number; name: string; meaningId: MeaningId; scaleId: ScaleId;
  dtype: "float64"; mask: string; formula: string; low: number; high: number;
}>;
export const SCALES_V3: Scales = Object.freeze({
  minerals: 12, gas: 3, turn: 45, ccLives: 3, maxSpawn: 9, paid: 3072, replacement: 2304,
  coords: 7, squares: 64, actions: 4, pairs: 6, relationPairs: 4096, visionOverlap: 256, files: 8,
});
const QUEUE_SCALES = Object.freeze([
  "unit", "actions", "minerals", "gas", "actions", "actions", "actions", "minerals", "gas", "paid", "replacement",
  "squares", "squares", "squares", "unit", "pairs", "pairs", "pairs", "pairs", "pairs", "pairs", "visionOverlap",
  "meanCosts*paid", "relationPairs*paid", "relationPairs*replacement", "squares*squares", "squares*ccComplement",
  "pairs*squares", "meanCosts*turn", "ccComplement", "actions*gas", "relationPairs", "meanCosts*paid", "actions*paid",
] as const satisfies readonly ScaleId[]);
const POSITION_SCALES = Object.freeze([
  "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit",
  "coords", "coords", "unit", "coords", "coords",
  "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit",
  "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit",
  "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "unit", "turn",
  "minerals", "gas", "minerals", "minerals", "unit", "unit", "unit", "unit",
  "squares", "squares", "squares", "squares", "coords", "squares", "squares", "squares", "unit", "squares", "unit",
  "minerals*minerals", "gas*gas", "minerals", "squares*minerals", "squares*minerals", "squares*minerals",
  "squares*replacement", "ccComplement", "squares", "coords", "coords*turn", "squares*paid",
] as const satisfies readonly ScaleId[]);
const QUEUE_FORMULAS = Object.freeze([
  "I(n=0)", "n/4", "totalRequestedMinerals/12", "totalRequestedGas/3", "BCount/4", "CCount/4", "FCount/4",
  "(bank-totalRequestedMinerals)/12", "(gas-totalRequestedGas)/3",
  "sumDistinctCrushedCurrentLineagePaidBasis/3072", "sumDistinctCrushedCurrentLineageReplacement/2304",
  "cardinality(N_Q)/64", "knownObservedEnemyRelationsToFinalOwnCC/64", "possibleObservedEnemyRelationsToFinalOwnCC/64",
  "I(baselineCCKnownExposed AND NOT finalCCKnownExposed)", "sameActorPairs/6", "sameActorBCPairs/6", "sameActorCFPairs/6",
  "sameActorMineClassicalRelocationPairs/6", "BDeployChildClassicalPairs/6", "authoredPhaseInversionPairs/6",
  "(sum_i cardinality(N_i)-cardinality(N_Q))/256", "s*D", "PK*EP", "PK*ER", "NL*U", "(CK+CP)*Cv",
  "pair.mineRelocate*U", "s*turn/45", "pass*Cv", "(deployCount/4)*gasIncome/3", "PK*I(enemyLoss.upper='unknown')",
  "s*W", "(deployCount/4)*W",
] as const);
const POSITION_INTERACTIONS = Object.freeze([
  "cost.minerals*B", "cost.gas*A", "I(kind=deploy)*MM", "exposure.known*actor.paid*actor.paidKnown",
  "exposure.possible*actor.paid*actor.paidKnown", "exposure.known*actor.replacement", "pressure.units*ER",
  "pressure.cc*Cv", "nominal.newlyLit*I(nominalActorType=b)", "ray.uncertain*effectiveChebyshevDistance/7",
  "nominal.staleApproach*selectedStaleMemoryAge", "protection.units*D",
] as const);
const POSITION_TAIL_FORMULAS = Object.freeze([
  "I(actualOwnLineageMatchesActorToken)", "I(noActorToken)", "I(actorDiffersFromCurrent OR hypotheticalBirth OR unknownDependentRewrite)",
  "I(existingActualOwnLineage)",
  "I(nominalActorType=p)", "I(nominalActorType=n)", "I(nominalActorType=b)", "I(nominalActorType=r)", "I(nominalActorType=q)", "I(nominalActorType=k)",
  "I(actorType=r AND ownTankModeKnown)", "I(actorType=r AND nominalTankMode=siege)",
  "I(noAuthoredTarget)", "I(authoredTargetUnknown)", "I(authoredTargetKnownEmpty)", "I(authoredTargetOwn)", "I(authoredTargetEnemy)",
  "I(currentObservedTargetType=p)", "I(currentObservedTargetType=n)", "I(currentObservedTargetType=b)", "I(currentObservedTargetType=r)", "I(currentObservedTargetType=q)", "I(currentObservedTargetType=k)",
  "I(enemyMemoryAtAuthoredTarget)", "(turn-targetMemoryObservedTurn)/45", "requestedActionMinerals/12", "requestedActionGas/3",
  "confirmedActorPaidBasis/12", "nominalActorReplacementExcludingCC/12",
  "I(classicalSlidingRay)", "I(applicableRayKnownOpen)", "I(applicableRayKnownBlocked)", "I(applicableRayUncertain)",
  "effectiveRayKnownEmptyIntermediates/64", "effectiveRayKnownOccupiedIntermediates/64", "effectiveRayUnknownIntermediates/64",
  "cardinality(N_i)/64", "positiveChebyshevReductionToSelectedStaleSquare/7",
  "knownObservedEnemySourcesToActorAfter/64", "possibleObservedEnemySourcesToActorAfter/64",
  "knownDistinctObservedNonCCTargetsFromActorAfter/64", "I(knownObservedEnemyCCRelationFromActorAfter)",
  "positiveThreatenedOwnNonCCTokenReduction/64", "I(beforeCCKnownExposed AND NOT afterCCKnownExposed)",
] as const);
const ECONOMIC_FORMULAS = Object.freeze(["S*b", "S*u", "A*b", "A*u", "T*b", "T*u", "P*b", "P*u", "S", "A", "T", "P"] as const);
const ECONOMIC_SCALES = Object.freeze([
  "meanCosts*unit", "meanCosts*unit", "minerals*unit", "minerals*unit", "minerals*unit", "minerals*unit", "minerals*unit", "minerals*unit",
  "meanCosts", "minerals", "minerals", "minerals",
] as const satisfies readonly ScaleId[]);
const ECONOMIC_DOMAINS = Object.freeze([
  [-576, 576], [0, 288], [-27648, 27648], [-13824, 288], [-1728, 1728], [-864, 216], [-27648, 27648], [0, 13824],
  [0, 1], [-48, 1], [-3, .75], [0, 48],
] as const);

const positionFormula = (k: number, meter: Meter): string => {
  charge(meter, 2, "$.registry"); if (k === 0) return "I(actionPresent)";
  charge(meter, 2, "$.registry"); if (k <= 7) { charge(meter, 3, "$.registry"); return `I(kind=${POSITION_NAMES[k]!.slice(5)})`; }
  charge(meter, 1, "$.registry"); if (k <= 10) { charge(meter, 3, "$.registry"); return `I(timing=${POSITION_NAMES[k]!.slice(7)})`; }
  charge(meter, 1, "$.registry"); if (k <= 15) { charge(meter, 1, "$.registry"); return ["authoredFromFile/7", "authoredFromRank/7", "I(authoredToPresent)", "authoredToFile/7", "authoredToRank/7"][k - 11]!; }
  charge(meter, 1, "$.registry"); if (k <= 27) { charge(meter, 3, "$.registry"); return `I(${POSITION_NAMES[k]!.replace(".", "=")})`; }
  charge(meter, 2, "$.registry"); return k <= 71 ? POSITION_TAIL_FORMULAS[k - 28]! : POSITION_INTERACTIONS[k - 72]!;
};
const positionMask = (k: number, meter: Meter): string => {
  charge(meter, 2, "$.registry"); if (k === 0) return "none";
  charge(meter, 3, "$.registry"); if (k === 14 || k === 15) return "present=1 && to.present=1";
  charge(meter, 1, "$.registry"); if (k === 52) return "present=1 && target.memory.present=1";
  charge(meter, 1, "$.registry"); if (k === 55) return "present=1 && actor.paidKnown=1";
  charge(meter, 5, "$.registry"); if (k >= 32 && k <= 39 || k === 56 || k >= 65 && k <= 71) return "present=1 && actor.absent=0";
  charge(meter, 3, "$.registry"); if (k >= 61 && k <= 63) return "present=1 && ray.applicable=1";
  return "present=1";
};
export const featureRegistryV3 = (meter: Meter): readonly FeatureDescriptor[] => {
  charge(meter, 1, "$.registry"); const entries: FeatureDescriptor[] = [];
  const add = (name: string, meaningId: MeaningId, scaleId: ScaleId, formula: string, mask: string, low = 0, high = 1): void => {
    charge(meter, 11, "$.registry"); entries.push(freezeRecord({ index: entries.length, name, meaningId, scaleId, dtype: "float64", mask, formula, low, high }, 9, meter, "$.registry"));
  };
  for (let j = 0; ; ) {
    charge(meter, 1, "$.registry"); if (j === 34) break;
    charge(meter, 7, "$.registry"); add(`queue.${QUEUE_NAMES[j]}`, `q:${j}`, QUEUE_SCALES[j]!, QUEUE_FORMULAS[j]!, "none", j === 7 || j === 8 ? -1 : 0, j === 23 ? 0 : 1);
    charge(meter, 1, "$.registry"); j++;
  }
  for (let slot = 0; ; ) {
    charge(meter, 1, "$.registry"); if (slot === 4) break;
    for (let k = 0; ; ) {
      charge(meter, 1, "$.registry"); if (k === 84) break;
      charge(meter, 5, "$.registry"); add(`position.${slot}.${POSITION_NAMES[k]}`, `p:${k}`, POSITION_SCALES[k]!, positionFormula(k, meter), positionMask(k, meter), k === 74 ? -1 : 0, 1);
      charge(meter, 1, "$.registry"); k++;
    }
    charge(meter, 1, "$.registry"); slot++;
  }
  for (let k = 0; ; ) {
    charge(meter, 1, "$.registry"); if (k === 12) break;
    charge(meter, 8, "$.registry"); add(`economic.${ECONOMIC_NAMES[k]}`, `e:${k}`, ECONOMIC_SCALES[k]!, ECONOMIC_FORMULAS[k]!, "none", ECONOMIC_DOMAINS[k]![0], ECONOMIC_DOMAINS[k]![1]);
    charge(meter, 1, "$.registry"); k++;
  }
  for (let k = 0; ; ) {
    charge(meter, 1, "$.registry"); if (k === 6) break;
    for (let c = 0; ; ) {
      charge(meter, 1, "$.registry"); if (c === 2) break;
      for (let h = 1; ; ) {
        charge(meter, 1, "$.registry"); if (h === 4) break;
        charge(meter, 6, "$.registry"); add(`promotion.${PROMOTION_KERNELS[k]}.${PROMOTION_CHANNELS[c]}.h${h}`, `promo:${k}:${c}:${h as 1 | 2 | 3}`, "files", "qualifyingDistinctPromotionDestinationFiles/8", "none");
        charge(meter, 1, "$.registry"); h++;
      }
      charge(meter, 1, "$.registry"); c++;
    }
    charge(meter, 1, "$.registry"); k++;
  }
  charge(meter, entries.length + 1, "$.registry"); return Object.freeze(entries);
};
export const featureManifestV3 = (meter: Meter): FeatureManifestV3 => {
  const registry = featureRegistryV3(meter);
  charge(meter, 2, "$.manifest"); const names: string[] = [], entries: ManifestEntry[] = [];
  for (const row of registry) {
    charge(meter, 8, "$.manifest"); names.push(row.name); entries.push(freezeRecord({ name: row.name, meaningId: row.meaningId, scaleId: row.scaleId }, 3, meter, "$.manifest"));
  }
  charge(meter, 5 + names.length + entries.length, "$.manifest");
  return freezeRecord({ version: "challenge-feature-manifest-v3", dimension: 418, names: Object.freeze(names), entries: Object.freeze(entries), scales: SCALES_V3 }, 5, meter, "$.manifest");
};
export const validateFeatureManifestV3 = (v: unknown, meter: Meter): FeatureManifestV3 => {
  const expected = featureManifestV3(meter), r = readObject(v, meter, "$", ["version", "dimension", "names", "entries", "scales"]);
  readLiteral(r.version, expected.version, meter, "$.version"); readLiteral(r.dimension, 418, meter, "$.dimension");
  readArray(r.names, meter, "$.names", 418, 418, (x, at, i) => { charge(meter, 1, at); return readLiteral(x, expected.names[i]!, meter, at); });
  readArray(r.entries, meter, "$.entries", 418, 418, (v, at, i) => {
    const row = readObject(v, meter, at, ["name", "meaningId", "scaleId"]);
    for (const key of ["name", "meaningId", "scaleId"] as const) { charge(meter, 3, at); readLiteral(row[key], expected.entries[i]![key], meter, `${at}.${key}`); }
    return expected.entries[i]!;
  });
  charge(meter, 14, "$.scales"); const keys = Object.keys(SCALES_V3) as (keyof Scales)[];
  const scales = readObject(r.scales, meter, "$.scales", keys);
  for (const key of keys) { charge(meter, 3, "$.scales"); readLiteral(scales[key], SCALES_V3[key], meter, `$.scales.${key}`); }
  return expected;
};
export const promotionNamesV3 = (meter: Meter): readonly string[] => {
  charge(meter, 1, "$.promotion"); const result: string[] = [];
  for (const kernel of PROMOTION_KERNELS) for (const channel of PROMOTION_CHANNELS) for (let h = 1; h <= 3; h++) {
    charge(meter, 6, "$.promotion"); result.push(`${kernel}.${channel}.h${h}`);
  }
  charge(meter, 37, "$.promotion"); return Object.freeze(result);
};
const requireLattice = (value: number, divisor: number, meter: Meter, p: string): void => {
  charge(meter, 5, p); const numerator = Math.round(value * divisor);
  if (!Number.isSafeInteger(numerator) || numerator / divisor !== value) fail(p, "NUMBER");
};
const requireValue = (actual: number, expected: number, meter: Meter, p: string): void => {
  charge(meter, 1, p); if (actual !== expected) fail(p, "DERIVED");
};
const requireIndicator = (value: number, meter: Meter, p: string): void => {
  charge(meter, 3, p); if (value !== 0 && value !== 1) fail(p, "NUMBER");
};
const requireProductRange = (factor: number, product: number, low: number, high: number, meter: Meter, p: string): void => {
  charge(meter, 1, p);
  if (factor === 0) { requireValue(product, 0, meter, p); return; }
  charge(meter, 9, p); const ratio = product / factor, error = 8 * Number.EPSILON * Math.max(Math.abs(ratio), Number.MIN_VALUE);
  if (!Number.isFinite(ratio) || ratio + error < low || ratio - error > high) fail(p, "DERIVED");
};
const validatePositionMeasurements = (r: Readonly<Record<string, number>>, meter: Meter, p: string): void => {
  for (let k = 0; ; ) {
    charge(meter, 1, p); if (k === 84) break;
    charge(meter, 14, p);
    const name = POSITION_NAMES[k], indicator = k <= 10 || k === 13 || k >= 16 && k <= 51 || k >= 57 && k <= 60 || k === 69 || k === 71;
    if (indicator) requireIndicator(r[name!]!, meter, `${p}.${name}`);
    charge(meter, 1, p); k++;
  }
  for (const [indices, divisor] of [
    [[11,12,14,15,65,81],7], [[52],45], [[53,55,56,74],12], [[54],3], [[61,62,63,64,66,67,68,70,80],64],
  ] as const) {
    for (const k of indices) { charge(meter, 2, p); requireLattice(r[POSITION_NAMES[k]]!, divisor, meter, `${p}.${POSITION_NAMES[k]}`); }
  }
  charge(meter, 1, p); if (r.present === 0) return;
  const sum = (names: readonly string[]): number => {
    charge(meter, 1, p); let total = 0;
    for (const name of names) { charge(meter, 3, p); total += r[name]!; }
    return total;
  };
  const zero = (names: readonly string[]): void => { for (const name of names) { charge(meter, 1, p); requireValue(r[name]!, 0, meter, `${p}.${name}`); } };
  charge(meter, 6, p); if (r["to.present"] === 0) {
    zero(["to.file", "to.rank", "target.memory.present", "target.memory.age"]);
    requireValue(r["target.absent"]!, 1, meter, `${p}.target.absent`);
  } else requireValue(r["target.absent"]!, 0, meter, `${p}.target.absent`);
  charge(meter, 6, p); requireValue(sum(POSITION_NAMES.slice(45,51)), r["target.own"]! + r["target.enemy"]!, meter, `${p}.target.type`);
  charge(meter, 1, p); if (r["target.memory.present"] === 0) zero(["target.memory.age"]);
  charge(meter, 6, p); requireValue(sum(POSITION_NAMES.slice(32,38)), 1 - r["actor.absent"]!, meter, `${p}.actor.type`);
  charge(meter, 1, p); if (r["actor.absent"] === 1) zero(["actor.known", "actor.nominal", "actor.paidKnown", "actor.paid", "actor.replacement", "nominal.staleApproach", "exposure.known", "exposure.possible", "pressure.units", "pressure.cc", "protection.units", "protection.cc"]);
  charge(meter, 1, p); if (r["actor.paidKnown"] === 0) zero(["actor.paid"]);
  charge(meter, 1, p); if (r["actor.type.r"] === 0) zero(["actor.tankMode.known", "actor.tankMode.sieged"]);
  charge(meter, 22, p);
  const replacement = r["actor.type.p"]! + 3 * r["actor.type.n"]! + 3 * r["actor.type.b"]! + 5 * r["actor.type.r"]! + 9 * r["actor.type.q"]!;
  requireValue(r["actor.replacement"]!, replacement / 12, meter, `${p}.actor.replacement`);
  charge(meter, 2, p); if (r["actor.paid"]! > .75) fail(`${p}.actor.paid`, "NUMBER");
  charge(meter, 5, p); const applicable = r["ray.applicable"]!;
  requireValue(r["ray.open"]! + r["ray.blocked"]! + r["ray.uncertain"]!, applicable, meter, `${p}.ray`);
  charge(meter, 1, p); if (applicable === 0) zero(["path.knownEmpty", "path.knownOccupied", "path.unknown"]);
  else {
    charge(meter, 8, p); if (r["kind.classical"] !== 1 || r["actor.type.b"]! + r["actor.type.r"]! + r["actor.type.q"]! !== 1) fail(`${p}.ray.applicable`, "DERIVED");
    charge(meter, 7, p); const blocked = r["path.knownOccupied"]! > 0, uncertain = !blocked && r["path.unknown"]! > 0;
    requireValue(r["ray.blocked"]!, Number(blocked), meter, `${p}.ray.blocked`);
    requireValue(r["ray.uncertain"]!, Number(uncertain), meter, `${p}.ray.uncertain`);
  }
  charge(meter, 4, p); if (r["exposure.known"]! + r["exposure.possible"]! > 1) fail(`${p}.exposure`, "DERIVED");
  charge(meter, 20, p);
  const minerals = r["kind.deploy"]! * (r["deployUnit.p"]! + 3 * r["deployUnit.n"]! + 3 * r["deployUnit.b"]! + 5 * r["deployUnit.r"]! + 9 * r["deployUnit.q"]!);
  const gas = r["kind.deploy"]! + r["kind.stimStep"]! + r["kind.spiderMine"]! + 2 * r["kind.charonMissiles"]! + r["kind.siegeMode"]! + 3 * r["kind.tacticalJump"]!;
  requireValue(r["cost.minerals"]!, minerals / 12, meter, `${p}.cost.minerals`);
  requireValue(r["cost.gas"]!, gas / 3, meter, `${p}.cost.gas`);
  charge(meter, 2, p); requireValue(r["deployUnit.none"]!, 1 - r["kind.deploy"]!, meter, `${p}.deployUnit.none`);
  charge(meter, 6, p); if (r["timing.C"] !== r["kind.classical"]) fail(`${p}.timing`, "DERIVED");
  charge(meter, 17, p);
  requireValue(r["ix.exposurePaidKnown"]!, r["exposure.known"]! * r["actor.paid"]! * r["actor.paidKnown"]!, meter, `${p}.ix.exposurePaidKnown`);
  requireValue(r["ix.exposurePaidPossible"]!, r["exposure.possible"]! * r["actor.paid"]! * r["actor.paidKnown"]!, meter, `${p}.ix.exposurePaidPossible`);
  requireValue(r["ix.exposureReplacement"]!, r["exposure.known"]! * r["actor.replacement"]!, meter, `${p}.ix.exposureReplacement`);
  requireValue(r["ix.noveltyReveal"]!, r["nominal.newlyLit"]! * r["actor.type.b"]!, meter, `${p}.ix.noveltyReveal`);
  for (const [factor, product] of [
    ["pressure.units","ix.tradeEnemyLoss"], ["pressure.cc","ix.ccPressureRisk"], ["ray.uncertain","ix.uncertainRayDistance"],
    ["nominal.staleApproach","ix.staleApproachAge"], ["protection.units","ix.protectionPaidLoss"],
  ]) { charge(meter, 2, p); requireProductRange(r[factor!]!, r[product!]!, 0, 1, meter, `${p}.${product}`); }
};
const validateQueueMeasurements = (q: Readonly<Record<string, number>>, positions: readonly Readonly<Record<string, number>>[], meter: Meter): void => {
  const p = "$.queue";
  requireIndicator(q.pass!, meter, `${p}.pass`); requireIndicator(q["nominal.ccProtection"]!, meter, `${p}.nominal.ccProtection`);
  for (const [indices, divisor] of [
    [[1,4,5,6],4], [[2,7],12], [[3,8],3], [[9],3072], [[10],2304], [[11,12,13],64], [[15,16,17,18,19,20],6], [[21],256], [[31],4096],
  ] as const) for (const k of indices) { charge(meter, 2, p); requireLattice(q[QUEUE_NAMES[k]]!, divisor, meter, `${p}.${QUEUE_NAMES[k]}`); }
  charge(meter, 7, p); let count = 0, minerals = 0, gas = 0, b = 0, c = 0, f = 0, deploy = 0;
  for (let i = 0; ; ) {
    charge(meter, 1, p); if (i === positions.length) break;
    charge(meter, 7, p); const r = positions[i]!;
    if (r.present === 1) {
      charge(meter, 19, p); if (count !== i) fail("$.positions", "DERIVED"); count++;
      minerals += Math.round(r["cost.minerals"]! * 12); gas += Math.round(r["cost.gas"]! * 3);
      b += r["timing.B"]!; c += r["timing.C"]!; f += r["timing.F"]!; deploy += r["kind.deploy"]!;
    }
    charge(meter, 1, p); i++;
  }
  charge(meter, 12, p);
  requireValue(q.pass!, Number(count === 0), meter, `${p}.pass`); requireValue(q.actionCount!, count / 4, meter, `${p}.actionCount`);
  requireValue(q.requestedMinerals!, minerals / 12, meter, `${p}.requestedMinerals`); requireValue(q.requestedGas!, gas / 3, meter, `${p}.requestedGas`);
  requireValue(q["timing.BCount"]!, b / 4, meter, `${p}.timing.BCount`); requireValue(q["timing.CCount"]!, c / 4, meter, `${p}.timing.CCount`); requireValue(q["timing.FCount"]!, f / 4, meter, `${p}.timing.FCount`);
  charge(meter, 17, p);
  const bank = (Math.round(q.mineralMargin! * 12) + minerals) / 12;
  const ownGas = (Math.round(q.gasMargin! * 3) + gas) / 3;
  if (bank < 0 || bank > 1 || ownGas < 0 || ownGas > 1) fail(p, "DERIVED");
  charge(meter, 4, p); const pairs = count * (count - 1) / 12;
  for (let k = 15; ; ) {
    charge(meter, 1, p); if (k === 21) break;
    charge(meter, 3, p); if (q[QUEUE_NAMES[k]]! > pairs) fail(`${p}.${QUEUE_NAMES[k]}`, "DERIVED");
    charge(meter, 1, p); k++;
  }
  for (const r of positions) {
    charge(meter, 15, p);
    requireValue(r["ix.spendLiquidity"]!, r["cost.minerals"]! * bank, meter, "$.positions.ix.spendLiquidity");
    requireValue(r["ix.gasAvailability"]!, r["cost.gas"]! * ownGas, meter, "$.positions.ix.gasAvailability");
    requireValue(r["ix.deployMargin"]!, r["kind.deploy"]! * q.mineralMargin!, meter, "$.positions.ix.deployMargin");
  }
  charge(meter, 4, p); const spend = .5 * (q.requestedMinerals! + q.requestedGas!);
  for (const [factor, product] of [
    [spend,"ix.spendOwnPaidLoss"], [q["ix.pressureLossUncertainty"]!,"ix.tradeEnemyReplacementBound"],
    [q["nominal.newlyLit"]!,"ix.noveltyUnknown"], [q["nominal.ccExposureKnown"]! + q["nominal.ccExposurePossible"]!,"ix.ccExposureVulnerability"],
    [q["pair.mineRelocate"]!,"ix.mineRelocateUnknown"], [spend,"ix.spendTurn"], [q.pass!,"ix.passVulnerability"],
    [deploy/4,"ix.deployGasIncome"], [spend,"ix.spendOwnPaidWaste"], [deploy/4,"ix.deployOwnPaidWaste"],
  ] as const) { charge(meter, 2, p); requireProductRange(factor, q[product]!, 0, 1, meter, `${p}.${product}`); }
};
const validateEconomicProducts = (economic: Readonly<Record<string, number>>, queue: Readonly<Record<string, number>>, meter: Meter): void => {
  const p = "$.economic";
  charge(meter, 4, p); requireValue(economic.spend!, .5 * (queue.requestedMinerals! + queue.requestedGas!), meter, `${p}.spend`);
  for (const name of ["deploy", "trade", "protection"]) { charge(meter, 1, p); requireLattice(economic[name]!, 12, meter, `${p}.${name}`); }
  charge(meter, 1, p); if (queue["timing.CCount"] === 0) requireValue(economic.trade!, 0, meter, `${p}.trade`);
  for (const suffix of ["Balance", "Uncertainty"] as const) {
    charge(meter, 4, p); let low = suffix === "Balance" ? -576 : 0, high = suffix === "Balance" ? 576 : 288;
    for (const name of ["spend", "deploy", "trade", "protection"]) {
      charge(meter, 4, p); const factor = economic[name]!, product = economic[`ix.${name}${suffix}`]!;
      charge(meter, 1, p); if (factor === 0) { requireValue(product, 0, meter, `${p}.ix.${name}${suffix}`); continue; }
      charge(meter, 12, p); const ratio = product / factor, error = 8 * Number.EPSILON * Math.max(Math.abs(ratio), Number.MIN_VALUE);
      if (!Number.isFinite(ratio)) fail(p, "DERIVED"); low = Math.max(low, ratio - error); high = Math.min(high, ratio + error);
    }
    charge(meter, 1, p); if (low > high) fail(p, "DERIVED");
    charge(meter, 5, p); if (suffix === "Uncertainty" && Math.ceil(2 * low) / 2 > high) fail(`${p}.uncertainty`, "DERIVED");
  }
};
export const validateFeatureBlocksV3 = (v: unknown, meter: Meter): FeatureBlocksV3 => {
  const r = readObject(v, meter, "$", ["version", "queue", "positions", "economic", "promotion"]);
  readLiteral(r.version, "challenge-features-v3", meter, "$.version");
  const registry = featureRegistryV3(meter);
  const block = (v: unknown, names: readonly string[], start: number, p: string): Readonly<Record<string, number>> => {
    const input = readObject(v, meter, p, names);
    charge(meter, 1, p); const result: Record<string, number> = {};
    for (let i = 0; ; ) {
      charge(meter, 1, p); if (i === names.length) break;
      charge(meter, 9, p); const name = names[i]!, value = input[name], domain = registry[start + i]!;
      if (typeof value !== "number" || !Number.isFinite(value)) return fail(`${p}.${name}`, "NONFINITE");
      if (value < domain.low || value > domain.high) return fail(`${p}.${name}`, "NUMBER");
      charge(meter, 1, p); result[name] = value;
      charge(meter, 1, p); i++;
    }
    return freezeRecord(result, names.length, meter, p);
  };
  const queue = block(r.queue, QUEUE_NAMES, 0, "$.queue");
  const positions = readArray(r.positions, meter, "$.positions", 4, 4, (x, at, i) => {
    charge(meter, 2, at); const result = block(x, POSITION_NAMES, 34 + 84 * i, at);
    charge(meter, 1, at); if (result.present === 0) {
      for (const key of POSITION_NAMES) { charge(meter, 2, at); if (result[key] !== 0) return fail(at, "DERIVED"); }
    } else {
      charge(meter, 1, at); if (result.present !== 1) return fail(`${at}.present`, "NUMBER");
      const oneHot = (names: readonly string[], expected: number): void => {
        charge(meter, 1, at); let sum = 0;
        for (const name of names) { charge(meter, 5, at); const x = result[name]!; if (x !== 0 && x !== 1) fail(`${at}.${name}`, "NUMBER"); sum += x; }
        charge(meter, 1, at); if (sum !== expected) fail(at, "DERIVED");
      };
      charge(meter, 10 + 3 + 6 + 6 + 5, at);
      oneHot(POSITION_NAMES.slice(1, 8), 1); oneHot(POSITION_NAMES.slice(8, 11), 1); oneHot(POSITION_NAMES.slice(16, 22), 1); oneHot(POSITION_NAMES.slice(22, 28), 1); oneHot(POSITION_NAMES.slice(40, 45), 1);
    }
    validatePositionMeasurements(result, meter, at);
    return result;
  });
  validateQueueMeasurements(queue, positions, meter);
  const economic = block(r.economic, ECONOMIC_NAMES, 370, "$.economic");
  validateEconomicProducts(economic, queue, meter);
  const promotion = block(r.promotion, promotionNamesV3(meter), 382, "$.promotion");
  for (const name of promotionNamesV3(meter)) {
    charge(meter, 4, "$.promotion"); if (!Number.isInteger(promotion[name]! * 8)) return fail(`$.promotion.${name}`, "NUMBER");
  }
  charge(meter, 5, "$"); return freezeRecord({ version: "challenge-features-v3", queue, positions, economic, promotion } as FeatureBlocksV3, 5, meter, "$");
};
