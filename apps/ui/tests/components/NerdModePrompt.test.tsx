import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";

import { NerdModePrompt } from "~/components/features/NerdModePrompt";
import { identityOptions, setNerdModeUnlocked, setPlayerName } from "~/store/settingsStore";

afterEach(() => {
  cleanup();
  setPlayerName("Classic Player");
  setNerdModeUnlocked(false);
});

describe("NerdModePrompt", () => {
  it("unlocks Nerd after recognizing a nearby StarCraft name", async () => {
    setNerdModeUnlocked(false);
    setPlayerName("Kerrigam");
    render(() => <NerdModePrompt />);

    expect(await screen.findByRole("dialog", { name: "Activate nerd mode?" })).toBeTruthy();
    expect(identityOptions()).not.toContain("Nerd");

    fireEvent.click(screen.getByRole("button", { name: "yes" }));

    expect(identityOptions()).toContain("Nerd");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the classic identities when declined", async () => {
    setNerdModeUnlocked(false);
    setPlayerName("Zeratul");
    render(() => <NerdModePrompt />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "keep chess classic",
      }),
    );

    expect(identityOptions()).not.toContain("Nerd");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
