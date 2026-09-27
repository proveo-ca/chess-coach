import { cleanup, render, screen } from "@solidjs/testing-library";
import { Show, createSignal } from "solid-js";
import { afterEach, describe, expect, it } from "vitest";

import { QueueHintProvider, queueActionKey, useQueueHint } from "~/presentation/hud/queueHint";

const Reader = () => {
  const hint = useQueueHint();
  return <span data-testid="hint">{hint() ?? "none"}</span>;
};

afterEach(() => cleanup());

describe("queue hint context", () => {
  it("reads null with no lesson host above the HUD", () => {
    render(() => <Reader />);
    expect(screen.getByTestId("hint").textContent).toBe("none");
  });

  it("follows the host's accessor, and a HUD outside a later host sees nothing", () => {
    const [hint, setHint] = createSignal<string | null>(null);
    const [hosted, setHosted] = createSignal(true);
    render(() => (
      <>
        <Show when={hosted()}>
          <QueueHintProvider value={hint}>
            <Reader />
          </QueueHintProvider>
        </Show>
        <Show when={!hosted()}>
          <Reader />
        </Show>
      </>
    ));
    const key = queueActionKey({ timing: "C", kind: "classical", from: "e2", to: "e3" });
    setHint(key);
    expect(screen.getByTestId("hint").textContent).toBe("C=e2e3");
    setHosted(false);
    expect(screen.getByTestId("hint").textContent).toBe("none");
  });
});
