/**
 * CC focus — which square each Adjutant build actually aims at.
 *
 * The decided contract: the **strategic** build is fog-honest (it scores the
 * running `intel.focus` guess while the real Command Center is unseen), and the
 * **naive** build keeps its omniscience (`enemyKing`, straight off the map).
 *
 * This is pinned because it was silently broken: `isGuess` was derived from
 * `enemyKing == null`, but `enemyKing` comes from `findKing(map, enemy)` with no
 * fog filter, so it is non-null in every live position. `isGuess` was therefore
 * always false and every `*_GUESS` weight was unreachable dead code.
 * // SPEC: _spec/apps/starchess/core/adjutant/cc-focus.puml
 */
import { describe, expect, it } from "vitest";

import { parseScFen } from "../../index";
import { buildStrategicCtx } from "../../ai/strategic";
import { buildAdjutantCtx } from "../../ai/context";

/** Opening board — both Command Centers home behind their marines, so e8/e1 are fogged. */
const OPENING = "SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";

describe("enemyKing is omniscient, not a fog-filtered field", () => {
  it("is populated even when the enemy Command Center is not visible", () => {
    const ctx = buildAdjutantCtx(parseScFen(OPENING), { storedFor: () => 3 });
    expect(ctx).not.toBeNull();
    // The real square is known straight from the map, whichever side moves...
    expect(ctx!.enemyKing).toBe(ctx!.enemy === "w" ? "e1" : "e8");
    // ...while vision says we cannot actually see it. Conflating the two is the
    // original bug: "am I guessing?" derived from `enemyKing == null` is never true.
    expect(ctx!.vision.enemyKingVisible).toBe(false);
  });
});

describe("the strategic build is fog-honest", () => {
  it("has a guess to score while the Command Center is unseen", () => {
    const ctx = buildStrategicCtx(parseScFen(OPENING), { storedFor: () => 3 });
    expect(ctx).not.toBeNull();
    expect(ctx!.vision.enemyKingVisible).toBe(false);
    // `intel.focus` is always defined (seeded at the opposite home), which is
    // exactly why a fallback chain ending in `enemyKing`/`null` was dead code.
    expect(ctx!.intel.focus).toBeTruthy();
  });
});

describe("the naive build carries no strategic-only fields", () => {
  it("leaves winning and ccIntel absent", () => {
    const ctx = buildAdjutantCtx(parseScFen(OPENING), { storedFor: () => 3 });
    expect(ctx).not.toBeNull();
    // `winning` is the strategic material ledger. Under naive it is absent, so
    // the sacrifice-for-CC bucket falls to its not-ahead weight with no
    // cross-layer type narrowing anywhere.
    expect(ctx!.winning).toBeUndefined();
    expect("ccIntel" in ctx!).toBe(false);
  });

  it("while the strategic build does populate winning", () => {
    const ctx = buildStrategicCtx(parseScFen(OPENING), { storedFor: () => 3 });
    expect(typeof ctx!.winning).toBe("boolean");
  });
});
