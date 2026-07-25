import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";

import { NERD_STARTING_FEN } from "~/data/nerdMode";
import { NERD_CAPABILITIES } from "~/store/capabilitiesStore";
import { IDENTITY_TO_PIECE_SET } from "~/store/settingsStore";

describe("NerdScreen placeholder", () => {
  it("starts with kings on the e-files and pawns on files c through f", () => {
    const game = new Chess(NERD_STARTING_FEN);

    expect(game.get("e1")).toEqual({ color: "w", type: "k" });
    expect(game.get("e8")).toEqual({ color: "b", type: "k" });

    for (const file of ["c", "d", "e", "f"] as const) {
      expect(game.get(`${file}2`)).toEqual({ color: "w", type: "p" });
      expect(game.get(`${file}7`)).toEqual({ color: "b", type: "p" });
    }

    expect(game.board().flat().filter(Boolean)).toHaveLength(10);
  });

  it("uses the Nerd piece set for both sides on a read-only board", () => {
    expect(IDENTITY_TO_PIECE_SET.Nerd).toBe("nerd");
    expect(NERD_CAPABILITIES.opponentUsesPlayerPieceSet).toBe(true);
    expect(NERD_CAPABILITIES.readOnly).toBe(true);
  });
});
