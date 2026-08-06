/**
 * Right-rail tools — CoachScreen Sidebar layout, StarChess actions.
 * // SPEC: _spec/apps/ui/responsiveness/rules.md
 */
import type { Component } from "solid-js";
import { Show } from "solid-js";

import { useMatchStore } from "~/app/MatchStoreContext";
import styles from "~/components/features/Sidebar.module.css";
import { Divider } from "~/components/primitives/Divider";
import { IconButton } from "~/components/primitives/IconButton";
import {
  BackArrowIcon,
  FlipBoardIcon,
} from "~/components/primitives/icons";
import { capabilities } from "~/store/capabilitiesStore";

export const Sidebar: Component = () => {
  const store = useMatchStore();

  const flip = () => {
    const v = store.state().viewer;
    store.dispatch({ type: "SET_VIEWER", viewer: v === "w" ? "b" : "w" });
  };

  return (
    <div class={styles.sidebar} data-testid="starchess-sidebar">
      <IconButton label="Home" href="/" aria-label="Home">
        <BackArrowIcon />
      </IconButton>

      <Show when={capabilities().flipBoard}>
        <Divider class={styles.divider} />
        <IconButton label="Flip" onClick={flip} aria-label="Flip board">
          <FlipBoardIcon />
        </IconButton>
      </Show>
    </div>
  );
};
