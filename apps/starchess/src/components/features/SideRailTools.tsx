/**
 * Home, vision, and flip tools rendered inside BoardSideRail.
 * Live Home asks for confirmation before leaving; review exposes vision radios.
 * // SPEC: _spec/apps/starchess/screens.puml
 * // SPEC: _spec/apps/ui/responsiveness/rules.md
 */
import type { StarChessColor } from "@chess-coach/starchess-core";
import type { Component } from "solid-js";
import { For, Show, createMemo, createSignal } from "solid-js";

import { useMatchStore } from "~/app/MatchStoreContext";
import { VisionSwatch } from "~/components/atoms/VisionSwatch";
import { formatScriptLabel } from "~/utils/matchTitle";
import type { MatchState } from "~/types/match";
import { ExitGameConfirm } from "~/components/features/ExitGameConfirm";
import styles from "~/components/features/SideRailTools.module.css";
import { Divider } from "~/components/primitives/Divider";
import { IconButton } from "~/components/primitives/IconButton";
import { BackArrowIcon, FlipBoardIcon } from "~/components/primitives/icons";
import { capabilities } from "~/store/capabilitiesStore";
import { reviewVisionFilter, setReviewVisionFilter } from "~/store/reviewVisionStore";
import type { ReviewVisionFilter } from "~/types/board";

const opposite = (c: StarChessColor): StarChessColor => (c === "w" ? "b" : "w");

type VisionOption = {
  value: ReviewVisionFilter;
  label: string;
  swatch: "both" | "w" | "b";
  aria: string;
};

export type SideRailToolsProps = {
  /** Prefer SPA return to menu when set; otherwise navigate to `/`. */
  onHome?: () => void;
};

export const SideRailTools: Component<SideRailToolsProps> = (props) => {
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
  const arenaPlayers = () =>
    (store.state() as MatchState & { arenaPlayers?: { w: string; b: string } }).arenaPlayers;

  const visionOptions = createMemo((): VisionOption[] => {
    const you = playerColor();
    const adj = opposite(you);
    const ap = arenaPlayers();
    if (ap) {
      return [
        {
          value: "both",
          label: "Both",
          swatch: "both",
          aria: "Both — full board",
        },
        {
          value: you,
          label: formatScriptLabel(ap[you]),
          swatch: you,
          aria: `${formatScriptLabel(ap[you])} — ${you === "w" ? "blue" : "red"} vision`,
        },
        {
          value: adj,
          label: formatScriptLabel(ap[adj]),
          swatch: adj,
          aria: `${formatScriptLabel(ap[adj])} — ${adj === "w" ? "blue" : "red"} vision`,
        },
      ];
    }
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

      <Show when={reviewing() && !capabilities().homeOnly}>
        <div
          class={styles.visionGroup}
          role="group"
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

      <Show when={capabilities().flipBoard && !capabilities().homeOnly}>
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
