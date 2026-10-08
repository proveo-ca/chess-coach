import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NewGamePanel } from "~/components/features/NewGamePanel";
import { savedOpponent, setSavedOpponent } from "~/store/newGameSetupStore";
import type { PlayableAdjutantKind } from "~/types/newGame";

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
    setSavedOpponent("wildcard" as PlayableAdjutantKind);
    expect(savedOpponent()).toBe("strategic");
  });

  it.each(["machine-learning", "rlhf", "rlcd"])("rejects the %s placeholder from selection and Start", (kind) => {
    setSavedOpponent("strategic");
    const onStart = vi.fn();
    const { getByTestId } = render(() => (
      <NewGamePanel open onClose={() => {}} onStart={onStart} />
    ));
    const select = getByTestId("new-game-opponent") as HTMLSelectElement;
    expect([...select.options].map((option) => option.value)).toEqual([
      "naive", "strategic", "machine-learning", "rlhf", "rlcd",
    ]);
    expect(select.querySelector<HTMLOptionElement>(`option[value="${kind}"]`)?.disabled).toBe(true);
    fireEvent.change(select, { target: { value: kind } });
    setSavedOpponent(kind as PlayableAdjutantKind);
    expect(savedOpponent()).toBe("strategic");
    fireEvent.click(getByTestId("new-game-start"));
    expect(onStart).toHaveBeenCalledWith({ map: "eclipse", team: "w", opponent: "strategic" });
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
