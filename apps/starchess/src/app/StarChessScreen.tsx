import { onCleanup, onMount } from "solid-js";
import type { Component } from "solid-js";

import { useMatchStore } from "~/app/MatchStoreContext";
import { StarChessBoard } from "~/presentation/board/StarChessBoard";
import { MatchHud } from "~/presentation/hud/MatchHud";
import styles from "~/app/StarChessScreen.module.css";

export type StarChessScreenProps = {
  /** When false, skip fog overlay (maps / harness). Default true. */
  fog?: boolean;
  /** Auto-arm planning timer on mount. */
  armTimer?: boolean;
};

export const StarChessScreen: Component<StarChessScreenProps> = (props) => {
  const store = useMatchStore();

  onMount(() => {
    if (props.armTimer !== false && store.state().phase === "planning") {
      store.armTimer();
    }
  });

  onCleanup(() => store.cancelEffects());

  return (
    <div class={styles.screen}>
      <MatchHud />
      <main class={styles.main}>
        <StarChessBoard fog={props.fog} />
      </main>
    </div>
  );
};
