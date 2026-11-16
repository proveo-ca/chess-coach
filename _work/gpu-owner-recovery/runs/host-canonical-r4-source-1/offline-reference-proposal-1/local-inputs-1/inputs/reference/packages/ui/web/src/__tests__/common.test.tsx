// SPEC: _spec/_plans/chess-ui-primitives.puml
import { cleanup, fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UiProvider } from "../UiProvider";
import { Button } from "../primitives/Button";
import { Toggle } from "../primitives/Toggle";
import { DualNavButton } from "../primitives/DualNavButton";
import { Modal } from "../atoms/Modal";
import chessStyles from "../primitives/Button.chess.module.css";
import starchessStyles from "../primitives/Button.starchess.module.css";

afterEach(cleanup);

describe("shared controls", () => {
  it("uses the product skin and keeps disabled controls inert", () => {
    const click = vi.fn();
    render(() => (
      <>
        <UiProvider product="chess">
          <Button disabled onClick={click}>
            Chess
          </Button>
        </UiProvider>
        <UiProvider product="starchess">
          <Button primary variant="neon">
            Star
          </Button>
        </UiProvider>
      </>
    ));
    expect(screen.getByText("Chess").classList.contains(chessStyles["common-btn"])).toBe(true);
    expect(
      screen.getByText("Star").classList.contains(starchessStyles["common-btn--neon-primary"]),
    ).toBe(true);
    (screen.getByText("Chess") as HTMLButtonElement).click();
    expect(click).not.toHaveBeenCalled();
  });

  it("uses injected navigation only for internal button links", () => {
    render(() => (
      <UiProvider product="chess" Link={(props) => <a {...props} data-router="yes" />}>
        <Button href="/game">Play</Button>
        <Button href="https://example.com" target="_blank" rel="noreferrer">
          External
        </Button>
      </UiProvider>
    ));
    expect(screen.getByText("Play").getAttribute("data-router")).toBe("yes");
    expect(screen.getByText("External").getAttribute("data-router")).toBeNull();
    expect(screen.getByText("External").getAttribute("rel")).toBe("noreferrer");
  });

  it("reports checkbox state and navigation actions", () => {
    const change = vi.fn();
    const forward = vi.fn();
    const back = vi.fn();
    render(() => (
      <>
        <Toggle checked={false} label="Sound" onChange={change} />
        <DualNavButton onBack={back} onForward={forward} backDisabled />
      </>
    ));
    fireEvent.click(screen.getByRole("checkbox", { name: "Sound" }));
    expect(change).toHaveBeenCalledWith(true);
    (screen.getByRole("button", { name: "Go back" }) as HTMLButtonElement).click();
    fireEvent.click(screen.getByRole("button", { name: "Go forward" }));
    expect(back).not.toHaveBeenCalled();
    expect(forward).toHaveBeenCalledOnce();
  });
});

describe.each(["chess", "starchess"] as const)("%s modal", (product) => {
  it("preserves initial focus, Escape dismissal, and focus restoration", async () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const [open, setOpen] = createSignal(true);
    render(() => (
      <UiProvider product={product}>
        <Modal open={open()} title="Settings" onClose={() => setOpen(false)}>
          Body
        </Modal>
      </UiProvider>
    ));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        product === "chess"
          ? screen.getByRole("button", { name: "Close modal" })
          : screen.getByRole("dialog"),
      ),
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("ignores Escape and overlay clicks when dismissal is disabled", () => {
    const close = vi.fn();
    render(() => (
      <UiProvider product={product}>
        <Modal open dismissible={false} showCloseButton={false} onClose={close}>
          Body
        </Modal>
      </UiProvider>
    ));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(close).not.toHaveBeenCalled();
  });
});
