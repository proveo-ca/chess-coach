// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import type { Cells, Component, EconomicArtifact, Meter, Side, Table, TransitionTable, EvidenceTable } from "./contracts";
import { BAND_STARTS, JOINT_SIZE } from "./contracts";
import { decodeFloat64, encodeFloat64 } from "./float64";
import { charge, fail } from "./work";
import { replacement } from "./innovation";
import { appendComponents247, appendConditional, beginComponents247, beginConditional,
  finishComponents247, finishConditional, makeComponent, beginEvaluationSupport7501, putEvaluationSupport,
  readEvaluationSupport, finishEvaluationSupport7501 } from "./ownedKernel";
import { requireArtifact, requireStartupArtifactContext } from "./ownedGuards";
import type { StartupArtifactContext } from "./ownedKernel";
import { decodeOwnedNumber } from "./ownedScalars";

export type BoardBounds = Readonly<{ lower: number; upper: number; marines: number }>;
export type EvaluationInput = Readonly<{
  joint: Float64Array; publicSupport: readonly boolean[]; tables: readonly Table[];
  inputTurn: number; turn: number; gas: number; boundsBefore: BoardBounds; bounds: BoardBounds;
  loss: number; grant: boolean; innovation: readonly [number, number, number]; settled: boolean;
}>;
export type Evaluation = Readonly<{ joint: Float64Array; publicSupport: readonly boolean[] }>;

export const currentBoardBounds = (cells: Cells, side: Side, meter: Meter): BoardBounds => {
  charge(meter, 20 + 26 * cells.length, "$.bounds");
  let lower = 0, unknown = 0, cc = false, marines = 0;
  for (const cell of cells) {
    if (cell.visibility === "unknown") unknown++;
    else if (cell.piece !== null && cell.piece.color !== side) {
      lower += replacement(cell.piece.type);
      if (cell.piece.type === "k") cc = true;
      if (cell.piece.type === "p") marines++;
    }
  }
  const reserve = cc ? 0 : 1;
  if (unknown < reserve) fail("$.bounds.cc", "CONSISTENCY");
  return { lower, upper: Math.min(576, lower + 9 * (unknown - reserve)), marines };
};

export const materialBand = (material: number, meter: Meter): number => {
  charge(meter, 4 + 4 * BAND_STARTS.length, "$.band");
  let band = 0;
  for (let i = 1; i < BAND_STARTS.length; i++) if (material >= BAND_STARTS[i]!) band = i;
  return band;
};

export const gammaSets = (meter: Meter): readonly (readonly number[])[] => {
  charge(meter, 16 + 5 * 33 + 4 * 33 * 4 * 12 + 5 * 33 * 8, "$.gamma");
  const masks: boolean[][] = [], sets: number[][] = [];
  for (let m = 0; m <= 4; m++) {
    const mask = new Array<boolean>(33).fill(false), values: number[] = [];
    if (m === 0) mask[0] = true;
    else for (let value = 0; value <= 32; value++) if (masks[m - 1]![value]) {
      for (const growth of [0, 2, 4, 8]) if (value + growth <= 32) mask[value + growth] = true;
    }
    for (let value = 0; value <= 32; value++) if (mask[value]) values.push(value);
    masks.push(mask); sets.push(values);
  }
  return sets;
};

type NumericTransition = readonly [number, number, number, number, number, number];
type NumericEvidence = readonly [number, number, number, number];
type IndexedTables = Readonly<{ transition: Map<string, TransitionTable>; evidence: Map<string, EvidenceTable>;
  transitions: Map<TransitionTable, readonly NumericTransition[]>; evidences: Map<EvidenceTable, readonly NumericEvidence[]> }>;
const artifactTables = new WeakMap<readonly Table[], IndexedTables>();
const immutableTables = (tables: readonly Table[]): boolean => Object.isFrozen(tables) && tables.every(table => Object.isFrozen(table) && Object.isFrozen(table.rows) &&
  table.rows.every(row => Object.isFrozen(row) && Object.isFrozen(row[row.length - 1])));
const tableKey = (level: number, bank: number | null, band: number | null, tier: number | null): string => `${level}:${bank}:${band}:${tier}`;
export const compileEconomicArtifactTables = (artifact: EconomicArtifact, context: StartupArtifactContext): void => {
  requireStartupArtifactContext(context); requireArtifact(artifact);
  if (artifactTables.has(artifact.tables)) return;
  const transition = new Map<string, TransitionTable>(), evidence = new Map<string, EvidenceTable>();
  const transitions = new Map<TransitionTable, readonly NumericTransition[]>(), evidences = new Map<EvidenceTable, readonly NumericEvidence[]>();
  for (const table of artifact.tables) {
    const key = tableKey(table.level, table.bank, table.band, table.tier);
    if (table.kind === "transition") {
      transition.set(key, table);
      transitions.set(table, Object.freeze(table.rows.map(row => Object.freeze([row[0], row[1], row[2], row[3], row[4], decodeOwnedNumber(row[5])] as const))));
    } else {
      evidence.set(key, table);
      evidences.set(table, Object.freeze(table.rows.map(row => Object.freeze([row[0], row[1], row[2], decodeOwnedNumber(row[3])] as const))));
    }
  }
  artifactTables.set(artifact.tables, { transition, evidence, transitions, evidences });
};
const indexTables = (tables: readonly Table[], meter: Meter): IndexedTables => {
  charge(meter, 12, "$.tables.compiledLookup");
  const compiled = artifactTables.get(tables);
  if (compiled) return compiled;
  charge(meter, 12 + 70 * tables.length, "$.tables.index");
  const transition = new Map<string, TransitionTable>(), evidence = new Map<string, EvidenceTable>();
  let rowCount = 0;
  for (const table of tables) {
    rowCount += table.rows.length;
    const key = tableKey(table.level, table.bank, table.band, table.tier);
    const map: Map<string, Table> = table.kind === "transition" ? transition : evidence;
    if (map.has(key)) fail("$.tables", "DUPLICATE");
    map.set(key, table);
  }
  const result = { transition, evidence, transitions: new Map<TransitionTable, readonly NumericTransition[]>(), evidences: new Map<EvidenceTable, readonly NumericEvidence[]>() };
  charge(meter, 20 + 12 * rowCount, "$.tables.immutableRows");
  if (immutableTables(tables)) artifactTables.set(tables, result);
  return result;
};
const select = <T extends Table>(tables: Map<string, T>, bank: number, band: number, tier: number, meter: Meter): T | undefined => {
  charge(meter, 160, "$.tables.backoff");
  const keys = [tableKey(0, bank, band, tier), tableKey(1, bank, null, tier), tableKey(2, bank, null, null), tableKey(3, null, null, null)];
  for (let level = 0; level < 4; level++) {
    const table = tables.get(keys[level]!);
    if (table && (level === 3 || table.groups >= 32)) return table;
  }
  return undefined;
};
const product = (a: number, b: number): number => {
  const value = a * b;
  if (!Number.isFinite(value) || (a > 0 && b > 0 && value === 0)) fail("$.evaluation.product", "NUMERIC");
  return value;
};
const divide = (a: number, b: number): number => {
  const value = a / b;
  if (!Number.isFinite(value) || (a > 0 && value === 0)) fail("$.evaluation.divide", "NUMERIC");
  return value;
};
const add = (a: number, b: number): number => {
  const value = a + b;
  if (!Number.isFinite(value)) fail("$.evaluation.sum", "NONFINITE");
  return value;
};

export const evaluateEconomic = (input: EvaluationInput, meter: Meter): Evaluation => {
  charge(meter, 50 + 2 * JOINT_SIZE + 2 * 13 * 618 + 13, "$.evaluation.allocate");
  if (input.joint.length !== JOINT_SIZE || input.publicSupport.length !== JOINT_SIZE) fail("$.evaluation.joint", "CARDINALITY");
  const head = new Float64Array(13 * 618), sparse = new Float64Array(JOINT_SIZE), joint = new Float64Array(JOINT_SIZE);
  const support = beginEvaluationSupport7501(meter), publicHead = new Int16Array(13).fill(-1);
  const publicHeads = new Uint8Array(13 * 618);
  const gammas = input.settled ? gammaSets(meter) : [];
  const tables = indexTables(input.tables, meter);
  charge(meter, 20, "$.evaluation.cache");
  const { transitions, evidences } = tables;
  const tier = input.inputTurn <= 10 ? 0 : input.inputTurn <= 20 ? 1 : 2;
  const outputTier = input.turn <= 10 ? 0 : input.turn <= 20 ? 1 : 2;
  const income = input.turn <= 10 ? 1 : input.turn <= 20 ? 2 : 3;
  charge(meter, 22 * JOINT_SIZE + 10, "$.evaluation.sourceScan");
  for (let bank = 0; bank <= 12; bank++) for (let d0 = 0; d0 <= 576; d0++) {
    const x = 577 * bank + d0, p = input.joint[x]!;
    if (!Number.isFinite(p) || p < 0 || (p > 0 && !input.publicSupport[x])) fail("$.evaluation.source", "NUMERIC");
    if (!input.publicSupport[x] && p === 0) continue;
    if (!input.settled) {
      charge(meter, 14, "$.evaluation.stationary");
      if (d0 >= input.bounds.lower && d0 <= input.bounds.upper) {
        joint[x] = p; putEvaluationSupport(meter, support, x, input.publicSupport[x]!);
        if (input.publicSupport[x]) publicHead[bank] = d0;
      }
      continue;
    }
    charge(meter, 30, "$.evaluation.source");
    const band = materialBand(d0, meter);
    const table = p > 0 ? select(tables.transition, bank, band, tier, meter) : undefined;
    let rows: readonly NumericTransition[] = [];
    if (table) {
      charge(meter, 6, "$.evaluation.rowCache");
      const cached = transitions.get(table);
      if (cached) rows = cached;
      else {
        charge(meter, 12 + 32 * table.rows.length, "$.evaluation.decodeRows");
        const decoded: NumericTransition[] = [];
        for (const row of table.rows) {
          const count = decodeFloat64(row[5], meter, "$.tables.count");
          if (!(count > 0) || count > 14400) fail("$.tables.count", "NUMBER");
          decoded.push([row[0], row[1], row[2], row[3], row[4], count]);
        }
        transitions.set(table, decoded); rows = decoded;
      }
    }
    charge(meter, 24 + 5 * 12 + 9 * 70, "$.evaluation.branchCohorts");
    const cohorts: [number, number, number, number][] = [];
    let branchCount = 0;
    for (const spend of [0, 1, 3, 5, 9]) {
      if (spend > bank) continue;
      for (let birthIndex = 0; birthIndex < (spend === 0 ? 1 : 2); birthIndex++) {
        const created = birthIndex === 0 ? 0 : spend;
        const m = Math.min(4, 1 + input.gas - (spend > 0 ? 1 : 0), input.boundsBefore.marines + d0 - input.boundsBefore.lower + (created === 1 ? 1 : 0));
        if (m < 0) continue;
        const bank1 = input.grant ? Math.min(12, bank - spend + income) : bank - spend;
        cohorts.push([spend, created, m, bank1]); branchCount += gammas[m]!.length;
      }
    }
    charge(meter, 20 + 12 * cohorts.length + 46 * branchCount, "$.evaluation.branches");
    const branches: [number, number, number, number, number][] = [];
    let z = 0;
    for (const [spend, created, m, bank1] of cohorts) {
      for (const growth of gammas[m]!) {
        const j = d0 + created + growth;
        z += Math.min(576, j) + 1;
        branches.push([spend, created, growth, j, bank1]);
        if (input.publicSupport[x] && j >= input.loss) {
          publicHeads[618 * bank1 + j] = 1;
          if (j > publicHead[bank1]!) publicHead[bank1] = j;
        }
      }
    }
    if (p === 0) continue;
    charge(meter, 10 + 90 * rows.length, "$.evaluation.sparseFeasible");
    const feasible: NumericTransition[] = [];
    let n = 0;
    for (const row of rows) {
      const [s, c, w, g, d, count] = row;
      const m = Math.min(4, 1 + input.gas - (s > 0 ? 1 : 0), input.boundsBefore.marines + d0 - input.boundsBefore.lower + (c === 1 ? 1 : 0));
      const j = d0 + c + g;
      charge(meter, 6 + 4 * 33, "$.evaluation.sparseGamma");
      if ((s !== 0 && s !== 1 && s !== 3 && s !== 5 && s !== 9) || s > bank || (c !== 0 && c !== s) || w !== s - c ||
          m < 0 || !gammas[m]!.includes(g) || d > j || d < 0 || j - d > 576) continue;
      n = add(n, count); feasible.push(row);
    }
    charge(meter, 36 + 30 * branches.length + 38 * feasible.length, "$.evaluation.scatter");
    const den = add(n, .5 * z);
    if (!(den > 0)) fail("$.evaluation.denominator", "CONSISTENCY");
    const background = divide(product(.5, p), den);
    for (const [, , , j, bank1] of branches) head[618 * bank1 + j] = add(head[618 * bank1 + j]!, background);
    for (const [s, c, , g, d, count] of feasible) if (d >= input.loss) {
      const bank1 = input.grant ? Math.min(12, bank - s + income) : bank - s;
      const destination = 577 * bank1 + d0 + c + g - d;
      sparse[destination] = add(sparse[destination]!, divide(product(p, count), den));
    }
  }
  if (input.settled) {
    charge(meter, 13 * 12 + 10, "$.evaluation.suffixBanks");
    for (let bank = 0; bank <= 12; bank++) {
      const maximum = publicHead[bank]!;
      if (maximum < 0) continue;
      const minimumD = Math.max(0, input.bounds.lower), maximumD = Math.min(576, maximum - input.loss, input.bounds.upper);
      charge(meter, 38 * maximum + 36 * Math.max(0, maximumD - minimumD + 1) + 12, "$.evaluation.suffix");
      for (let j = maximum - 1; j >= 0; j--) {
        head[618 * bank + j] = add(head[618 * bank + j]!, head[618 * bank + j + 1]!);
        publicHeads[618 * bank + j] |= publicHeads[618 * bank + j + 1]!;
      }
      for (let d = minimumD; d <= maximumD; d++) {
        const x = 577 * bank + d;
        joint[x] = add(sparse[x]!, d + input.loss <= 617 ? head[618 * bank + d + input.loss]! : 0);
        if (publicHeads[618 * bank + d + input.loss] === 1) putEvaluationSupport(meter, support, x, true);
      }
    }
  }
  charge(meter, 30 + 13 * 16, "$.evaluation.conditionBanks");
  let total = 0, any = false;
  const innovative = input.innovation[0] !== 0 || input.innovation[1] !== 0 || input.innovation[2] !== 0;
  charge(meter, 10, "$.evaluation.likelihoodCache");
  const likelihoods = new Map<string, number>();
  for (let bank = 0; bank <= 12; bank++) {
    const minimum = Math.max(0, input.bounds.lower), maximum = Math.min(576, publicHead[bank]! - (input.settled ? input.loss : 0), input.bounds.upper);
    charge(meter, 36 * Math.max(0, maximum - minimum + 1) + 8, "$.evaluation.conditionScan");
    for (let d = minimum; d <= maximum; d++) {
      const x = bank * 577 + d;
      if (readEvaluationSupport(meter, support, x)) any = true;
      if (joint[x]! > 0 && innovative) {
        const band = materialBand(d, meter), key = `${bank}:${band}`;
        charge(meter, 14, "$.evaluation.likelihoodLookup");
        let likelihood = likelihoods.get(key);
        if (likelihood === undefined) {
          const table = select(tables.evidence, bank, band, outputTier, meter);
          let rows: readonly NumericEvidence[] = [];
          if (table) {
            charge(meter, 6, "$.evaluation.evidenceCache");
            const cached = evidences.get(table);
            if (cached) rows = cached;
            else {
              charge(meter, 12 + 28 * table.rows.length, "$.evaluation.decodeEvidence");
              const decoded: NumericEvidence[] = [];
              for (const row of table.rows) {
                const count = decodeFloat64(row[3], meter, "$.tables.count");
                if (!(count > 0) || count > 14400) fail("$.tables.count", "NUMBER");
                decoded.push([row[0], row[1], row[2], count]);
              }
              evidences.set(table, decoded); rows = decoded;
            }
          }
          charge(meter, 20 + 26 * rows.length, "$.evaluation.evidenceSum");
          let sum = 0, count = 0;
          for (const row of rows) {
            sum = add(sum, row[3]);
            if (row[0] === input.innovation[0] && row[1] === input.innovation[1] && row[2] === input.innovation[2]) count = row[3];
          }
          likelihood = divide(count + .5, sum + 24); likelihoods.set(key, likelihood);
        }
        charge(meter, 16, "$.evaluation.likelihoodProduct");
        joint[x] = product(joint[x]!, likelihood);
      }
      total = add(total, joint[x]!);
    }
  }
  charge(meter, 10 + 13 * 16, "$.evaluation.normalizeBanks");
  if (!any || !(total > 0)) fail("$.evaluation.support", "CONSISTENCY");
  let normalized = 0;
  for (let bank = 0; bank <= 12; bank++) {
    const minimum = Math.max(0, input.bounds.lower), maximum = Math.min(576, publicHead[bank]! - (input.settled ? input.loss : 0), input.bounds.upper);
    charge(meter, 28 * Math.max(0, maximum - minimum + 1) + 8, "$.evaluation.normalize");
    for (let d = minimum; d <= maximum; d++) {
      const x = bank * 577 + d;
      joint[x] = divide(joint[x]!, total); normalized = add(normalized, joint[x]!);
    }
  }
  if (Math.abs(normalized - 1) > 1e-12) fail("$.evaluation.normalization", "NUMERIC");
  return { joint, publicSupport: finishEvaluationSupport7501(meter, support) };
};

export const expandComponents = (components: readonly Component[], meter: Meter): Float64Array => {
  charge(meter, JOINT_SIZE + 24 + 40 * components.length, "$.components.expand");
  const joint = new Float64Array(JOINT_SIZE);
  const decoded = new Map<Component["mass"], number>();
  const number = (value: Component["mass"], path: string): number => {
    const cached = decoded.get(value);
    if (cached !== undefined) return cached;
    const result = decodeFloat64(value, meter, path); decoded.set(value, result); return result;
  };
  for (const component of components) {
    const start = BAND_STARTS[component.band]!, end = component.band === 18 ? 577 : BAND_STARTS[component.band + 1]!;
    const mass = number(component.mass, "$.components.mass");
    charge(meter, 10 + 36 * (end - start), "$.components.expandBand");
    if (component.conditional.length !== end - start) fail("$.components.conditional", "CARDINALITY");
    for (let d = start; d < end; d++) joint[577 * component.bank + d] = product(mass, number(component.conditional[d - start]!, "$.components.conditional"));
  }
  return joint;
};

export const rebandEconomic = (joint: Float64Array, meter: Meter): readonly Component[] => {
  charge(meter, 20 + 13 * 19 * 18 + JOINT_SIZE * 16, "$.components.rebandScan");
  const components = beginComponents247(meter);
  const encoded = new Map<number | "-0", Component["mass"]>();
  const hex = (value: number, path: string): Component["mass"] => {
    const key = Object.is(value, -0) ? "-0" : value, cached = encoded.get(key);
    if (cached) return cached;
    const result = encodeFloat64(value, meter, path); encoded.set(key, result); return result;
  };
  let total = 0;
  for (let bank = 0; bank <= 12; bank++) for (let band = 0; band < 19; band++) {
    const start = BAND_STARTS[band]!, end = band === 18 ? 577 : BAND_STARTS[band + 1]!;
    let mass = 0;
    for (let d = start; d < end; d++) {
      const value = joint[577 * bank + d]!;
      if (!Number.isFinite(value) || value < 0) fail("$.components.joint", "NUMERIC");
      mass = add(mass, value);
    }
    if (mass === 0) continue;
    charge(meter, 38 + 36 * (end - start), "$.components.rebandBand");
    const conditional = beginConditional(meter, end - start);
    let sum = 0;
    for (let d = start; d < end; d++) {
      const value = divide(joint[577 * bank + d]!, mass);
      appendConditional(meter, conditional, hex(value, "$.components.conditional")); sum = add(sum, value);
    }
    if (Math.abs(sum - 1) > 1e-12) fail("$.components.conditional", "NUMERIC");
    appendComponents247(meter, components, makeComponent(meter, bank, band, hex(mass, "$.components.mass"), finishConditional(meter, conditional)));
    total = add(total, mass);
  }
  if (Math.abs(total - 1) > 1e-12) fail("$.components.normalization", "NUMERIC");
  return finishComponents247(meter, components);
};
