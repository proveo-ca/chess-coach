// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml
import { describe, expect, it } from "vitest";
import * as k from "../economic/ownedKernel";
import { advanceEconomicState, initializeEconomicState } from "../features";
import { armFixture, fixtureArtifact, fixtureBoundary, openingHistory } from "./economicA2.test";

const inputs = () => {
  const artifact = fixtureArtifact(), initial = fixtureBoundary(openingHistory());
  const open = fixtureBoundary(openingHistory(), 1, "turn-open", initial.seqThrough);
  const settled = fixtureBoundary(openingHistory(1), 2, "settled", open.seqThrough);
  return { artifact, initial, open, settled };
};

describe("economic work-cap boundaries", () => {
  it("completes the first isolated settled reduction without truncating support or renewing its ledger", () => {
    const { artifact, initial, open, settled } = inputs();
    const initialized = initializeEconomicState(artifact.opening, initial, artifact, armFixture("initialize"));
    const prior = advanceEconomicState(initialized, open, artifact, armFixture("advance"));
    const pair = k.createPlanningLedger(); pair.owner.admitOnce(); pair.owner.armAdvance();
    const state = advanceEconomicState(prior, settled, artifact, pair.meter);
    expect(k.requireState(state)).toBe(state);
    expect(state.ordinal).toBe(2); expect(state.publicSupport).toHaveLength(7501);
    expect(state.publicSupport.slice(577 * 4, 577 * 5).some(Boolean)).toBe(true);
    expect(state.publicSupport.slice(0, 577).some(Boolean)).toBe(false);
    expect(pair.meter.limit).toBe(1048576); expect(pair.meter.used).toBeLessThanOrEqual(1048576);
    pair.owner.close();
  });

  it("retains the pending-boundary shared-cap failure instead of introducing fresh meters", () => {
    const { artifact, initial, open, settled } = inputs(), pair = k.createPlanningLedger(); pair.owner.admitOnce();
    pair.owner.armInitialize();
    const initialized = initializeEconomicState(artifact.opening, initial, artifact, pair.meter), initializedUsage = pair.meter.used;
    pair.owner.armAdvance();
    const prior = advanceEconomicState(initialized, open, artifact, pair.meter), before = pair.meter.used;
    expect(before).toBeGreaterThan(initializedUsage);
    pair.owner.armAdvance();
    expect(() => advanceEconomicState(prior, settled, artifact, pair.meter)).toThrow("WORK_CAP");
    expect(prior.ordinal).toBe(1); expect(initialized.ordinal).toBe(0);
    expect(pair.meter.used).toBeGreaterThan(before); expect(pair.meter.used).toBeLessThanOrEqual(1048576);
    expect(() => pair.owner.armReadout()).toThrow("LIFECYCLE");
    expect(() => pair.owner.close()).toThrow("LIFECYCLE");
  });
});
