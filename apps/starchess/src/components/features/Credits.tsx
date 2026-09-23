/**
 * StarChess credits modal — Brood War neon chrome via NeonModal.
 */
import type { Component } from "solid-js";

import { NeonModal } from "@chess-coach/ui-web/atoms/NeonModal";
import styles from "~/components/features/Credits.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

export const Credits: Component<Props> = (props) => (
  <NeonModal
    open={props.open}
    onClose={props.onClose}
    title="Credits"
    position="fixed"
    size="lg"
  >
    <div class={styles.credits}>
      <ul>
        <li>
          <strong>The Cat:</strong> by Johan Mouchet <br />
          <a href="https://codepen.io/johanmouchet" target="_blank" rel="noopener noreferrer">
            codepen.io/johanmouchet
          </a>
        </li>
        <li>
          <strong>Pieces:</strong> Inspired by Carbot Animations <br />
          <a
            href="https://carbotanimations.com/en-cad"
            target="_blank"
            rel="noopener noreferrer"
          >
            carbotanimations.com
          </a>
        </li>
        <li>
          <strong>Engine and Board:</strong> Inspired by StarCraft Brood War <br />
          <a
            href="https://starcraft.blizzard.com/en-us/"
            target="_blank"
            rel="noopener noreferrer"
          >
            starcraft.blizzard.com
          </a>
        </li>
        <li>
          <strong>All running in your browser:</strong> by Roberto von Schoettler <br />
          <a href="https://github.com/proveo-ca" target="_blank" rel="noopener noreferrer">
            github.com/proveo-ca
          </a>
        </li>
      </ul>
    </div>
  </NeonModal>
);
