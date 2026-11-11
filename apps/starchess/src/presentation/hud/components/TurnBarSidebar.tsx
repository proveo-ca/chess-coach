/**
 * Vertical turn controls for BoardSideRail (live + review chips).
 * Review DualNav lives in top ReviewTurnNav; pass `hideDualNav`.
 * Does not replace horizontal `TurnBar`.
 * // SPEC: _spec/apps/starchess/screens.puml, _spec/apps/starchess/architecture/reactivity/presentation.md
 */
import type { ScAction } from "@chess-coach/starchess-core";
import {
  For,
  Show,
  batch,
  createEffect,
  createMemo,
  createSignal,
  onMount,
  type Component,
  type JSX,
} from "solid-js";

import { createRepeat } from "~/adapters/timers";
import { useMatchStore } from "~/ports/matchStore";
import { Button } from "@chess-coach/ui-web/primitives/Button";
import { Chip } from "@chess-coach/ui-web/primitives/Chip";
import { CancelHint } from "~/presentation/hud/components/CancelHint";
import { queueActionKey, useQueueHint } from "~/presentation/hud/queueHint";
import { CountdownRing } from "@chess-coach/ui-web/primitives/CountdownRing";
import { DualNavButton } from "@chess-coach/ui-web/primitives/DualNavButton";
import { turnTimeoutMsForTurn } from "~/presentation/constants";
import { liveMatchPhase } from "~/presentation/hud/liveMatchPhase";
import { reviewPhaseChipTone } from "~/presentation/hud/reviewPhases";
import styles from "~/presentation/hud/components/TurnBarSidebar.module.css";
import type { ReviewTurnPhase } from "~/types/review";
import type { ChipTone } from "@chess-coach/ui-web/types/ui";

export type TurnBarSidebarReviewProps = {
  turn: number;
  phase: ReviewTurnPhase;
  onBack?: () => void;
  onForward?: () => void;
  backDisabled?: boolean;
  forwardDisabled?: boolean;
  /** Hide DualNav (tutorial phase steppers own advance). */
  hideDualNav?: boolean;
};

export type TurnBarSidebarProps = {
  onEnd?: () => void;
  onTimeout?: () => void;
  autoStart?: boolean;
  resolveOnEnd?: boolean;
  /**
   * Observer review — Turn/Phase chips on the rail. DualNav is owned by top
   * top ReviewTurnNav; pass `hideDualNav: true` (default for new hosts).
   */
  review?: TurnBarSidebarReviewProps;
};

const TURN_DEADLINE_TICK_MS = 200;

const badgeLabel = (a: ScAction): string => {
  if (a.timing === "C") return `${a.from}→${a.to}`;
  if (a.to) return `${a.from}→${a.to}`;
  return `${a.timing} ${a.from}`;
};

const toneFor = (timing: ScAction["timing"]): ChipTone => {
  if (timing === "B") return "before";
  if (timing === "F") return "after";
  return "classical";
};

const phaseShort = (phase: ReviewTurnPhase): string => {
  switch (phase) {
    case "start":
      return "Start";
    case "check":
      return "Check";
    case "intent":
      return "Intent";
    case "resolve":
      return "Resolve";
    case "final":
      return "—";
  }
};

export const TurnBarSidebar: Component<TurnBarSidebarProps> = (props) => {
  const queueHint = useQueueHint();
  const store = useMatchStore();
  const [now, setNow] = createSignal(Date.now());
  let firedForDeadline: number | null = null;
  const reviewing = createMemo(() => !!props.review);
  const resolveOnEnd = createMemo(() => props.resolveOnEnd !== false);
  const onTimeout = createMemo(() => props.onTimeout);

  const resolveIfArmed = () => {
    if (!resolveOnEnd()) return;
    if (!store.view.canSubmit()) return;
    store.submitTurn("end");
  };

  onMount(() => {
    if (reviewing()) return;
    if (props.autoStart !== false && store.view.turnDeadlineAt() == null) {
      store.armTimer();
    }
    createRepeat(TURN_DEADLINE_TICK_MS, () => {
      if (reviewing()) return;
      setNow(Date.now());
      const deadline = store.view.turnDeadlineAt();
      if (deadline == null) return;
      if (store.view.turnSecondsRemaining() > 0) return;
      if (firedForDeadline === deadline) return;
      firedForDeadline = deadline;
      batch(() => {
        store.dispatch({ type: "SET_DEADLINE", at: null });
        if (resolveOnEnd() && store.view.canSubmit()) store.submitTurn("timeout");
        onTimeout()?.();
      });
    });
  });

  createEffect(() => {
    if (reviewing()) return;
    const deadline = store.view.turnDeadlineAt();
    if (deadline != null && deadline !== firedForDeadline) {
      firedForDeadline = null;
    }
  });

  const seconds = createMemo(() => {
    void now();
    return store.view.turnSecondsRemaining();
  });

  const displayedTurn = createMemo(() => store.view.displayedSnapshot().turn);

  const progress = createMemo(() => {
    const total = turnTimeoutMsForTurn(displayedTurn()) / 1000;
    return Math.min(1, Math.max(0, seconds() / Math.max(1, total)));
  });

  const liveTurnNumber = createMemo(() => Math.max(1, displayedTurn()));

  const livePhase = createMemo(() => {
    const s = store.shell();
    if (s.phase === "gameOver") return store.reviewPhase();
    return liveMatchPhase({
      phase: s.phase,
      lastResolve: s.lastResolve,
      timelineActive: store.timeline().active,
      pendingPromotion: !!s.pendingPromotion,
    });
  });

  const turnNumber = () => (reviewing() ? Math.max(1, props.review!.turn) : liveTurnNumber());
  const phase = () => (reviewing() ? props.review!.phase : livePhase());

  const turnLabel = (): JSX.Element => {
    const r = props.review;
    if (r?.phase === "final") return "Final";
    if (r?.phase === "start" && r.turn <= 0) return "Start";
    return <>Turn {turnNumber()}</>;
  };

  const sideQueue = createMemo(() => {
    const color = store.view.viewerColor();
    return store.view.currentQueue()
      .filter((a) => a.color === color)
      .slice()
      .sort((a, b) => a.seq - b.seq);
  });

  const befores = () => sideQueue().filter((a) => a.timing === "B");
  const classical = () => sideQueue().find((a) => a.timing === "C") ?? null;
  const afters = () => sideQueue().filter((a) => a.timing === "F");

  const removeChip = (a: ScAction, e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      store.dispatch({ type: "REMOVE_ACTION", seq: a.seq });
    } catch {
      /* ignore */
    }
  };

  const queueChip = (a: ScAction) => (
    <CancelHint active={queueHint() === queueActionKey(a)}>
      <Chip
        size="sm"
        tone={toneFor(a.timing)}
        data-timing={a.timing}
        data-seq={a.seq}
        removeTestId={`queue-remove-${a.seq}`}
        removeLabel={`Remove ${badgeLabel(a)}`}
        onRemove={(e) => removeChip(a, e)}
      >
        {badgeLabel(a)}
      </Chip>
    </CancelHint>
  );

  return (
    <div
      class={styles.rail}
      data-testid={reviewing() ? "turn-bar-sidebar-review" : "turn-bar-sidebar"}
      data-team={store.view.viewerColor()}
      data-phase={phase()}
      role="group"
      aria-label={reviewing() ? "Review turn" : "Turn"}
    >
      <Show when={props.review}>
        {(r) => (
          <Show when={!r().hideDualNav}>
            <div class={styles.dualNav} data-testid="sidebar-dual-nav">
              <DualNavButton
                inverted
                vertical
                onBack={() => r().onBack?.()}
                onForward={() => r().onForward?.()}
                backDisabled={r().backDisabled}
                forwardDisabled={r().forwardDisabled}
              />
            </div>
          </Show>
        )}
      </Show>

      <div class={styles.meta}>
        <Chip
          tone="turn"
          data-testid={reviewing() ? "review-turn-chip" : "live-turn-chip"}
          class={styles.chip}
        >
          {turnLabel()}
        </Chip>
        <Chip
          tone={reviewPhaseChipTone(phase())}
          data-testid={reviewing() ? "review-phase-chip" : "live-phase-chip"}
          class={styles.chip}
        >
          {phaseShort(phase())}
        </Chip>
      </div>

      <Show when={!reviewing()}>
        <div class={styles.queue} data-testid="turn-queue" aria-label="Action queue">
          <For each={befores()}>{(a) => queueChip(a)}</For>
          <Show
            when={classical()}
            fallback={
              <Chip size="sm" tone="muted" data-timing="C" class={styles.chip}>
                C —
              </Chip>
            }
          >
            {(c) => queueChip(c())}
          </Show>
          <For each={afters()}>{(a) => queueChip(a)}</For>
        </div>

        <hr class={styles.divider} />

        <CountdownRing
          class={styles.gauge}
          progress={progress()}
          aria-label={`${seconds()} seconds remaining`}
          data-seconds={seconds()}
        >
          {seconds()}
        </CountdownRing>

        <Button
          class={styles.end}
          data-testid="turn-end"
          onClick={() => {
            resolveIfArmed();
            props.onEnd?.();
          }}
        >
          End Turn
        </Button>
      </Show>
    </div>
  );
};
