import { onMount } from "solid-js";
import type { Component } from "solid-js";

import { ChessBoard } from "~/components/features/ChessBoard";
import { Button } from "~/components/primitives/Button";
import { Label } from "~/components/primitives/Label";
import { Screen } from "~/components/primitives/Screen";
import { NERD_STARTING_FEN } from "~/data/nerdMode";
import styles from "~/screens/NerdScreen.module.css";
import { NERD_CAPABILITIES, setCapabilities } from "~/store/capabilitiesStore";
import { loadFen } from "~/store/gameStore";
import { setNerdModeUnlocked, setPlayerIdentity } from "~/store/settingsStore";
import type { NerdBoardVariant } from "~/types/ui";

export const NerdScreen: Component<{ boardVariant?: NerdBoardVariant }> = (props) => {
  onMount(() => {
    setCapabilities(NERD_CAPABILITIES);
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    loadFen(NERD_STARTING_FEN);
  });

  return (
    <Screen>
      <Screen.BoardArea>
        <Screen.BoardColumn>
          <div class={styles.header}>
            <Button href="/">Back</Button>
            <div>
              <Label variant="title">Brood War</Label>
              <p class={styles.matchup}>Nerd vs Selena</p>
            </div>
          </div>
          <ChessBoard variant={props.boardVariant ?? "eclipse"} />
          <p class={styles.placeholder}>Nerd mode is awakening…</p>
        </Screen.BoardColumn>
      </Screen.BoardArea>
    </Screen>
  );
};
