// SPEC: _spec/_plans/chess-ui-primitives.puml
import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewTurnNav } from "../atoms/ReviewTurnNav";
import { SelectCard } from "../atoms/SelectCard";
import { Collapsible } from "../primitives/Collapsible";

afterEach(cleanup);

describe("shared presentation controls", () => {
  it("preserves review keyboard guards and removes its listener on unmount", () => {
    const back = vi.fn();
    const forward = vi.fn();
    const view = render(() => (
      <ReviewTurnNav onBack={back} onForward={forward} keyboard forwardDisabled>
        <input aria-label="Turn annotation" />
      </ReviewTurnNav>
    ));
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(back).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(forward).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "ArrowLeft", ctrlKey: true });
    expect(back).toHaveBeenCalledTimes(1);
    view.unmount();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("renders selectable cards as buttons and leaves nested actions in static cards", () => {
    const select = vi.fn();
    render(() => (
      <>
        <SelectCard label="Seat" selected onClick={select}>
          White
        </SelectCard>
        <SelectCard label="Lobby">
          <button type="button">Join</button>
        </SelectCard>
      </>
    ));
    const seat = screen.getByRole("button", { name: /Seat\s*White/ });
    expect(seat).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(seat);
    expect(select).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Join" }).parentElement?.tagName).toBe("DIV");
  });

  it("keeps collapsed contents hidden and calls controlled expansion", () => {
    const toggle = vi.fn();
    render(() => (
      <Collapsible title="Details" open={false} onToggle={toggle}>
        Body
      </Collapsible>
    ));
    expect(screen.queryByText("Body")).toBeNull();
    const header = screen.getByRole("button", { name: "Details" });
    expect(header).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(header);
    expect(toggle).toHaveBeenCalledTimes(1);
  });
});
