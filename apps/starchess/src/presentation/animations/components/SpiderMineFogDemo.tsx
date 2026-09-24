/**
 * Spider Mine fog harness — presents an SCFEN snap (M: vision), no combat logic.
 * Always on Screen grid.
 */
import { createMemo, Show, type Component } from "solid-js";

import { parseScFen } from "@chess-coach/starchess-core";

import { Screen } from "~/components/primitives/Screen";
import { AnimationStage } from "~/presentation/animations/components/AnimationStage";
import styles from "~/presentation/animations/components/SpiderMineFogDemo.module.css";
import type { BoardSkin, PieceSet } from "~/types/board";

/** Owner-side white mine on a4; Command Center on e1 cannot see a4 without the mine. */
const FOG_MINE_SCFEN =
  "SCFEN|7k/8/8/8/8/8/8/4K3|0|33|P|G:11:11|M:w:a4|Q:w:;b:";

/**
 * Storybook: SCFEN `M:` + fog — no hand-rolled cues.
 */
export const SpiderMineFogDemo: Component<{
  variant?: BoardSkin;
  pieceSet?: PieceSet;
  header?: import("solid-js").JSX.Element;
  footerExtra?: import("solid-js").JSX.Element;
  sidebar?: import("solid-js").JSX.Element;
}> = (props) => {
  const snap = createMemo(() => parseScFen(FOG_MINE_SCFEN));

  return (
    <Screen>
      <Show when={props.header} fallback={<Screen.SidebarInset />}>
        <Screen.Header>{props.header}</Screen.Header>
      </Show>
      <Screen.BoardArea>
        <Screen.BoardColumn>
          <div class={styles.host}>
            <AnimationStage
              snapshot={snap()}
              viewer="w"
              fog
              variant={props.variant ?? "eclipse"}
              pieceSet={props.pieceSet}
            />
          </div>
        </Screen.BoardColumn>
        <Show when={props.sidebar}>{props.sidebar}</Show>
      </Screen.BoardArea>
      <Screen.Footer>
        <Show when={props.footerExtra}>{props.footerExtra}</Show>
        <p class={styles.caption}>Fog · SCFEN M:w:a4 · own-square vision only</p>
      </Screen.Footer>
    </Screen>
  );
};
