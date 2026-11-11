// SPEC: _spec/packages/starchess-core/resolve.puml, _spec/apps/starchess/architecture/board-entities.puml
/**
 * Resolve VFX — vespene canister falls from the top of the square into the unit.
 */
import { For, type Component } from "solid-js";

import { syncToClock } from "~/presentation/animations/clockSync";
import { GAS_DROP_MS } from "~/presentation/animations/gasDrop";
import styles from "~/presentation/animations/components/GasDropAnimation.module.css";
import { squareBoxStyle } from "~/presentation/animations/boardGeom";
import { VespeneIcon } from "@chess-coach/ui-web/primitives/icons";
import type { GasDropCue } from "~/presentation/types";

/** Same green as ResourceBar / GasDeploy rack — absorb is not team-tinted. */
const VESPENE_GREEN = "#2a9b6a";

export type GasDropAnimationProps = {
  cues: readonly GasDropCue[];
  boardWidth: number;
  boardHeight: number;
};

/**
 * One short absorb per gas special: canister drops from the top edge
 * (left / mid / right) into the piece, green aura eases in underneath.
 */
export const GasDropAnimation: Component<GasDropAnimationProps> = (props) => (
  <div
    class={styles.boardOverlay}
    data-starchess-gas-drop-layer
    style={{
      inset: "0",
      width: "100%",
      height: "100%",
      "--gas-drop-ms": `${GAS_DROP_MS}ms`,
    }}
  >
    <For each={props.cues}>
      {(cue) => (
        <div
          ref={(el) => syncToClock(el)}
          class={styles.slot}
          style={squareBoxStyle(cue.at, props.boardWidth, props.boardHeight)}
          data-square={cue.at}
          data-gas-drop={cue.corner}
          data-gas-drop-id={cue.id}
        >
          <div class={styles.aura} aria-hidden="true" />
          <div
            class={styles.canister}
            style={{ color: VESPENE_GREEN }}
            aria-hidden="true"
          >
            <div class={styles.canisterShadow} />
            <VespeneIcon size={32} />
          </div>
        </div>
      )}
    </For>
  </div>
);
