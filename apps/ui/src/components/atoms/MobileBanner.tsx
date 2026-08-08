// SPEC: _spec/apps/ui/components.puml
import { Show, type Component, type JSX } from "solid-js";
import { useNavigate } from "@solidjs/router";

import styles from "~/components/atoms/MobileBanner.module.css";
import { IconButton } from "~/components/primitives/IconButton";
import { HamburgerIcon } from "~/components/primitives/icons";
import { ChevronNav } from "~/components/primitives/ChevronNav";
import { Label } from "~/components/primitives/Label";
import { screenBackTarget } from "~/utils/navHistory";

export type MobileBannerProps = {
  /** Centre title (e.g. “Solo Analysis”). */
  title: JSX.Element | string;
  /** Override default in-app back / main-menu fallback. */
  onBack?: () => void;
  /** Opens the mobile menu (hamburger). */
  onMenu: () => void;
  /**
   * Dynamic-mobile fuse: hide the centre title so the MobileSidebar centre
   * (e.g. CoachAvatar) owns the strip. No-op outside `--dynamic-mobile`.
   */
  hideCentre?: boolean;
  class?: string;
  "data-testid"?: string;
};

/**
 * Mobile-only top strip flush to the viewport edge:
 * `‹ Back` · title · hamburger. Hidden on desktop (Sidebar / ScreenBackNav).
 * At `--dynamic-mobile`, a parent `[data-testid=mobile-fuse]` row hoists
 * these cells beside MobileSidebar items (display:contents).
 */
export const MobileBanner: Component<MobileBannerProps> = (props) => {
  const navigate = useNavigate();
  const goBack = () => {
    if (props.onBack) {
      props.onBack();
      return;
    }
    const target = screenBackTarget();
    if (typeof target === "number") navigate(target);
    else navigate(target);
  };

  return (
    <header
      class={`mobile-banner ${styles.banner} ${props.class ?? ""}`.trim()}
      data-testid={props["data-testid"] ?? "mobile-banner"}
      data-hide-centre={props.hideCentre ? "" : undefined}
    >
      <div class={styles.side} data-fuse="back">
        <ChevronNav
          direction="back"
          onClick={goBack}
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
