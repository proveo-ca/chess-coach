import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";

import { PlayerNameField } from "~/components/features/PlayerNameField";
import {
  playerNameCommitTick,
  resetPlayerNameCommitTick,
} from "~/features/nerd/nameCommit";
import { setPlayerName } from "~/store/settingsStore";

afterEach(() => {
  cleanup();
  setPlayerName("Classic Player");
  resetPlayerNameCommitTick();
});

describe("PlayerNameField", () => {
  it("commits nerd-name check on blur, not on input", () => {
    render(() => <PlayerNameField id="player-name" />);
    const input = screen.getByPlaceholderText("Your name");

    fireEvent.input(input, { target: { value: "Kerrigam" } });
    expect(playerNameCommitTick()).toBe(0);

    fireEvent.blur(input);
    expect(playerNameCommitTick()).toBe(1);
  });

  it("commits nerd-name check when rolling a random name", () => {
    render(() => <PlayerNameField />);
    expect(playerNameCommitTick()).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Roll a random name" }));
    expect(playerNameCommitTick()).toBe(1);
  });
});
