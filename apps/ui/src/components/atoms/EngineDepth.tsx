// SPEC: _spec/apps/ui/components.puml
import type { Component } from "solid-js";

import styles from "~/components/atoms/EngineDepth.module.css";
import { baseEvalDepth } from "~/store/evalStore";

const THREADING = __STOCKFISH_VARIANT__.endsWith("-single") ? "single-thread" : "multi-thread";

/**
 * Live Stockfish search depth behind the on-board best-move (green) and advice
 * (blue) arrows: the centre slot of the Analysis / Review mobile sidebar, and
 * the same slot in the desktop Sidebar (Analysis + Review `/:id`). The ring is
 * split green→blue to tie it to those arrows.
 */
export const EngineDepth: Component = () => (
  <span
    class={styles.depth}
    data-testid="engine-depth"
    title={`Stockfish (WASM, ${THREADING}) analysis depth: ${baseEvalDepth() || "–"}`}
  >
    <span class={styles.num} data-testid="engine-depth-value">
      {baseEvalDepth() || "–"}
    </span>
    <span class={styles.label}>depth</span>
  </span>
);
