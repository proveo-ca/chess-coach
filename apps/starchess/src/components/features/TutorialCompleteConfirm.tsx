/**
 * Congrats after King Hunt (live) win — mark tutorial cleared and return home.
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 */
import type { Component } from "solid-js";

import { NeonModal } from "~/components/atoms/NeonModal";
import styles from "~/components/features/TutorialCompleteConfirm.module.css";
import { Button } from "~/components/primitives/Button";

export type TutorialCompleteConfirmProps = {
  open: boolean;
  onGoHome: () => void;
};

export const TutorialCompleteConfirm: Component<TutorialCompleteConfirmProps> = (props) => (
  <NeonModal
    open={props.open}
    title="Tutorial"
    position="fixed"
    size="md"
    dismissible={false}
    showCloseButton={false}
  >
    <div class={styles.body} data-testid="tutorial-complete-confirm">
      <p class={styles.copy}>You have finished all the lessons, congratulations!</p>
      <div class={styles.actions}>
        <Button
          variant="neon"
          primary
          onClick={() => props.onGoHome()}
          data-testid="tutorial-complete-go-home"
        >
          play single player
        </Button>
      </div>
    </div>
  </NeonModal>
);
