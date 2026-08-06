/**
 * Spider Mine fog harness — presents an SCFEN snap (M: vision), no combat logic.
 */
import { createMemo, type Component } from "solid-js";

import { parseScFen } from "@chess-coach/starchess-core";

import { AnimationStage } from "~/presentation/animations/AnimationStage";
import styles from "~/presentation/animations/SpiderMineFogDemo.module.css";

/** Owner-side white mine on a4; king on e1 cannot see a4 without the mine. */
const FOG_MINE_SCFEN =
  "SCFEN|7k/8/8/8/8/8/8/4K3|0|33|P|G:11:11|M:w:a4|Q:w:;b:";

/**
 * Storybook: SCFEN `M:` + fog — no hand-rolled cues.
 */
export const SpiderMineFogDemo: Component = () => {
  const snap = createMemo(() => parseScFen(FOG_MINE_SCFEN));

  return (
    <div class={styles.demo}>
      <div class={styles.host}>
        <AnimationStage snapshot={snap()} viewer="w" fog variant="eclipse" />
      </div>
      <p class={styles.caption}>Fog · SCFEN M:w:a4 · own-square vision only</p>
    </div>
  );
};
