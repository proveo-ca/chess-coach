// SPEC: _spec/apps/chess/responsiveness/rules.md, _spec/apps/starchess/architecture/board-entities.puml
/**
 * Terrain gallery board — Screen grid + static SCFEN (no match store).
 */
import type { Component } from "solid-js";
import { createMemo } from "solid-js";

import { parseScFen } from "@chess-coach/starchess-core";

import { Label } from "@chess-coach/ui-web/primitives/Label";
import { Screen } from "@chess-coach/ui-web/primitives/Screen";
import { AnimationStage } from "~/presentation/animations/components/AnimationStage";
import type { BoardVariant } from "~/types/board";
import { mapSample } from "~/demos/samples";

const VARIANT_LABEL: Record<BoardVariant, string> = {
  eclipse: "Eclipse",
  butter: "Butter",
  vermeer: "Vermeer",
};

export type MapScreenProps = {
  boardVariant: BoardVariant;
};

export const MapScreen: Component<MapScreenProps> = (props) => {
  const fixture = () => mapSample(props.boardVariant);
  const snap = createMemo(() => parseScFen(fixture().scfen));
  const mode = () => fixture().visionMode;

  return (
    <Screen>
      <Screen.SidebarInset>
        <Label variant="title">Map · {VARIANT_LABEL[props.boardVariant]}</Label>
      </Screen.SidebarInset>
      <Screen.BoardArea>
        <Screen.BoardColumn>
          <AnimationStage
            snapshot={snap()}
            viewer="w"
            fog={mode() === "observer" ? false : fixture().fog !== false}
            visionMode={mode()}
            variant={props.boardVariant}
          />
        </Screen.BoardColumn>
      </Screen.BoardArea>
      <Screen.Footer>
        <p
          style={{
            margin: 0,
            "font-size": "12px",
            color: "#6a7564",
            "font-family":
              '"IBM Plex Sans", "Segoe UI", sans-serif',
          }}
        >
          Terrain · {VARIANT_LABEL[props.boardVariant]} · observer · no fog
        </p>
      </Screen.Footer>
    </Screen>
  );
};
