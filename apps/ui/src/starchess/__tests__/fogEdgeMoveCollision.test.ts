import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";

import {
  FOG_EDGE_BISHOP_PLY_SC,
  FOG_EDGE_BISHOP_START_SCFEN,
  FOG_EDGE_BISHOP_STEPS,
  queueFogEdgeStep,
} from "~/starchess/demos/fogEdgeBishop";
import {
  FOG_EDGE_ROOK_TANK_PLY_SC,
  FOG_EDGE_ROOK_TANK_START_SCFEN,
  FOG_EDGE_ROOK_TANK_STEPS,
  queueFogEdgeRookTankStep,
} from "~/starchess/demos/fogEdgeRookTank";
import { endScTurn } from "~/starchess/endScTurn";
import { parseScFen } from "~/starchess/scfen";
import { getSideVision, pathRevealSteps } from "~/starchess/vision";

describe("fog-edge path resolve (SCFEN intent past / onto fog)", () => {
  it("bishop: C=d4h8 legal with hidden king on h8; resolve Bxg7", () => {
    const before = parseScFen(FOG_EDGE_BISHOP_START_SCFEN);
    const game = new Chess(`${before.placement} w - - 0 1`);
    const { litSquares, revealedPieces } = getSideVision(game, "w");
    expect(litSquares.has("g7")).toBe(false);
    expect(litSquares.has("h8")).toBe(false);
    expect(revealedPieces.has("g7")).toBe(false);
    expect(game.get("h8")?.type).toBe("k");
    expect(pathRevealSteps(before.placement, "d4", "h8", "w", "g7")).toBe(1);

    const queued = queueFogEdgeStep(before, FOG_EDGE_BISHOP_STEPS[0]!);
    expect(queued.queue?.actions[0]).toMatchObject({
      timing: "C",
      from: "d4",
      to: "h8",
    });
    const { resolved, next } = endScTurn(queued);

    expect(resolved.attacks).toEqual([]);
    expect(resolved.pathRevealAttacks[0]).toMatchObject({
      kind: "capture",
      from: "e5",
      to: "g7",
      pathRevealFrom: "d4",
      pathRevealSteps: 1,
      victim: { piece: "p", color: "b" },
      occupies: true,
    });
    expect(resolved.moveCollisions).toEqual([]);
    expect(resolved.moves).toEqual([]);
    expect(resolved.afterMove.placement).toBe("7k/6p1/8/8/3B4/8/8/K7");
    expect(resolved.afterAll.placement).toBe("7k/6B1/8/8/8/8/8/K7");
    expect(next.kingLives.b).toBe(3);
    expect(next.placement).toBe("7k/6B1/8/8/8/8/8/K7");
    expect(FOG_EDGE_BISHOP_PLY_SC[1]?.placement).toBe(next.placement);
  });

  it("rook tank: C=d4d8 intent; resolve Rxd7", () => {
    const before = parseScFen(FOG_EDGE_ROOK_TANK_START_SCFEN);
    const game = new Chess(`${before.placement} w - - 0 1`);
    const { litSquares } = getSideVision(game, "w", {
      rookModeFor: () => "tank",
    });
    expect(litSquares.has("d7")).toBe(false);
    expect(
      pathRevealSteps(before.placement, "d4", "d8", "w", "d7", {
        rookModeFor: () => "tank",
      }),
    ).toBe(1);

    const queued = queueFogEdgeRookTankStep(before, FOG_EDGE_ROOK_TANK_STEPS[0]!);
    expect(queued.queue?.actions[0]).toMatchObject({ from: "d4", to: "d8" });
    const { resolved, next } = endScTurn(queued);

    expect(resolved.attacks).toEqual([]);
    expect(resolved.pathRevealAttacks[0]).toMatchObject({
      kind: "capture",
      from: "d5",
      to: "d7",
      pathRevealFrom: "d4",
      pathRevealSteps: 1,
      victim: { piece: "p", color: "b" },
      occupies: true,
    });
    expect(resolved.moveCollisions).toEqual([]);
    expect(resolved.moves).toEqual([]);
    expect(resolved.afterMove.placement).toBe("7k/3p4/8/8/3R4/8/8/K7");
    expect(resolved.afterAll.placement).toBe("7k/3R4/8/8/8/8/8/K7");
    expect(next.placement).toBe("7k/3R4/8/8/8/8/8/K7");
    expect(FOG_EDGE_ROOK_TANK_PLY_SC[1]?.placement).toBe(next.placement);
  });

  it("visible enemy still attacks (not move collision)", () => {
    const snap = parseScFen(
      "SCFEN|7k/8/5p2/8/3B4/8/8/K7|0|33|P|G:11:11|Q:w:;b:",
    );
    const queued = queueFogEdgeStep(snap, {
      caption: "visible",
      actions: [
        { timing: "C", kind: "classical", color: "w", from: "d4", to: "f6" },
      ],
    });
    const { resolved } = endScTurn(queued);
    expect(resolved.attacks[0]).toMatchObject({
      kind: "capture",
      from: "d4",
      to: "f6",
      occupies: true,
    });
    expect(resolved.attacks[0]).not.toHaveProperty("pathRevealFrom");
    expect(resolved.moveCollisions).toEqual([]);
  });
});
