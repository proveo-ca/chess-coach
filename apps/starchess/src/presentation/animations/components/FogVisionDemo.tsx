/**
 * Static SCFEN fog vision sample — siege rook (immobile, 9×9).
 * Always on Screen grid. Stories feed SCFEN only; no DualNav / combat.
 */
import { createMemo, onCleanup, onMount, type Component } from "solid-js";
import type { Square } from "chess.js";

import { parseScFen, placementToMap } from "@chess-coach/starchess-core";

import { Screen } from "@chess-coach/ui-web/primitives/Screen";
import { AnimationStage } from "~/presentation/animations/components/AnimationStage";
import styles from "~/presentation/animations/components/FogVisionDemo.module.css";
import {
  clearSiegedRooks,
  setRookMode,
} from "~/presentation/animations/rookModeStore";

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
  const snap = createMemo(() => parseScFen(props.scfen));

  const applyRookModes = () => {
    clearSiegedRooks();
    if (!props.rookMode) return;
    const map = placementToMap(snap().placement);
    for (const [sq, piece] of map) {
      if (piece.type === "r") setRookMode(sq as Square, props.rookMode);
    }
  };

  onMount(() => {
    applyRookModes();
  });

  onCleanup(() => {
    clearSiegedRooks();
  });

  const sieged = createMemo((): Square[] => {
    if (props.rookMode === "siege") {
      const out: Square[] = [];
      const map = placementToMap(snap().placement);
      for (const [sq, piece] of map) {
        if (piece.type === "r") out.push(sq as Square);
      }
      return out;
    }
    return [...(snap().siegedRooks ?? [])];
  });

  return (
    <Screen>
      <Screen.SidebarInset />
      <Screen.BoardArea>
        <Screen.BoardColumn>
          <div class={styles.host}>
            <AnimationStage
              snapshot={{ ...snap(), siegedRooks: sieged() }}
              viewer="w"
              fog
              variant="eclipse"
            />
          </div>
        </Screen.BoardColumn>
      </Screen.BoardArea>
      <Screen.Footer>
        <p class={styles.caption}>{props.caption}</p>
      </Screen.Footer>
    </Screen>
  );
};
