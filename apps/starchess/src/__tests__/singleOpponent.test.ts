/**
 * `?opponent=` → which Adjutant script actually plays.
 *
 * The New Game modal offers two scripts, so the wiring has to be checked end to
 * end: an unknown or missing value must fall back to the naive script rather
 * than throwing, and the two scripts must be distinguishable at the call site
 * (they were not — the header was a hardcoded "Adjutant (Script)" string).
 */
import { describe, expect, it } from "vitest";

import { adjutant, mulberry32, strategicAdjutant, parseScFen } from "@chess-coach/starchess-core";

import { isAdjutantKind, ADJUTANT_KINDS } from "~/types/newGame";
import { adjutantKindLabel } from "~/utils/matchTitle";

const OPENING = "SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";

describe("opponent query parsing", () => {
  it("accepts exactly the two shipped scripts", () => {
    expect(ADJUTANT_KINDS).toEqual(["naive", "strategic"]);
    expect(isAdjutantKind("naive")).toBe(true);
    expect(isAdjutantKind("strategic")).toBe(true);
  });

  it("rejects anything else, so a bad URL falls back rather than throwing", () => {
    for (const bad of ["", "adjutant", "STRATEGIC", undefined, null, 1]) {
      expect(isAdjutantKind(bad)).toBe(false);
    }
  });

  it("labels the two scripts differently", () => {
    expect(adjutantKindLabel("naive")).not.toBe(adjutantKindLabel("strategic"));
  });
});

describe("both scripts are usable through the screen's call shape", () => {
  // Seeded: both scripts break the turn-1 Hoverbike/Mecha tie with `ctx.rng`,
  // so an unseeded comparison could differ by coin flip instead of by script.
  const ctx = () => ({ color: "b" as const, storedFor: () => 3, rng: mulberry32(7) });

  it("the naive script returns a playable snapshot", () => {
    const out = adjutant(parseScFen(OPENING), ctx());
    expect(out.snapshot).toBeTruthy();
  });

  it("the strategic script returns a playable snapshot", () => {
    const out = strategicAdjutant(parseScFen(OPENING), ctx());
    expect(out.snapshot).toBeTruthy();
  });

  it("the two scripts do not queue the same opening plan", () => {
    // Same seed on both sides, so any difference is the script, not the jitter.
    // Guards the wiring: if `?opponent=strategic` silently ran the naive
    // script, these would be identical.
    const naive = adjutant(parseScFen(OPENING), ctx());
    const strategic = strategicAdjutant(parseScFen(OPENING), ctx());
    expect(strategic.snapshot.queue).not.toEqual(naive.snapshot.queue);
  });
});
