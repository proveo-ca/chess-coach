// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { describe, expect, it } from "vitest";
import type { Meter } from "../economic/contracts";
import { JOINT_SIZE } from "../economic/contracts";
import { calibrateJoint, publicCertainty, summarizeJoint } from "../economic/readout";
import { createPlanningLedger, enterA2, type LedgerPair } from "../economic/ownedKernel";

let previous: LedgerPair | undefined;
const meter = (): Meter => {
  if (previous) { try { previous.owner.abort(); } catch { } }
  previous = createPlanningLedger(); previous.owner.admitOnce(); previous.owner.armReadout(); enterA2(previous.meter, "readout");
  return previous.meter;
};
const distribution = (entries: readonly (readonly [number, number, number])[]) => {
  const joint = new Float64Array(JOINT_SIZE), support = new Array<boolean>(JOINT_SIZE).fill(false);
  for (const [d, bank, p] of entries) { joint[577 * bank + d] = p; support[577 * bank + d] = true; }
  return { joint, support };
};

describe("economic calibrated joint readout", () => {
  it("temperatures the joint copy with an independent power reference", () => {
    const { joint, support } = distribution([[0, 12, .1], [3, 0, .2], [7, 2, .3], [576, 12, .4]]), original = joint.slice();
    for (const temperature of [.25, 1, 4]) {
      const result = calibrateJoint(joint, support, temperature, meter());
      const powers = [.1, .2, .3, .4].map(p => p ** (1 / temperature)), total = powers.reduce((sum, p) => sum + p, 0);
      for (const [i, index] of [577 * 12, 3, 577 * 2 + 7, 577 * 12 + 576].entries()) expect(result[index]).toBeCloseTo(powers[i]! / total, 14);
      expect(joint).toEqual(original); expect(result).not.toBe(joint);
    }
  });
  it("marginalizes D and D+B with smallest-integer quantiles in .05,.95,.025,.975 order", () => {
    const { joint, support } = distribution([[0, 12, .03], [1, 0, .03], [4, 3, .88], [9, 0, .03], [10, 0, .03]]);
    const result = summarizeJoint(joint, support, 9, meter());
    expect(result.quantilesD).toEqual([1, 9, 0, 10]);
    expect(result.quantilesPotential).toEqual([7, 10, 1, 12]);
    expect(result.meanD).toBeCloseTo(4.12, 14);
    expect(result.meanPotential).toBeCloseTo(7.12, 14);
    expect(result.balance).toBeCloseTo(4.88, 14); expect(result.uncertainty).toBe(5);
  });
  it("derives certainty from Boolean support rather than model point masses", () => {
    const { joint, support } = distribution([[4, 3, 1], [8, 0, 0]]);
    expect(publicCertainty(support, meter())).toEqual({ material: null, potential: null });
    expect(summarizeJoint(joint, support, 0, meter()).meanD).toBe(4);
    const samePotential = distribution([[4, 3, .6], [6, 1, .4]]);
    expect(publicCertainty(samePotential.support, meter())).toEqual({ material: null, potential: 7 });
    expect(summarizeJoint(samePotential.joint, samePotential.support, 4, meter()).meanPotential).toBe(7);
    const sameMaterial = distribution([[576, 0, .2], [576, 12, .8]]);
    expect(publicCertainty(sameMaterial.support, meter())).toEqual({ material: 576, potential: null });
    expect(summarizeJoint(sameMaterial.joint, sameMaterial.support, 0, meter()).balance).toBe(-576);
  });
  it("retains numerical extremes at tau4 and fails erased positive mass at tau.25", () => {
    const { joint, support } = distribution([[0, 0, 1], [576, 12, 1e-300]]);
    expect(calibrateJoint(joint, support, 4, meter())[577 * 12 + 576]).toBeGreaterThan(0);
    expect(() => calibrateJoint(joint, support, .25, meter())).toThrow("NUMERIC");
    expect(() => calibrateJoint(joint, support, NaN, meter())).toThrow("NUMBER");
  });
  it("rejects negative/nonfinite/empty mass, contradictory support and unnormalized inputs", () => {
    const { joint, support } = distribution([[4, 3, 1]]);
    for (const value of [-1, NaN, Infinity, 0, .9]) {
      joint[577 * 3 + 4] = value;
      expect(() => calibrateJoint(joint, support, 1, meter())).toThrow("NUMERIC");
    }
    joint[577 * 3 + 4] = 1; support[577 * 3 + 4] = false;
    expect(() => calibrateJoint(joint, support, 1, meter())).toThrow("NUMERIC");
  });
  it("shares the existing cap across successive helpers", () => {
    const { joint, support } = distribution([[4, 3, 1]]), work = meter();
    const result = calibrateJoint(joint, support, 1, work);
    expect(summarizeJoint(result, support, 4, work).balance).toBe(0);
    const used = work.used;
    calibrateJoint(joint, support, 1, work);
    expect(() => calibrateJoint(joint, support, 1, work)).toThrow("WORK_CAP");
    expect(work.used).toBeGreaterThanOrEqual(used); expect(work.used).toBeLessThanOrEqual(work.limit);
  });
});
