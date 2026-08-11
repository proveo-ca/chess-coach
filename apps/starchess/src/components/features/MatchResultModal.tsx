/**
 * Live match terminal banner — VICTORY / DEFEAT (+ DRAW) with rematch / replay.
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 */
import type { Component } from "solid-js";

import { NeonModal } from "~/components/atoms/NeonModal";
import styles from "~/components/features/MatchResultModal.module.css";
import { Button } from "~/components/primitives/Button";
import type { StarChessMatchResult } from "~/types/review";

export type MatchResultModalProps = {
  open: boolean;
  result: StarChessMatchResult | null;
  onAnotherGame: () => void;
  onReplay: () => void;
};

const headlineFor = (result: StarChessMatchResult | null): string => {
  if (result === "win") return "VICTORY";
  if (result === "loss") return "DEFEAT";
  return "DRAW";
};

export const MatchResultModal: Component<MatchResultModalProps> = (props) => (
  <NeonModal
    open={props.open}
    position="fixed"
    size="md"
    dismissible={false}
    showCloseButton={false}
  >
    <div class={styles.body} data-testid="match-result-modal">
      <p
        class={styles.headline}
        classList={{
          [styles.headlineDefeat]: props.result === "loss",
          [styles.headlineDraw]: props.result === "draw",
        }}
        data-testid="match-result-headline"
        data-result={props.result ?? undefined}
      >
        {headlineFor(props.result)}
      </p>
      <div class={styles.actions}>
        <Button
          variant="neon"
          primary
          onClick={() => props.onAnotherGame()}
          data-testid="match-result-another-game"
        >
          Another Game
        </Button>
        <Button
          variant="neon"
          onClick={() => props.onReplay()}
          data-testid="match-result-replay"
        >
          Replay
        </Button>
      </div>
    </div>
  </NeonModal>
);
