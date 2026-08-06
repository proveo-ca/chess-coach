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
  MineMissileCue,
  MoveCue,
  QueenJumpTrail,
} from "~/starchess/types";
import { AttackAnimation } from "~/starchess/animations/AttackAnimation";
import { DeathAnimation } from "~/starchess/animations/DeathAnimation";
import { DeployAnimation } from "~/starchess/animations/DeployAnimation";
import { KingDamageOverlay } from "~/starchess/animations/kingDamageOverlay";
import { MineMissileAnimation } from "~/starchess/animations/MineMissileAnimation";
import { MoveAnimation } from "~/starchess/animations/MoveAnimation";
import { QueenJumpAnimation } from "~/starchess/animations/QueenJumpAnimation";
import { buildFxHiddenSquares, EMPTY_FX_HIDDEN, hasCombatFxInput } from "~/starchess/boardFx";
import { useAutoMineDeploy } from "~/starchess/hooks/useAutoMineDeploy";
import { useScMoveProvider } from "~/starchess/hooks/useScMoveProvider";
import {
  planningSnapshot,
  rookModeAt,
  siegedRooks,
  specialsUsedThisTurn,
} from "~/starchess/starChessStore";
import { isStarChessBoard } from "~/starchess/classicalOutcomes";
import { MOVE_MS, MOVE_SQUARE_MS } from "~/starchess/constants";
import {
  gameWithMovePathOccupancy,
  getSideVision,
  getVisionDisplayCells,
  getVisionFogHolePaths,
  type MoveVisionCue,
} from "~/starchess/vision";
import { ChessBoardArrow } from "~/components/atoms/ChessBoardArrow.tsx";
import { StarChessSquare } from "~/starchess/board/StarChessSquare";
import { GameOverBanner } from "~/components/features/GameOverBanner";
import styles from "~/starchess/board/StarChessBoardView.module.css";
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
// SPEC: _spec/apps/ui/starchess/sc-moves.puml
import type { MoveSquares } from "~/types/game";
import type { NerdBoardVariant } from "~/starchess/types";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

const getPieceImg = (type: PieceSymbol, color: Color, pieceSet: string) =>
  `/chess/pieces/${pieceSet}/${color}${type.toUpperCase()}.svg`;

const squareFromTouch = (touch: Touch): Square | null => {
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  return ((el?.closest("[data-square]") as HTMLElement | null)?.dataset.square as Square) ?? null;
};

export const StarChessBoardView: Component<{
  /** Override end-of-game CTAs (Review: Another Game → /selena + Replay Review). */
  gameOverActions?: JSX.Element;
  /** StarChess tile treatment; reserved for Nerd mode. */
  variant?: NerdBoardVariant;
  /** Cumulative side-vision fog; reserved for Nerd mode. */
  fogOfWar?: boolean;
  /** Single StarChess attack cue (convenience; prefer `attackCues` for simultaneous). */
  attackCue?: AttackCue | null;
  /** Active StarChess attack VFX cues. */
  attackCues?: AttackCue[];
  /** Attack cue ids whose hull has swapped to death art mid-cue. */
  attackDying?: Record<string, boolean>;
  /** Active StarChess death VFX cues. */
  deathCues?: DeathCue[];
  /**
   * Deploy drop overlays. Prefer board auto-deploy via occupancy (StarChessBoard);
   * optional explicit cues still hide `at` while playing.
   */
  deployCues?: DeployCue[];
  /** Quiet / occupy slide cues — hides `from` while travelling. */
  moveCues?: MoveCue[];
  /** Slide progress keyed by move cue id (0 = from, 1 = to). */
  moveProgress?: Record<string, 0 | 1>;
  /** Knight L-path facing: 0 = long leg, 1 = short leg (after elbow). */
  moveLeg?: Record<string, 0 | 1>;
  /** Tactical Jump teleport cues (own fx-hidden squares; rendered by QueenJumpAnimation). */
  jumpCues?: MoveCue[];
  /** Tactical Jump green thruster trails (1000ms; no board hiding). */
  jumpTrails?: QueenJumpTrail[];
  /** Spider Mine squares in chase wake (legs + lift on the board glyph). */
  chasingMines?: readonly { at: Square; legMs: number[] }[];
  /** Spider Mine self-missile hulls after the victim lands. */
  mineMissiles?: MineMissileCue[];
  /** Single green trails for mine missiles (queen/battlecruiser palette). */
  mineMissileTrails?: QueenJumpTrail[];
  /** Mines that already launched — stay off the board glyph until combat clears. */
  spentMines?: readonly Square[];
  /**
   * When true, skip auto unit/mine deploy VFX and re-baseline (DualNav scrub).
   * StarChessBoard forwards this for mine burrow + piece drop.
   */
  suppressAutoDeploy?: boolean;
  /** @deprecated Prefer store {@link rookModeAt}; board-wide override for fog stories. */
  rookMode?: import("~/starchess/types").RookMode;
  /** Squares with an armed spider mine (drawn under pieces). Plain squares use `spiderMineColor`. */
  spiderMines?:
    | readonly Square[]
    | ReadonlySet<Square>
    | readonly { at: Square; color: Color }[];
  /** Owner color for plain-square `spiderMines` (defaults to active player). */
  spiderMineColor?: Color;
  /** Engine-special target squares (Charon Booster Missiles queen) with a distinct ring. */
  specialTargets?: readonly Square[];
  /**
   * Queued planning intent destinations — ghost piece silhouettes
   * (live NerdScreen; DualNav SCFEN review omits these).
   */
  intentDestinations?: readonly {
    at: Square;
    color: Color;
    piece: PieceSymbol;
    rookMode?: import("~/starchess/types").RookMode;
  }[];
  /** Queued specials — ghost canister over the unit square. */
  intentCanisters?: readonly { at: Square; color: Color }[];
  /** Pending king-checks (`H:`) — red dashed rings on threatened kings. */
  intentChecks?: readonly { at: Square }[];
  /** Squares whose Goliath is Charon-armed (popped shoulder launchers). */
  armedBishops?: readonly Square[];
  /**
   * First chance at square clicks/taps. Return true to swallow the board's
   * classical selection/move handling (special targeting mode).
   */
  onSquareClickIntercept?: (square: Square) => boolean;
  /** King HP presentation — prefer `KingDamageCue[]` (stable id across moves). */
  kingDamage?: readonly KingDamageCue[] | Partial<Record<Square, KingDamageState>>;
}> = (props) => {
  const navigate = useNavigate();

  const starChessRules = createMemo(() =>
    isStarChessBoard({ fogOfWar: props.fogOfWar, variant: props.variant }),
  );
  // SC-native legality only during a live planning snap (phase P). Cosmetic
  // fog/variant boards without a snap keep the classical chess.js path.
  const scMoveProvider = useScMoveProvider();
  const board = useChessBoard({
    moveProvider: () => {
      if (!starChessRules()) return undefined;
      const snap = planningSnapshot();
      if (!snap || snap.phase !== "P") return undefined;
      return scMoveProvider;
    },
  });

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
  const resolvedDeployCuesRaw = createMemo(() => props.deployCues ?? []);
  const resolvedMoveCues = createMemo(() => props.moveCues ?? []);
  const resolvedJumpCues = createMemo(() => props.jumpCues ?? []);
  const resolvedJumpTrails = createMemo(() => props.jumpTrails ?? []);
  const resolvedMineMissiles = createMemo(() => props.mineMissiles ?? []);
  const resolvedMineTrails = createMemo(() => props.mineMissileTrails ?? []);
  const chasingBySquare = createMemo(() => {
    const map = new Map<Square, number[]>();
    for (const c of props.chasingMines ?? []) map.set(c.at, c.legMs);
    return map;
  });
  const mineMissileOrigins = createMemo(
    () => new Set(resolvedMineMissiles().map((c) => c.from)),
  );
  const spentMineSquares = createMemo(() => new Set(props.spentMines ?? []));
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

  const mineEntries = createMemo(() => {
    const raw = props.spiderMines;
    if (!raw) return [] as { at: Square; color: Color }[];
    const fallback = props.spiderMineColor ?? activePlayerColor();
    if (raw instanceof Set) {
      return [...raw].map((at) => ({ at, color: fallback }));
    }
    const list = [...raw];
    if (list.length === 0) return [];
    if (typeof list[0] === "string") {
      return (list as Square[]).map((at) => ({ at, color: fallback }));
    }
    return list as { at: Square; color: Color }[];
  });
  const { mineDeployCues, cueAt: mineDeployCueAt } = useAutoMineDeploy({
    mines: mineEntries,
    enabled: () => !props.suppressAutoDeploy,
  });
  const mineSquares = createMemo(() => new Set(mineEntries().map((m) => m.at)));
  const mineColorAt = (sq: Square): Color =>
    mineEntries().find((m) => m.at === sq)?.color ?? props.spiderMineColor ?? activePlayerColor();
  const specialTargetSquares = createMemo(() => new Set(props.specialTargets ?? []));
  const armedBishopSquares = createMemo(() => new Set(props.armedBishops ?? []));
  const intentDestAt = createMemo(() => {
    const map = new Map<
      Square,
      { color: Color; piece: PieceSymbol; rookMode?: import("~/starchess/types").RookMode }
    >();
    for (const g of props.intentDestinations ?? []) {
      map.set(g.at, {
        color: g.color,
        piece: g.piece,
        ...(g.rookMode ? { rookMode: g.rookMode } : {}),
      });
    }
    return map;
  });
  const intentCanisterAt = createMemo(() => {
    const map = new Map<Square, Color>();
    for (const g of props.intentCanisters ?? []) map.set(g.at, g.color);
    return map;
  });

  const [boardSize, setBoardSize] = createSignal<{ width: number; height: number } | null>(null);
  let boardGridRef = undefined as HTMLDivElement | undefined;

  /** Resolve Siege Tank mode for a square (board override → store). */
  const modeForRook = (sq: Square) => {
    if (props.rookMode != null) return props.rookMode;
    // Track store so tank↔siege toggles re-render without fog vision memos.
    void siegedRooks();
    return rookModeAt(sq);
  };

  /**
   * Progressive path fog — tick while move cues are sliding so lit squares
   * advance with the hull (resolve.puml).
   */
  const [moveVisionTick, setMoveVisionTick] = createSignal(0);
  const moveVisionStartedAt = new Map<string, number>();
  createEffect(() => {
    const cues = resolvedMoveCues();
    const prog = moveProgress();
    if (!props.fogOfWar || cues.length === 0) {
      moveVisionStartedAt.clear();
      return;
    }
    const now = performance.now();
    const live = new Set(cues.map((c) => c.id));
    for (const id of moveVisionStartedAt.keys()) {
      if (!live.has(id)) moveVisionStartedAt.delete(id);
    }
    for (const c of cues) {
      if (prog[c.id] === 1 && !moveVisionStartedAt.has(c.id)) {
        moveVisionStartedAt.set(c.id, now);
      }
    }
    const sliding = cues.some((c) => prog[c.id] === 1);
    if (!sliding) return;
    const tick = window.setInterval(
      () => setMoveVisionTick((n) => n + 1),
      Math.max(32, MOVE_SQUARE_MS / 4),
    );
    onCleanup(() => window.clearInterval(tick));
  });

  const nerdVision = createMemo(() => {
    // Touch siegedRooks so vision recompute when tanks toggle.
    void siegedRooks();
    void moveVisionTick();
    if (!props.fogOfWar) return null;
    const cues = resolvedMoveCues();
    const prog = moveProgress();
    const now = performance.now();
    const relocating: MoveVisionCue[] = [];
    for (const c of cues) {
      if (prog[c.id] !== 1) continue;
      const startedAt = moveVisionStartedAt.get(c.id);
      if (startedAt == null) continue;
      relocating.push({
        id: c.id,
        from: c.from,
        to: c.to,
        piece: c.piece,
        startedAt,
      });
    }
    const visionGame =
      relocating.length > 0
        ? gameWithMovePathOccupancy(activeGame(), relocating, now)
        : activeGame();
    return getSideVision(visionGame, activePlayerColor(), {
      rookModeFor: modeForRook,
      mines: mineEntries(),
    });
  });
  const visibleSquares = createMemo(() => nerdVision()?.litSquares ?? null);
  /**
   * Deploy drop overlays — never punch a fogged enemy into view. Own units
   * remain visible (and may deploy) even on unlit tiles.
   * Defined after `visibleSquares` (depends on fog vision).
   */
  const deployOverlayCues = createMemo(() => {
    const cues = resolvedDeployCuesRaw();
    if (!props.fogOfWar) return cues;
    const lit = visibleSquares();
    const viewer = activePlayerColor();
    return cues.filter((c) => c.color === viewer || !!lit?.has(c.at));
  });
  /**
   * Pieces shown through fog without lighting the tile.
   * Active attack origins are always included so shooters under fog reveal
   * for the duration of their attack VFX.
   * Chase mine combat also reveals the hunted mover (engine mineTriggers →
   * moveCues / missile to) so path-collide is not a fog-hidden “random boom”.
   * Classical boards (no fog) always get `null` — no fog gating.
   */
  const revealedPieces = createMemo(() => {
    if (!props.fogOfWar) return null;
    const base = nerdVision()?.revealedPieces;
    const attacks = resolvedAttackCues();
    const chaseActive =
      (props.chasingMines?.length ?? 0) > 0 || resolvedMineMissiles().length > 0;
    if (!attacks.length && !chaseActive) return base ?? null;
    const next = new Set(base ?? []);
    // Reveal shooter origin and the target square (victim under fog for the shot).
    for (const cue of attacks) {
      next.add(cue.from);
      next.add(cue.to);
    }
    // Quiet moves stay fog-gated — except engine chase victims mid-hunt.
    if (chaseActive) {
      for (const cue of resolvedMoveCues()) {
        next.add(cue.from);
        next.add(cue.to);
      }
      for (const m of resolvedMineMissiles()) {
        next.add(m.from);
        next.add(m.to);
      }
    }
    return next;
  });

  /** Damaged-king overlay — never punch a fogged enemy command center into view. */
  const fogSafeKingDamageCues = createMemo((): KingDamageCue[] => {
    const cues = kingDamageCues();
    if (!props.fogOfWar) return cues;
    const lit = visibleSquares();
    const revealed = revealedPieces();
    const viewer = activePlayerColor();
    return cues.filter((c) => {
      if (c.id === viewer) return true;
      return !!lit?.has(c.at) || !!revealed?.has(c.at);
    });
  });

  /** Combat overlays — only when StarChess props feed cues (classical boards stay false). */
  const combatFxInput = createMemo(() => ({
    attacks: resolvedAttackCues(),
    deaths: resolvedDeathCues(),
    moves: [...resolvedMoveCues(), ...resolvedJumpCues()],
    // Fog-safe: never reserve hide-slots for an enemy command center the viewer can't see.
    kingDamage: fogSafeKingDamageCues(),
    // Raw deploys for hide-set; fog-filtered cues feed DeployAnimation only.
    deploys: resolvedDeployCuesRaw(),
    jumpTrails: [...resolvedJumpTrails(), ...resolvedMineTrails()],
    mineMissiles: resolvedMineMissiles(),
    fleeCover: kingFleeCover(),
  }));
  const hasCombatFx = createMemo(() => hasCombatFxInput(combatFxInput()));
  const hasDeployFx = createMemo(() => resolvedDeployCuesRaw().length > 0);
  const fxHiddenSquares = createMemo(() => buildFxHiddenSquares(combatFxInput()));
  const needsBoardMetrics = createMemo(
    () =>
      hasCombatFx() ||
      hasDeployFx() ||
      chasingBySquare().size > 0 ||
      mineDeployCues().length > 0,
  );

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

  const intentCheckAt = createMemo(() => {
    const set = new Set<Square>();
    const lit = visibleSquares();
    const revealed = revealedPieces();
    for (const g of props.intentChecks ?? []) {
      if (props.fogOfWar === true) {
        if (!lit?.has(g.at) && !revealed?.has(g.at)) continue;
      }
      set.add(g.at);
    }
    return set;
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

  // Under SC rules the provider already emits sieged-rook artillery captures
  // (firesInPlace) and filters dropsAtResolve — no chess.js destination block.
  const displayValidMoves = createMemo(() => board.validMoves());

  const handleSquareClick = (square: Square) => {
    if (props.onSquareClickIntercept?.(square)) return;
    void board.handleSquareClick(square);
  };

  const isCheck = () => !starChessRules() && activeGame().inCheck();
  const isCheckmate = () => !starChessRules() && activeGame().isCheckmate();
  const isStalemate = () => !starChessRules() && activeGame().isStalemate();
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
    if (!sq || board.isReplaying()) return;
    if (props.onSquareClickIntercept?.(sq)) {
      e.preventDefault();
      return;
    }
    if (capabilities().readOnly) return;

    const g = board.game();
    const piece = g.get(sq);
    if (!piece) return;

    // Prefer provider canSelect (SC); classical turn/colour otherwise.
    const canTouch = board.canSelectPiece
      ? board.canSelectPiece(sq)
      : capabilities().freeColorControl
        ? piece.color === g.turn()
        : g.turn() === activePlayerColor() && piece.color === activePlayerColor();
    if (!canTouch) return;

    e.preventDefault();

    // Select the piece (sets selectedSquare + validMoves inside the hook)
    void board.handleSquareClick(sq);

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
  // replaying a past move or time-travelling. StarChess suppresses classical
  // draw / mate / stalemate (HP wins only).
  const isGameOver = () =>
    !starChessRules() &&
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
                      if (board.canSelectPiece) return !board.canSelectPiece(square);
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
                    <StarChessSquare
                      square={square}
                      piece={piece() ?? null}
                      pieceSet={squarePieceSet()}
                      isLight={(rIndex() + fIndex()) % 2 === 0}
                      isSelected={board.selectedSquare() === square}
                      isHovered={board.hoveredSquare() === square}
                      isValidMove={displayValidMoves().includes(square)}
                      isAdviceHovered={adviceHoveredSquares().includes(square)}
                      isSpecialTarget={specialTargetSquares().has(square)}
                      intentTarget={intentDestAt().get(square)}
                      intentCanisterColor={intentCanisterAt().get(square)}
                      intentCheck={intentCheckAt().has(square)}
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
                      spiderMine={
                        mineSquares().has(square) &&
                        !mineMissileOrigins().has(square) &&
                        !spentMineSquares().has(square) &&
                        // Own mines always show (they light their tile). Enemy mines
                        // stay hidden under fog until the square is otherwise lit.
                        (mineColorAt(square) === activePlayerColor() ||
                          !(props.fogOfWar === true && isFogged() === true))
                      }
                      spiderMineColor={mineColorAt(square)}
                      spiderMineChasing={chasingBySquare().has(square)}
                      spiderMineDeploying={!!mineDeployCueAt(square)}
                      spiderMineLegMs={
                        mineDeployCueAt(square)?.legMs ?? chasingBySquare().get(square)
                      }
                      rookMode={
                        piece()?.type === "r" && starChessRules()
                          ? modeForRook(square)
                          : undefined
                      }
                      charonArmed={armedBishopSquares().has(square)}
                      bishopFace={piece()?.color === activePlayerColor() ? "front" : "back"}
                      specialUsed={
                        starChessRules() && specialsUsedThisTurn().has(square)
                      }
                      showRank={fIndex() === 0 && rank}
                      showFile={rIndex() === 7 && file}
                      onClick={() => handleSquareClick(square)}
                      onMouseEnter={() => board.handleSquareHover(square)}
                      onDragStart={(e) => {
                        if (props.onSquareClickIntercept?.(square)) {
                          e.preventDefault();
                          return;
                        }
                        board.handleDragStart(square, e);
                      }}
                      onDragEnter={(e) => board.handleDragEnter(square, e)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        if (props.onSquareClickIntercept?.(square)) {
                          e.preventDefault();
                          return;
                        }
                        board.handleDrop(square, e);
                      }}
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
            <div data-starchess-combat-root style={{ position: "absolute", inset: "0", "pointer-events": "none" }}>
              <KingDamageOverlay
                cues={fogSafeKingDamageCues()}
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
              <QueenJumpAnimation
                cues={resolvedJumpCues()}
                trails={resolvedJumpTrails()}
                boardWidth={combatBoardWidth()}
                boardHeight={combatBoardHeight()}
              />
              <MineMissileAnimation
                cues={resolvedMineMissiles()}
                trails={resolvedMineTrails()}
                boardWidth={combatBoardWidth()}
                boardHeight={combatBoardHeight()}
              />
            </div>
          </Show>

          <Show when={deployOverlayReady()}>
            <DeployAnimation
              cues={deployOverlayCues()}
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
