import type { Square } from "chess.js";
import { parseScFen, type ScFenSnapshot } from "@chess-coach/starchess-core";
import { createEffect, createSignal, on, type Component } from "solid-js";

import styles from "~/presentation/animations/components/DeathBoardDemo.module.css";
import { createPhaseClock } from "~/presentation/animations/phaseLoop";
import {
  DEATH_MS,
  FEN_BY_PIECE,
  HOLD_MS,
  IDLE_MS,
  ORIGIN,
  SCFEN_MINE,
  SCFEN_MINE_GONE,
  type DeathPiece,
} from "~/presentation/animations/deathAnim";
import type { DeathSubject } from "~/types/cues";
import { AnimationStage } from "~/presentation/animations/components/AnimationStage";
import {
  clearSiegedTanks,
  setTankMode,
} from "~/presentation/animations/tankModeStore";
import { Screen } from "@chess-coach/ui-web/primitives/Screen";
import type { DeathCue } from "~/presentation/types";

const LOOP_TAIL_MS = 400;
const NO_MINES: readonly Square[] = [];
const MINE_SPENT: readonly Square[] = [ORIGIN];

const FEN_GONE: Record<DeathPiece, string> = {
  p: "7k/8/8/8/8/8/8/K7 w - - 0 1",
  n: "7k/8/8/8/8/8/8/K7 w - - 0 1",
  b: "7k/8/8/8/8/8/8/K7 w - - 0 1",
  r: "7k/8/8/8/8/8/8/K7 w - - 0 1",
  q: "7k/8/8/8/8/8/8/K7 w - - 0 1",
  k: "7k/8/8/8/8/8/8/8 w - - 0 1",
};

const PACKED_TANK_SQ: Square = "c4";
const SIEGED_TANK_SQ: Square = "e4";
const FEN_TANK_DUAL = "7k/8/8/8/2R1R3/8/8/K7 w - - 0 1";

type DeathPhase = "idle" | "dying" | "gone";

export const DeathBoardDemo: Component<{ subject: DeathSubject }> = (props) => {
  const isMine = () => props.subject === "mine";
  /** Narrowed accessor — every `FEN_*` lookup is unit-only. */
  const unit = () => props.subject as DeathPiece;
  const [phase, setPhase] = createSignal<DeathPhase>("idle");
  const [cues, setCues] = createSignal<DeathCue[]>([]);

  const idleFen = () => (unit() === "r" ? FEN_TANK_DUAL : FEN_BY_PIECE[unit()]);

  /**
   * A mine sits in the SCFEN `M:` field, so the mine demo hands
   * `AnimationStage` a snapshot; `spentMines` darkens the glyph for the death
   * window exactly as `handleMineDeaths` does in a real resolve.
   */
  const mineSnapshot = (): ScFenSnapshot =>
    parseScFen(phase() === "idle" ? SCFEN_MINE : SCFEN_MINE_GONE);

  const seedTankModes = () => {
    clearSiegedTanks();
    if (props.subject !== "r") return;
    setTankMode(PACKED_TANK_SQ, "tank");
    setTankMode(SIEGED_TANK_SQ, "siege");
  };

  const makeCues = (): DeathCue[] => {
    if (isMine()) {
      // `piece: "n"` + `mine: true` is the shape the projector emits — the
      // Hoverbike owns the colour, `DeathMine` owns the silhouette.
      return [{ id: "death-mine", piece: "n", color: "b", at: ORIGIN, mine: true }];
    }
    if (props.subject === "r") {
      return [
        { id: "death-r-tank", piece: "r", color: "w", at: PACKED_TANK_SQ, tankMode: "tank" },
        { id: "death-r-siege", piece: "r", color: "w", at: SIEGED_TANK_SQ, tankMode: "siege" },
      ];
    }
    return [
      {
        id: `death-${unit()}`,
        piece: unit(),
        color: "w",
        at: ORIGIN,
      },
    ];
  };

  createEffect(
    on(
      () => props.subject,
      () =>
        createPhaseClock(
          [
            [
              0,
              () => {
                seedTankModes();
                setPhase("idle");
                setCues([]);
              },
            ],
            [
              IDLE_MS,
              () => {
                setPhase("dying");
                setCues(makeCues());
              },
            ],
            [
              IDLE_MS + DEATH_MS,
              () => {
                setPhase("gone");
                setCues([]);
              },
            ],
          ],
          IDLE_MS + DEATH_MS + HOLD_MS + LOOP_TAIL_MS,
        ),
    ),
  );

  const fen = () => {
    if (phase() === "gone") return FEN_GONE[unit()];
    if (phase() === "dying") {
      // Hide shattered units under the death overlay.
      return FEN_GONE[unit()];
    }
    return idleFen();
  };

  return (
    <Screen>
      <Screen.SidebarInset />
      <Screen.BoardArea>
        <Screen.BoardColumn>
          <div class={styles.host}>
            <AnimationStage
              {...(isMine() ? { snapshot: mineSnapshot() } : { fen: fen() })}
              fog
              // Player fog would hide an enemy mine on an unlit tile; the demo
              // is about the wreck, not about who can see it.
              visionMode={isMine() ? "observer" : "player"}
              spentMines={isMine() && phase() !== "idle" ? MINE_SPENT : NO_MINES}
              combat={{ deathCues: cues() }}
            />
          </div>
        </Screen.BoardColumn>
      </Screen.BoardArea>
      <Screen.Footer>
        <p class={styles.caption}>
          StarChess · {props.subject.toUpperCase()} · {phase()} · deathCues
        </p>
      </Screen.Footer>
    </Screen>
  );
};
