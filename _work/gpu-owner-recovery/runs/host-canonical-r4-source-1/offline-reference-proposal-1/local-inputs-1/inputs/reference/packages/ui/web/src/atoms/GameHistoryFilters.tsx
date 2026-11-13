// SPEC: _spec/_plans/chess-ui-primitives.puml, _spec/apps/ui/components.puml
import { For, Show } from "solid-js";
import type { Component } from "solid-js";

import { ColorSwatch } from "./ColorSwatch";
import styles from "./GameHistoryFilters.module.css";
import { ChevronLeftIcon, ChevronRightIcon } from "../primitives/icons";

export interface GameHistoryFiltersProps {
  colorFilter: "w" | "b";
  setColorFilter: (v: "w" | "b") => void;
  firstMoveFilter: string | null;
  setFirstMoveFilter: (san: string | null) => void;
  availableFirstMoves: string[];
  totalPages: number;
  activePage: number;
  currentDateLabel: string;
  goToPrev: () => void;
  goToNext: () => void;
}

export const GameHistoryFilters: Component<GameHistoryFiltersProps> = (props) => {
  return (
    <>
      <div class={styles.filters} data-testid="game-history-filters">
        <div class={styles.group}>
          <div class={styles.label}>Playing as</div>
          <div class={styles.tiles} role="group" aria-label="Playing as">
            <button
              type="button"
              class={styles.tile}
              classList={{ [styles["tile--active"]]: props.colorFilter === "w" }}
              aria-pressed={props.colorFilter === "w"}
              aria-label="White"
              onClick={() => {
                props.setColorFilter("w");
                props.setFirstMoveFilter(null);
              }}
            >
              <ColorSwatch color="w" />
              <span class={styles.colorName}>White</span>
            </button>
            <button
              type="button"
              class={styles.tile}
              classList={{ [styles["tile--active"]]: props.colorFilter === "b" }}
              aria-pressed={props.colorFilter === "b"}
              aria-label="Black"
              onClick={() => {
                props.setColorFilter("b");
                props.setFirstMoveFilter(null);
              }}
            >
              <ColorSwatch color="b" />
              <span class={styles.colorName}>Black</span>
            </button>
          </div>
        </div>

        <Show when={props.availableFirstMoves.length > 0}>
          <div class={styles.group}>
            <div class={styles.label}>First move</div>
            <div class={styles.tiles} role="group" aria-label="First move">
              <button
                type="button"
                class={styles.tile}
                classList={{ [styles["tile--active"]]: props.firstMoveFilter === null }}
                aria-pressed={props.firstMoveFilter === null}
                onClick={() => props.setFirstMoveFilter(null)}
              >
                Any
              </button>
              <For each={props.availableFirstMoves}>
                {(san) => (
                  <button
                    type="button"
                    class={styles.tile}
                    classList={{ [styles["tile--active"]]: props.firstMoveFilter === san }}
                    aria-pressed={props.firstMoveFilter === san}
                    onClick={() => props.setFirstMoveFilter(san)}
                  >
                    {san}
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>

      {/* Date pagination - always shown to display the game date */}
      <Show when={props.totalPages >= 1 && props.currentDateLabel}>
        <div class={styles["page-nav"]}>
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
};
