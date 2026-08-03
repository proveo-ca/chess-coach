import { For, type Component, type JSX } from "solid-js";

import { DEATH_MS, scatterSeedFromId } from "~/starchess/animations/deathAnim";
import styles from "~/starchess/animations/DeathAnimation.module.css";
import { DeathBishop } from "~/starchess/animations/pieces/DeathBishop";
import { DeathKing } from "~/starchess/animations/pieces/DeathKing";
import { DeathKnight } from "~/starchess/animations/pieces/DeathKnight";
import { DeathPawn } from "~/starchess/animations/pieces/DeathPawn";
import { DeathQueen } from "~/starchess/animations/pieces/DeathQueen";
import { DeathRook } from "~/starchess/animations/pieces/DeathRook";
import { squareBoxStyle } from "~/starchess/animations/boardGeom";
import { rookModeAt } from "~/starchess/starChessStore";
import type { PieceColor } from "~/starchess/animations/teamColors";
import type { StarChessPiece, DeathCue } from "~/starchess/animations/types";

const deathNode = (
  piece: StarChessPiece,
  color: PieceColor,
  seed: number,
  cue: DeathCue,
): JSX.Element => {
  switch (piece) {
    case "p":
      return <DeathPawn color={color} seed={seed} />;
    case "n":
      return <DeathKnight color={color} seed={seed} />;
    case "b":
      return <DeathBishop color={color} seed={seed} />;
    case "r":
      return <DeathRook color={color} seed={seed} mode={rookModeAt(cue.at)} />;
    case "q":
      return <DeathQueen color={color} seed={seed} />;
    case "k":
      return <DeathKing color={color} seed={seed} damage="destroyed" collapse />;
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
 * StarChess death VFX layer — every cue finishes in `DEATH_MS` (`ATTACK_MS / 2`).
 * Pawn: outward bubble + shred; king: rubble collapse; others: boom + shards.
 */
export const DeathAnimation: Component<DeathAnimationProps> = (props) => (
  <div
    class={styles.boardOverlay}
    data-starchess-death-layer
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
        const kingDeath = cue.piece === "k";
        const seed = scatterSeedFromId(cue.id);
        return (
          <div
            class={styles.originSlot}
            classList={{
              [styles.dying]: true,
              [styles.dyingPawn]: pawnDeath,
              [styles.dyingDrama]: !pawnDeath && !kingDeath,
              [styles.dyingKing]: kingDeath,
            }}
            style={squareBoxStyle(cue.at, props.boardWidth, props.boardHeight)}
            data-square={cue.at}
            data-death-phase="dying"
            data-scatter-seed={String(seed)}
          >
            <div class={styles.pieceFace}>
              {deathNode(cue.piece, cue.color, seed, cue)}
              <div class={styles.boomFlash} aria-hidden="true" />
              <div class={styles.boomRing} aria-hidden="true" />
            </div>
          </div>
        );
      }}
    </For>
  </div>
);
