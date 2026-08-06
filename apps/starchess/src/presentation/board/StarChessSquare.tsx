import { Show } from "solid-js";
import type { Component } from "solid-js";
import type { PieceSymbol, Square } from "chess.js";
import clsx from "clsx";

import { pieceUrl } from "~/presentation/board/pieceUrl";
import styles from "~/presentation/board/StarChessSquare.module.css";

export type SquarePiece = { type: PieceSymbol; color: "w" | "b" } | null;

export type StarChessSquareProps = {
  square: Square;
  piece: SquarePiece;
  isLight: boolean;
  isSelected: boolean;
  isValidMove: boolean;
  isFogged: boolean;
  hidePiece: boolean;
  specialUsed: boolean;
  spiderMine?: boolean;
  spiderMineColor?: "w" | "b";
  intentGhost?: SquarePiece;
  onClick: () => void;
};

export const StarChessSquare: Component<StarChessSquareProps> = (props) => {
  const isCapture = () => props.isValidMove && !!props.piece;
  return (
    <button
      type="button"
      class={clsx(
        styles.square,
        props.isLight ? styles.light : styles.dark,
        props.isSelected && styles.selected,
        props.isValidMove && styles.valid,
        isCapture() && styles.capture,
        props.isFogged && styles.fogged,
        props.specialUsed && styles.specialUsed,
      )}
      data-square={props.square}
      data-special-used={props.specialUsed || undefined}
      aria-label={props.square}
      onClick={() => props.onClick()}
    >
      <Show when={props.spiderMine}>
        <span
          class={styles.mine}
          data-color={props.spiderMineColor}
          aria-hidden
        />
      </Show>
      <Show when={props.piece && !props.hidePiece}>
        <img
          class={styles.piece}
          src={pieceUrl(props.piece!.color, props.piece!.type)}
          alt=""
          draggable={false}
        />
      </Show>
      <Show when={props.intentGhost}>
        <img
          class={clsx(styles.piece, styles.ghost)}
          src={pieceUrl(props.intentGhost!.color, props.intentGhost!.type)}
          alt=""
          draggable={false}
        />
      </Show>
      <Show when={props.isValidMove && !props.piece}>
        <span class={styles.dot} aria-hidden />
      </Show>
    </button>
  );
};

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

export const isLightSquare = (file: string, rank: string) =>
  (file.charCodeAt(0) - 97 + Number(rank)) % 2 === 1;
