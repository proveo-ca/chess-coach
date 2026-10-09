import { describe, expect, it } from "vitest";
import type { Meter, Table, TransitionTable } from "../economic/contracts";
import { BAND_STARTS, JOINT_SIZE } from "../economic/contracts";
import { encodeFloat64, decodeFloat64 } from "../economic/float64";
import { evaluateEconomic, gammaSets, rebandEconomic, type EvaluationInput } from "../economic/evaluator";

const meter = (): Meter => ({ limit: 1048576, used: 0 });
const h = (value: number) => encodeFloat64(value, undefined);
const rows = [[0, 0, 0, 0, 0, 7], [1, 0, 1, 0, 0, 5], [1, 1, 0, 8, 3, 4], [3, 3, 0, 2, 1, 2]] as const;
const global: TransitionTable = { kind: "transition", level: 3, bank: null, band: null, tier: null, groups: 40,
  rows: rows.map(([s, c, w, g, d, count]) => [s, c, w, g, d, h(count)]) };
const jointInput = (d: number, bank: number, gas: number, grant: boolean, loss: number): EvaluationInput => {
  const joint = new Float64Array(JOINT_SIZE), publicSupport = new Array<boolean>(JOINT_SIZE).fill(false);
  joint[577 * bank + d] = 1; publicSupport[577 * bank + d] = true;
  return { joint, publicSupport, tables: [global], inputTurn: 10, turn: 11, gas, boundsBefore: { lower: 0, upper: 576, marines: 0 },
    bounds: { lower: 0, upper: 576, marines: 0 }, loss, grant, innovation: [0, 0, 0], settled: true };
};
const bruteGrowth = (opportunities: number): number[] => {
  const result = new Set<number>();
  const visit = (remaining: number, sum: number): void => {
    if (remaining === 0) { result.add(sum); return; }
    for (const growth of [0, 2, 4, 8]) visit(remaining - 1, sum + growth);
  };
  visit(opportunities, 0);
  return [...result].sort((a, b) => a - b);
};
const oracle = (input: EvaluationInput, counts: readonly (readonly number[])[] = rows) => {
  const result = new Float64Array(JOINT_SIZE), support = new Array<boolean>(JOINT_SIZE).fill(false);
  for (let bank = 0; bank < 13; bank++) for (let material = 0; material < 577; material++) {
    const source = 577 * bank + material;
    if (!input.publicSupport[source] && input.joint[source] === 0) continue;
    const feasible: number[][] = [];
    for (const spend of [0, 1, 3, 5, 9]) {
      if (spend > bank) continue;
      for (const created of spend === 0 ? [0] : [0, spend]) {
        const opportunities = Math.min(4, 1 + input.gas - Number(spend > 0), input.boundsBefore.marines + material - input.boundsBefore.lower + Number(created === 1));
        if (opportunities < 0) continue;
        for (const growth of bruteGrowth(opportunities)) {
          const headstock = material + created + growth;
          for (let destroyed = Math.max(0, headstock - 576); destroyed <= headstock; destroyed++) feasible.push([spend, created, spend - created, growth, destroyed]);
        }
      }
    }
    const tupleCount = (tuple: number[]) => counts.find(row => tuple.every((v, i) => v === row[i]))?.[5] ?? 0;
    const denominator = feasible.reduce((sum, tuple) => sum + tupleCount(tuple) + .5, 0);
    for (const tuple of feasible) {
      const [spend, created, , growth, destroyed] = tuple as [number, number, number, number, number];
      if (destroyed < input.loss) continue;
      const outD = material + created + growth - destroyed;
      if (outD < input.bounds.lower || outD > input.bounds.upper) continue;
      const credit = input.grant ? input.turn <= 10 ? 1 : input.turn <= 20 ? 2 : 3 : 0;
      const outBank = Math.min(12, bank - spend + credit), destination = 577 * outBank + outD;
      if (input.publicSupport[source]) support[destination] = true;
      result[destination] += input.joint[source]! * (tupleCount(tuple) + .5) / denominator;
    }
  }
  const total = result.reduce((sum, p) => sum + p, 0);
  if (total === 0) return null;
  for (let i = 0; i < JOINT_SIZE; i++) result[i] /= total;
  return { joint: result, publicSupport: support };
};
const equal = (actual: ReturnType<typeof evaluateEconomic>, expected: ReturnType<typeof evaluateEconomic>) => {
  let maximumError = 0, supportMismatch = -1;
  for (let i = 0; i < JOINT_SIZE; i++) {
    maximumError = Math.max(maximumError, Math.abs(actual.joint[i]! - expected.joint[i]!));
    if (actual.publicSupport[i] !== expected.publicSupport[i]) supportMismatch = i;
  }
  expect(supportMismatch).toBe(-1); expect(maximumError).toBeLessThan(1e-12);
  expect(actual.joint.reduce((sum, p) => sum + p, 0)).toBeCloseTo(1, 12);
};

describe("economic positive evaluator independent exhaustive parity", () => {
  it("enumerates Boolean Gamma sums once", () => {
    expect(gammaSets(meter())).toEqual([0, 1, 2, 3, 4].map(bruteGrowth));
    expect(gammaSets(meter())[2]!.filter(value => value === 8)).toHaveLength(1);
  });
  it("exhausts small banks/material, three gas tiers, both grant cases and witnessed losses", () => {
    for (let material = 0; material <= 5; material++) for (let bank = 0; bank <= 4; bank++) for (const gas of [1, 2, 3])
      for (const grant of [false, true]) for (const loss of [0, 1, 3]) {
        const input = jointInput(material, bank, gas, grant, loss), expected = oracle(input);
        if (expected === null) expect(() => evaluateEconomic(input, meter())).toThrow("CONSISTENCY");
        else equal(evaluateEconomic(input, meter()), expected);
      }
  });
  it("conditions mixtures globally without source renormalization after L", () => {
    const input = jointInput(0, 1, 1, false, 1);
    input.joint[577] = .4; input.joint[577 + 4] = .6;
    (input.publicSupport as boolean[])[577 + 4] = true;
    equal(evaluateEconomic(input, meter()), oracle(input)!);
  });
  it("counts only feasible fitted rows and clips destruction by the ceiling, not by the loss evidence", () => {
    for (const material of [575, 576]) {
      const input = { ...jointInput(material, 3, 3, true, 4), bounds: { lower: 570, upper: 576, marines: 0 } };
      equal(evaluateEconomic(input, meter()), oracle(input)!);
    }
  });
  it("uses group32 backoff and global even when it has fewer groups", () => {
    const input = jointInput(4, 3, 1, false, 0);
    const local: TransitionTable = { ...global, level: 0, bank: 3, band: 4, tier: 0, groups: 31,
      rows: [[0, 0, 0, 0, 0, h(100)]] };
    equal(evaluateEconomic({ ...input, tables: [local, { ...global, groups: 1 }] }, meter()), oracle(input)!);
    const selected = { ...local, groups: 32 };
    equal(evaluateEconomic({ ...input, tables: [selected, global] }, meter()), oracle(input, [[0, 0, 0, 0, 0, 100]])!);
    const bankTier = { ...selected, level: 1, band: null };
    const bankOnly = { ...selected, level: 2, band: null, tier: null };
    for (const table of [bankTier, bankOnly]) equal(evaluateEconomic({ ...input, tables: [local, table, global] }, meter()), oracle(input, [[0, 0, 0, 0, 0, 100]])!);
  });
  it("keeps Boolean support when a model source has zero probability", () => {
    const input = jointInput(1, 0, 1, false, 0);
    (input.publicSupport as boolean[])[577 * 12 + 20] = true;
    equal(evaluateEconomic(input, meter()), oracle(input)!);
    expect(evaluateEconomic(input, meter()).publicSupport[577 * 12 + 20]).toBe(true);
  });
  it("uses evidence smoothing over all48 codes without changing Boolean support", () => {
    const input = jointInput(3, 1, 1, false, 0);
    const evidence: Table = { kind: "evidence", level: 3, bank: null, band: null, tier: null, groups: 1,
      rows: [[1, 0, 0, h(8)]] };
    const baseline = evaluateEconomic(input, meter());
    const actual = evaluateEconomic({ ...input, tables: [global, evidence], innovation: [1, 0, 0] }, meter());
    equal(actual, baseline);
    equal(evaluateEconomic({ ...input, tables: [global, evidence] }, meter()), baseline);
  });
  it("matches an independent heterogeneous evidence product and output-tier backoff", () => {
    const input = jointInput(4, 3, 1, false, 0), baseline = evaluateEconomic(input, meter());
    const local: Table = { kind: "evidence", level: 1, bank: 2, band: null, tier: 1, groups: 32,
      rows: [[0, 0, 1, h(7)], [1, 0, 0, h(9)]] };
    const globalEvidence: Table = { kind: "evidence", level: 3, bank: null, band: null, tier: null, groups: 1, rows: [[1, 0, 0, h(3)]] };
    const expected = baseline.joint.slice();
    let total = 0;
    for (let bank = 0; bank <= 12; bank++) for (let d = 0; d <= 576; d++) {
      const index = bank * 577 + d;
      expected[index] *= bank === 2 ? 9.5 / 40 : 3.5 / 27;
      total += expected[index]!;
    }
    for (let i = 0; i < JOINT_SIZE; i++) expected[i] /= total;
    equal(evaluateEconomic({ ...input, turn: 11, tables: [global, local, globalEvidence], innovation: [1, 0, 0] }, meter()),
      { joint: expected, publicSupport: baseline.publicSupport });
  });
  it("retains all247 components and every explicit conditional band entry", () => {
    const joint = new Float64Array(JOINT_SIZE).fill(1 / JOINT_SIZE);
    const components = rebandEconomic(joint, meter());
    expect(components).toHaveLength(247);
    let entries = 0;
    for (const component of components) {
      const width = (component.band === 18 ? 577 : BAND_STARTS[component.band + 1]!) - BAND_STARTS[component.band]!;
      expect(component.conditional).toHaveLength(width); entries += width;
      for (const value of component.conditional) expect(decodeFloat64(value, undefined)).toBeGreaterThan(0);
    }
    expect(entries).toBe(7501);
  });
  it("preserves band zeros and rejects positive underflow", () => {
    const joint = new Float64Array(JOINT_SIZE); joint[5] = 1;
    const components = rebandEconomic(joint, meter());
    expect(components[0]!.conditional.map(value => decodeFloat64(value, undefined))).toEqual([0, 1]);
    const input = jointInput(1, 0, 1, false, 0);
    input.joint[1] = Number.MIN_VALUE; input.joint[0] = 1;
    (input.publicSupport as boolean[])[0] = true;
    expect(() => evaluateEconomic(input, meter())).toThrow("NUMERIC");
  });
  it("prevents cap overflow without publishing or mutating the source", () => {
    const input = jointInput(4, 3, 1, false, 0), before = input.joint.slice();
    const work = meter(); work.used = work.limit - 1;
    expect(() => evaluateEconomic(input, work)).toThrow("WORK_CAP");
    expect(input.joint).toEqual(before); expect(work.used).toBe(work.limit - 1);
  });
  it("persists the broad-support cap conflict at source bank0/material368", () => {
    const joint = new Float64Array(JOINT_SIZE), publicSupport = new Array<boolean>(JOINT_SIZE).fill(false);
    for (let bank = 0; bank <= 12; bank++) for (let d = 0; d <= 567; d++) {
      joint[577 * bank + d] = 1 / (13 * 568); publicSupport[577 * bank + d] = true;
    }
    const before = joint.slice(), work = meter();
    const input: EvaluationInput = { joint, publicSupport, tables: [], inputTurn: 21, turn: 22, gas: 3,
      boundsBefore: { lower: 0, upper: 567, marines: 0 }, bounds: { lower: 0, upper: 567, marines: 0 },
      loss: 0, grant: true, innovation: [0, 0, 0], settled: true };
    expect(() => evaluateEconomic(input, work)).toThrow("WORK_CAP: $.evaluation.branches");
    expect(work.used).toBe(1047859); expect(work.limit - work.used).toBe(717);
    expect(joint).toEqual(before);
  });
});
