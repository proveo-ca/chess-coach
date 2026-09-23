// SPEC: _spec/_plans/chess-ui-primitives.puml
import type { Component } from "solid-js";

import styles from "./HistoryOverlay.module.css";

export interface HistoryOverlayProps {
  active: boolean;
}

export const HistoryOverlay: Component<HistoryOverlayProps> = (props) => {
  return <div class={styles["history-overlay"]} classList={{ [styles.active]: props.active }} />;
};
