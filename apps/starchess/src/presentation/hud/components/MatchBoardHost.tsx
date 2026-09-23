// SPEC: _spec/apps/starchess/architecture/bridge-match-board-host.puml, _spec/apps/starchess/screens.puml, _spec/apps/starchess/architecture/screen-entities.puml
/**
 * Structural board row shell — compound regions like {@link Screen}.
 * Chrome assemblers compose Column / BoardHost / Rail; no slot props.
 */
import type { Component, JSX, ParentComponent } from "solid-js";

import { Screen } from "@chess-coach/ui-web/primitives/Screen";
import { BoardSideRail } from "~/presentation/hud/components/BoardSideRail";

type BoardHostProps = {
  class?: string;
  /** Root test id on the board host wrapper. */
  "data-testid"?: string;
  ref?: (el: HTMLDivElement) => void;
  children?: JSX.Element;
};

type RailProps = {
  /** Prefer SPA navigation when leaving the current screen. */
  onHome?: () => void;
  /** Reactive visibility for controls and their divider. */
  controlsVisible?: boolean;
  children?: JSX.Element;
};

/** Row middle: board column + side rail. */
const Root: ParentComponent = (props) => (
  <Screen.BoardArea>{props.children}</Screen.BoardArea>
);

/** Board column within the board row. */
const BoardColumn: ParentComponent = (props) => (
  <Screen.BoardColumn>{props.children}</Screen.BoardColumn>
);

/** Board host wrapper — Live binding + overlays as children. */
const BoardHost: Component<BoardHostProps> = (props) => (
  <div
    class={props.class}
    data-testid={props["data-testid"]}
    ref={props.ref}
  >
    {props.children}
  </div>
);

/** Side rail — turn controls as children; Home tools always present. */
const Rail: Component<RailProps> = (props) => (
  <BoardSideRail
    controlsVisible={props.controlsVisible ?? props.children != null}
    onHome={props.onHome}
    controls={props.children}
  />
);

export const MatchBoardHost = Object.assign(Root, {
  BoardColumn,
  BoardHost,
  Rail,
});
