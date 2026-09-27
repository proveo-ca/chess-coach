// SPEC: _spec/apps/starchess/demos.puml, _spec/apps/starchess/architecture/board-entities.puml, _spec/apps/starchess/architecture/reactivity/presentation.md
/**
 * Static SCFEN board frame — maps gallery / open-board samples.
 * Always mounts on Screen grid (top · board · footer). No match store / DualNav.
 */
import type { Component } from "solid-js";
import { createMemo } from "solid-js";

import { parseScFen } from "@chess-coach/starchess-core";

import { Screen } from "@chess-coach/ui-web/primitives/Screen";
import { AnimationStage } from "~/presentation/animations/components/AnimationStage";
import type { BoardVariant, VisionMode } from "~/types/board";

export type StaticScfenBoardProps = {
  scfen: string;
  boardVariant?: BoardVariant;
  fog?: boolean;
  visionMode?: VisionMode;
  viewer?: "w" | "b";
  /** Optional caption in Screen.Footer. */
  caption?: string;
};

export const StaticScfenBoard: Component<StaticScfenBoardProps> = (props) => {
  const snap = createMemo(() => parseScFen(props.scfen));
  const mode = () => props.visionMode ?? (props.fog === false ? "observer" : "player");
  const fog = createMemo(() => (mode() === "observer" ? false : props.fog !== false));
  return (
    <Screen>
      <Screen.SidebarInset />
      <Screen.BoardArea>
        <Screen.BoardColumn>
          <AnimationStage
            snapshot={snap()}
            viewer={props.viewer ?? "w"}
            fog={fog()}
            visionMode={mode()}
            variant={props.boardVariant ?? "eclipse"}
          />
        </Screen.BoardColumn>
      </Screen.BoardArea>
      <Screen.Footer>
        <p style={{ margin: 0, "font-size": "12px", color: "#6a7564" }}>
          {props.caption ?? ""}
        </p>
      </Screen.Footer>
    </Screen>
  );
};
