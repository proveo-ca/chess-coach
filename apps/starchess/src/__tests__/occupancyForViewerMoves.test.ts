import { describe, expect, it } from "vitest";
import { placementToMap, scMovesFrom } from "@chess-coach/starchess-core";

import { occupancyForViewerMoves } from "~/presentation/board/occupancyForViewerMoves";
import { FOG_EDGE_MECHA_START_SCFEN } from "~/demos/fogEdgeMecha";

describe("occupancyForViewerMoves", () => {
  it("lets Bd4 intent through fogged g7 so h8 is a legal dest", () => {
    const placement = FOG_EDGE_MECHA_START_SCFEN.split("|")[1]!;
    const full = placementToMap(placement);
    expect(full.get("g7")?.type).toBe("p");
    expect(full.get("h8")?.type).toBe("k");

    const classical = scMovesFrom(full, "d4", "w").map((m) => m.to);
    expect(classical).toContain("g7");
    expect(classical).not.toContain("h8");

    const fogged = occupancyForViewerMoves(full, "w", true);
    expect(fogged.has("g7")).toBe(false);
    expect(fogged.has("h8")).toBe(false);
    expect(fogged.has("d4")).toBe(true);

    const intent = scMovesFrom(fogged, "d4", "w").map((m) => m.to);
    expect(intent).toContain("h8");
    expect(intent).toContain("e5");
  });

  it("keeps visible blockers when fog is off", () => {
    const placement = FOG_EDGE_MECHA_START_SCFEN.split("|")[1]!;
    const full = placementToMap(placement);
    const same = occupancyForViewerMoves(full, "w", false);
    expect(same.get("g7")?.type).toBe("p");
    expect(scMovesFrom(same, "d4", "w").map((m) => m.to)).not.toContain("h8");
  });
});
