/**
 * StarChess single-player setup — MAP / TEAM / locked Adjutant / START.
 */
import type { StarChessColor } from "@chess-coach/starchess-core";
import { For, createSignal, type Component } from "solid-js";

import { MapSwatch, mapLabel } from "~/components/atoms/MapSwatch";
import { NeonModal } from "~/components/atoms/NeonModal";
import { TeamSwatch } from "~/components/atoms/TeamSwatch";
import styles from "~/components/features/NewGamePanel.module.css";
import { PlayerNameField } from "~/components/features/PlayerNameField";
import { Button } from "~/components/primitives/Button";
import { Select } from "~/components/primitives/Select";
import type { BoardVariant } from "~/types/board";
import type { NewGameOptions } from "~/types/newGame";

const MAPS: readonly BoardVariant[] = ["eclipse", "butter", "vermeer"];

export type NewGamePanelProps = {
  open: boolean;
  onClose: () => void;
  onStart: (opts: NewGameOptions) => void;
};

export const NewGamePanel: Component<NewGamePanelProps> = (props) => {
  const [map, setMap] = createSignal<BoardVariant>("eclipse");
  const [team, setTeam] = createSignal<StarChessColor>("w");

  const start = () => {
    props.onStart({ map: map(), team: team() });
  };

  return (
    <NeonModal
      open={props.open}
      onClose={props.onClose}
      title="Single Player"
      position="fixed"
      size="md"
    >
      <div class={styles["new-game-panel"]} data-testid="starchess-new-game-panel">
        <section class={styles.section} aria-labelledby="new-game-player-name">
          <h3 id="new-game-player-name" class={styles.sectionTitle}>
            Name
          </h3>
          <PlayerNameField id="starchess-player-name" />
        </section>

        <section class={styles.section} aria-labelledby="new-game-map">
          <h3 id="new-game-map" class={styles.sectionTitle}>
            Map
          </h3>
          <div class={styles.row} role="group" aria-label="Map">
            <For each={MAPS}>
              {(variant) => (
                <MapSwatch
                  variant={variant}
                  label={mapLabel(variant)}
                  selected={map() === variant}
                  onSelect={() => setMap(variant)}
                />
              )}
            </For>
          </div>
        </section>

        <section class={styles.section} aria-labelledby="new-game-team">
          <h3 id="new-game-team" class={styles.sectionTitle}>
            Team
          </h3>
          <div class={styles.row} role="group" aria-label="Team">
            <TeamSwatch
              color="w"
              label="Blue"
              selected={team() === "w"}
              onSelect={() => setTeam("w")}
            />
            <TeamSwatch
              color="b"
              label="Red"
              selected={team() === "b"}
              onSelect={() => setTeam("b")}
            />
          </div>
        </section>

        <section class={styles.section} aria-labelledby="new-game-opponent">
          <h3 id="new-game-opponent" class={styles.sectionTitle}>
            Opponent
          </h3>
          <Select
            class={styles.opponent}
            variant="neon"
            value="adjutant"
            disabled
            aria-label="Opponent"
            data-testid="new-game-opponent"
          >
            <option value="adjutant">Adjutant (Script)</option>
          </Select>
        </section>

        <Button
          class={styles["start-btn"]}
          variant="neon"
          primary
          onClick={start}
          data-testid="new-game-start"
        >
          Start
        </Button>
      </div>
    </NeonModal>
  );
};
