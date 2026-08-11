/**
 * First Single Player click when tutorial is uncleared —
 * "Show me" → tutorial · "Yolo" → NewGamePanel.
 * // SPEC: _spec/apps/starchess/menu-flow.puml
 */
import type { Component } from "solid-js";

import { NeonModal } from "~/components/atoms/NeonModal";
import styles from "~/components/features/FirstTimePrompt.module.css";
import { Button } from "~/components/primitives/Button";

export type FirstTimePromptProps = {
  open: boolean;
  onClose: () => void;
  /** Navigate into the tutorial. */
  onShowMe: () => void;
  /** Skip tutorial → open New Game setup. */
  onYolo: () => void;
};

export const FirstTimePrompt: Component<FirstTimePromptProps> = (props) => (
  <NeonModal
    open={props.open}
    onClose={props.onClose}
    title="First time?"
    position="fixed"
    size="md"
  >
    <div class={styles.body} data-testid="first-time-prompt">
      <p class={styles.copy}>I can get you up to speed</p>
      <div class={styles.actions}>
        <Button
          variant="neon"
          primary
          onClick={() => props.onShowMe()}
          data-testid="first-time-show-me"
        >
          Show me
        </Button>
        <Button
          variant="neon"
          onClick={() => props.onYolo()}
          data-testid="first-time-yolo"
        >
          Yolo
        </Button>
      </div>
    </div>
  </NeonModal>
);
