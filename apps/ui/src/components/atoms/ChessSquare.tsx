import type { Color, PieceSymbol, Square } from "chess.js";
import clsx from "clsx";
import { Show, createEffect, on } from "solid-js";
import type { Component } from "solid-js";

import { ROOK_REST_AIM_DEG } from "~/starchess/animations/attackAnim";
import { InlineBishop } from "~/starchess/animations/pieces/InlineBishop";
import { InlineRook } from "~/starchess/animations/pieces/InlineRook";
import { SpiderMine } from "~/starchess/specials/SpiderMine";
import { TEAM_PRIMARY } from "~/starchess/animations/teamColors";
import { VespeneIcon } from "~/starchess/primitives/icons";
import styles from "~/components/atoms/ChessSquare.module.css";
// SPEC: _spec/apps/ui/components.puml
import type { MoveSquares } from "~/types/game";
import type { RookMode } from "~/types/starchess";
import type { PieceSet } from "~/types/settings";

/** Grid-square offset from `from` to `to`, accounting for board flip. */
function squareOffset(from: string, to: string, flipped: boolean): { dx: number; dy: number } {
  const fileDiff = from.charCodeAt(0) - to.charCodeAt(0);
  const rankDiff = Number(to[1]) - Number(from[1]);
  const sign = flipped ? -1 : 1;
  return { dx: sign * fileDiff, dy: sign * rankDiff };
}

interface ChessSquareProps {
  square: Square;
  piece: { type: PieceSymbol; color: Color } | null;
  pieceSet: PieceSet;
  isLight: boolean;
  isSelected: boolean;
  isHovered: boolean;
  isValidMove: boolean;
  isAdviceHovered: boolean;
  /** StarChess special targeting ring (Charon Booster Missiles queen). */
  isSpecialTarget?: boolean;
  /**
   * Queued SCFEN intent destination — dashed border-only ring in that side's
   * color (planning ghost; not resolve / review replay).
   */
  intentTargetColor?: Color;
  /** Queued special — ghost vespene canister over the unit. */
  intentCanisterColor?: Color;
  isDragging: boolean;
  isInvalid: boolean;
  showRank: string | false;
  showFile: string | false;
  onClick: () => void;
  onMouseEnter: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnter: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  lastMove: MoveSquares | null;
  animationQueue: MoveSquares[];
  consumeAnimation?: (m: MoveSquares) => void;
  flipped: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isFogged?: boolean;
  hidePiece?: boolean;
  /** StarChess spider mine under this square (always below the piece). */
  spiderMine?: boolean;
  /** Mine owner — white enamel + team-color bumps. */
  spiderMineColor?: Color;
  /** Wake / chase — lift off + 8 mechanic legs. */
  spiderMineChasing?: boolean;
  /** Just placed — legs burrowing into the ground. */
  spiderMineDeploying?: boolean;
  /** Per-leg bury/emerge durations (ms). */
  spiderMineLegMs?: readonly number[];
  /**
   * When set, board rooks render {@link InlineRook} (tank vs siege art)
   * instead of the static `*R.svg` asset. StarChess boards always pass this;
   * piece-sets reference boards omit it so static siege `*R.svg` stays.
   */
  rookMode?: RookMode;
  /** Charon Booster Missiles armed Goliath — render InlineBishop with popped launchers. */
  charonArmed?: boolean;
  /** Armed Goliath face (front cockpit toward viewer / back canopy). */
  bishopFace?: "front" | "back";
  /** StarChess: unit already used its special this turn — green aura. */
  specialUsed?: boolean;
}

const getPieceImg = (type: PieceSymbol, color: Color, pieceSet: PieceSet) => {
  const piece = type.toUpperCase();
  return `/chess/pieces/${pieceSet}/${color}${piece}.svg`;
};

export const ChessSquare: Component<ChessSquareProps> = (props) => {
  const isCapture = () => props.isValidMove && !!props.piece;
  const isLastMove = () =>
    props.lastMove?.from === props.square || props.lastMove?.to === props.square;

  let pieceRef: HTMLElement | undefined;

  const useInlineRook = () =>
    props.piece?.type === "r" && props.rookMode != null;
  const useInlineArmedBishop = () =>
    props.piece?.type === "b" && props.charonArmed === true;

  // Queue-driven animation: consumes the head of animationQueue when it targets
  // this square, ensuring rapid successive moves (human+AI) each get a visible slide.
  createEffect(
    on(
      () => props.animationQueue,
      (queue) => {
        if (!queue.length || !pieceRef || props.isDragging) return;
        const head = queue[0];
        if (!head || head.to !== props.square) return;
        // Consume immediately so the next queued move for any square can proceed
        props.consumeAnimation?.(head);
        const { dx, dy } = squareOffset(head.from, head.to, props.flipped);
        pieceRef.style.transition = "none";
        pieceRef.style.transform = `translate(${dx * 100}%, ${dy * 100}%)`;
        void pieceRef.offsetWidth;
        pieceRef.style.transition = "transform 150ms ease-out";
        pieceRef.style.transform = "translate(0, 0)";
      },
      { defer: true },
    ),
  );

  return (
    <div
      data-square={props.square}
      data-tone={props.isLight ? "light" : "dark"}
      data-fog={props.isFogged == null ? undefined : props.isFogged ? "hidden" : "visible"}
      data-intent-dest={props.intentTargetColor ? props.square : undefined}
      data-intent-canister={props.intentCanisterColor ? props.square : undefined}
      classList={{
        [styles.square]: true,
        [styles.light]: props.isLight,
        [styles.dark]: !props.isLight,
        [styles.selected]: props.isSelected,
        [styles["valid-move"]]: props.isValidMove && !isCapture(),
        [styles.capture]: isCapture(),
        [styles.hovered]: props.isHovered && !props.isInvalid,
        [styles.invalid]: props.isInvalid,
        [styles["advice-highlight"]]: props.isAdviceHovered,
        [styles["special-target"]]: props.isSpecialTarget === true,
        [styles.dragging]: props.isDragging,
        [styles["has-piece"]]: !!props.piece,
        [styles["in-check"]]: props.isCheck,
        [styles["in-checkmate"]]: props.isCheckmate,
        [styles["in-stalemate"]]: props.isStalemate,
      }}
      onClick={props.onClick}
      onMouseEnter={props.onMouseEnter}
      onDragEnter={props.onDragEnter}
      onDragOver={props.onDragOver}
      onDrop={props.onDrop}
    >
      {props.showRank && (
        <span class={clsx(styles.coordinate, styles["rank-label"])}>{props.showRank}</span>
      )}
      {props.showFile && (
        <span class={clsx(styles.coordinate, styles["file-label"])}>{props.showFile}</span>
      )}

      {isLastMove() && <div class={styles["last-move-indicator"]}></div>}
      <Show when={props.intentTargetColor}>
        {(color) => (
          <div
            class={styles.intentRing}
            style={{ "--intent-ring": TEAM_PRIMARY[color()] }}
            data-intent-dest={props.square}
            aria-hidden="true"
          />
        )}
      </Show>
      {/* Fogged tiles with a visible piece (own unit or bishop queen-ping) sit above
          the board SVG fog; this local veil keeps the tile darkened under the piece. */}
      {props.isFogged && props.piece && !props.hidePiece && (
        <div class={styles.fog} aria-hidden="true"></div>
      )}

      <Show when={props.spiderMine}>
        <SpiderMine
          color={props.spiderMineColor === "b" ? "b" : "w"}
          state={
            props.spiderMineDeploying
              ? "deploying"
              : props.spiderMineChasing
                ? "chasing"
                : "idle"
          }
          legMs={props.spiderMineLegMs}
        />
      </Show>

      <Show when={props.piece && !props.hidePiece}>
        <Show
          when={useInlineRook() || useInlineArmedBishop()}
          fallback={
            <img
              ref={(el) => {
                pieceRef = el;
              }}
              src={getPieceImg(props.piece!.type, props.piece!.color, props.pieceSet)}
              alt={`${props.piece!.color} ${props.piece!.type}`}
              class={styles.piece}
              classList={{ [styles.pieceSpecialUsed]: props.specialUsed === true }}
              draggable="true"
              onDragStart={props.onDragStart}
              data-special-used={props.specialUsed ? "true" : undefined}
            />
          }
        >
          <Show
            when={useInlineRook()}
            fallback={
              <div
                ref={(el) => {
                  pieceRef = el;
                }}
                class={styles.piece}
                classList={{ [styles.pieceSpecialUsed]: props.specialUsed === true }}
                draggable="true"
                onDragStart={props.onDragStart}
                role="img"
                aria-label={`${props.piece!.color} ${props.piece!.type}`}
                data-piece-inline="b"
                data-special-used={props.specialUsed ? "true" : undefined}
              >
                <InlineBishop
                  color={props.piece!.color}
                  face={props.bishopFace ?? "front"}
                  armed
                  armAnim
                />
              </div>
            }
          >
            <div
              ref={(el) => {
                pieceRef = el;
              }}
              class={styles.piece}
              classList={{ [styles.pieceSpecialUsed]: props.specialUsed === true }}
              draggable="true"
              onDragStart={props.onDragStart}
              role="img"
              aria-label={`${props.piece!.color} ${props.piece!.type}`}
              data-piece-inline="r"
              data-special-used={props.specialUsed ? "true" : undefined}
            >
              <InlineRook
                color={props.piece!.color}
                mode={props.rookMode}
                aimDeg={ROOK_REST_AIM_DEG}
              />
            </div>
          </Show>
        </Show>
      </Show>

      <Show when={props.intentCanisterColor}>
        {(color) => (
          <div
            class={styles.intentCanister}
            style={{ color: TEAM_PRIMARY[color()] }}
            data-intent-canister={props.square}
            aria-hidden="true"
          >
            <VespeneIcon size={22} />
          </div>
        )}
      </Show>
    </div>
  );
};
