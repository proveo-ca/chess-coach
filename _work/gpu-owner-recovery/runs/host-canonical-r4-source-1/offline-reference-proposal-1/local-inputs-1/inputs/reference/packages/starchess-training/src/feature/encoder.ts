// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { specialGasCost, UNIT_COST } from "@chess-coach/starchess-core/planning-v1";
import type { Candidate, EconomicArtifact, EconomicBeliefState, FeatureBlocksV3, History, Meter, Position84, Queue34 } from "../economic/contracts";
import { POSITION_NAMES, QUEUE_NAMES } from "../economic/contracts";
import { charge, fail } from "../economic/work";
import { economicFeatures, type NumericalEconomicReadout } from "./economic";
import { promotionFeatures, type PromotionFrontiers } from "./promotion";
import { projectOwn, type OwnProjection } from "./projection";
import { chebyshev, exposure, measureRay, ownLitSquares, pressure, replacementValue, threatened } from "./relations";
import { beginPosition84, putPosition84, finishPosition84, beginQueue34, putQueue34, finishQueue34, makeFeatureBlocks } from "../economic/ownedKernel";
import { requireArtifact, requireCandidate, requireHistory, requireState } from "../economic/ownedGuards";
import { readoutEconomicInternal } from "../economic/readout";
import { decodeFloat64 } from "../economic/float64";

type MutablePosition = { -readonly [K in keyof Position84]: number };
type MutableQueue = { -readonly [K in keyof Queue34]: number };
export type NumericalFeatureContext = NumericalEconomicReadout & PromotionFrontiers;
export type HistoricalFeatureBlocks = Readonly<{ queue: Queue34; positions: readonly [Position84, Position84, Position84, Position84] }>;

const zeroPosition = (meter: Meter): MutablePosition => {
  charge(meter, 2 + POSITION_NAMES.length * 4, "$.work.feature.encoder.zeroPosition");
  return Object.fromEntries(POSITION_NAMES.map(name => [name, 0])) as MutablePosition;
};
const zeroQueue = (meter: Meter): MutableQueue => {
  charge(meter, 2 + QUEUE_NAMES.length * 4, "$.work.feature.encoder.zeroQueue");
  return Object.fromEntries(QUEUE_NAMES.map(name => [name, 0])) as MutableQueue;
};

export const encodeHistorical370 = (history: History, candidate: Candidate, projection: OwnProjection, meter: Meter): HistoricalFeatureBlocks => {
  charge(meter, 34, "$.work.feature.encoder.context");
  requireHistory(history); requireCandidate(candidate);
  const snapshot = history.currentAuthorizedSnapshotV2, ledger = history.economicState;
  const B = snapshot.own.minerals / 12, A = snapshot.own.gas / 3, Cv = 1 - snapshot.own.ccLives / 3;
  const m = candidate.ownSpend.minerals / 12, g = candidate.ownSpend.gas / 3;
  const MM = B - m, GM = A - g, s = (m + g) / 2;
  const D = ledger.ownPaidDestroyed / 3072, W = ledger.ownPaidWasted / 3072, ER = ledger.enemyLoss.replacementLowerBound / 2304, EP = 0;
  charge(meter, 12 + 4 * snapshot.memory.length + 3 * history.everLit.length, "$.work.feature.encoder.memoryAndVisionSets");
  const memories = new Map(snapshot.memory.map(sighting => [sighting.square, sighting]));
  const everLit = new Set(history.everLit), novelUnion = new Set<string>();
  let selected = snapshot.memory[0];
  for (const memory of snapshot.memory) {
    charge(meter, 10, "$.work.feature.encoder.staleSelectionVisit");
    if (!selected || memory.observedTurn > selected.observedTurn || memory.observedTurn === selected.observedTurn && memory.square < selected.square) selected = memory;
  }
  charge(meter, 12, "$.work.feature.encoder.staleContext");
  const selectedAge = selected ? (snapshot.turn - selected.observedTurn) / 45 : 0;
  const U = projection.layers.unknown.size / 64;
  const positions = [zeroPosition(meter), zeroPosition(meter), zeroPosition(meter), zeroPosition(meter)] as const;
  let noveltySum = 0;
  for (const checkpoint of projection.positions) {
    charge(meter, 20, "$.work.feature.encoder.positionVisit");
    const p = positions[checkpoint.index], action = checkpoint.action, actor = checkpoint.actorBefore;
    p.present = 1; p[`kind.${action.kind}`] = 1; p[`timing.${action.timing}`] = 1;
    charge(meter, 19, "$.work.feature.encoder.authoredCoordinates");
    p["from.file"] = (action.from.charCodeAt(0) - 97) / 7; p["from.rank"] = (Number(action.from[1]) - 1) / 7;
    if (action.to) {
      p["to.present"] = 1; p["to.file"] = (action.to.charCodeAt(0) - 97) / 7; p["to.rank"] = (Number(action.to[1]) - 1) / 7;
    }
    charge(meter, 12, "$.work.feature.encoder.spawnOneHots");
    p[`deployUnit.${action.kind === "deploy" ? action.unit ?? "none" : "none"}`] = 1;
    p[`promotion.${action.promotion ?? "none"}`] = 1;
    charge(meter, 32, "$.work.feature.encoder.actorMasks");
    p["actor.known"] = Number(!!actor?.baseline); p["actor.absent"] = Number(!actor);
    charge(meter, 12, "$.work.feature.encoder.actorCurrentFactComparison");
    const actual = actor ? projection.baseline.units.get(actor.token) : undefined;
    p["actor.nominal"] = Number(!!actor && (!actual || actor.square !== actual.square || actor.type !== actual.type || checkpoint.unknownRewrite));
    p["actor.paidKnown"] = Number(!!actor?.baseline);
    if (actor) {
      p[`actor.type.${actor.type}`] = 1;
      p["actor.tankMode.known"] = Number(actor.type === "r"); p["actor.tankMode.sieged"] = Number(actor.type === "r" && actor.mode === "siege");
      p["actor.paid"] = actor.baseline ? actor.paidBasis / 12 : 0; p["actor.replacement"] = replacementValue(actor.type, meter) / 12;
    }
    charge(meter, 10 + 4 * snapshot.cells.length, "$.work.feature.encoder.authoredTargetLookup");
    const target = action.to ? snapshot.cells.find(cell => cell.square === action.to) : undefined;
    if (!action.to) p["target.absent"] = 1;
    else if (!target || target.visibility === "unknown") p["target.unknown"] = 1;
    else if (!target.piece) p["target.knownEmpty"] = 1;
    else { p[target.piece.color === snapshot.side ? "target.own" : "target.enemy"] = 1; p[`target.type.${target.piece.type}`] = 1; }
    charge(meter, 14, "$.work.feature.encoder.targetMemory");
    const memory = action.to ? memories.get(action.to) : undefined;
    p["target.memory.present"] = Number(!!memory); p["target.memory.age"] = memory ? (snapshot.turn - memory.observedTurn) / 45 : 0;
    charge(meter, 20, "$.work.feature.encoder.nativeCost");
    p["cost.minerals"] = action.kind === "deploy" && action.unit ? UNIT_COST[action.unit] / 12 : 0;
    p["cost.gas"] = action.kind === "classical" ? 0 : specialGasCost(action.kind) / 3;
    let effectiveDistance = 0;
    charge(meter, 7, "$.work.feature.encoder.rayEligibility");
    if (action.kind === "classical" && actor && checkpoint.effectiveTo) {
      const ray = measureRay(projection.layers, checkpoint.before, actor.type, checkpoint.effectiveFrom, checkpoint.effectiveTo, meter);
      charge(meter, 24, "$.work.feature.encoder.rayMeasurements");
      p["ray.applicable"] = Number(ray.applicable);
      p["ray.blocked"] = Number(ray.applicable && ray.occupied > 0);
      p["ray.uncertain"] = Number(ray.applicable && ray.occupied === 0 && ray.unknown > 0);
      p["ray.open"] = Number(ray.applicable && ray.occupied === 0 && ray.unknown === 0);
      p["path.knownEmpty"] = ray.empty / 64; p["path.knownOccupied"] = ray.occupied / 64; p["path.unknown"] = ray.unknown / 64;
      effectiveDistance = ray.distance;
    }
    const lit = ownLitSquares(checkpoint.after, meter);
    charge(meter, 1, "$.work.feature.encoder.noveltyCounter");
    let novel = 0;
    for (const square of lit) {
      charge(meter, 7, "$.work.feature.encoder.noveltyVisit");
      if (!everLit.has(square)) { novel++; novelUnion.add(square); }
    }
    charge(meter, 5, "$.work.feature.encoder.noveltyReduction");
    noveltySum += novel; p["nominal.newlyLit"] = novel / 64;
    const actorAfter = checkpoint.actorAfter;
    if (actor && actorAfter) {
      charge(meter, 5, "$.work.feature.encoder.staleEligibility");
      if (selected) {
        const before = chebyshev(actor.square, selected.square, meter), after = chebyshev(actorAfter.square, selected.square, meter);
        charge(meter, 6, "$.work.feature.encoder.staleReduction");
        p["nominal.staleApproach"] = Math.max(0, before - after) / 7;
      }
      const e = exposure(projection.layers, checkpoint.after, actorAfter.square, meter);
      const pr = pressure(projection.layers, checkpoint.after, actorAfter, meter);
      const beforeThreat = threatened(projection.layers, checkpoint.before, meter), afterThreat = threatened(projection.layers, checkpoint.after, meter);
      charge(meter, 22, "$.work.feature.encoder.stationaryMeasurements");
      p["exposure.known"] = e.known / 64; p["exposure.possible"] = e.possible / 64;
      p["pressure.units"] = pr.units / 64; p["pressure.cc"] = pr.cc;
      p["protection.units"] = Math.max(0, beforeThreat.units - afterThreat.units) / 64;
      p["protection.cc"] = Number(beforeThreat.ccKnown && !afterThreat.ccKnown);
    }
    charge(meter, 62, "$.work.feature.encoder.positionInteractions");
    p["ix.spendLiquidity"] = p["cost.minerals"] * B; p["ix.gasAvailability"] = p["cost.gas"] * A;
    p["ix.deployMargin"] = Number(action.kind === "deploy") * MM;
    p["ix.exposurePaidKnown"] = p["exposure.known"] * p["actor.paid"] * p["actor.paidKnown"];
    p["ix.exposurePaidPossible"] = p["exposure.possible"] * p["actor.paid"] * p["actor.paidKnown"];
    p["ix.exposureReplacement"] = p["exposure.known"] * p["actor.replacement"];
    p["ix.tradeEnemyLoss"] = p["pressure.units"] * ER; p["ix.ccPressureRisk"] = p["pressure.cc"] * Cv;
    p["ix.noveltyReveal"] = p["nominal.newlyLit"] * Number(actor?.type === "b");
    p["ix.uncertainRayDistance"] = p["ray.uncertain"] * effectiveDistance / 7;
    p["ix.staleApproachAge"] = p["nominal.staleApproach"] * selectedAge;
    p["ix.protectionPaidLoss"] = p["protection.units"] * D;
  }
  const q = zeroQueue(meter);
  charge(meter, 43, "$.work.feature.encoder.queueBasics");
  q.pass = Number(candidate.actions.length === 0); q.actionCount = candidate.actions.length / 4;
  q.requestedMinerals = m; q.requestedGas = g; q.mineralMargin = MM; q.gasMargin = GM;
  let deployCount = 0;
  for (const action of candidate.actions) {
    charge(meter, 10, "$.work.feature.encoder.phaseCountVisit");
    q[`timing.${action.timing}Count`] += 1 / 4;
    if (action.kind === "deploy") deployCount++;
  }
  charge(meter, 2, "$.work.feature.encoder.crushCounters");
  let crushedPaid = 0, crushedReplacement = 0;
  for (const token of projection.crushed) {
    charge(meter, 8, "$.work.feature.encoder.crushedTokenVisit");
    const unit = projection.baseline.units.get(token);
    if (unit) { crushedPaid += unit.paidBasis; crushedReplacement += replacementValue(unit.type, meter); }
  }
  charge(meter, 6, "$.work.feature.encoder.crushScales");
  q["nominal.deployCrushOwnPaid"] = crushedPaid / 3072; q["nominal.deployCrushOwnReplacement"] = crushedReplacement / 2304;
  const beforeThreat = threatened(projection.layers, projection.baseline, meter), afterThreat = threatened(projection.layers, projection.final, meter);
  for (const unit of projection.final.units.values()) {
    charge(meter, 4, "$.work.feature.encoder.finalCCVisit");
    if (unit.type === "k") {
      const e = exposure(projection.layers, projection.final, unit.square, meter);
      charge(meter, 6, "$.work.feature.encoder.finalCCMeasurements");
      q["nominal.ccExposureKnown"] = e.known / 64; q["nominal.ccExposurePossible"] = e.possible / 64;
    }
  }
  charge(meter, 5, "$.work.feature.encoder.queueCCProtection");
  q["nominal.ccProtection"] = Number(beforeThreat.ccKnown && !afterThreat.ccKnown);
  for (let i = 0; i < projection.positions.length; i++) for (let j = i + 1; j < projection.positions.length; j++) {
    // WHAT: token/kind/timing/position reads, six pair predicates, and counter stores.
    charge(meter, 40 + 6 * 16, "$.work.feature.encoder.authoredPairVisit");
    const a = projection.positions[i], b = projection.positions[j];
    const same = a.actorToken !== null && a.actorToken === b.actorToken;
    if (same) {
      q["pair.sameActor"]++;
      if (a.action.timing === "B" && b.action.timing === "C" || a.action.timing === "C" && b.action.timing === "B") q["pair.BC"]++;
      if (a.action.timing === "C" && b.action.timing === "F" || a.action.timing === "F" && b.action.timing === "C") q["pair.CF"]++;
      if (a.action.kind === "spiderMine" && b.action.kind === "classical" && b.actorBefore?.square !== b.actorAfter?.square ||
          b.action.kind === "spiderMine" && a.action.kind === "classical" && a.actorBefore?.square !== a.actorAfter?.square) q["pair.mineRelocate"]++;
    }
    if (a.action.kind === "deploy" && a.action.timing === "B" && a.childToken !== null && a.childToken === b.actorToken && b.action.kind === "classical" ||
        b.action.kind === "deploy" && b.action.timing === "B" && b.childToken !== null && b.childToken === a.actorToken && a.action.kind === "classical") q["pair.deployMove"]++;
    if (({ B: 0, C: 1, F: 2 } as const)[a.action.timing] > ({ B: 0, C: 1, F: 2 } as const)[b.action.timing]) q["pair.timingInversions"]++;
  }
  for (const name of ["pair.sameActor", "pair.BC", "pair.CF", "pair.mineRelocate", "pair.deployMove", "pair.timingInversions"] as const) {
    charge(meter, 6, "$.work.feature.encoder.pairScaleVisit");
    q[name] /= 6;
  }
  charge(meter, 1, "$.work.feature.encoder.relationPairCounter");
  let pairs = 0;
  for (const unit of projection.final.units.values()) {
    charge(meter, 4, "$.work.feature.encoder.pressureActorVisit");
    pairs += pressure(projection.layers, projection.final, unit, meter).units;
  }
  charge(meter, 81, "$.work.feature.encoder.queueInteractions");
  const PK = pairs / 4096, NL = novelUnion.size / 64, CK = q["nominal.ccExposureKnown"], CP = q["nominal.ccExposurePossible"];
  q["nominal.newlyLit"] = NL; q["nominal.visionOverlap"] = (noveltySum - novelUnion.size) / 256;
  q["ix.spendOwnPaidLoss"] = s * D; q["ix.tradeEnemyPaidBound"] = PK * EP; q["ix.tradeEnemyReplacementBound"] = PK * ER;
  q["ix.noveltyUnknown"] = NL * U; q["ix.ccExposureVulnerability"] = (CK + CP) * Cv;
  q["ix.mineRelocateUnknown"] = q["pair.mineRelocate"] * U; q["ix.spendTurn"] = s * snapshot.turn / 45;
  q["ix.passVulnerability"] = q.pass * Cv; q["ix.deployGasIncome"] = deployCount / 4 * snapshot.own.gasIncome / 3;
  q["ix.pressureLossUncertainty"] = PK * Number(ledger.enemyLoss.upper === "unknown");
  q["ix.spendOwnPaidWaste"] = s * W; q["ix.deployOwnPaidWaste"] = deployCount / 4 * W;
  charge(meter, 8 + QUEUE_NAMES.length + 4 * (POSITION_NAMES.length + 1), "$.work.feature.encoder.historicalFreeze");
  const queueCursor = beginQueue34(meter);
  for (let i = 0; i < QUEUE_NAMES.length; i++) putQueue34(meter, queueCursor, i, q[QUEUE_NAMES[i]!]);
  const ownedPositions = positions.map(p => {
    const cursor = beginPosition84(meter);
    for (let i = 0; i < POSITION_NAMES.length; i++) putPosition84(meter, cursor, i, p[POSITION_NAMES[i]!]);
    return finishPosition84(meter, cursor);
  });
  return { queue: finishQueue34(meter, queueCursor), positions: [ownedPositions[0]!, ownedPositions[1]!, ownedPositions[2]!, ownedPositions[3]!] };
};

export const encodeFeatureBlocksV3 = (history: History, state: EconomicBeliefState, candidate: Candidate, artifact: EconomicArtifact, meter: Meter): FeatureBlocksV3 => {
  charge(meter, 5, "$.work.feature.encoder.entry");
  requireHistory(history); requireState(state); requireCandidate(candidate); requireArtifact(artifact);
  if (candidate.actions.length > 4) fail("$.actions", "CARDINALITY");
  const readout = readoutEconomicInternal(history, state, artifact, meter);
  const context: NumericalFeatureContext = { balance: decodeFloat64(readout.balance, meter), uncertainty: decodeFloat64(readout.uncertainty, meter), witnessed: state.witnessed, unlocated: state.unlocated };
  const projection = projectOwn(history, candidate, meter);
  const prefix = encodeHistorical370(history, candidate, projection, meter);
  const economic = economicFeatures(projection, candidate, context, meter);
  const promotion = promotionFeatures(projection, context, history.currentAuthorizedSnapshotV2.side, history.currentAuthorizedSnapshotV2.turn, meter);
  charge(meter, 12, "$.work.feature.encoder.blocksFreeze");
  return makeFeatureBlocks(meter, prefix.queue, ...prefix.positions, economic, promotion);
};
