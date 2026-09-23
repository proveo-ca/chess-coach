// SPEC: _spec/_plans/chess-ui-primitives.puml, _spec/apps/ui/components.puml, _spec/apps/ui/responsiveness/rules.md
import clsx from "clsx";
import { type Component, type ParentComponent } from "solid-js";

import chessStyles from "./Screen.chess.module.css";
import starchessStyles from "./Screen.starchess.module.css";
import { useUiStyles, useUi } from "../UiProvider";

export interface ScreenProps {
  highlight?: boolean;
  children?: import("solid-js").JSX.Element;
}

export interface RegionProps {
  class?: string;
  children?: import("solid-js").JSX.Element;
}

const ScreenRoot: Component<ScreenProps> = (props) => {
  const ui = useUi();
  const styles = useUiStyles(chessStyles, starchessStyles);
  return (
    <div
      data-testid="screen-root"
      data-layout="screen"
      data-ui-product={ui.product}
      data-footer-float="false"
      classList={{
        [styles["app-container"]]: true,
        "screen-root": true,
        highlight: !!props.highlight,
      }}
    >
      {props.children}
    </div>
  );
};

const Header: ParentComponent = (props) => {
  const styles = useUiStyles(chessStyles, starchessStyles);
  return (
    <div class={styles["coach-header"]} data-region="top">
      {props.children}
    </div>
  );
};

const SidebarInset: Component<RegionProps> = (props) => {
  const styles = useUiStyles(chessStyles, starchessStyles);
  return (
    <div class={clsx(styles["sidebar-inset"], props.class)} data-region="top">
      {props.children}
    </div>
  );
};

const BoardArea: ParentComponent = (props) => {
  const styles = useUiStyles(chessStyles, starchessStyles);
  return (
    <div class={styles["board-area"]} data-region="middle">
      {props.children}
    </div>
  );
};

const BoardColumn: ParentComponent = (props) => {
  const styles = useUiStyles(chessStyles, starchessStyles);
  return (
    <div class={styles["board-column"]} data-board-column>
      {props.children}
    </div>
  );
};

const Footer: ParentComponent = (props) => {
  const styles = useUiStyles(chessStyles, starchessStyles);
  return (
    <div class={styles.footer} data-region="bottom">
      {props.children}
    </div>
  );
};

export const Screen = Object.assign(ScreenRoot, {
  Header,
  SidebarInset,
  BoardArea,
  BoardColumn,
  Footer,
});
