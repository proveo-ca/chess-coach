/**
 * Static SCFEN fog vision sample — siege rook (immobile, 9×9).
 * Stories feed SCFEN only; no DualNav / combat.
 * // SPEC: _spec/apps/ui/starchess/starchess-mode.puml
 */

import { onCleanup, onMount, type Component } from "solid-js";
import type { Square } from "chess.js";

import styles from "~/starchess/animations/PathCollideDemo.module.css";
import { classicFenFromSc, parseScFen } from "~/starchess/scfen";
import {
  clearSiegedRooks,
  setPlanningSnapshot,
  setRookMode,
} from "~/starchess/starChessStore";
import { StarChessBoard } from "~/starchess/StarChessBoard";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/starchess/capabilities";
import { loadFen } from "~/store/gameStore";
import { setActivePlayerColor, setPlayerIdentity } from "~/store/settingsStore";
import { setNerdModeUnlocked } from "~/starchess/identity";

/** Rd4 siege; Ka1; kh8 — vision sample only. */
export const FOG_SIEGE_ROOK_SCFEN =
  "SCFEN|7k/8/8/8/3R4/8/8/K7|0|33|P|G:11:11|Q:w:;b:";

export type FogVisionDemoProps = {
  scfen: string;
  caption: string;
  /** Apply rook mode to every rook in the snap (siege / tank). */
  rookMode?: "siege" | "tank";
};

/**
 * Present one SCFEN snap under fog — no queue / resolve.
 */
export const FogVisionDemo: Component<FogVisionDemoProps> = (props) => {
  onMount(() => {
    setStorybookCapabilities(NERD_CAPABILITIES);
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
    const snap = parseScFen(props.scfen);
    clearSiegedRooks();
    setPlanningSnapshot(snap);
    loadFen(classicFenFromSc(snap, "w"));
    if (props.rookMode) {
      const files = "abcdefgh";
      const ranks = snap.placement.split("/");
      for (let r = 0; r < 8; r++) {
        let file = 0;
        for (const ch of ranks[r]!) {
          if (ch >= "1" && ch <= "8") {
            file += Number(ch);
            continue;
          }
          if (ch === "R" || ch === "r") {
            setRookMode(`${files[file]}${8 - r}` as Square, props.rookMode);
          }
          file += 1;
        }
      }
    }
  });

  onCleanup(() => {
    clearSiegedRooks();
    setPlanningSnapshot(null);
  });

  return (
    <div class={styles.demo}>
      <div class={styles.host}>
        <StarChessBoard variant="eclipse" fogOfWar />
      </div>
      <p class={styles.caption}>{props.caption}</p>
    </div>
  );
};
