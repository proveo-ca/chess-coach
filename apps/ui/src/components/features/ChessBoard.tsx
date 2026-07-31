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

import type {
  AttackCue,
  DeathCue,
  DeployCue,
  KingDamageCue,
  KingDamageState,
  MoveCue,
} from "~/types/broodwar";
import { AttackAnimation } from "~/broodwar/animations/AttackAnimation";
import { DeathAnimation } from "~/broodwar/animations/DeathAnimation";
import { DeployAnimation } from "~/broodwar/animations/DeployAnimation";
import { KingDamageOverlay } from "~/broodwar/animations/kingDamageOverlay";
import { MoveAnimation } from "~/broodwar/animations/MoveAnimation";
import { buildFxHiddenSquares, EMPTY_FX_HIDDEN, hasCombatFxInput } from "~/broodwar/boardFx";
import { rookModeAt, siegedRooks } from "~/broodwar/broodWarStore";
import { isBroodWarBoard } from "~/broodwar/classicalOutcomes";
import { MOVE_MS } from "~/broodwar/constants";
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
  /**
   * Command Center deploy drops — piece is overlay-only until the cue ends;
   * callers should commit FEN after {@link DEPLOY_MS}.
   */
  deployCues?: DeployCue[];
  /** Quiet / occupy slide cues — hides `from` while travelling. */
  moveCues?: MoveCue[];
  /** Slide progress keyed by move cue id (0 = from, 1 = to). */
  moveProgress?: Record<string, 0 | 1>;
  /** Knight L-path facing: 0 = long leg, 1 = short leg (after elbow). */
  moveLeg?: Record<string, 0 | 1>;
  /** @deprecated Prefer store {@link rookModeAt}; board-wide override for fog stories. */
  rookMode?: import("~/types/broodwar").RookMode;
  /** Squares with an armed spider mine (drawn under pieces). */
  spiderMines?: readonly Square[] | ReadonlySet<Square>;
  /** Owner color for `spiderMines` (defaults to active player). */
  spiderMineColor?: Color;
  /** King HP presentation — prefer `KingDamageCue[]` (stable id across moves). */
  kingDamage?: readonly KingDamageCue[] | Partial<Record<Square, KingDamageState>>;
}> = (props) => {
  const navigate = useNavigate();
  const board = useChessBoard();

  const displayRanks = () => (activePlayerColor() === "w" ? RANKS : [...RANKS].reverse());
  const displayFiles = () => (activePlayerColor() === "w" ? FILES : [...FILES].reverse());

  const activeGame = () => board.activeGame();
  const lastMove = () => board.lastMove();
  const animationQueue = () => board.animationQueue();
  const consumeAnimation = (m: MoveSquares) => board.consumeAnimation?.(m);

  const broodWarRules = createMemo(() =>
    isBroodWarBoard({ fogOfWar: props.fogOfWar, variant: props.variant }),
  );

  const resolvedAttackCues = createMemo(() => {
    if (props.attackCues?.length) return props.attackCues;
    return props.attackCue ? [props.attackCue] : [];
  });
  const resolvedDeathCues = createMemo(() => props.deathCues ?? []);
  const resolvedDeployCues = createMemo(() => props.deployCues ?? []);
  const resolvedMoveCues = createMemo(() => props.moveCues ?? []);
  const moveProgress = createMemo(() => props.moveProgress ?? {});
  const moveLeg = createMemo(() => props.moveLeg ?? {});
  const kingDamageCues = createMemo((): KingDamageCue[] => {
    const raw = props.kingDamage;
    if (!raw) return [];
    const dying = new Set(resolvedDeathCues().map((c) => c.at));
    if (Array.isArray(raw)) {
      return raw.filter((c) => c.damage !== "pristine" && !dying.has(c.at));
    }
    return (Object.entries(raw) as [Square, KingDamageState][])
      .filter(([at, damage]) => damage != null && damage !== "pristine" && !dying.has(at))
      .map(([at, damage]) => ({ id: `king-${at}`, at, damage }));
  });

  /**
   * While a damaged king slides (`at` changes), keep hiding the previous square
   * for MOVE_MS so the board `<img>` cannot flash beside the overlay.
   * No-op when `kingDamage` is unset (Coach / Analysis / Review / LAN).
   */
  const [kingFleeCover, setKingFleeCover] = createSignal<ReadonlySet<Square>>(EMPTY_FX_HIDDEN);
  const prevKingAt = new Map<string, Square>();
  const fleeCoverTimers: number[] = [];
  createEffect(() => {
    const cues = kingDamageCues();
    if (cues.length === 0) {
      prevKingAt.clear();
      if (kingFleeCover() !== EMPTY_FX_HIDDEN) setKingFleeCover(EMPTY_FX_HIDDEN);
      return;
    }
    const newly: Square[] = [];
    const seen = new Set<string>();
    for (const c of cues) {
      seen.add(c.id);
      const old = prevKingAt.get(c.id);
      if (old && old !== c.at) newly.push(old);
      prevKingAt.set(c.id, c.at);
    }
    for (const id of prevKingAt.keys()) {
      if (!seen.has(id)) prevKingAt.delete(id);
    }
    if (newly.length === 0) return;
    setKingFleeCover((prev) => new Set([...prev, ...newly]));
    const t = window.setTimeout(() => {
      setKingFleeCover((prev) => {
        const next = new Set(prev);
        for (const s of newly) next.delete(s);
        return next.size === 0 ? EMPTY_FX_HIDDEN : next;
      });
    }, MOVE_MS);
    fleeCoverTimers.push(t);
  });
  onCleanup(() => {
    while (fleeCoverTimers.length) window.clearTimeout(fleeCoverTimers.pop());
  });

  /** Combat overlays — only when Brood War props feed cues (classical boards stay false). */
  const combatFxInput = createMemo(() => ({
    attacks: resolvedAttackCues(),
    deaths: resolvedDeathCues(),
    moves: resolvedMoveCues(),
    kingDamage: kingDamageCues(),
    fleeCover: kingFleeCover(),
  }));
  const hasCombatFx = createMemo(() => hasCombatFxInput(combatFxInput()));
  const hasDeployFx = createMemo(() => resolvedDeployCues().length > 0);
  const needsBoardMetrics = createMemo(() => hasCombatFx() || hasDeployFx());
  const fxHiddenSquares = createMemo(() => buildFxHiddenSquares(combatFxInput()));
  const mineSquares = createMemo(() => {
    const raw = props.spiderMines;
    if (!raw) return null;
    return raw instanceof Set ? raw : new Set(raw);
  });

  const [boardSize, setBoardSize] = createSignal<{ width: number; height: number } | null>(null);
  let boardGridRef = undefined as HTMLDivElement | undefined;

  createEffect(() => {
    if (!needsBoardMetrics()) {
      setBoardSize(null);
      return;
    }
    const el = boardGridRef;
    if (!el) return;
    const sync = () => {
      // Content box only — absolute overlays use the padding box (inside the
      // 4px board border). getBoundingClientRect includes the border and would
      // stretch every squareBoxStyle slot down/right.
      const width = el.clientWidth;
      const height = el.clientHeight;
      // Keep referential equality when unchanged — a new `{width,height}` each
      // ResizeObserver tick (e.g. mid-resolve loadFen) used to remount Show
      // children and restart attack CSS (tank “double fire”).
      setBoardSize((prev) =>
        prev && prev.width === width && prev.height === height ? prev : { width, height },
      );
    };
    sync();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    onCleanup(() => ro.disconnect());
  });

  /** Primitive gate so Show does not remount when boardSize object identity flips. */
  const combatOverlayReady = createMemo(() => {
    const s = boardSize();
    return hasCombatFx() && s != null && s.width > 0 && s.height > 0;
  });
  const deployOverlayReady = createMemo(() => {
    const s = boardSize();
    return hasDeployFx() && s != null && s.width > 0 && s.height > 0;
  });
  const combatBoardWidth = () => boardSize()?.width ?? 0;
  const combatBoardHeight = () => boardSize()?.height ?? 0;
  /** Resolve Siege Tank mode for a square (board override → store). */
  const modeForRook = (sq: Square) => {
    if (props.rookMode != null) return props.rookMode;
    // Track store so tank↔siege toggles re-render without fog vision memos.
    void siegedRooks();
    return rookModeAt(sq);
  };

  const nerdVision = createMemo(() => {
    // Touch siegedRooks so vision recompute when tanks toggle.
    void siegedRooks();
    return props.fogOfWar
      ? getSideVision(activeGame(), activePlayerColor(), { rookModeFor: modeForRook })
      : null;
  });
  const visibleSquares = createMemo(() => nerdVision()?.litSquares ?? null);
  /**
   * Pieces shown through fog without lighting the tile.
   * Active attack origins are always included so shooters under fog reveal
   * for the duration of their attack VFX.
   * Classical boards (no fog) always get `null` — no fog gating.
   */
  const revealedPieces = createMemo(() => {
    if (!props.fogOfWar) return null;
    const base = nerdVision()?.revealedPieces;
    const attacks = resolvedAttackCues();
    if (!attacks.length) return base ?? null;
    const next = new Set(base ?? []);
    // Attack-time only — quiet moveCues must not punch through fog.
    for (const cue of attacks) next.add(cue.from);
    return next;
  });
  const visionCells = createMemo(() => {
    if (!props.fogOfWar) return [] as ReturnType<typeof getVisionDisplayCells>;
    const visible = visibleSquares();
    if (!visible || visible.size === 0) return [] as ReturnType<typeof getVisionDisplayCells>;
    return getVisionDisplayCells(visible, displayFiles(), displayRanks());
  });
  const visionPaths = createMemo(() =>
    props.fogOfWar ? getVisionFogHolePaths(visionCells()) : ([] as string[]),
  );
  const fogOverlayId = createUniqueId();
  const fogMaskId = `${fogOverlayId}-mask`;

  /** Siege Tank in siege mode cannot relocate (vision widens instead). */
  const isSiegedRookSquare = (sq: Square | null | undefined): boolean => {
    if (!sq) return false;
    if (activeGame().get(sq)?.type !== "r") return false;
    return modeForRook(sq) === "siege";
  };

  const displayValidMoves = createMemo(() => {
    const sel = board.selectedSquare();
    if (isSiegedRookSquare(sel)) return [] as string[];
    return board.validMoves();
  });

  const handleSquareClick = (square: Square) => {
    const sel = board.selectedSquare();
    // Block completing a move from a sieged rook (hook still lists chess.js destinations).
    if (
      sel &&
      sel !== square &&
      isSiegedRookSquare(sel) &&
      board.validMoves().includes(square)
    ) {
      return;
    }
    void board.handleSquareClick(square);
  };

  const isCheck = () => !broodWarRules() && activeGame().inCheck();
  const isCheckmate = () => !broodWarRules() && activeGame().isCheckmate();
  const isStalemate = () => !broodWarRules() && activeGame().isStalemate();
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
      handleSquareClick(target);
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
  // End-game banner is shown only in the final game state — never while
  // replaying a past move or time-travelling. Brood War suppresses classical
  // draw / mate / stalemate (HP wins only).
  const isGameOver = () =>
    !broodWarRules() &&
    !isReplaying() &&
    !isTravelling() &&
    (game().isGameOver() || isResigned());

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
                      return !displayValidMoves().includes(square) && square !== selected;
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
                      isValidMove={displayValidMoves().includes(square)}
                      isAdviceHovered={adviceHoveredSquares().includes(square)}
                      isDragging={touchDrag()?.from === square}
                      isInvalid={isInvalid()}
                      isFogged={isFogged()}
                      hidePiece={
                        // Classical boards: fxHidden is the shared empty set (always false).
                        fxHiddenSquares().has(square) ||
                        (isFogged() === true &&
                          piece() != null &&
                          piece()?.color !== activePlayerColor() &&
                          !revealedPieces()?.has(square))
                      }
                      spiderMine={mineSquares()?.has(square) === true}
                      spiderMineColor={props.spiderMineColor ?? activePlayerColor()}
                      rookMode={
                        piece()?.type === "r" && broodWarRules()
                          ? modeForRook(square)
                          : undefined
                      }
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

          {/*
            One stable combat root for the whole FX window. Do NOT wrap each
            layer in its own Show — toggling death/kingDamage siblings remounts
            AttackAnimation and restarts CSS (rook/tank double-fire at ~FRAG+DEATH).
          */}
          <Show when={combatOverlayReady()}>
            <div data-broodwar-combat-root style={{ position: "absolute", inset: "0", "pointer-events": "none" }}>
              <KingDamageOverlay
                cues={kingDamageCues()}
                boardWidth={combatBoardWidth()}
                boardHeight={combatBoardHeight()}
              />
              <AttackAnimation
                cues={resolvedAttackCues()}
                dyingIds={props.attackDying}
                boardWidth={combatBoardWidth()}
                boardHeight={combatBoardHeight()}
              />
              <DeathAnimation
                cues={resolvedDeathCues()}
                boardWidth={combatBoardWidth()}
                boardHeight={combatBoardHeight()}
              />
              <MoveAnimation
                cues={resolvedMoveCues()}
                progress={moveProgress()}
                leg={moveLeg()}
                boardWidth={combatBoardWidth()}
                boardHeight={combatBoardHeight()}
              />
            </div>
          </Show>

          <Show when={deployOverlayReady()}>
            <DeployAnimation
              cues={resolvedDeployCues()}
              boardWidth={combatBoardWidth()}
              boardHeight={combatBoardHeight()}
            />
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
