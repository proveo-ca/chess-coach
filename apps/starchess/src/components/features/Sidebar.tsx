/**
 * Right-rail tools — CoachScreen Sidebar layout, StarChess actions.
 * Labels live in this module (not IconButton) so contrast is guaranteed.
 * Live Home asks for confirm before leaving (NeonModal).
 * Review: vision radios under Home (BOTH / You / Adjutant).
 * // SPEC: _spec/apps/ui/responsiveness/rules.md
 */
import type { StarChessColor } from "@chess-coach/starchess-core";
import type { Component } from "solid-js";
import { For, Show, createMemo, createSignal } from "solid-js";

import { useMatchStore } from "~/app/MatchStoreContext";
import { VisionSwatch } from "~/components/atoms/VisionSwatch";
import { ExitGameConfirm } from "~/components/features/ExitGameConfirm";
import styles from "~/components/features/Sidebar.module.css";
import { Divider } from "~/components/primitives/Divider";
import { IconButton } from "~/components/primitives/IconButton";
import {
  BackArrowIcon,
  FlipBoardIcon,
} from "~/components/primitives/icons";
import { capabilities } from "~/store/capabilitiesStore";
import {
  reviewVisionFilter,
  setReviewVisionFilter,
} from "~/store/reviewVisionStore";
import type { ReviewVisionFilter } from "~/types/board";

const opposite = (c: StarChessColor): StarChessColor => (c === "w" ? "b" : "w");

type VisionOption = {
  value: ReviewVisionFilter;
  label: string;
  swatch: "both" | "w" | "b";
  aria: string;
};

export type SidebarProps = {
  /** Prefer SPA return to menu when set; otherwise navigate to `/`. */
  onHome?: () => void;
};

export const Sidebar: Component<SidebarProps> = (props) => {
  const store = useMatchStore();
  const [exitOpen, setExitOpen] = createSignal(false);

  const flip = () => {
    const v = store.state().viewer;
    store.dispatch({ type: "SET_VIEWER", viewer: v === "w" ? "b" : "w" });
  };

  /** Active live match — leaving discards the session. */
  const liveMatch = () => {
    const phase = store.state().phase;
    return phase === "planning" || phase === "targeting" || phase === "resolving";
  };

  const reviewing = () => store.state().phase === "gameOver";

  const playerColor = () => store.state().playerColor;

  const visionOptions = createMemo((): VisionOption[] => {
    const you = playerColor();
    const adj = opposite(you);
    return [
      {
        value: "both",
        label: "Both",
        swatch: "both",
        aria: "Both — full board",
      },
      {
        value: you,
        label: "You",
        swatch: you,
        aria: `You — ${you === "w" ? "blue" : "red"} vision`,
      },
      {
        value: adj,
        label: "Adjutant",
        swatch: adj,
        aria: `Adjutant — ${adj === "w" ? "blue" : "red"} vision`,
      },
    ];
  });

  const selectVision = (v: ReviewVisionFilter) => {
    setReviewVisionFilter(v);
    if (v === "w" || v === "b") {
      store.dispatch({ type: "SET_VIEWER", viewer: v });
    }
  };

  const goHome = () => {
    if (props.onHome) {
      props.onHome();
      return;
    }
    const base = import.meta.env.BASE_URL || "/";
    window.location.assign(base);
  };

  const requestHome = () => {
    if (liveMatch()) {
      setExitOpen(true);
      return;
    }
    goHome();
  };

  const confirmLeave = () => {
    setExitOpen(false);
    goHome();
  };

  return (
    <div class={styles.sidebar} data-testid="starchess-sidebar">
      <div class={styles.tool}>
        <span class={styles.toolLabel}>Home</span>
        <IconButton onClick={requestHome} aria-label="Home">
          <BackArrowIcon />
        </IconButton>
      </div>

      <Show when={reviewing()}>
        <div
          class={styles.visionGroup}
          role="radiogroup"
          aria-label="Review vision"
          data-testid="review-vision-filter"
        >
          <For each={visionOptions()}>
            {(opt) => (
              <VisionSwatch
                value={opt.value}
                label={opt.label}
                swatch={opt.swatch}
                ariaLabel={opt.aria}
                selected={reviewVisionFilter() === opt.value}
                onSelect={() => selectVision(opt.value)}
              />
            )}
          </For>
        </div>
      </Show>

      <Show when={capabilities().flipBoard}>
        <Divider class={styles.divider} />
        <div class={styles.tool}>
          <span class={styles.toolLabel}>Flip</span>
          <IconButton onClick={flip} aria-label="Flip board">
            <FlipBoardIcon />
          </IconButton>
        </div>
      </Show>

      <ExitGameConfirm
        open={exitOpen()}
        onClose={() => setExitOpen(false)}
        onConfirm={confirmLeave}
      />
    </div>
  );
};
