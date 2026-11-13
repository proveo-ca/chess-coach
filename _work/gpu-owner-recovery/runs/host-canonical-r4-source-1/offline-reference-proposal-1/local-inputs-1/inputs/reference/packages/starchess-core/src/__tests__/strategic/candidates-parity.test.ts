/**
 * strategicCandidates / applyCandidate parity — the strategic orchestration
 * refactored into two pure exports (build ranked list, then commit one). The
 * composed `strategicAdjutant` must remain behavior-identical to committing
 * the top scoring legal candidate — the crux for the engine-feed rescue, which
 * re-ranks AFTER `strategicCandidates` but commits the same way.
 */
import { describe, expect, it } from "vitest";

import { endScTurn, parseScFen } from "../../index";
import {
  applyCandidate,
  strategicAdjutant,
  strategicCandidates,
} from "../../ai/strategic";

const SNAP = () =>
  parseScFen("SCFEN|4k3/8/8/8/8/8/8/4K3|5|33|P|G:11:11|Q:w:;b:");

describe("strategicCandidates + applyCandidate", () => {
  it("null outside the planning phase", () => {
    const snap = parseScFen("SCFEN|4k3/8/8/8/8/8/8/4K3|5|33|O|G:11:11|Q:w:;b:");
    expect(strategicCandidates(snap)).toBeNull();
  });

  it("returns a sorted, non-empty candidate list with a legal-commit path", () => {
    const snap = SNAP();
    const built = strategicCandidates(snap, { storedFor: () => 12 });
    expect(built).not.toBeNull();
    const { us, candidates } = built!;
    expect(candidates.length).toBeGreaterThan(0);
    for (let i = 1; i < candidates.length; i += 1) {
      expect(candidates[i - 1]!.score).toBeGreaterThanOrEqual(candidates[i]!.score);
    }

    // Committing the top candidate matches what strategicAdjutant picks.
    const viaAdjutant = strategicAdjutant(snap, { storedFor: () => 12 });
    const viaCommit = applyCandidate(snap, candidates[0]!, us);
    expect(viaCommit).not.toBeNull();
    expect(
      endScTurn(viaCommit!.snapshot, { skipTurnStartChecks: true }).next.placement,
    ).toBe(endScTurn(viaAdjutant.snapshot, { skipTurnStartChecks: true }).next.placement);
  });

  it("applyCandidate returns null for an illegal candidate instead of throwing", () => {
    const snap = SNAP();
    const built = strategicCandidates(snap, { storedFor: () => 12 })!;
    const single = built.candidates.find(
      (c) => c.actions.length === 1 && c.actions[0]!.kind === "classical",
    );
    expect(single).toBeDefined();
    const classical = single!.actions[0]!;
    // Two classical actions for the same side is a queue-shape violation: the
    // second addScAction throws SC_QUEUE_SHAPE mid-commit → null, not a crash.
    const doubleClassical = {
      ...single!,
      actions: [classical, { ...classical, from: classical.from, to: classical.from }],
    };
    expect(applyCandidate(snap, doubleClassical as never, built.us)).toBeNull();
  });
});
