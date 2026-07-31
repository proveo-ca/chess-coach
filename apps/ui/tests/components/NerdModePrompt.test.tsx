import { MemoryRouter, Route } from "@solidjs/router";
import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";

import { NerdModePrompt } from "~/components/features/NerdModePrompt";
import {
  identityOptions,
  playerIdentity,
  setNerdModeUnlocked,
  setPlayerIdentity,
  setPlayerName,
} from "~/store/settingsStore";

afterEach(() => {
  cleanup();
  setPlayerName("Classic Player");
  setPlayerIdentity("Human");
  setNerdModeUnlocked(false);
});

describe("NerdModePrompt", () => {
  it("sends the user to Brood War when they accept nerd mode", async () => {
    setNerdModeUnlocked(false);
    setPlayerName("Kerrigam");
    render(() => (
      <MemoryRouter>
        <Route path="/" component={() => <NerdModePrompt />} />
        <Route path="/broodwar" component={() => <div>Brood War screen</div>} />
      </MemoryRouter>
    ));

    expect(await screen.findByRole("dialog", { name: "Activate nerd mode?" })).toBeTruthy();
    expect(identityOptions()).not.toContain("Nerd");

    fireEvent.click(screen.getByRole("button", { name: "yes" }));

    expect(await screen.findByText("Brood War screen")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("unlocks the Nerd identity for classic chess when declined", async () => {
    setNerdModeUnlocked(false);
    setPlayerName("Zeratul");
    render(() => (
      <MemoryRouter>
        <Route path="/" component={() => <NerdModePrompt />} />
      </MemoryRouter>
    ));

    fireEvent.click(
      await screen.findByRole("button", {
        name: "keep chess classic",
      }),
    );

    expect(identityOptions()).toContain("Nerd");
    expect(playerIdentity()).toBe("Nerd");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
