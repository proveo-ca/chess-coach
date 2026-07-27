import { useNavigate } from "@solidjs/router";
import type { Color, PieceSymbol, Square } from "chess.js";
import clsx from "clsx";
import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  onCleanup,
} from "solid-js";
import type { Component, JSX } from "solid-js";

import { AttackAnimation } from "~/broodwar/animations/AttackAnimation";
import { DeathAnimation } from "~/broodwar/animations/DeathAnimation";
import type { AttackCue, DeathCue } from "~/broodwar/animations/types";
import type { KingDamageState } from "~/broodwar/types";
import { getSideVision, getVisionDisplayCells, getVisionFogHolePaths } from "~/broodwar/vision";
import { ChessBoardArrow } from "~/components/atoms/ChessBoardArrow.tsx";
import { ChessSquare } from "~/components/atoms/ChessSquare";
import { GameOverBanner } from "~/components/features/GameOverBanner";
import styles from "~/components/features/ChessBoard.module.css";
import { Button } from "~/components/primitives/Button.tsx";
import { EvalBar } from "~/components/primitives/EvalBar";
import { PromotionModal } from "~/components/primitives/PromotionModal";
import { useChessBoard } from "~/hooks/useChessBoard";
import { capabilities } from "~/store/capabilitiesStore";
import { adviceArrow, adviceHoveredSquares, setShowNewGame } from "~/store/coachStore";
import { getExpectedReviewId, hasRecordedReview } from "~/store/gameHistoryStore.ts";
import { currentIndex, fenHistory, game, isResigned, startingFen } from "~/store/gameStore";
import { activePlayerColor, opponentPieceSet, playerPieceSet } from "~/store/settingsStore";
import { isTravelling } from "~/store/travelStore";
// SPEC: _spec/apps/ui/components.puml
import type { MoveSquares } from "~/types/game";
import type { NerdBoardVariant } from "~/types/ui";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

const getPieceImg = (type: PieceSymbol, color: Color, pieceSet: string) =>
  `/chess/pieces/${pieceSet}/${color}${type.toUpperCase()}.svg`;

const squareFromTouch = (touch: Touch): Square | null => {
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  return ((el?.closest("[data-square]") as HTMLElement | null)?.dataset.square as Square) ?? null;
};

export const ChessBoard: Component<{
  /** Override end-of-game CTAs (Review: Another Game → /selena + Replay Review). */
  gameOverActions?: JSX.Element;
  /** Brood War tile treatment; reserved for Nerd mode. */
  variant?: NerdBoardVariant;
  /** Cumulative side-vision fog; reserved for Nerd mode. */
  fogOfWar?: boolean;
  /** Single Brood War attack cue (convenience; prefer `attackCues` for simultaneous). */
  attackCue?: AttackCue | null;
  /** Active Brood War attack VFX cues. */
  attackCues?: AttackCue[];
  /** Attack cue ids whose hull has swapped to death art mid-cue. */
  attackDying?: Record<string, boolean>;
  /** Active Brood War death VFX cues. */
  deathCues?: DeathCue[];
  /** Squares with an armed spider mine (drawn under pieces). */
  spiderMines?: readonly Square[] | ReadonlySet<Square>;
  /** Owner color for `spiderMines` (defaults to active player). */
  spiderMineColor?: Color;
  /** Per-square king damage presentation (lives → fire / destroyed). */
  kingDamage?: Partial<Record<Square, KingDamageState>>;
}> = (props) => {
  const navigate = useNavigate();
  const board = useChessBoard();

  const displayRanks = () => (activePlayerColor() === "w" ? RANKS : [...RANKS].reverse());
  const displayFiles = () => (activePlayerColor() === "w" ? FILES : [...FILES].reverse());

  const activeGame = () => board.activeGame();
  const lastMove = () => board.lastMove();
  const animationQueue = () => board.animationQueue();
  const consumeAnimation = (m: MoveSquares) => board.consumeAnimation?.(m);

  const resolvedAttackCues = createMemo(() => {
    if (props.attackCues?.length) return props.attackCues;
    return props.attackCue ? [props.attackCue] : [];
  });
  const resolvedDeathCues = createMemo(() => props.deathCues ?? []);
  const hasCombatFx = createMemo(
    () => resolvedAttackCues().length > 0 || resolvedDeathCues().length > 0,
  );
  const fxHiddenSquares = createMemo(() => {
    const hide = new Set<Square>();
    for (const c of resolvedAttackCues()) hide.add(c.from);
    for (const c of resolvedDeathCues()) hide.add(c.at);
    return hide;
  });
  const mineSquares = createMemo(() => {
    const raw = props.spiderMines;
    if (!raw) return null;
    return raw instanceof Set ? raw : new Set(raw);
  });

  const [boardSize, setBoardSize] = createSignal<{ width: number; height: number } | null>(null);
  let boardGridRef: HTMLDivElement | undefined;

  createEffect(() => {
    if (!hasCombatFx()) {
      setBoardSize(null);
      return;
    }
    const el = boardGridRef;
    if (!el) return;
    const sync = () => {
      // Content box only — absolute overlays use the padding box (inside the
      // 4px board border). getBoundingClientRect includes the border and would
      // stretch every squareBoxStyle slot down/right.
      setBoardSize({ width: el.clientWidth, height: el.clientHeight });
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    onCleanup(() => ro.disconnect());
  });

  const nerdVision = createMemo(() =>
    props.fogOfWar ? getSideVision(activeGame(), activePlayerColor()) : null,
  );
  const visibleSquares = createMemo(() => nerdVision()?.litSquares ?? null);
  const revealedPieces = createMemo(() => nerdVision()?.revealedPieces ?? null);
  const visionCells = createMemo(() => {
    const visible = visibleSquares();
    if (!visible || visible.size === 0) return [] as ReturnType<typeof getVisionDisplayCells>;
    return getVisionDisplayCells(visible, displayFiles(), displayRanks());
  });
  const visionPaths = createMemo(() => getVisionFogHolePaths(visionCells()));
  const fogOverlayId = createUniqueId();
  const fogMaskId = `${fogOverlayId}-mask`;

  const handleSquareClick = (square: Square) => {
    void board.handleSquareClick(square);
  };

  const isCheck = () => activeGame().inCheck();
  const isCheckmate = () => activeGame().isCheckmate();
  const isStalemate = () => activeGame().isStalemate();
  const turn = () => activeGame().turn();

  // ── Touch-drag (mobile) ──────────────────────────────────────────────
  const [touchDrag, setTouchDrag] = createSignal<{
    from: Square;
    piece: { type: PieceSymbol; color: Color };
    pieceSet: string;
    x: number;
    y: number;
  } | null>(null);
  let lastTouchSquare: Square | null = null;

  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    const sq = squareFromTouch(touch);
    if (!sq || board.isReplaying() || capabilities().readOnly) return;

    const g = board.game();
    const piece = g.get(sq);
    if (!piece) return;

    const canTouch = capabilities().freeColorControl
      ? piece.color === g.turn()
      : g.turn() === activePlayerColor() && piece.color === activePlayerColor();
    if (!canTouch) return;

    e.preventDefault();

    // Select the piece (sets selectedSquare + validMoves inside the hook)
    board.handleSquareClick(sq);

    const pSet = piece.color === activePlayerColor() ? playerPieceSet() : opponentPieceSet();
    setTouchDrag({ from: sq, piece, pieceSet: pSet, x: touch.clientX, y: touch.clientY });
    lastTouchSquare = sq;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!touchDrag()) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;

    setTouchDrag((prev) => (prev ? { ...prev, x: touch.clientX, y: touch.clientY } : null));

    const sq = squareFromTouch(touch);
    if (sq && sq !== lastTouchSquare) {
      board.handleSquareHover(sq);
      lastTouchSquare = sq;
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (!touchDrag()) return;
    const touch = e.changedTouches[0];
    const target = touch ? squareFromTouch(touch) : null;

    if (target && target !== touchDrag()!.from) {
      board.handleSquareClick(target);
    }

    setTouchDrag(null);
    lastTouchSquare = null;
    board.handleBoardMouseLeave();
  };

  // Cancel any in-flight touch drag when the board enters replay or travel
  // — the piece snaps back to its original square.
  createEffect(() => {
    if ((board.isReplaying() || isTravelling()) && touchDrag()) {
      setTouchDrag(null);
      lastTouchSquare = null;
    }
  });
  const isReplaying = () => currentIndex() < fenHistory().length - 1;
  // End-game banner is shown only in the final game state — never while
  // replaying a past move or time-travelling. `game()` is the authoritative
  // live instance, so checkmate/stalemate read the true terminal position.
  const isGameOver = () =>
    !isReplaying() && !isTravelling() && (game().isGameOver() || isResigned());

  return (
    <div class={styles["board-layout-wrapper"]}>
      <Show when={board.isReplaying() || capabilities().evalBarAlwaysVisible}>
        <EvalBar
          score={board.baseEvalScore()}
          isFlipped={activePlayerColor() === "b"}
          turn={turn()}
        />
      </Show>
      <div
        data-testid="chessboard"
        class={styles["chessboard-container"]}
        onMouseEnter={board.handleBoardMouseEnter}
        onMouseLeave={board.handleBoardMouseLeave}
      >
        <div
          ref={boardGridRef}
          data-board-grid
          class={clsx(
            styles.chessboard,
            props.variant && styles[`chessboard--${props.variant}`],
            props.fogOfWar && styles["chessboard--fog"],
          )}
          onContextMenu={(e) => e.preventDefault()}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <For each={displayRanks()}>
            {(rank, rIndex) => (
              <For each={displayFiles()}>
                {(file, fIndex) => {
                  const square = `${file}${rank}` as Square;
                  const piece = () => activeGame().get(square);
                  const isFogged = () =>
                    props.fogOfWar ? !visibleSquares()?.has(square) : undefined;

                  const isInvalid = () => {
                    if (board.hoveredSquare() !== square) return false;
                    const selected = board.selectedSquare();
                    if (selected) {
                      return !board.validMoves().includes(square) && square !== selected;
                    } else {
                      const p = piece();
                      if (!p) return false;
                      return (
                        p.color !== activePlayerColor() ||
                        board.game().turn() !== activePlayerColor()
                      );
                    }
                  };

                  const squarePieceSet = () => {
                    const p = piece();
                    if (!p) return playerPieceSet();
                    return p.color === activePlayerColor() ? playerPieceSet() : opponentPieceSet();
                  };

                  return (
                    <ChessSquare
                      square={square}
                      piece={piece() ?? null}
                      pieceSet={squarePieceSet()}
                      isLight={(rIndex() + fIndex()) % 2 === 0}
                      isSelected={board.selectedSquare() === square}
                      isHovered={board.hoveredSquare() === square}
                      isValidMove={board.validMoves().includes(square)}
                      isAdviceHovered={adviceHoveredSquares().includes(square)}
                      isDragging={touchDrag()?.from === square}
                      isInvalid={isInvalid()}
                      isFogged={isFogged()}
                      hidePiece={
                        fxHiddenSquares().has(square) ||
                        (isFogged() === true &&
                          piece() != null &&
                          piece()?.color !== activePlayerColor() &&
                          !revealedPieces()?.has(square))
                      }
                      spiderMine={mineSquares()?.has(square) === true}
                      spiderMineColor={props.spiderMineColor ?? activePlayerColor()}
                      showRank={fIndex() === 0 && rank}
                      showFile={rIndex() === 7 && file}
                      onClick={() => handleSquareClick(square)}
                      onMouseEnter={() => board.handleSquareHover(square)}
                      onDragStart={(e) => board.handleDragStart(square, e)}
                      onDragEnter={(e) => board.handleDragEnter(square, e)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => board.handleDrop(square, e)}
                      lastMove={lastMove()}
                      animationQueue={animationQueue()}
                      consumeAnimation={consumeAnimation}
                      flipped={activePlayerColor() === "b"}
                      isCheck={
                        piece()?.type === "k" &&
                        piece()?.color === turn() &&
                        isCheck() &&
                        !isCheckmate()
                      }
                      isCheckmate={
                        piece()?.type === "k" && piece()?.color === turn() && isCheckmate()
                      }
                      isStalemate={
                        piece()?.type === "k" && piece()?.color === turn() && isStalemate()
                      }
                    />
                  );
                }}
              </For>
            )}
          </For>

          <Show when={props.fogOfWar && visionCells().length < 64}>
            <svg class={styles["fog-overlay"]} viewBox="0 0 8 8" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <mask
                  id={fogMaskId}
                  maskUnits="userSpaceOnUse"
                  x="0"
                  y="0"
                  width="8"
                  height="8"
                >
                  <rect width="8" height="8" fill="#fff" />
                  <Show when={visionPaths().length > 0}>
                    {/* Soft ~4px falloff, then fog hole rounded only at union corners. */}
                    <g fill="none" stroke="#787878" stroke-width="0.13" stroke-linejoin="round">
                      <For each={visionPaths()}>{(d) => <path d={d} />}</For>
                    </g>
                    <g fill="#000">
                      <For each={visionPaths()}>{(d) => <path d={d} />}</For>
                    </g>
                  </Show>
                </mask>
              </defs>
              <rect
                width="8"
                height="8"
                fill="rgba(3, 7, 10, 0.88)"
                mask={`url(#${fogMaskId})`}
              />
            </svg>
          </Show>

          <Show when={board.bestMoveArrow()}>
            {(arrow) => (
              <ChessBoardArrow
                from={arrow().from}
                to={arrow().to}
                color="#7dd17d"
                id="best-move-arrow-head"
              />
            )}
          </Show>

          <Show when={adviceArrow()}>
            {(arrow) => (
              <ChessBoardArrow
                from={arrow().from}
                to={arrow().to}
                color="#76b3e1"
                id="advice-arrow-head"
              />
            )}
          </Show>

          <Show when={hasCombatFx() && boardSize()}>
            {(size) => (
              <>
                <Show when={resolvedAttackCues().length > 0}>
                  <AttackAnimation
                    cues={resolvedAttackCues()}
                    dyingIds={props.attackDying}
                    boardWidth={size().width}
                    boardHeight={size().height}
                  />
                </Show>
                <Show when={resolvedDeathCues().length > 0}>
                  <DeathAnimation
                    cues={resolvedDeathCues()}
                    boardWidth={size().width}
                    boardHeight={size().height}
                  />
                </Show>
              </>
            )}
          </Show>

          <Show when={touchDrag()}>
            {(drag) => (
              <img
                src={getPieceImg(drag().piece.type, drag().piece.color, drag().pieceSet)}
                alt=""
                class={styles["touch-ghost"]}
                style={{ left: `${drag().x}px`, top: `${drag().y}px` }}
              />
            )}
          </Show>

          <PromotionModal
            pending={board.pendingPromotion()}
            onSelect={board.resolvePromotion}
            onCancel={board.cancelPromotion}
          />
        </div>
      </div>
      <GameOverBanner
        open={isGameOver()}
        heading={
          isResigned()
            ? "Resignation"
            : game().isCheckmate()
              ? "Checkmate"
              : game().isStalemate()
                ? "Stalemate"
                : "Draw"
        }
      >
        <Show
          when={props.gameOverActions != null}
          fallback={
            <>
              <Button
                primary
                onClick={() => {
                  setShowNewGame(true);
                  navigate("/selena");
                }}
              >
                Another Game
              </Button>
              <Show when={hasRecordedReview(game().pgn(), startingFen())}>
                <Button href={`/review/${getExpectedReviewId(game().pgn(), startingFen())}`}>
                  Review Game
                </Button>
              </Show>
            </>
          }
        >
          {props.gameOverActions}
        </Show>
      </GameOverBanner>
    </div>
  );
};
