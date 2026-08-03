import { Chess } from "chess.js";
import { MemoryRouter, Route } from "@solidjs/router";
import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NERD_STARTING_FEN } from "~/data/nerdMode";
import { NerdScreen } from "~/screens/NerdScreen";
import { NERD_CAPABILITIES } from "~/store/capabilitiesStore";
import { currentFen } from "~/store/gameStore";
import { IDENTITY_TO_PIECE_SET } from "~/store/settingsStore";

vi.mock("~/services/api", () => ({
  postAdviceStream: vi.fn(),
  postExplainStream: vi.fn(),
  postMove: vi.fn(),
  postNewGame: vi.fn(),
}));

afterEach(() => cleanup());

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

  it("uses the Nerd piece set for both sides on a movable board", () => {
    expect(IDENTITY_TO_PIECE_SET.Nerd).toBe("nerd");
    expect(NERD_CAPABILITIES.opponentUsesPlayerPieceSet).toBe(true);
    expect(NERD_CAPABILITIES.readOnly).toBe(false);
    expect(NERD_CAPABILITIES.freeColorControl).toBe(true);
  });

  it("lights cumulative friendly vision on load without selecting a piece", async () => {
    // White rook on d4 (tank 5×5) + king on a1 (3 extra tiles) ⇒ 28 lit tiles.
    const fen = "7k/8/8/8/3R3q/8/8/K7 w - - 0 1";
    const view = render(() => (
      <MemoryRouter>
        <Route path="*" component={() => <NerdScreen startingFen={fen} />} />
      </MemoryRouter>
    ));

    await waitFor(() => expect(view.container.querySelectorAll('[data-fog="visible"]')).toHaveLength(28));
    expect(view.container.querySelector('[data-piece-inline="r"]')).toBeTruthy();
    expect(view.container.querySelector('svg[data-rook-mode="tank"]')).toBeTruthy();
    // Enemy queen on h4 stays outside the rook's tank 5×5.
    expect(view.container.querySelector('img[alt="b q"]')).toBeNull();
  });

  it("does not change the fog mask when a piece is selected or deselected", async () => {
    const fen = "7k/8/8/8/3K1P1q/8/8/8 w - - 0 1";
    const view = render(() => (
      <MemoryRouter>
        <Route path="*" component={() => <NerdScreen startingFen={fen} />} />
      </MemoryRouter>
    ));

    await waitFor(() => expect(view.container.querySelectorAll('[data-fog="visible"]')).toHaveLength(13));
    const before = view.container.querySelectorAll('[data-fog="visible"]').length;

    fireEvent.click(view.container.querySelector('[data-square="d4"]')!);
    await waitFor(() => expect(view.container.querySelectorAll('[data-fog="visible"]')).toHaveLength(before));

    fireEvent.click(view.container.querySelector('[data-square="f4"]')!);
    await waitFor(() => expect(view.container.querySelectorAll('[data-fog="visible"]')).toHaveLength(before));
    expect(view.container.querySelector('img[alt="b q"]')).toBeNull();
    expect(currentFen()).toBe(fen);
  });

  it("updates cumulative fog after a move to the new side vision", async () => {
    const fen = "7k/8/8/8/3K4/8/8/8 w - - 0 1";
    const view = render(() => (
      <MemoryRouter>
        <Route path="*" component={() => <NerdScreen startingFen={fen} />} />
      </MemoryRouter>
    ));

    await waitFor(() => expect(view.container.querySelectorAll('[data-fog="visible"]')).toHaveLength(9));

    fireEvent.click(view.container.querySelector('[data-square="d4"]')!);
    fireEvent.click(view.container.querySelector('[data-square="d5"]')!);
    await waitFor(() => expect(currentFen()).not.toBe(fen));
    // StarChess boards hide the destination `<img>` during MoveAnimation (MOVE_MS).
    await waitFor(
      () =>
        expect(
          view.container
            .querySelector('img[alt="w k"]')
            ?.closest("[data-square]")
            ?.getAttribute("data-square"),
        ).toBe("d5"),
      { timeout: 2000 },
    );
    await waitFor(() => expect(view.container.querySelectorAll('[data-fog="visible"]')).toHaveLength(9));
    expect(view.container.querySelector('[data-square="d5"]')?.getAttribute("data-fog")).toBe("visible");
    // d3 was in the old d4 cone but falls outside the king’s 3×3 on d5.
    expect(view.container.querySelector('[data-square="d3"]')?.getAttribute("data-fog")).toBe("hidden");
  });
});
