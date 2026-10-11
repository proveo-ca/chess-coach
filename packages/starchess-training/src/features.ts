// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import type { Candidate, CheckedBoundary, EconomicArtifact, EconomicBeliefState, EconomicReadout, FeatureBlocksV3, History, Meter, PublicOpening } from "./economic/contracts";
import { requireArtifact, requireBoundary, requireCandidate, requireFeatureBlocks, requireHistory, requireOpening, requireReadout, requireState } from "./economic/ownedGuards";
import { boundaryRef, enterA2, failCurrentEntry, finishA2, makeAdvanceReductionInput, makeInitialReductionInput } from "./economic/ownedKernel";
import { initializeEconomicBelief, reduceEconomicBelief } from "./economic/belief";
import { readoutEconomicInternal, requireHistoryState } from "./economic/readout";
import { encodeFeatureBlocksV3 } from "./feature/encoder";
import { flattenFeatureBlocksV3 } from "./feature/manifest";
import { charge, fail } from "./economic/work";

export type { Candidate, CheckedBoundary, EconomicArtifact, EconomicBeliefState, EconomicReadout, FeatureBlocksV3, FeatureManifestV3, History, Meter, PublicOpening } from "./economic/contracts";

export const initializeEconomicState = (opening: PublicOpening, boundary: CheckedBoundary, artifact: EconomicArtifact, meter: Meter): EconomicBeliefState => {
  const ticket = enterA2(meter, "initialize");
  try {
    requireOpening(opening); requireBoundary(boundary); requireArtifact(artifact);
    charge(meter, 32, "$.initialize.opening");
    if (artifact.opening.version !== opening.version) fail("$.initialize.opening", "CONSISTENCY");
    const result = initializeEconomicBelief(opening, makeInitialReductionInput(meter, boundary), artifact, meter, boundary);
    requireState(result); finishA2(ticket); return result;
  } catch (error) { return failCurrentEntry(ticket, error); }
};

export const advanceEconomicState = (prev: EconomicBeliefState, boundary: CheckedBoundary, artifact: EconomicArtifact, meter: Meter): EconomicBeliefState => {
  const ticket = enterA2(meter, "advance");
  try {
    requireState(prev); requireBoundary(boundary); requireArtifact(artifact);
    charge(meter, 32, "$.advance.replay");
    const ref = boundaryRef(boundary);
    if (boundary.ordinal === prev.ordinal) {
      if (ref.byteLength !== prev.boundaryRef.byteLength || ref.sha256 !== prev.boundaryRef.sha256) fail("$.advance.replay", "DUPLICATE");
      finishA2(ticket); return prev;
    }
    const result = reduceEconomicBelief(prev, makeAdvanceReductionInput(meter, prev, boundary), artifact, meter, boundary);
    requireState(result); finishA2(ticket); return result;
  } catch (error) { return failCurrentEntry(ticket, error); }
};

export const readoutEconomic = (history: History, state: EconomicBeliefState, artifact: EconomicArtifact, meter: Meter): EconomicReadout => {
  const ticket = enterA2(meter, "readout");
  try {
    requireHistory(history); requireState(state); requireArtifact(artifact);
    requireHistoryState(history, state, meter);
    const result = readoutEconomicInternal(history, state, artifact, meter);
    requireReadout(result); finishA2(ticket); return result;
  } catch (error) { return failCurrentEntry(ticket, error); }
};

export const encodeFeaturesV3 = (history: History, state: EconomicBeliefState, candidate: Candidate, artifact: EconomicArtifact, meter: Meter): FeatureBlocksV3 => {
  const ticket = enterA2(meter, "encode");
  try {
    requireHistory(history); requireState(state); requireCandidate(candidate); requireArtifact(artifact);
    requireHistoryState(history, state, meter);
    const result = encodeFeatureBlocksV3(history, state, candidate, artifact, meter);
    requireFeatureBlocks(result); finishA2(ticket); return result;
  } catch (error) { return failCurrentEntry(ticket, error); }
};

export const flattenFeaturesV3 = (blocks: FeatureBlocksV3, meter: Meter): Float64Array => {
  const ticket = enterA2(meter, "flatten");
  try {
    requireFeatureBlocks(blocks);
    const result = flattenFeatureBlocksV3(blocks, meter);
    finishA2(ticket); return result;
  } catch (error) { return failCurrentEntry(ticket, error); }
};
