import type { ScAction } from "@chess-coach/starchess-core";
/**
 * StarChess turn chrome — phase chips + queue badges + End + countdown.
 */
import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type Component,
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
import { TeamFrame } from "~/components/primitives/TeamFrame";
import { turnTimeoutMsForTurn } from "~/presentation/constants";
import { liveMatchPhase, reviewPhaseLabel } from "~/presentation/hud/liveMatchPhase";
import { reviewPhaseChipTone } from "~/presentation/hud/reviewPhases";
import styles from "~/presentation/hud/components/TurnBar.module.css";
import type { ChipTone } from "~/types/ui";

export type TurnBarDensity = "default" | "compact" | "queueOnly";

type TurnBarProps = {
  /** Called when the player presses End (after store submit when resolveOnEnd). */
  onEnd?: () => void;
  /** Called when the planning timer hits 0. */
  onTimeout?: () => void;
  /** Seed the 10s gauge on mount when no deadline is set (default true). */
  autoStart?: boolean;
  /**
   * When true (default), End/timeout call `submitTurn` if planning is open.
   * Stories that only demo chrome can set false and handle via onEnd.
   */
  resolveOnEnd?: boolean;
  /**
   * default  — phase chips + full queue + End + timer
   * compact  — last queue chip (cancel) + End + timer (MobileBanner)
   * queueOnly — last viewer queue chip only (cancel); no End/timer
   */
  density?: TurnBarDensity;
  /** Alias for density="compact" (MobileBanner). */
  compact?: boolean;
  /** Hide Turn/Phase label chips (tall-mobile footer under GasRack). */
  hidePhase?: boolean;
  class?: string;
};

const badgeLabel = (a: ScAction): string => {
  if (a.timing === "C") return `C ${a.from}→${a.to}`;
  const to = a.to ? `→${a.to}` : "";
  return `${a.timing} ${a.kind}${to ? ` ${a.from}${to}` : ` ${a.from}`}`;
};

const toneFor = (timing: ScAction["timing"]): ChipTone => {
  if (timing === "B") return "before";
  if (timing === "F") return "after";
  return "classical";
};

export const TurnBar: Component<TurnBarProps> = (props) => {
  const store = useMatchStore();
  const [now, setNow] = createSignal(Date.now());
  /** Deadline timestamp we already fired for — reset when a new planning window arms. */
  let firedForDeadline: number | null = null;

  const density = (): TurnBarDensity =>
    props.density ?? (props.compact ? "compact" : "default");
  const isCompact = () => density() === "compact";
  const isQueueOnly = () => density() === "queueOnly";
  const showControls = () => !isQueueOnly();
  const showTurnMeta = () => density() === "default";
  const showFullQueue = () => density() === "default";

  const resolveIfArmed = () => {
    if (props.resolveOnEnd === false) return;
    if (!canSubmit(store.state())) return;
    store.submitTurn("end");
  };

  onMount(() => {
    // queueOnly is cancel chrome only — never arm or tick the planning timer.
    if (isQueueOnly()) return;
    if (props.autoStart !== false && turnDeadlineAt(store) == null) {
      store.armTimer();
    }
    const id = window.setInterval(() => {
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
    if (isQueueOnly()) return;
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

  const turnNumber = createMemo(() => Math.max(1, displayedSnapshot(store.state()).turn));

  const phase = createMemo(() => {
    const s = store.state();
    if (s.phase === "gameOver") return store.reviewPhase();
    return liveMatchPhase({
      phase: s.phase,
      lastResolve: s.lastResolve,
      timelineActive: s.timeline.active,
      pendingPromotion: !!s.pendingPromotion,
    });
  });

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
  /** Highest seq among viewer actions (most recently queued). */
  const lastQueued = createMemo(() => {
    const q = sideQueue();
    if (!q.length) return null;
    let best = q[0]!;
    for (const a of q) {
      if (a.seq > best.seq) best = a;
    }
    return best;
  });

  const removeChip = (a: ScAction, e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      store.dispatch({ type: "REMOVE_ACTION", seq: a.seq });
    } catch {
      // No planning snap / already gone — ignore.
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
    <Show when={!isQueueOnly() || lastQueued()}>
      <TeamFrame
        class={`${styles.bar}${isCompact() ? ` ${styles.compact}` : ""}${isQueueOnly() ? ` ${styles.queueOnly}` : ""}${props.class ? ` ${props.class}` : ""}`}
        teamColor="#000"
        data-testid="turn-bar"
        data-density={density()}
        data-team={viewerColor(store)}
        data-phase={phase()}
        role="group"
        aria-label={isQueueOnly() ? "Queued action" : "Turn"}
      >
        <Show when={showControls()}>
          <div class={styles.controls}>
            <Show when={showTurnMeta()}>
              <div class={styles.chips}>
                <Chip tone="turn" data-testid="live-turn-chip">
                  Turn - {turnNumber()}
                </Chip>
                <Show when={!props.hidePhase}>
                  <Chip tone={reviewPhaseChipTone(phase())} data-testid="live-phase-chip">
                    {reviewPhaseLabel(phase())}
                  </Chip>
                </Show>
              </div>
            </Show>
            <Show when={isCompact()}>
              <div
                class={styles.inlineQueue}
                data-testid="turn-queue"
                aria-label="Last queued action"
              >
                <Show when={lastQueued()} keyed>
                  {(a) => queueChip(a)}
                </Show>
              </div>
            </Show>
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
            <CountdownRing
              class={styles.timer}
              progress={progress()}
              aria-label={`${seconds()} seconds remaining`}
              data-seconds={seconds()}
            >
              {seconds()}
            </CountdownRing>
          </div>
        </Show>
        <Show when={showFullQueue()}>
          <div class={styles.queue} data-testid="turn-queue" aria-label="Action queue">
            <For each={befores()}>{(a) => queueChip(a)}</For>
            <Show
              when={classical()}
              fallback={
                <Chip size="sm" tone="muted" data-timing="C">
                  C —
                </Chip>
              }
            >
              {(c) => queueChip(c())}
            </Show>
            <For each={afters()}>{(a) => queueChip(a)}</For>
          </div>
        </Show>
        <Show when={isQueueOnly() && lastQueued()}>
          {(a) => (
            <div class={styles.queue} data-testid="turn-queue" aria-label="Last queued action">
              {queueChip(a())}
            </div>
          )}
        </Show>
      </TeamFrame>
    </Show>
  );
};
