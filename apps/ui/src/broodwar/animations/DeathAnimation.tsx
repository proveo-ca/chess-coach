import { For, type Component, type JSX } from "solid-js";

import { DEATH_MS, scatterSeedFromId } from "~/broodwar/animations/deathAnim";
import styles from "~/broodwar/animations/DeathAnimations.module.css";
import { DeathBishop } from "~/broodwar/animations/pieces/DeathBishop";
import { DeathKing } from "~/broodwar/animations/pieces/DeathKing";
import { DeathKnight } from "~/broodwar/animations/pieces/DeathKnight";
import { DeathPawn } from "~/broodwar/animations/pieces/DeathPawn";
import { DeathQueen } from "~/broodwar/animations/pieces/DeathQueen";
import { DeathRook } from "~/broodwar/animations/pieces/DeathRook";
import { squareBoxStyle } from "~/broodwar/animations/boardGeom";
import type { PieceColor } from "~/broodwar/animations/teamColors";
import type { BroodWarPiece, DeathCue } from "~/broodwar/animations/types";

const deathNode = (piece: BroodWarPiece, color: PieceColor, seed: number): JSX.Element => {
  switch (piece) {
    case "p":
      return <DeathPawn color={color} seed={seed} />;
    case "n":
      return <DeathKnight seed={seed} />;
    case "b":
      return <DeathBishop color={color} seed={seed} />;
    case "r":
      return <DeathRook seed={seed} />;
    case "q":
      return <DeathQueen seed={seed} />;
    case "k":
      return <DeathKing seed={seed} />;
  }
};

export type DeathAnimationProps = {
  cues: DeathCue[];
  boardWidth: number;
  boardHeight: number;
  /**
   * When set, positions the overlay absolutely relative to a host wrapper.
   * Omit when nesting inside the ChessBoard grid (inset 0).
   */
  box?: { top: number; left: number };
};

/**
 * Brood War death VFX layer — every cue finishes in `DEATH_MS` (500ms).
 * Pawn: outward bubble + shred; others: boom + shards.
 * Shard directions re-roll per cue id so repeats don't look identical.
 */
export const DeathAnimation: Component<DeathAnimationProps> = (props) => (
  <div
    class={styles.boardOverlay}
    data-broodwar-death-layer
    style={{
      ...(props.box
        ? {
            top: `${props.box.top}px`,
            left: `${props.box.left}px`,
            width: `${props.boardWidth}px`,
            height: `${props.boardHeight}px`,
          }
        : {
            inset: "0",
            width: "100%",
            height: "100%",
          }),
      "--death-ms": `${DEATH_MS}ms`,
    }}
  >
    <For each={props.cues}>
      {(cue) => {
        const pawnDeath = cue.piece === "p";
        const seed = scatterSeedFromId(cue.id);
        return (
          <div
            class={styles.originSlot}
            classList={{
              [styles.dying]: true,
              [styles.dyingPawn]: pawnDeath,
              [styles.dyingDrama]: true,
            }}
            style={squareBoxStyle(cue.at, props.boardWidth, props.boardHeight)}
            data-square={cue.at}
            data-death-phase="dying"
            data-scatter-seed={String(seed)}
          >
            <div class={styles.pieceFace}>
              {deathNode(cue.piece, cue.color, seed)}
              <div class={styles.boomFlash} aria-hidden="true" />
              <div class={styles.boomRing} aria-hidden="true" />
            </div>
          </div>
        );
      }}
    </For>
  </div>
);
