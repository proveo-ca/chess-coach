import { describe, expect, it } from "vitest";

import { addScMove, endScTurn, parseScFen } from "../../index";

describe("fogged target that vacates same turn", () => {
  it("Rh1→h8 (fog) lands while the h8 occupant escapes to h7", () => {
    let s = parseScFen("SCFEN|k6r/8/8/8/8/8/8/4K2R|1|33|P|G:11:11|Q:w:;b:");
    s = addScMove(s, { color: "w", from: "h1", to: "h8" });
    s = addScMove(s, { color: "b", from: "h8", to: "h7" });
    const r = endScTurn(s, { skipTurnStartChecks: true });
    expect(r.next.placement).toBe("k6R/7r/8/8/8/8/8/4K3");
    expect(r.resolved.moves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "h1", to: "h8", piece: "r" }),
        expect.objectContaining({ from: "h8", to: "h7", piece: "r" }),
      ]),
    );
    expect(r.resolved.attacks).toEqual([]);
    expect(r.resolved.moveCollisions).toEqual([]);
    expect(r.resolved.pathRevealAttacks).toEqual([]);
  });

  it("no-plan occupant: the approach fires and captures (contrast with vacate)", () => {
    let s = parseScFen("SCFEN|k6r/8/8/8/8/8/8/4K2R|1|33|P|G:11:11|Q:w:;b:");
    s = addScMove(s, { color: "w", from: "h1", to: "h8" });
    const r = endScTurn(s, { skipTurnStartChecks: true });
    expect(r.next.placement).toBe("k6R/8/8/8/8/8/8/4K3");
    expect(r.resolved.pathRevealAttacks).toEqual([
      expect.objectContaining({
        kind: "capture",
        to: "h8",
        victim: { piece: "r", color: "b" },
      }),
    ]);
    expect(r.resolved.moveCollisions).toEqual([]);
  });

  it("approach fork: mid-walk reveal fizzles on the vacated square and the Tank still lands", () => {
    let s = parseScFen("SCFEN|k6r/8/8/8/8/8/7R/4K3|1|33|P|G:11:11|Q:w:;b:");
    s = addScMove(s, { color: "w", from: "h2", to: "h8" });
    s = addScMove(s, { color: "b", from: "h8", to: "h7" });
    const r = endScTurn(s, { skipTurnStartChecks: true });
    expect(r.next.placement).toBe("k6R/7r/8/8/8/8/8/4K3");
    expect(r.resolved.pathRevealAttacks).toEqual([]);
    expect(r.resolved.moves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "h2", to: "h8", piece: "r" }),
      ]),
    );
    expect(r.resolved.moveCollisions).toEqual([]);
  });

  it("leaper vacates too: fogged marine target escapes and the attacker lands", () => {
    let s = parseScFen("SCFEN|k7/7p/8/8/8/8/8/K6R|1|33|P|G:11:11|Q:w:;b:");
    s = addScMove(s, { color: "w", from: "h1", to: "h7" });
    s = addScMove(s, { color: "b", from: "h7", to: "h6" });
    const r = endScTurn(s, { skipTurnStartChecks: true });
    expect(r.next.placement).toBe("k7/7R/7p/8/8/8/8/K7");
    expect(r.resolved.moveCollisions).toEqual([]);
  });

  it("victim-stays fallback: dropped escape turns the delayed plan into a single fogged collision", () => {
    let s = parseScFen("SCFEN|6kr/8/8/8/8/8/8/4K2R|1|33|P|G:11:11|Q:w:;b:");
    s = addScMove(s, { color: "w", from: "h1", to: "h8" });
    s = {
      ...s,
      queue: {
        actions: [
          ...(s.queue?.actions ?? []),
          {
            timing: "C",
            kind: "classical",
            color: "b",
            from: "h8",
            to: "g8",
            seq: 1,
          },
        ],
      },
    };
    const r = endScTurn(s, { skipTurnStartChecks: true });
    expect(r.next.placement).toBe("6kR/8/8/8/8/8/8/4K3");
    expect(r.resolved.pathRevealAttacks).toEqual([
      expect.objectContaining({
        kind: "capture",
        to: "h8",
        victim: { piece: "r", color: "b" },
      }),
    ]);
    expect(r.resolved.attacks).toEqual([]);
    expect(r.resolved.moveCollisions).toEqual([]);
  });

  it("mutual same-line fogged pair resolves deterministically (no phantom double kill)", () => {
    let s = parseScFen("SCFEN|k6r/8/8/8/8/8/8/4K2R|1|33|P|G:11:11|Q:w:;b:");
    s = addScMove(s, { color: "w", from: "h1", to: "h8" });
    s = addScMove(s, { color: "b", from: "h8", to: "h1" });
    const r = endScTurn(s, { skipTurnStartChecks: true });
    const commandCenters = r.next.placement;
    expect(commandCenters).toContain("K");
    expect(commandCenters).toContain("k");
    const h8White = r.resolved.afterAll.placement.startsWith("k6R");
    const h1Black = r.resolved.afterAll.placement.endsWith("4K2r");
    expect(h8White !== h1Black).toBe(true);
  });
});
