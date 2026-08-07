/**
 * Right-rail tools — CoachScreen Sidebar layout, StarChess actions.
 * Labels live in this module (not IconButton) so contrast is guaranteed.
 * Live Home asks for confirm before leaving (Credits-style modal).
 * // SPEC: _spec/apps/ui/responsiveness/rules.md
 */
import type { Component } from "solid-js";
import { Show, createSignal } from "solid-js";

import { useMatchStore } from "~/app/MatchStoreContext";
import { ExitGameConfirm } from "~/components/atoms/ExitGameConfirm";
import styles from "~/components/features/Sidebar.module.css";
import { Divider } from "~/components/primitives/Divider";
import { IconButton } from "~/components/primitives/IconButton";
import {
  BackArrowIcon,
  FlipBoardIcon,
} from "~/components/primitives/icons";
import { capabilities } from "~/store/capabilitiesStore";

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
