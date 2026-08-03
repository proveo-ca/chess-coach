import { Chess, type Square } from "chess.js";
import { describe, expect, it } from "vitest";

import {
  getNerdVision,
  getNerdVisibleSquares,
  getSideVision,
  getVisionDisplayCells,
  getVisionFogHolePaths,
  isMoverVisibleToSide,
  isPieceVisibleToSide,
} from "~/broodwar/vision";

const sorted = (squares: ReadonlySet<Square>) => [...squares].sort();

describe("getNerdVisibleSquares", () => {
  it("shows the king's centered 3x3 area", () => {
    const game = new Chess("7k/8/8/8/3K4/8/8/8 w - - 0 1");

    expect(sorted(getNerdVisibleSquares(game, "d4"))).toEqual(
      ["c3", "c4", "c5", "d3", "d4", "d5", "e3", "e4", "e5"].sort(),
    );
  });

  it("clips vision at the edge of the board", () => {
    const game = new Chess("7k/8/8/8/8/8/8/K7 w - - 0 1");

    expect(sorted(getNerdVisibleSquares(game, "a1"))).toEqual(["a1", "a2", "b1", "b2"]);
  });

  it("shows a white pawn's tile, three front squares, and the middle square one row further", () => {
    const game = new Chess("7k/8/8/8/3P4/8/8/K7 w - - 0 1");

    expect(sorted(getNerdVisibleSquares(game, "d4"))).toEqual(
      ["d4", "c5", "d5", "e5", "d6"].sort(),
    );
  });

  it("orients black pawn vision toward decreasing ranks", () => {
    const game = new Chess("7k/8/8/3p4/8/8/8/K7 b - - 0 1");

    expect(sorted(getNerdVisibleSquares(game, "d5"))).toEqual(
      ["d5", "c4", "d4", "e4", "d3"].sort(),
    );
  });

  it("shows a knight's 5x5 area without corners or border middles", () => {
    const game = new Chess("7k/8/8/8/3N4/8/8/K7 w - - 0 1");

    expect(sorted(getNerdVisibleSquares(game, "d4"))).toEqual(
      [
        "c3",
        "d3",
        "e3",
        "c4",
        "d4",
        "e4",
        "c5",
        "d5",
        "e5",
        "b3",
        "b5",
        "c2",
        "c6",
        "e2",
        "e6",
        "f3",
        "f5",
      ].sort(),
    );
  });

  it("shows a bishop's 5x5 area; remote queens stay fogged but are revealed as pieces", () => {
    const game = new Chess("7k/1q6/8/8/3B4/8/6Q1/K7 w - - 0 1");
    const { litSquares, revealedPieces } = getNerdVision(game, "d4");

    expect(litSquares).toHaveProperty("size", 25);
    expect(litSquares.has("b2")).toBe(true);
    expect(litSquares.has("f6")).toBe(true);
    expect(litSquares.has("b7")).toBe(false);
    expect(litSquares.has("g2")).toBe(false);
    expect(litSquares.has("h8")).toBe(false);
    expect(sorted(revealedPieces)).toEqual(["b7", "g2"]);
  });

  it("does not double-count a queen already inside the bishop's 5x5", () => {
    const game = new Chess("7k/8/8/8/3B4/8/1q6/K7 w - - 0 1");
    const { litSquares, revealedPieces } = getNerdVision(game, "d4");

    expect(litSquares.has("b2")).toBe(true);
    expect(revealedPieces.has("b2")).toBe(false);
  });

  it("shows a tank-mode rook's 5x5 area (same as bishop)", () => {
    const game = new Chess("7k/8/8/8/3R4/8/8/K7 w - - 0 1");
    const visible = getNerdVisibleSquares(game, "d4", { rookModeFor: () => "tank" });

    expect(visible).toHaveProperty("size", 25);
    expect(visible.has("b2")).toBe(true);
    expect(visible.has("f6")).toBe(true);
    expect(visible.has("a1")).toBe(false);
    expect(visible.has("g7")).toBe(false);
  });

  it("defaults rook vision to tank-mode 5x5", () => {
    const game = new Chess("7k/8/8/8/3R4/8/8/K7 w - - 0 1");
    expect(getNerdVisibleSquares(game, "d4")).toHaveProperty("size", 25);
  });

  it("shows a siege-mode rook's centered 9x9 area", () => {
    const game = new Chess("7k/8/8/8/3R4/8/8/K7 w - - 0 1");
    const visible = getNerdVisibleSquares(game, "d4", { rookModeFor: () => "siege" });

    expect(visible).toHaveProperty("size", 64); // 9×9 clipped to the whole board from d4
    expect(visible.has("a1")).toBe(true);
    expect(visible.has("h8")).toBe(true);
  });

  it("shows a queen's centered 7x7 area", () => {
    const game = new Chess("7k/8/8/8/3Q4/8/8/K7 w - - 0 1");
    const visible = getNerdVisibleSquares(game, "d4");

    expect(visible).toHaveProperty("size", 49);
    expect(visible.has("a1")).toBe(true);
    expect(visible.has("g7")).toBe(true);
    expect(visible.has("h4")).toBe(false);
    expect(visible.has("d8")).toBe(false);
  });

  it("clips queen vision at the board edge", () => {
    const queen = new Chess("7k/8/8/8/8/8/8/Q6K w - - 0 1");
    expect(getNerdVisibleSquares(queen, "a1")).toHaveProperty("size", 16); // files a–d, ranks 1–4
  });

  it("clips siege rook vision at the board edge", () => {
    const rook = new Chess("7k/8/8/8/8/8/8/R6K w - - 0 1");
    expect(getNerdVisibleSquares(rook, "a1", { rookModeFor: () => "siege" })).toHaveProperty(
      "size",
      25,
    ); // files a–e, ranks 1–5 (9×9 clipped)
  });

  it("returns no visible squares without a selected piece", () => {
    const game = new Chess();

    expect(getNerdVisibleSquares(game, null)).toHaveProperty("size", 0);
  });
});

describe("getSideVision", () => {
  it("matches single-unit vision when only one friendly piece is present", () => {
    const game = new Chess("7k/8/8/8/3K4/8/8/8 w - - 0 1");
    const side = getSideVision(game, "w");
    const unit = getNerdVision(game, "d4");

    expect(sorted(side.litSquares)).toEqual(sorted(unit.litSquares));
    expect(side.litSquares).toHaveProperty("size", 9);
  });

  it("unions vision from every friendly unit", () => {
    const game = new Chess("7k/8/8/8/3K1P2/8/8/8 w - - 0 1");
    const side = getSideVision(game, "w");
    const king = getNerdVisibleSquares(game, "d4");
    const pawn = getNerdVisibleSquares(game, "f4");

    expect(side.litSquares.size).toBeGreaterThan(king.size);
    expect(side.litSquares.size).toBeGreaterThan(pawn.size);
    for (const square of king) expect(side.litSquares.has(square)).toBe(true);
    for (const square of pawn) expect(side.litSquares.has(square)).toBe(true);
    expect(side.litSquares).toHaveProperty("size", 13);
  });

  it("ignores enemy pieces when computing a side's lit vision", () => {
    const game = new Chess("4n2k/8/8/8/3K4/8/8/8 w - - 0 1");
    const white = getSideVision(game, "w");
    const black = getSideVision(game, "b");

    expect(white.litSquares).toHaveProperty("size", 9);
    expect(black.litSquares.size).toBeGreaterThan(9); // king + knight
    expect(white.litSquares.has("e8")).toBe(false);
  });

  it("does not permanently reveal king-attackers (fog punishment until they shoot)", () => {
    // Nc5 checks Ke4 but stays hidden in vision — ChessBoard reveals on attackCues.
    const game = new Chess("k7/5r2/8/2n5/4K3/8/7b/8 w - - 0 1");
    const white = getSideVision(game, "w");
    expect(white.revealedPieces.has("c5")).toBe(false);
    expect(white.litSquares.has("c5")).toBe(false);
  });
});

describe("isPieceVisibleToSide", () => {
  it("always shows own pieces; hides fogged enemies", () => {
    const g = new Chess("k7/5r2/8/2n5/4K3/8/7b/8 w - - 0 1");
    expect(isPieceVisibleToSide(g, "w", "e4", "w")).toBe(true);
    expect(isPieceVisibleToSide(g, "w", "h2", "b")).toBe(false);
    expect(isPieceVisibleToSide(g, "w", "c5", "b")).toBe(false);
  });
});

describe("isMoverVisibleToSide", () => {
  it("keeps an attacker's occupy cue visible after its spotter dies mid-resolve", () => {
    // Combat Chain turn 3 post-attack: the c3 siege rook is gone, so e4 is dark.
    const g = new Chess("5k2/8/8/4P3/4n3/8/8/4K3 w - - 0 1");
    const move = { from: "e4", color: "b" } as const;

    expect(isPieceVisibleToSide(g, "w", move.from, move.color)).toBe(false);
    expect(isMoverVisibleToSide(g, "w", move, new Set<Square>())).toBe(false);
    expect(isMoverVisibleToSide(g, "w", move, new Set<Square>(["e4"]))).toBe(true);
  });

  it("still gates quiet enemy moves that did not attack this resolve", () => {
    const g = new Chess("k7/5r2/8/2n5/4K3/8/7b/8 w - - 0 1");
    const quiet = { from: "c5", color: "b" } as const;

    expect(isMoverVisibleToSide(g, "w", quiet, new Set<Square>())).toBe(false);
    expect(isMoverVisibleToSide(g, "w", quiet, new Set<Square>(["c5"]))).toBe(true);
  });

  it("uses rook mode for vision parity with the board fog", () => {
    const g = new Chess("4k3/8/8/6n1/8/2R5/8/4K3 w - - 0 1");
    const move = { from: "g5", color: "b" } as const;

    expect(isMoverVisibleToSide(g, "w", move, new Set<Square>())).toBe(false);
    expect(
      isMoverVisibleToSide(g, "w", move, new Set<Square>(), { rookModeFor: () => "siege" }),
    ).toBe(true);
  });
});

describe("getVisionDisplayCells", () => {
  it("maps algebraic squares onto the display grid", () => {
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];

    expect(getVisionDisplayCells(new Set<Square>(["d4", "c6"]), files, ranks)).toEqual([
      { col: 3, row: 4 },
      { col: 2, row: 2 },
    ]);
  });
});

describe("getVisionFogHolePaths", () => {
  it("rounds only exterior fog-union corners, not every tile corner", () => {
    const paths = getVisionFogHolePaths(
      [
        { col: 1, row: 1 },
        { col: 2, row: 1 },
        { col: 1, row: 2 },
        { col: 2, row: 2 },
      ],
      0.15,
    );

    expect(paths).toHaveLength(4);
    expect(paths[0]).toContain("A0.15 0.15 0 0 1 1.15 1");
    expect(paths[0]).not.toContain("A0.15 0.15 0 0 1 2 1.15");
    expect(paths[1]).toContain("A0.15 0.15 0 0 1 3 1.15");
  });

  it("keeps one-wide tips from becoming pill-shaped", () => {
    const paths = getVisionFogHolePaths([{ col: 3, row: 3 }, { col: 3, row: 4 }], 0.15);
    // Vertical tip cell has no left/right neighbor → capped corner radius.
    expect(paths[0]).toContain("A0.1 0.1");
  });
});
