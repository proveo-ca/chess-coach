import { cleanup, render } from "@solidjs/testing-library";
import { MemoryRouter, Route, createMemoryHistory } from "@solidjs/router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewScreen } from "~/screens/ReviewScreen";

const signals: AbortSignal[] = [];

const renderReview = () => {
  const history = createMemoryHistory();
  history.set({ value: "/review" });
  return render(() => (
    <MemoryRouter history={history}>
      <Route path="/review" component={ReviewScreen} />
    </MemoryRouter>
  ));
};

describe("ReviewScreen arena fetch deadline", () => {
  beforeEach(() => {
    signals.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        if (init?.signal) signals.push(init.signal);
        return new Promise<Response>(() => {});
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("unmount aborts the in-flight arena list fetch", () => {
    const { unmount } = renderReview();
    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(false);
    unmount();
    expect(signals[0].aborted).toBe(true);
  });

  it("the arena list fetch carries a 5s deadline", () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    renderReview();
    expect(timeout).toHaveBeenCalledWith(5_000);
  });
});
