import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NerdModePrompt } from "~/features/nerd/NerdModePrompt";
import { identityOptions, setNerdModeUnlocked } from "~/features/nerd/identity";
import { playerIdentity, setPlayerIdentity, setPlayerName } from "~/store/settingsStore";

afterEach(() => {
  cleanup();
  setPlayerName("Classic Player");
  setPlayerIdentity("Human");
  setNerdModeUnlocked(false);
  vi.restoreAllMocks();
});

describe("NerdModePrompt", () => {
  it("opens standalone StarChess when they accept nerd mode", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", {
      ...window.location,
      search: "?scfen=SCFEN%7Cx",
      hash: "#h",
      assign,
    });
    setNerdModeUnlocked(false);
    setPlayerName("Kerrigam");
    render(() => <NerdModePrompt />);

    expect(await screen.findByRole("dialog", { name: "Activate nerd mode?" })).toBeTruthy();
    expect(identityOptions()).not.toContain("Nerd");

    fireEvent.click(screen.getByRole("button", { name: "yes" }));

    expect(assign).toHaveBeenCalledWith("/starchess/?scfen=SCFEN%7Cx#h");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("unlocks the Nerd identity for classic chess when declined", async () => {
    setNerdModeUnlocked(false);
    setPlayerName("Zeratul");
    render(() => <NerdModePrompt />);

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
