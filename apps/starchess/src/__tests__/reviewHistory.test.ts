import { describe, expect, it } from "vitest";

import { createMatchStore } from "~/app/MatchStoreContext";
import { buildReviewHistory, createMatchStateFromReviewHistory } from "~/app/reviewHistory";
import { COMBAT_CHAIN_PLY_SC, COMBAT_CHAIN_STEPS, queueCombatChainStep } from "~/demos/combatChain";
import { buildTypewriterBeats } from "~/tutorial/typewriterBeats";

describe("reviewHistory", () => {
  const history = buildReviewHistory({
    start: COMBAT_CHAIN_PLY_SC[0]!,
    steps: COMBAT_CHAIN_STEPS,
    startCaption: "Start",
    queueStep: (snap, i) => queueCombatChainStep(snap, COMBAT_CHAIN_STEPS[i]!),
  });

  it("records one resolve per step (plus optional check plies)", () => {
    expect(history.settledSnapshots.length).toBe(history.settledResolves.length + 1);
    expect(history.settledResolves.length).toBeGreaterThanOrEqual(COMBAT_CHAIN_STEPS.length);
  });

  it("seeds MatchStore in gameOver DualNav at index 0", () => {
    const state = createMatchStateFromReviewHistory(history);
    expect(state.phase).toBe("gameOver");
    expect(state.reviewIndex).toBe(0);
    expect(state.settledSnapshots).toHaveLength(history.settledSnapshots.length);
    expect(state.settledResolves).toHaveLength(history.settledResolves.length);
  });

  it("reviewForward is available on a store seeded from history", () => {
    const store = createMatchStore({
      initial: createMatchStateFromReviewHistory(history),
      autoArmTimer: false,
    });
    expect(store.state().reviewIndex).toBe(0);
    expect(store.state().settledResolves.length).toBeGreaterThan(0);
    store.reviewForward();
    store.cancelEffects();
    expect(store.state().phase).toBe("gameOver");
  });

  it("builds typewriter beats as Turn + Check + Intent + Resolve per combat turn", () => {
    const beats = buildTypewriterBeats(history.settledResolves);
    expect(beats.filter((b) => b.kind === "turn")).toHaveLength(
      COMBAT_CHAIN_STEPS.length,
    );
    expect(beats.map((b) => b.kind)).toEqual(
      COMBAT_CHAIN_STEPS.flatMap(() => [
        "turn",
        "check",
        "intent",
        "resolve",
      ]),
    );
  });
});
