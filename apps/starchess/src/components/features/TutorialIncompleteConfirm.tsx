/**
 * Warn when finishing King Hunt (live) while tutorialCleared is still false.
 */
import type { Component } from "solid-js";

import { NeonModal } from "~/components/atoms/NeonModal";
import styles from "~/components/features/ExitGameConfirm.module.css";
import { Button } from "~/components/primitives/Button";

export type TutorialIncompleteConfirmProps = {
  open: boolean;
  onNo: () => void;
  onYes: () => void;
};

export const TutorialIncompleteConfirm: Component<
  TutorialIncompleteConfirmProps
> = (props) => (
  <NeonModal
    open={props.open}
    onClose={props.onNo}
    title="Tutorial"
    position="fixed"
    size="md"
    dismissible={false}
    showCloseButton={false}
  >
    <div class={styles.body} data-testid="tutorial-incomplete-confirm">
      <p class={styles.copy}>
        You have not completed the tutorial yet. Proceed?
      </p>
      <div class={styles.actions}>
        <Button
          variant="neon"
          onClick={() => props.onNo()}
          data-testid="tutorial-incomplete-no"
        >
          No
        </Button>
        <Button
          variant="neon"
          primary
          onClick={() => props.onYes()}
          data-testid="tutorial-incomplete-yes"
        >
          Yes
        </Button>
      </div>
    </div>
  </NeonModal>
);
