import { Show, createEffect, createSignal, onMount } from "solid-js";
import type { Component } from "solid-js";
import type { RouteSectionProps } from "@solidjs/router";

import { BroodWarChessBoard } from "~/broodwar/BroodWarChessBoard";
import { resetBroodWarEconomy } from "~/broodwar/broodWarStore";
import { ResourceBar } from "~/broodwar/primitives/ResourceBar";
import { TurnBar } from "~/broodwar/primitives/TurnBar";
import { Button } from "~/components/primitives/Button";
import { Label } from "~/components/primitives/Label";
import { Screen } from "~/components/primitives/Screen";
import { NERD_STARTING_FEN } from "~/data/nerdMode";
import styles from "~/screens/NerdScreen.module.css";
import { NERD_CAPABILITIES, setCapabilities } from "~/store/capabilitiesStore";
import { loadFen } from "~/store/gameStore";
import {
  setActivePlayerColor,
  setNerdModeUnlocked,
  setPlayerIdentity,
} from "~/store/settingsStore";
import type { NerdBoardVariant } from "~/types/ui";

type NerdScreenProps = Partial<RouteSectionProps> & {
  boardVariant?: NerdBoardVariant;
  startingFen?: string;
  /**
   * Brood War ruleset (default true on `/broodwar`).
   * When on, fog of war is **always** enabled — not overridable.
   * Maps / terrain gallery sets `false` to preview boards without fog.
   */
  broodWarMode?: boolean;
};

export const NerdScreen: Component<NerdScreenProps> = (props) => {
  const broodWarMode = () => props.broodWarMode ?? true;
  /** Non-negotiable: Brood War / Nerd gameplay always has cumulative fog. */
  const fogOfWar = () => broodWarMode();
  const [status, setStatus] = createSignal("Plan a special and/or move · End to submit");

  onMount(() => {
    setCapabilities(NERD_CAPABILITIES);
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
    if (broodWarMode()) {
      resetBroodWarEconomy({
        turn: 1,
        white: { stored: 12, deployed: 1 },
        black: { stored: 12, deployed: 1 },
      });
    }
  });

  // Storybook reuses this screen across fog variants — reload when FEN changes.
  createEffect(() => {
    loadFen(props.startingFen ?? NERD_STARTING_FEN);
  });

  const submitTurn = (reason: "end" | "timeout") => {
    setStatus(reason === "timeout" ? "Turn locked — time up" : "Turn submitted");
    // Full resolveTurn wiring lands with broodWarStore planning lock.
  };

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
          <Show when={broodWarMode()}>
            <div class={styles.topChrome} data-testid="nerd-board-chrome">
              <ResourceBar />
              <TurnBar
                onEnd={() => submitTurn("end")}
                onTimeout={() => submitTurn("timeout")}
              />
            </div>
          </Show>
          <BroodWarChessBoard
            variant={props.boardVariant ?? "eclipse"}
            fogOfWar={fogOfWar()}
          />
          <Show
            when={broodWarMode()}
            fallback={<p class={styles.placeholder}>Nerd mode is awakening…</p>}
          >
            <p class={styles.placeholder}>{status()}</p>
          </Show>
        </Screen.BoardColumn>
      </Screen.BoardArea>
    </Screen>
  );
};
