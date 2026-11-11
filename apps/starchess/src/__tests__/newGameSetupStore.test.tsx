import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";

import { NewGamePanel } from "~/components/features/NewGamePanel";
import { savedOpponent, setSavedOpponent } from "~/store/newGameSetupStore";
import type { AdjutantKind } from "~/types/newGame";

afterEach(() => {
  cleanup();
  setSavedOpponent("naive");
});

describe("starchess_setup opponent", () => {
  it("defaults to the naive script", () => {
    expect(savedOpponent()).toBe("naive");
  });

  it("keeps strategic and ignores anything else", () => {
    setSavedOpponent("strategic");
    expect(savedOpponent()).toBe("strategic");
    setSavedOpponent("wildcard" as AdjutantKind);
    expect(savedOpponent()).toBe("strategic");
  });

  it("opens the Single Player modal on the saved script", () => {
    setSavedOpponent("strategic");
    const { getByTestId } = render(() => (
      <NewGamePanel open onClose={() => {}} onStart={() => {}} />
    ));
    expect((getByTestId("new-game-opponent") as HTMLSelectElement).value).toBe(
      "strategic",
    );
  });

  it("writes the select into starchess_setup", () => {
    const { getByTestId } = render(() => (
      <NewGamePanel open onClose={() => {}} onStart={() => {}} />
    ));
    fireEvent.change(getByTestId("new-game-opponent"), {
      target: { value: "strategic" },
    });
    expect(savedOpponent()).toBe("strategic");
  });

  it("shows the saved script again after the modal remounts", () => {
    const first = render(() => (
      <NewGamePanel open onClose={() => {}} onStart={() => {}} />
    ));
    fireEvent.change(first.getByTestId("new-game-opponent"), {
      target: { value: "strategic" },
    });
    first.unmount();

    const second = render(() => (
      <NewGamePanel open onClose={() => {}} onStart={() => {}} />
    ));
    expect((second.getByTestId("new-game-opponent") as HTMLSelectElement).value).toBe(
      "strategic",
    );
  });
});
