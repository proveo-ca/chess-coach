import type { ScFenSnapshot } from "@chess-coach/starchess-core";
/**
 * Observer review chrome — dual ResourceBars + turn/phase chips + DualNav.
 * Snapshot is read via createMemo so minerals / gas / deployed update each phase.
 */
import { createMemo, type Component } from "solid-js";

import { Chip } from "~/components/primitives/Chip";
import { DualNavButton } from "~/components/primitives/DualNavButton";
import styles from "~/presentation/hud/ObserverReviewChrome.module.css";
import { ResourceBar } from "~/presentation/hud/ResourceBar";
import {
  reviewPhaseChipTone,
  reviewPhaseLabel,
  type ReviewTurnPhase,
} from "~/presentation/hud/reviewPhases";

export type ObserverReviewChromeProps = {
  turn: number;
  phase: ReviewTurnPhase;
  onBack: () => void;
  onForward: () => void;
  backDisabled?: boolean;
  forwardDisabled?: boolean;
  /**
   * Current DualNav / review board snap. Gas debits (queued specials) and turn
   * advances must flow through this reference.
   */
  snapshot: ScFenSnapshot;
};

export const ObserverReviewChrome: Component<ObserverReviewChromeProps> = (props) => {
  // Re-subscribe when DualNav replaces snap (turn / gas / placement / queue).
  const liveSnap = createMemo(() => {
    const s = props.snapshot;
    void s.turn;
    void s.gas.w;
    void s.gas.b;
    void s.placement;
    void s.queue?.actions?.length;
    return s;
  });

  const turnLabel = () => {
    if (props.phase === "final") return "Final";
    if (props.phase === "start" && props.turn <= 0) return "Start";
    return `Turn ${Math.max(1, props.turn)}`;
  };

  return (
    <div
      class={styles.chrome}
      data-testid="observer-review-chrome"
      data-phase={props.phase}
      data-turn={liveSnap().turn}
    >
      <div class={styles.bars} role="group" aria-label="Both sides resources">
        <ResourceBar color="w" snapshot={liveSnap()} />
        <ResourceBar color="b" snapshot={liveSnap()} />
      </div>
      <div class={styles.navRow}>
        <div class={styles.chips}>
          <Chip tone="turn" data-testid="review-turn-chip">
            {turnLabel()}
          </Chip>
          <Chip tone={reviewPhaseChipTone(props.phase)} data-testid="review-phase-chip">
            {reviewPhaseLabel(props.phase)}
          </Chip>
        </div>
        <DualNavButton
          inverted
          inline
          onBack={props.onBack}
          onForward={props.onForward}
          backDisabled={props.backDisabled}
          forwardDisabled={props.forwardDisabled}
        />
      </div>
    </div>
  );
};
