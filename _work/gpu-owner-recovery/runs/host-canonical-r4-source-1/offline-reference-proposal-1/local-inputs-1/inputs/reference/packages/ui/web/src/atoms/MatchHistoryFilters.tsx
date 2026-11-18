// SPEC: _spec/_plans/chess-ui-primitives.puml
import { Show } from "solid-js";
import type { Component } from "solid-js";
import type { SideColor as StarChessColor } from "../types/visual";

import { ColorSwatch } from "./ColorSwatch";
import styles from "./MatchHistoryFilters.module.css";
import { ChevronLeftIcon, ChevronRightIcon } from "../primitives/icons";

export type MatchHistoryFiltersProps = {
  colorFilter: StarChessColor;
  setColorFilter: (v: StarChessColor) => void;
  totalPages: number;
  activePage: number;
  currentDateLabel: string;
  goToPrev: () => void;
  goToNext: () => void;
  /** MobileBanner density — one row, no "Playing as" label / divider. */
  compact?: boolean;
};

export const MatchHistoryFilters: Component<MatchHistoryFiltersProps> = (props) => (
  <>
    <div
      class={styles.filters}
      classList={{ [styles.compact]: props.compact }}
      data-testid="match-history-filters"
    >
      <div class={styles.group}>
        <div class={styles.label}>Playing as</div>
        <div class={styles.tiles} role="group" aria-label="Playing as">
          <button
            type="button"
            class={styles.tile}
            classList={{ [styles["tile--active"]]: props.colorFilter === "w" }}
            aria-pressed={props.colorFilter === "w"}
            aria-label="Blue"
            onClick={() => props.setColorFilter("w")}
          >
            <ColorSwatch color="w" />
            <span class={styles.colorName}>Blue</span>
          </button>
          <button
            type="button"
            class={styles.tile}
            classList={{ [styles["tile--active"]]: props.colorFilter === "b" }}
            aria-pressed={props.colorFilter === "b"}
            aria-label="Red"
            onClick={() => props.setColorFilter("b")}
          >
            <ColorSwatch color="b" />
            <span class={styles.colorName}>Red</span>
          </button>
        </div>
      </div>
    </div>

    <Show when={props.totalPages >= 1 && props.currentDateLabel}>
      <div class={styles["page-nav"]} classList={{ [styles.compact]: props.compact }}>
        <Show when={props.totalPages > 1}>
          <button
            type="button"
            class={styles["page-btn"]}
            onClick={props.goToPrev}
            disabled={props.activePage === 0}
            aria-label="Previous date"
          >
            <ChevronLeftIcon size={14} />
          </button>
        </Show>

        <span class={styles["page-indicator"]}>
          {props.currentDateLabel} ({props.activePage + 1} / {props.totalPages})
        </span>

        <Show when={props.totalPages > 1}>
          <button
            type="button"
            class={styles["page-btn"]}
            onClick={props.goToNext}
            disabled={props.activePage >= props.totalPages - 1}
            aria-label="Next date"
          >
            <ChevronRightIcon size={14} />
          </button>
        </Show>
      </div>
    </Show>
  </>
);
