// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import type { Candidate, Economic12, Meter } from "../economic/contracts";
import { charge, fail } from "../economic/work";
import type { OwnProjection } from "./projection";
import { exposure, replacementValue, stationaryRelation } from "./relations";
import { beginEconomic12, finishEconomic12, putEconomic12 } from "../economic/ownedKernel";

export type NumericalEconomicReadout = Readonly<{ balance: number; uncertainty: number }>;

export const economicFeatures = (projection: OwnProjection, candidate: Candidate, readout: NumericalEconomicReadout, meter: Meter): Economic12 => {
  charge(meter, 12, "$.work.feature.economic.readoutDomain");
  if (!Number.isFinite(readout.balance) || !Number.isFinite(readout.uncertainty)) fail("$.readout", "NONFINITE");
  if (readout.balance < -576 || readout.balance > 576 || readout.uncertainty < 0 || readout.uncertainty > 288) fail("$.readout", "NUMBER");
  charge(meter, 12, "$.work.feature.economic.accumulators");
  const targets = new Set<string>(), risks = new Map<string, number>();
  let targetValue = 0, deployValue = 0, crushedValue = 0, protectedValue = 0, classical = false;
  for (const index of projection.schedule) {
    charge(meter, 12, "$.work.feature.economic.checkpointVisit");
    const checkpoint = projection.positions[index], action = checkpoint.action;
    if (action.kind === "deploy" && action.unit) deployValue += replacementValue(action.unit, meter);
    if (action.kind === "classical") {
      classical = true;
      const target = projection.layers.enemies.get(action.to);
      charge(meter, 12, "$.work.feature.economic.targetEligibility");
      if (target && target.type !== "k" && checkpoint.actorBefore && !targets.has(action.to) &&
          stationaryRelation(projection.layers, checkpoint.before, checkpoint.actorBefore, action.to, meter) === "known") {
        charge(meter, 4, "$.work.feature.economic.targetDedup");
        targets.add(action.to); targetValue += replacementValue(target.type, meter);
      }
    }
    const actor = checkpoint.actorAfter;
    charge(meter, 5, "$.work.feature.economic.riskEligibility");
    if (actor && actor.type !== "k") {
      const e = exposure(projection.layers, checkpoint.after, actor.square, meter);
      charge(meter, 8, "$.work.feature.economic.riskCheckpoint");
      if (e.known + e.possible > 0) {
        const value = replacementValue(actor.type, meter);
        charge(meter, 7, "$.work.feature.economic.riskMaxDedup");
        risks.set(actor.token, Math.max(risks.get(actor.token) ?? 0, value));
      }
    }
  }
  for (const token of projection.crushed) {
    charge(meter, 6, "$.work.feature.economic.crushedTokenVisit");
    const unit = projection.baseline.units.get(token);
    if (unit) crushedValue += replacementValue(unit.type, meter);
  }
  for (const unit of projection.baseline.units.values()) {
    charge(meter, 8, "$.work.feature.economic.survivorVisit");
    const survivor = projection.final.units.get(unit.token);
    if (unit.type === "k" || !survivor) continue;
    const before = exposure(projection.layers, projection.baseline, unit.square, meter);
    const after = exposure(projection.layers, projection.final, survivor.square, meter);
    charge(meter, 8, "$.work.feature.economic.survivorPredicate");
    if (before.known + before.possible > 0 && after.known + after.possible === 0) protectedValue += replacementValue(unit.type, meter);
  }
  charge(meter, 2 + 4 * risks.size, "$.work.feature.economic.riskReduce");
  let actorRisk = 0;
  for (const value of risks.values()) actorRisk += value;
  charge(meter, 58, "$.work.feature.economic.formulasAndRecord");
  const S = .5 * (candidate.ownSpend.minerals / 12 + candidate.ownSpend.gas / 3);
  const A = (deployValue - crushedValue) / 12, T = classical ? (targetValue - actorRisk) / 12 : 0, P = protectedValue / 12;
  if (S < 0 || S > 1 || A < -48 || A > 1 || T < -3 || T > .75 || P < 0 || P > 48) fail("$.economic", "NUMBER");
  const cursor = beginEconomic12(meter), values = [S * readout.balance, S * readout.uncertainty, A * readout.balance, A * readout.uncertainty,
    T * readout.balance, T * readout.uncertainty, P * readout.balance, P * readout.uncertainty, S, A, T, P];
  for (let i = 0; i < 12; i++) putEconomic12(meter, cursor, i, values[i] === 0 ? 0 : values[i]!);
  return finishEconomic12(meter, cursor);
};
