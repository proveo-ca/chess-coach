import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { playReviewTurn } from "~/presentation/hud/playReviewTurn";
import { REVIEW_INTENT_HOLD_MS } from "~/presentation/hud/reviewPhases";

const makeArgs = () => ({
  onPhase: vi.fn(),
  playChecks: vi.fn(async () => {}),
  showIntent: vi.fn(),
  playResolve: vi.fn(async () => {}),
  onDone: vi.fn(),
});

describe("playReviewTurn", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs check → intent hold → resolve → done", async () => {
    const args = makeArgs();
    playReviewTurn(args);
    await vi.advanceTimersByTimeAsync(REVIEW_INTENT_HOLD_MS);
    expect(args.onPhase.mock.calls.map((c) => c[0])).toEqual(["check", "intent", "resolve"]);
    expect(args.playResolve).toHaveBeenCalledOnce();
    expect(args.onDone).toHaveBeenCalledOnce();
  });

  it("cancel during the intent hold stops later phases and leaves no pending timer", async () => {
    const args = makeArgs();
    const cancel = playReviewTurn(args);
    await vi.advanceTimersByTimeAsync(REVIEW_INTENT_HOLD_MS / 2);
    expect(vi.getTimerCount()).toBe(1);
    cancel();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(REVIEW_INTENT_HOLD_MS * 2);
    expect(args.onPhase).not.toHaveBeenCalledWith("resolve");
    expect(args.playResolve).not.toHaveBeenCalled();
    expect(args.onDone).not.toHaveBeenCalled();
  });
});
