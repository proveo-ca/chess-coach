/**
 * Static SCFEN board frame — maps gallery / open-board samples.
 * No match store, DualNav, or resolve.
 * // SPEC: _spec/apps/ui/starchess/demos.puml
 */
import type { Component } from "solid-js";
import { createMemo } from "solid-js";

import { parseScFen } from "@chess-coach/starchess-core";

import { AnimationStage } from "~/presentation/animations/AnimationStage";
import type { BoardVariant, VisionMode } from "~/presentation/board/EclipseBoard";

export type StaticScfenBoardProps = {
  scfen: string;
  boardVariant?: BoardVariant;
  fog?: boolean;
  visionMode?: VisionMode;
  viewer?: "w" | "b";
  /** Optional width wrapper (Board stories). */
  width?: string;
};

export const StaticScfenBoard: Component<StaticScfenBoardProps> = (props) => {
  const snap = createMemo(() => parseScFen(props.scfen));
  const mode = () => props.visionMode ?? (props.fog === false ? "observer" : "player");
  return (
    <div style={{ width: props.width, "max-width": "100%" }}>
      <AnimationStage
        snapshot={snap()}
        viewer={props.viewer ?? "w"}
        fog={mode() === "observer" ? false : props.fog !== false}
        visionMode={mode()}
        variant={props.boardVariant ?? "eclipse"}
      />
    </div>
  );
};
