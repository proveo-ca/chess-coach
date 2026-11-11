/**
 * One DualNav Forward = one full turn: check → intent hold → resolve.
 * // SPEC: _spec/packages/starchess-core/turn-queue-sequence.puml, _spec/apps/starchess/architecture/timers.puml
 */
import { sleep } from "~/adapters/timers";
import {
  REVIEW_INTENT_HOLD_MS,
  type ReviewTurnPhase,
} from "~/presentation/hud/reviewPhases";
import type { Cancel } from "~/types/ports";

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
 * Returns a cancel: it settles the in-flight hold and stops every later phase.
 * Callers cancel their own check / resolve playback.
 */
export const playReviewTurn = (args: PlayReviewTurnArgs): Cancel => {
  const abort = new AbortController();
  const { signal } = abort;

  const run = async () => {
    try {
      if (args.playChecks) {
        args.onPhase("check");
        await args.playChecks();
        if (signal.aborted) return;
      }

      args.onPhase("intent");
      args.showIntent();
      await sleep(REVIEW_INTENT_HOLD_MS, signal);
      if (signal.aborted) return;

      args.onPhase("resolve");
      await args.playResolve();
      if (signal.aborted) return;

      args.onDone();
    } catch {
      // Cancelled playback may reject; ignore.
    }
  };

  void run();

  return () => abort.abort();
};
