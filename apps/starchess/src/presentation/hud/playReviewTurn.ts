/**
 * One DualNav Forward = one full turn: check → intent hold → resolve.
 * // SPEC: _spec/apps/ui/starchess/turn-queue-sequence.puml
 */
import {
  REVIEW_INTENT_HOLD_MS,
  type ReviewTurnPhase,
} from "~/presentation/hud/reviewPhases";

export type PlayReviewTurnArgs = {
  onPhase: (phase: ReviewTurnPhase) => void;
  /** Omit or return immediately when this turn has no turn-open checks. */
  playChecks?: () => Promise<void>;
  /** Set ghosts / rings; runner awaits {@link REVIEW_INTENT_HOLD_MS}. */
  showIntent: () => void;
  playResolve: () => Promise<void>;
  onDone: () => void;
};

/**
 * Runs check → intent hold → resolve sequentially.
 * Returns a cancel function (rejects in-flight waits; callers cancel playback too).
 */
export const playReviewTurn = (args: PlayReviewTurnArgs): (() => void) => {
  let cancelled = false;
  let holdTimer: ReturnType<typeof setTimeout> | null = null;

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      holdTimer = setTimeout(() => {
        holdTimer = null;
        resolve();
      }, ms);
    });

  const run = async () => {
    try {
      if (args.playChecks) {
        args.onPhase("check");
        await args.playChecks();
        if (cancelled) return;
      }

      args.onPhase("intent");
      args.showIntent();
      await wait(REVIEW_INTENT_HOLD_MS);
      if (cancelled) return;

      args.onPhase("resolve");
      await args.playResolve();
      if (cancelled) return;

      args.onDone();
    } catch {
      // Cancelled playback may reject; ignore.
    }
  };

  void run();

  return () => {
    cancelled = true;
    if (holdTimer != null) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  };
};
