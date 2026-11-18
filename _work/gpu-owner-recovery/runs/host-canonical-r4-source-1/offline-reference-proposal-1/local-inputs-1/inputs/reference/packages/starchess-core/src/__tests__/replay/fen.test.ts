/**
 * scfenToFen — SCFEN→classical FEN projection + legality guard for the arena's
 * stockfish feed. Projection is lossy by design (classical movement hint only);
 * the guard exists so the feed never feeds stockfish an unparseable position.
 */
import { describe, expect, it } from "vitest";

import { parseScFen, scfenToFen } from "../../index";

const START = "SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|Q:w:;b:";

describe("scfenToFen", () => {
  it("projects the classic start to a playable FEN (fullmove ≥ 1)", () => {
    const proj = scfenToFen(parseScFen(START));
    expect(proj).toEqual({
      ok: true,
      fen: "4k3/2pppp2/8/8/8/8/2PPPP2/4K3 w - - 0 1",
    });
  });

  it("uses the current turn as fullmove", () => {
    const proj = scfenToFen(
      parseScFen("SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|5|33|P|G:11:11|Q:w:;b:"),
    );
    expect(proj.ok && proj.fen.endsWith("0 5")).toBe(true);
  });

  it("flags a spawn-promoted back-rank Marine (rank 8) as ineligible", () => {
    const proj = scfenToFen(
      parseScFen("SCFEN|4kP2/8/8/8/8/8/8/4K3|3|33|P|G:11:11|Q:w:;b:"),
    );
    expect(proj).toEqual({ ok: false, reason: "back-rank-marine" });
  });

  it("flags a back-rank Marine on rank 1 as ineligible", () => {
    const proj = scfenToFen(
      parseScFen("SCFEN|4k3/8/8/8/8/8/8/4Kp2|3|33|P|G:11:11|Q:w:;b:"),
    );
    expect(proj).toEqual({ ok: false, reason: "back-rank-marine" });
  });

  it("allows a Marine on a mid-rank", () => {
    const proj = scfenToFen(
      parseScFen("SCFEN|4k3/8/8/8/4P3/8/8/4K3|3|33|P|G:11:11|Q:w:;b:"),
    );
    expect(proj.ok).toBe(true);
  });

  it("rejects placements without the exact Command Center pair", () => {
    // parseScFen itself rejects kingless placements, so build the snapshot by
    // structurally swapping a valid placement (covers programmatic snapshots).
    const snap = parseScFen(START);
    const kingless = scfenToFen({ ...snap, placement: "8/8/8/8/8/8/8/4K3" });
    expect(kingless).toEqual({ ok: false, reason: "no-exact-cc-pair" });
  });

  it("drops SCFEN extras (stored / queue) from the projection", () => {
    const proj = scfenToFen(
      parseScFen("SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:C=e2e4"),
    );
    expect(proj).toEqual({
      ok: true,
      fen: "4k3/2pppp2/8/8/8/8/2PPPP2/4K3 w - - 0 1",
    });
  });
});