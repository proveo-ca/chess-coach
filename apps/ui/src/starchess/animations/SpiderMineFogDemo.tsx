/**
 * Spider Mine fog harness — presents an SCFEN snap (M: vision), no combat logic.
 */

import { createSignal, onCleanup, onMount, type Component } from "solid-js";

import styles from "~/starchess/animations/SpiderMineFogDemo.module.css";
import { classicFenFromSc, parseScFen } from "~/starchess/scfen";
import { setPlanningSnapshot } from "~/starchess/starChessStore";
import { StarChessChessBoard } from "~/starchess/StarChessChessBoard";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/store/capabilitiesStore";
import type { ScMine } from "~/types/starchess";
import { loadFen } from "~/store/gameStore";
import {
  setActivePlayerColor,
  setNerdModeUnlocked,
  setPlayerIdentity,
} from "~/store/settingsStore";

/** Owner-side white mine on a4; king on e1 cannot see a4 without the mine. */
const FOG_MINE_SCFEN =
  "SCFEN|7k/8/8/8/8/8/8/4K3|0|33|P|G:33:33|M:w:a4|Q:w:;b:";

/**
 * Storybook: SCFEN `M:` + fog — no hand-rolled cues.
 */
export const SpiderMineFogDemo: Component = () => {
  const [mines, setMines] = createSignal<ScMine[]>([]);

  onMount(() => {
    setStorybookCapabilities(NERD_CAPABILITIES);
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
    const snap = parseScFen(FOG_MINE_SCFEN);
    setPlanningSnapshot(snap);
    setMines([...(snap.mines ?? [])]);
    loadFen(classicFenFromSc(snap, "w"));
  });

  onCleanup(() => {
    setPlanningSnapshot(null);
  });

  return (
    <div class={styles.demo}>
      <div class={styles.host}>
        <StarChessChessBoard variant="eclipse" fogOfWar spiderMines={mines()} />
      </div>
      <p class={styles.caption}>Fog · SCFEN M:w:a4 · own-square vision only</p>
    </div>
  );
};
