import { describe, expect, it } from "vitest";
import type { Square } from "chess.js";
import type { StarChessPiece } from "@chess-coach/starchess-core";

import { deployCuesForBoardDiff } from "~/presentation/board/hooks/useAutoDeploy";
import type { PieceColor } from "@chess-coach/starchess-core";

type PieceAt = { type: StarChessPiece; color: PieceColor };

const at = (sq: Square, type: StarChessPiece, color: PieceColor = "w"): [Square, PieceAt] => [
  sq,
  { type, color },
];

describe("deployCuesForBoardDiff", () => {
  it("fires for Command Center Tank spawn (no matching leave)", () => {
    const prev = new Map<Square, PieceAt>([at("e1", "k")]);
    const next = new Map<Square, PieceAt>([at("e1", "k"), at("e2", "r")]);
    const cues = deployCuesForBoardDiff(prev, next);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ piece: "r", color: "w", at: "e2" });
  });

  it("skips quiet relocates", () => {
    const prev = new Map<Square, PieceAt>([at("e2", "r")]);
    const next = new Map<Square, PieceAt>([at("e4", "r")]);
    expect(deployCuesForBoardDiff(prev, next)).toEqual([]);
  });

  it("skips Command Centers", () => {
    const prev = new Map<Square, PieceAt>();
    const next = new Map<Square, PieceAt>([at("e1", "k")]);
    expect(deployCuesForBoardDiff(prev, next)).toEqual([]);
  });

  it("does not treat a same-turn capture as a lasting deploy candidate", () => {
    // Diff helper only sees one step; capture is prev has Marine → next empty.
    // Guarding cancel belongs to useAutoDeploy occupancy watch — here we only
    // assert appearance-then-absence does not invent a relocate deploy.
    const withMarine = new Map<Square, PieceAt>([at("e1", "k"), at("e2", "p")]);
    const empty = new Map<Square, PieceAt>([at("e1", "k")]);
    expect(deployCuesForBoardDiff(withMarine, empty)).toEqual([]);
  });
});
