import type { EconomicArtifact, EconomicBeliefState, EconomicReadout, History, Meter } from "./contracts";
import { JOINT_SIZE } from "./contracts";
import { charge, fail } from "./work";
import { decodeFloat64, encodeFloat64 } from "./float64";
import { expandComponents } from "./evaluator";
import { replacement } from "./innovation";

export type PublicCertainty = Readonly<{ material: number | null; potential: number | null }>;
export const publicCertainty = (support: readonly boolean[], meter: Meter): PublicCertainty => {
  charge(meter, 18 * JOINT_SIZE + 20, "$.readout.certaintyScan");
  if (support.length !== JOINT_SIZE) fail("$.readout.publicSupport", "CARDINALITY");
  let material: number | null = null, potential: number | null = null, first = true;
  for (let bank = 0; bank <= 12; bank++) for (let d = 0; d <= 576; d++) if (support[577 * bank + d]) {
    charge(meter, 20, "$.readout.certaintyState");
    if (first) { material = d; potential = d + bank; first = false; }
    else {
      if (material !== d) material = null;
      if (potential !== d + bank) potential = null;
    }
  }
  if (first) fail("$.readout.publicSupport", "CONSISTENCY");
  return { material, potential };
};

export const calibrateJoint = (source: Float64Array, support: readonly boolean[], temperature: number, meter: Meter): Float64Array => {
  charge(meter, JOINT_SIZE + 24 + 22 * JOINT_SIZE, "$.readout.logScan");
  if (source.length !== JOINT_SIZE || support.length !== JOINT_SIZE || !Number.isFinite(temperature) || temperature < .25 || temperature > 4) fail("$.readout.temperature", "NUMBER");
  const result = new Float64Array(JOINT_SIZE);
  let maximum = -Infinity, originalSum = 0;
  for (let i = 0; i < JOINT_SIZE; i++) {
    const p = source[i]!;
    if (!Number.isFinite(p) || p < 0 || (p > 0 && !support[i])) fail("$.readout.joint", "NUMERIC");
    originalSum += p;
    if (p === 0) result[i] = -Infinity;
    else {
      charge(meter, 16, "$.readout.logWeight");
      result[i] = Math.log(p) / temperature;
      if (result[i]! > maximum) maximum = result[i]!;
    }
  }
  if (!Number.isFinite(maximum) || Math.abs(originalSum - 1) > 1e-12) fail("$.readout.normalization", "NUMERIC");
  charge(meter, 10 * JOINT_SIZE + 10, "$.readout.exponentialScan");
  let total = 0;
  for (let i = 0; i < JOINT_SIZE; i++) {
    if (result[i] === -Infinity) { result[i] = 0; continue; }
    charge(meter, 20, "$.readout.exponential");
    const value = Math.exp(result[i]! - maximum);
    if (!Number.isFinite(value) || (source[i]! > 0 && value === 0)) fail("$.readout.underflow", "NUMERIC");
    result[i] = value; total += value;
  }
  charge(meter, 8 * JOINT_SIZE + 10, "$.readout.normalizeScan");
  let normalized = 0;
  for (let i = 0; i < JOINT_SIZE; i++) {
    if (result[i] === 0) continue;
    charge(meter, 24, "$.readout.normalize");
    const value = result[i]! / total;
    if (!Number.isFinite(value) || (result[i]! > 0 && value === 0)) fail("$.readout.underflow", "NUMERIC");
    result[i] = value; normalized += value;
  }
  if (Math.abs(normalized - 1) > 1e-12) fail("$.readout.normalization", "NUMERIC");
  return result;
};

export type NumericalReadout = Readonly<{
  meanD: number; meanPotential: number; quantilesD: readonly [number, number, number, number];
  quantilesPotential: readonly [number, number, number, number]; balance: number; uncertainty: number;
}>;
export const summarizeJoint = (joint: Float64Array, support: readonly boolean[], ownReplacement: number, meter: Meter): NumericalReadout => {
  const certainty = publicCertainty(support, meter);
  charge(meter, 577 + 589 + 20 * JOINT_SIZE + 20, "$.readout.marginalScan");
  const material = new Float64Array(577), potential = new Float64Array(589);
  let meanD = 0, meanPotential = 0, total = 0;
  for (let bank = 0; bank <= 12; bank++) for (let d = 0; d <= 576; d++) {
    const p = joint[577 * bank + d]!;
    if (!Number.isFinite(p) || p < 0 || (p > 0 && !support[577 * bank + d])) fail("$.readout.joint", "NUMERIC");
    if (p === 0) continue;
    charge(meter, 26, "$.readout.marginalState");
    material[d] += p; potential[d + bank] += p; meanD += d * p; meanPotential += (d + bank) * p; total += p;
  }
  if (Math.abs(total - 1) > 1e-12 || ownReplacement < 0 || ownReplacement > 576) fail("$.readout.summary", "NUMERIC");
  const quantiles = (marginal: Float64Array): readonly [number, number, number, number] => {
    charge(meter, 16 + 4 * marginal.length * 12, "$.readout.quantiles");
    const result: number[] = [];
    for (const threshold of [.05, .95, .025, .975]) {
      let cdf = 0, value = -1;
      for (let i = 0; i < marginal.length; i++) {
        cdf += marginal[i]!;
        if (cdf >= threshold) { value = i; break; }
      }
      if (value < 0) fail("$.readout.quantiles", "NUMERIC");
      result.push(value);
    }
    return [result[0]!, result[1]!, result[2]!, result[3]!];
  };
  const quantilesD = quantiles(material), quantilesPotential = quantiles(potential);
  charge(meter, 64, "$.readout.summaryOutput");
  if (certainty.material !== null) meanD = certainty.material;
  if (certainty.potential !== null) meanPotential = certainty.potential;
  const balance = ownReplacement - meanD, uncertainty = (quantilesD[3] - quantilesD[2]) / 2;
  if (!Number.isFinite(meanD) || !Number.isFinite(meanPotential) || !Number.isFinite(balance) || !Number.isFinite(uncertainty) ||
      meanD < 0 || meanD > 576 || meanPotential < 0 || meanPotential > 588 || balance < -576 || balance > 576 || uncertainty < 0 || uncertainty > 288) fail("$.readout.domain", "NUMERIC");
  return { meanD, meanPotential, quantilesD, quantilesPotential, balance, uncertainty };
};

export const readoutEconomicInternal = (history: History, state: EconomicBeliefState, artifact: EconomicArtifact, meter: Meter): EconomicReadout => {
  charge(meter, 30 + 12 * history.currentAuthorizedSnapshotV2.cells.length + 20 * artifact.partition.length, "$.readout.bin");
  const snapshot = history.currentAuthorizedSnapshotV2;
  if (snapshot.side !== state.side || snapshot.turn !== state.turn) fail("$.readout.history", "CONSISTENCY");
  let lit = 0, selected = -1;
  for (const cell of snapshot.cells) if (cell.visibility === "lit") lit++;
  for (let i = 0; i < artifact.partition.length; i++) {
    const [low, high, litLow, litHigh] = artifact.partition[i]!;
    if (state.turn >= low && state.turn <= high && lit >= litLow && lit <= litHigh) {
      if (selected !== -1) fail("$.readout.partition", "DUPLICATE");
      selected = i;
    }
  }
  if (selected < 0) fail("$.readout.partition", "CONSISTENCY");
  const temperature = decodeFloat64(artifact.temperatures[selected], meter, "$.readout.temperature");
  const recursive = expandComponents(state.components, meter), calibrated = calibrateJoint(recursive, state.publicSupport, temperature, meter);
  charge(meter, 12 + 18 * snapshot.own.pieces.length, "$.readout.ownReplacement");
  let ownReplacement = 0;
  for (const item of snapshot.own.pieces) ownReplacement += replacement(item.piece.type);
  const summary = summarizeJoint(calibrated, state.publicSupport, ownReplacement, meter);
  charge(meter, 24, "$.readout.output");
  return { version: "starchess-economic-readout-v1", boundaryRef: state.boundaryRef,
    meanD: encodeFloat64(summary.meanD, meter), meanPotential: encodeFloat64(summary.meanPotential, meter),
    quantilesD: summary.quantilesD, quantilesPotential: summary.quantilesPotential,
    balance: encodeFloat64(summary.balance, meter), uncertainty: encodeFloat64(summary.uncertainty, meter) };
};
