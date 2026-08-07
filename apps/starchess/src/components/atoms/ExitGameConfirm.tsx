/**
 * Confirm leaving a live StarChess match — Credits / Brood War neon chrome.
 */
import type { Component } from "solid-js";

import styles from "~/components/atoms/ExitGameConfirm.module.css";
import { Modal } from "~/components/atoms/Modal";
import { Button } from "~/components/primitives/Button";

export type ExitGameConfirmProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export const ExitGameConfirm: Component<ExitGameConfirmProps> = (props) => (
  <Modal
    open={props.open}
    onClose={props.onClose}
    title="Leave Match"
    position="fixed"
    overlayClass={styles.overlay}
    contentClass={styles.panel}
  >
    <div class={styles.body} data-testid="exit-game-confirm">
      <p class={styles.copy}>
        Leave this live game and return to the menu? Progress on this match will
        be lost.
      </p>
      <div class={styles.actions}>
        <Button
          class={styles.secondary}
          onClick={() => props.onClose()}
          data-testid="exit-game-stay"
        >
          Stay
        </Button>
        <Button
          class={styles.primary}
          primary
          onClick={() => props.onConfirm()}
          data-testid="exit-game-leave"
        >
          Leave
        </Button>
      </div>
    </div>
  </Modal>
);
