// SPEC: _spec/_plans/chess-ui-primitives.puml
import { Show, type Component, type JSX } from "solid-js";

import styles from "./ChessMobileBanner.module.css";
import { IconButton } from "../primitives/IconButton";
import { HamburgerIcon } from "../primitives/icons";
import { ChevronNav } from "../primitives/ChevronNav";
import { Label } from "../primitives/Label";

export type ChessMobileBannerProps = {
  title: JSX.Element | string;

  onBack?: () => void;

  onMenu: () => void;

  hideCentre?: boolean;
  class?: string;
  "data-testid"?: string;
};

export const ChessMobileBanner: Component<ChessMobileBannerProps> = (props) => {
  return (
    <header
      class={`mobile-banner ${styles.banner} ${props.class ?? ""}`.trim()}
      data-testid={props["data-testid"] ?? "mobile-banner"}
      data-hide-centre={props.hideCentre ? "" : undefined}
    >
      <div class={styles.side} data-fuse="back">
        <ChevronNav
          direction="back"
          onClick={props.onBack}
          aria-label="Back"
          data-testid="mobile-banner-back"
        >
          Back
        </ChevronNav>
      </div>
      <div class={styles.center} data-fuse="centre">
        <Show
          when={typeof props.title === "string"}
          fallback={<span class={styles.title}>{props.title}</span>}
        >
          <Label variant="title" class={styles.title}>
            {props.title as string}
          </Label>
        </Show>
      </div>
      <div class={`${styles.side} ${styles.trailing}`} data-fuse="menu">
        <IconButton onClick={() => props.onMenu()} aria-label="Open menu">
          <HamburgerIcon />
        </IconButton>
      </div>
    </header>
  );
};
