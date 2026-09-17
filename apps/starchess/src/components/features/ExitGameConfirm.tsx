// SPEC: _spec/apps/starchess/menu-flow.puml, _spec/_plans/forfeit-as-loss.puml
/**
 * Confirm leaving a live StarChess match — NeonModal + neon Buttons.
 */
import type { Component } from "solid-js";

import { NeonModal } from "~/components/atoms/NeonModal";
import styles from "~/components/features/ExitGameConfirm.module.css";
import { Button } from "~/components/primitives/Button";

export type ExitGameConfirmProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export const ExitGameConfirm: Component<ExitGameConfirmProps> = (props) => (
  <NeonModal
    open={props.open}
    onClose={props.onClose}
    title="Leave Match"
    position="fixed"
    size="md"
  >
    <div class={styles.body} data-testid="exit-game-confirm">
      <p class={styles.copy}>By leaving this match the progress will be lost</p>
      <div class={styles.actions}>
        <Button
          variant="neon"
          onClick={() => props.onClose()}
          data-testid="exit-game-stay"
        >
          Stay
        </Button>
        <Button
          variant="neon"
          primary
          onClick={() => props.onConfirm()}
          data-testid="exit-game-leave"
        >
          Leave
        </Button>
      </div>
    </div>
  </NeonModal>
);
