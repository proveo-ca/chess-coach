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

  it("the arena list fetch aborts with AbortError once its 5s deadline passes", () => {
    const deadline = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      expect(ms).toBe(5_000);
      return deadline.signal;
    });
    renderReview();
    expect(signals[0].aborted).toBe(false);
    deadline.abort();
    expect(signals[0].aborted).toBe(true);
    expect((signals[0].reason as DOMException).name).toBe("AbortError");
  });

  it("does not depend on AbortSignal.any", () => {
    const any = Object.getOwnPropertyDescriptor(AbortSignal, "any");
    Reflect.deleteProperty(AbortSignal, "any");
    try {
      const { unmount } = renderReview();
      unmount();
      expect(signals[0].aborted).toBe(true);
    } finally {
      if (any) Object.defineProperty(AbortSignal, "any", any);
    }
  });
});
