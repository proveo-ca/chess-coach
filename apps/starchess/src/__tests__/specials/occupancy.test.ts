import { describe, expect, it } from "vitest";
import {
  parseScFen,
  placementToMap,
  scMovesFrom,
} from "@chess-coach/starchess-core";

import {
  occupancyForQueuedMoves,
  pieceAtQueuedSquare,
} from "~/presentation/specials/planning/occupancy";

describe("occupancyForQueuedMoves", () => {
  it("selects about-to-deploy pawn and offers forward dests", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:01:11|B:3:3|Q:w:B=spawn:e1:d1:p;b:",
    );
    const raw = placementToMap(snap.placement);
    const { map, siegedRooks } = occupancyForQueuedMoves(raw, "w", false, snap);
    const piece = pieceAtQueuedSquare(raw, "d1", "w", snap.queue?.actions);
    expect(piece).toEqual({ type: "p", color: "w" });
    const dests = scMovesFrom(map, "d1", "w", { siegedRooks }).map((m) => m.to);
    expect(dests).toContain("d2");
  });

  it("gas pawn step then select new square for further dests", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/8/8/4P3/4K3|1|33|P|G:01:11|B:3:3|Q:w:B=pawnDouble:e2:e3;b:",
    );
    const raw = placementToMap(snap.placement);
    const { map, siegedRooks } = occupancyForQueuedMoves(raw, "w", false, snap);
    expect(pieceAtQueuedSquare(raw, "e3", "w", snap.queue?.actions)?.type).toBe(
      "p",
    );
    expect(map.has("e2")).toBe(false);
    const dests = scMovesFrom(map, "e3", "w", { siegedRooks }).map((m) => m.to);
    expect(dests).toContain("e4");
  });

  it("B Charon kill clears the victim for classical planning", () => {
    const snap = parseScFen(
      "SCFEN|k6q/8/8/8/3B4/8/8/4K3|11|33|P|G:02:22|Q:w:B=bishopSnipe:d4:h8;b:",
    );
    const raw = placementToMap(snap.placement);
    expect(raw.has("h8")).toBe(true);
    const { map } = occupancyForQueuedMoves(raw, "w", false, snap);
    expect(map.has("h8")).toBe(false);
    // The firing Mecha stays put in the projection.
    expect(map.get("d4")).toEqual({ type: "b", color: "w" });
  });

  it("unsiege unlocks quiet rook moves", () => {
    const snap = parseScFen(
      "SCFEN|4k3/8/8/8/2R5/8/8/4K3|1|33|P|G:01:11|S:c4|B:3:3|Q:w:B=rookSiege:c4;b:",
    );
    const raw = placementToMap(snap.placement);
    const { map, siegedRooks } = occupancyForQueuedMoves(
      raw,
      "w",
      false,
      snap,
      new Set(["c4" as const]),
    );
    expect(siegedRooks.includes("c4")).toBe(false);
    const dests = scMovesFrom(map, "c4", "w", { siegedRooks }).map((m) => m.to);
    expect(dests.length).toBeGreaterThan(0);
    expect(dests).toContain("c5");
  });
});
