import { Show, createEffect, createSignal, onMount } from "solid-js";
import type { Component } from "solid-js";
import type { RouteSectionProps } from "@solidjs/router";
import { Chess, type Square } from "chess.js";

import { StarChessChessBoard } from "~/starchess/StarChessChessBoard";
import {
  clearSiegedRooks,
  resetStarChessEconomy,
  setRookMode,
} from "~/starchess/starChessStore";
import { ResourceBar } from "~/starchess/primitives/ResourceBar";
import { TurnBar } from "~/starchess/primitives/TurnBar";
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
import type { RookMode } from "~/types/starchess";
import type { NerdBoardVariant } from "~/types/ui";

type NerdScreenProps = Partial<RouteSectionProps> & {
  boardVariant?: NerdBoardVariant;
  startingFen?: string;
  /**
   * StarChess ruleset (default true on `/starchess`).
   * When on, fog of war is **always** enabled — not overridable.
   * Maps / terrain gallery sets `false` to preview boards without fog.
   */
  starChessMode?: boolean;
  /**
   * Storybook seed: force every rook on the starting FEN into this mode
   * (writes {@link setRookMode} / clears siege state).
   */
  rookMode?: RookMode;
};

export const NerdScreen: Component<NerdScreenProps> = (props) => {
  const starChessMode = () => props.starChessMode ?? true;
  /** Non-negotiable: StarChess / Nerd gameplay always has cumulative fog. */
  const fogOfWar = () => starChessMode();
  const [status, setStatus] = createSignal("Plan a special and/or move · End to submit");

  onMount(() => {
    setCapabilities(NERD_CAPABILITIES);
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
    if (starChessMode()) {
      resetStarChessEconomy({
        turn: 1,
        white: { stored: 12, deployed: 1 },
        black: { stored: 12, deployed: 1 },
      });
    }
  });

  // Storybook reuses this screen across fog variants — reload when FEN / mode changes.
  createEffect(() => {
    const fen = props.startingFen ?? NERD_STARTING_FEN;
    loadFen(fen);
    clearSiegedRooks();
    if (props.rookMode === "siege") {
      const g = new Chess(fen);
      for (const row of g.board()) {
        for (const cell of row) {
          if (cell?.type === "r") setRookMode(cell.square as Square, "siege");
        }
      }
    }
  });

  const submitTurn = (reason: "end" | "timeout") => {
    setStatus(reason === "timeout" ? "Turn locked — time up" : "Turn submitted");
    // Full resolveTurn wiring lands with starChessStore planning lock.
  };

  return (
    <Screen>
      <Screen.BoardArea>
        <Screen.BoardColumn>
          <div class={styles.header}>
            <Button href="/">Back</Button>
            <div>
              <Label variant="title">StarChess</Label>
              <p class={styles.matchup}>Nerd vs Selena</p>
            </div>
          </div>
          <Show when={starChessMode()}>
            <div class={styles.topChrome} data-testid="nerd-board-chrome">
              <ResourceBar />
              <TurnBar
                resolveOnEnd={false}
                onEnd={() => submitTurn("end")}
                onTimeout={() => submitTurn("timeout")}
              />
            </div>
          </Show>
          <StarChessChessBoard
            variant={props.boardVariant ?? "eclipse"}
            fogOfWar={fogOfWar()}
          />
          <Show
            when={starChessMode()}
            fallback={<p class={styles.placeholder}>Nerd mode is awakening…</p>}
          >
            <p class={styles.placeholder}>{status()}</p>
          </Show>
        </Screen.BoardColumn>
      </Screen.BoardArea>
    </Screen>
  );
};
