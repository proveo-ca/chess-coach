import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MatchResultModal } from "~/components/features/MatchResultModal";

afterEach(cleanup);

describe("MatchResultModal", () => {
  it("shows VICTORY for win and wires primary/secondary actions", () => {
    const onAnotherGame = vi.fn();
    const onReplay = vi.fn();
    const { getByTestId } = render(() => (
      <MatchResultModal
        open
        result="win"
        onAnotherGame={onAnotherGame}
        onReplay={onReplay}
      />
    ));

    expect(getByTestId("match-result-headline").textContent).toBe("VICTORY");
    fireEvent.click(getByTestId("match-result-another-game"));
    fireEvent.click(getByTestId("match-result-replay"));
    expect(onAnotherGame).toHaveBeenCalledOnce();
    expect(onReplay).toHaveBeenCalledOnce();
  });

  it("shows DEFEAT for loss and DRAW for draw", () => {
    const { getByTestId, unmount } = render(() => (
      <MatchResultModal open result="loss" onAnotherGame={() => {}} onReplay={() => {}} />
    ));
    expect(getByTestId("match-result-headline").textContent).toBe("DEFEAT");
    unmount();

    const again = render(() => (
      <MatchResultModal open result="draw" onAnotherGame={() => {}} onReplay={() => {}} />
    ));
    expect(again.getByTestId("match-result-headline").textContent).toBe("DRAW");
  });
});
