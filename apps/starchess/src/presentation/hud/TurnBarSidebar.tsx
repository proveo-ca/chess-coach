/**
 * Experimental vertical TurnBar — board side rail (live + observer DualNav).
 * Does not replace horizontal `TurnBar`.
 */
import type { ScAction } from "@chess-coach/starchess-core";
import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type Component,
  type JSX,
} from "solid-js";

import {
  currentQueue,
  turnDeadlineAt,
  turnSecondsRemaining,
  viewerColor,
} from "~/app/matchEconomy";
import { useMatchStore } from "~/app/MatchStoreContext";
import { canSubmit, displayedSnapshot } from "~/app/selectors";
import { Button } from "~/components/primitives/Button";
import { Chip } from "~/components/primitives/Chip";
import { CountdownRing } from "~/components/primitives/CountdownRing";
import { DualNavButton } from "~/components/primitives/DualNavButton";
import { turnTimeoutMsForTurn } from "~/presentation/constants";
import { liveMatchPhase } from "~/presentation/hud/liveMatchPhase";
import { reviewPhaseChipTone } from "~/presentation/hud/reviewPhases";
import styles from "~/presentation/hud/TurnBarSidebar.module.css";
import type { ChipTone } from "~/types/ui";
import type { ReviewTurnPhase } from "~/types/review";

export type TurnBarSidebarReviewProps = {
  turn: number;
  phase: ReviewTurnPhase;
  onBack: () => void;
  onForward: () => void;
  backDisabled?: boolean;
  forwardDisabled?: boolean;
};

export type TurnBarSidebarProps = {
  onEnd?: () => void;
  onTimeout?: () => void;
  autoStart?: boolean;
  resolveOnEnd?: boolean;
  /**
   * Observer DualNav review — DualNav sits at the top of the rail; live End /
   * countdown / queue are omitted.
   */
  review?: TurnBarSidebarReviewProps;
};

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
  const store = useMatchStore();
  const [now, setNow] = createSignal(Date.now());
  let firedForDeadline: number | null = null;
  const reviewing = () => !!props.review;

  const resolveIfArmed = () => {
    if (props.resolveOnEnd === false) return;
    if (!canSubmit(store.state())) return;
    store.submitTurn("end");
  };

  onMount(() => {
    if (reviewing()) return;
    if (props.autoStart !== false && turnDeadlineAt(store) == null) {
      store.armTimer();
    }
    const id = window.setInterval(() => {
      if (reviewing()) return;
      setNow(Date.now());
      const deadline = turnDeadlineAt(store);
      if (deadline == null) return;
      if (turnSecondsRemaining(store) > 0) return;
      if (firedForDeadline === deadline) return;
      firedForDeadline = deadline;
      store.dispatch({ type: "SET_DEADLINE", at: null });
      if (props.resolveOnEnd === false) {
        props.onTimeout?.();
        return;
      }
      if (canSubmit(store.state())) store.submitTurn("timeout");
      props.onTimeout?.();
    }, 200);
    onCleanup(() => window.clearInterval(id));
  });

  createEffect(() => {
    if (reviewing()) return;
    const deadline = turnDeadlineAt(store);
    if (deadline != null && deadline !== firedForDeadline) {
      firedForDeadline = null;
    }
  });

  const seconds = () => {
    void now();
    return turnSecondsRemaining(store);
  };

  const progress = () => {
    const total = turnTimeoutMsForTurn(displayedSnapshot(store.state()).turn) / 1000;
    return Math.min(1, Math.max(0, seconds() / Math.max(1, total)));
  };

  const liveTurnNumber = createMemo(() =>
    Math.max(1, displayedSnapshot(store.state()).turn),
  );

  const livePhase = createMemo(() => {
    const s = store.state();
    if (s.phase === "gameOver") return store.reviewPhase();
    return liveMatchPhase({
      phase: s.phase,
      lastResolve: s.lastResolve,
      timelineActive: s.timeline.active,
      pendingPromotion: !!s.pendingPromotion,
    });
  });

  const turnNumber = () =>
    reviewing() ? Math.max(1, props.review!.turn) : liveTurnNumber();
  const phase = () => (reviewing() ? props.review!.phase : livePhase());

  const turnLabel = (): JSX.Element => {
    const r = props.review;
    if (r?.phase === "final") return "Final";
    if (r?.phase === "start" && r.turn <= 0) return "Start";
    return <>Turn {turnNumber()}</>;
  };

  const sideQueue = () => {
    const color = viewerColor(store);
    return currentQueue(store)
      .filter((a) => a.color === color)
      .slice()
      .sort((a, b) => a.seq - b.seq);
  };

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
  );

  return (
    <div
      class={styles.rail}
      data-testid={reviewing() ? "turn-bar-sidebar-review" : "turn-bar-sidebar"}
      data-team={viewerColor(store)}
      data-phase={phase()}
      role="group"
      aria-label={reviewing() ? "Review turn" : "Turn"}
    >
      <Show when={props.review}>
        {(r) => (
          <div class={styles.dualNav} data-testid="sidebar-dual-nav">
            <DualNavButton
              inverted
              vertical
              onBack={() => r().onBack()}
              onForward={() => r().onForward()}
              backDisabled={r().backDisabled}
              forwardDisabled={r().forwardDisabled}
            />
          </div>
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
