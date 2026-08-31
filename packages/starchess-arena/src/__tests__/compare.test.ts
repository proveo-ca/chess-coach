/**
 * Scoreboard math — pure aggregation over records (win/loss/draw counts,
 * turns-to-close, terminal material margin).
 */
import { describe, expect, it } from "vitest";

import type { ArenaGameRecord } from "@chess-coach/starchess-core";

import { summarize } from "../compare/compare";
import { STAR_STARTING_SCFEN } from "../seeds";

const record = (
  id: string,
  players: { w: string; b: string },
  outcome: ArenaGameRecord["outcome"],
  turns: number,
  status: ArenaGameRecord["meta"] extends { status?: infer S } ? S : "finished",
): ArenaGameRecord => ({
  id,
  startedAt: "2026-08-29T00:00:00.000Z",
  endedAt: "2026-08-29T00:00:30.000Z",
  players,
  mapSeed: STAR_STARTING_SCFEN,
  outcome,
  turns,
  scfens: [STAR_STARTING_SCFEN],
  resolves: [],
  meta: { engine: null, status },
});

describe("summarize", () => {
  it("counts wins/losses/draws per script and per status", () => {
    const board = summarize([
      record("a", { w: "naive", b: "strategic" }, { winner: "w", draw: false }, 40, "finished"),
      record("b", { w: "naive", b: "strategic" }, { winner: "b", draw: false }, 55, "finished"),
      record("c", { w: "naive", b: "strategic" }, { winner: null, draw: true }, 200, "stall"),
    ]);

    expect(board.total).toBe(3);
    expect(board.byStatus).toEqual({ finished: 2, aborted: 0, stall: 1 });

    const naive = board.rows.find((r) => r.script === "naive")!;
    const strategic = board.rows.find((r) => r.script === "strategic")!;
    expect(naive).toMatchObject({ wins: 1, losses: 1, draws: 1 });
    expect(strategic).toMatchObject({ wins: 1, losses: 1, draws: 1 });
    // meanTurns = (40 + 55 + 200) / 3 for each script.
    expect(naive.meanTurns).toBeCloseTo((40 + 55 + 200) / 3);
  });

  it("an aborted run counts as a draw for both sides (no win)", () => {
    const board = summarize([
      record("a", { w: "naive", b: "strategic" }, { winner: null, draw: false }, 12, "aborted"),
    ]);
    const naive = board.rows.find((r) => r.script === "naive")!;
    expect(naive).toMatchObject({ wins: 0, losses: 0, draws: 1 });
    expect(board.byStatus.aborted).toBe(1);
  });

  it("terminal material margin uses the recorded board, not captures again", () => {
    const w = record("a", { w: "naive", b: "strategic" }, { winner: "w", draw: false }, 3, "finished");
    w.scfens = [
      w.scfens[0]!,
      "SCFEN|4k3/2p1pp2/8/8/8/8/2PPPP2/4K3|1|33|P|G:11:11|Q:w:;b:",
    ];
    const board = summarize([w]);
    // Terminal board: white has 4 pawns + king; black has 3 pawns + king.
    // deployedMaterialFromPlacement counts non-king units, so with UNIT_COST
    // pawn = 1 this is 4 − 3 = a 1-point white margin.
    const naive = board.rows.find((r) => r.script === "naive")!;
    expect(naive.meanMaterialMargin).toBeCloseTo(1);
  });
});