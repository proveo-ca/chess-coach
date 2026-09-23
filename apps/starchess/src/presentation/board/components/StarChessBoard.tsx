// SPEC: _spec/apps/starchess/demos.puml, _spec/apps/starchess/architecture/board-entities.puml, _spec/apps/starchess/architecture/strategy-starchess-board.puml
/**
 * Snapshot-driven StarChess board — eclipse/butter/vermeer (default eclipse).
 * Vision via VisionStrategy (player fog | observer dual borders).
 * Presentation CSS matches apps/ui StarChessBoardView + StarChessSquare at 3bed049.
 */
import { For, Show, createEffect, createMemo, createSignal, createUniqueId, onCleanup, onMount } from "solid-js";
import type { Component } from "solid-js";
import type { Square } from "chess.js";
import clsx from "clsx";

import {
  getSideVision,
  placementToMap,
  type RookMode,
  type ScFenSnapshot,
  type StarChessColor,
} from "@chess-coach/starchess-core";

import {
  FILES,
  RANKS,
  isLightSquare,
} from "~/presentation/board/components/StarChessSquare";
import type { TutorialBoardArrow } from "~/types/tutorial";
import {
  mapWithMovePathOccupancy,
  getVisionDisplayCells,
  getVisionBorderPaths,
  getVisionFogHolePaths,
  observerVisionFromSnap,
  type MoveVisionCue,
} from "~/presentation/board/fogProjection";
import { rookModeAt, rookModeForSieged } from "~/presentation/board/rookMode";
import { PieceGlyph } from "~/presentation/board/components/PieceGlyph";
import { visionStrategyFor } from "~/presentation/board/vision/VisionStrategy";
import { TEAM_PRIMARY } from "~/presentation/pieces/teamColors";
import { SpiderMine } from "~/presentation/specials/components/SpiderMine";
import { VespeneIcon } from "@chess-coach/ui-web/primitives/icons";
import { MoveAnimation } from "~/presentation/animations/components/MoveAnimation";
import { MOVE_SQUARE_MS } from "~/presentation/constants";
import type { MoveCue } from "~/types/cues";
import styles from "~/presentation/board/components/StarChessBoard.module.css";
import type {
  BoardSkin,
  IntentCanister,
  IntentCheck,
  IntentGhost,
  PieceSet,
  VisionMode,
} from "~/types/board";
import type { ReviewTurnPhase } from "~/types/review";

export type StarChessBoardProps = {
  snapshot: ScFenSnapshot;
  viewer?: StarChessColor;
  fog?: boolean;
  /**
   * DualNav review: no fog veil; stroke both sides' `getSideVision` in team colors.
   * Default `player` keeps live fog.
   */
  visionMode?: VisionMode;
  /** Only eclipse | butter | vermeer | classic — default eclipse. */
  variant?: BoardSkin;
  /**
   * Presentation skin. Default `nerd` (inline units).
   * `cburnett` = tutorial fog Chess mode only — not a core/rules concern.
   */
  pieceSet?: PieceSet;
  /** Phase frame border — matches TurnBar phase chip tones. */
  phase?: ReviewTurnPhase;
  siegedRooks?: readonly Square[];
  intentGhosts?: readonly IntentGhost[];
  /** Queued special — ghost canister badge on the actor square. */
  intentCanisters?: readonly IntentCanister[];
  /** Pending check / attack-intent rings (red dashed). */
  intentChecks?: readonly IntentCheck[];
  selected?: Square | null;
  legalDests?: readonly Square[];
  /** Tutorial destination rings (guide green). */
  hintSquares?: readonly Square[];
  /** Tutorial destination rings drawn in alert red. */
  hintAlertSquares?: readonly Square[];
  /** Tutorial hint lines drawn square-to-square (attack / x-ray lines). */
  hintArrows?: readonly TutorialBoardArrow[];
  onSquareClick?: (square: Square) => void;
  /**
   * Hide board glyphs on these squares (combat / king-damage overlays own them).
   * Must not mutate placement — vision reads SCFEN occupancy, not chess.js FEN.
   */
  hideSquares?: ReadonlySet<Square> | readonly Square[];
  /** Active move slides — progressive path fog while `moveProgress[id] === 1`. */
  moveCues?: readonly MoveCue[];
  moveProgress?: Readonly<Record<string, 0 | 1>>;
  /** Knight L-path facing (0 = long leg, 1 = short leg) by cue id. */
  moveLeg?: Record<string, 0 | 1>;
  /**
   * Enemy movers with a fogged origin whose path crosses viewer vision —
   * rendered as smooth hulls *under* the fog veil (z below the veil's lit-cell
   * holes), so they appear the moment they cross a lit square and are veiled
   * over dark ones. Their above-the-veil overlay hull is suppressed.
   */
  veilMoveCueIds?: ReadonlySet<string>;
  /** Hide mine glyphs after boom / while missile overlay owns them. */
  spentMines?: readonly Square[];
  /** Wake / chase — legs out on these squares. */
  chasingMines?: readonly Square[];
  /** Mecha squares with Charon launchers armed (inline SVG). */
  armedBishops?: readonly Square[];
  /** Shoulder-raise CSS only while arming (not for persistent U: pods). */
  armAnimBishops?: readonly Square[];
  /**
   * Gas special absorb — ease green aura onto the unit while the canister drops.
   * Lasts for the drop cue only; persistent green is snap `U:` / arm marks.
   */
  gasAbsorbSquares?: ReadonlySet<Square> | readonly Square[];
};

export const StarChessBoard: Component<StarChessBoardProps> = (props) => {
  const maskId = createUniqueId();
  const hintHeadId = createUniqueId();
  const hintHeadAlertId = createUniqueId();
  const viewer = () => props.viewer ?? "w";
  const variant = (): BoardSkin => props.variant ?? "eclipse";
  const pieceSet = (): PieceSet => props.pieceSet ?? "nerd";
  const strategy = () => visionStrategyFor(props.visionMode);
  const isObserver = () => strategy().isObserver;
  /** Player fog veil — off in observer mode or when fog=false. */
  const usePlayerFog = () => strategy().usePlayerFog(props.fog);
  const map = createMemo(() => placementToMap(props.snapshot.placement));
  const sieged = createMemo(
    () => new Set(props.siegedRooks ?? props.snapshot.siegedRooks ?? []),
  );
  const specialsUsed = createMemo(
    () => new Set(props.snapshot.specialsUsed ?? []),
  );
  const spentMines = createMemo(() => new Set(props.spentMines ?? []));
  const chasingMines = createMemo(() => new Set(props.chasingMines ?? []));
  const armedBishops = createMemo(() => new Set(props.armedBishops ?? []));
  const armAnimBishops = createMemo(() => new Set(props.armAnimBishops ?? []));
  const gasAbsorb = createMemo((): ReadonlySet<Square> => {
    const g = props.gasAbsorbSquares;
    if (!g) return new Set();
    return g instanceof Set ? g : new Set(g);
  });
  const minesBySquare = createMemo(() => {
    const out = new Map<Square, StarChessColor>();
    for (const m of props.snapshot.mines ?? []) out.set(m.at, m.color);
    return out;
  });
  const fxHidden = createMemo((): ReadonlySet<Square> => {
    const h = props.hideSquares;
    if (!h) return new Set();
    return h instanceof Set ? h : new Set(h);
  });

  const moveVisionStartedAt = new Map<string, number>();
  const [moveVisionTick, setMoveVisionTick] = createSignal(0);

  createEffect(() => {
    const cues = props.moveCues ?? [];
    const prog = props.moveProgress ?? {};
    if (!usePlayerFog() || cues.length === 0) {
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

  const fog = createMemo(() => {
    if (!usePlayerFog()) {
      return { litSquares: new Set<Square>(), revealedPieces: new Set<Square>() };
    }
    void moveVisionTick();
    void sieged();
    const cues = props.moveCues ?? [];
    const prog = props.moveProgress ?? {};
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
        stim: c.stim,
      });
    }
    const baseMap = map();
    const visionMap =
      relocating.length > 0
        ? mapWithMovePathOccupancy(baseMap, relocating, now)
        : baseMap;
    // U: specialsUsed is not a fog pierce — green aura paints only on lit units.
    return getSideVision(visionMap, viewer(), {
      rookModeFor: rookModeForSieged(sieged()),
      mines: props.snapshot.mines,
    });
  });

  /**
   * Veil-reveal movers — enemy hulls with a fogged origin whose path crosses
   * viewer vision. Rendered through the same {@link MoveAnimation} hulls as
   * any other mover, but inside a stacking context *below* the fog veil
   * (`.veilMoveLayer` z=2 < veil z=5): the veil's lit-cell holes show the
   * hull only while it crosses lit squares — visible the moment it enters
   * vision, veiled the moment it leaves, sliding smoothly the whole way.
   */
  const veilMoveCues = createMemo(() => {
    const ids = props.veilMoveCueIds;
    if (!ids || ids.size === 0) return [];
    return (props.moveCues ?? []).filter((c) => ids.has(c.id));
  });

  /** Grid box in px — MoveAnimation positions its hulls from these. */
  let gridEl: HTMLDivElement | undefined;
  const [gridPx, setGridPx] = createSignal({ w: 0, h: 0 });
  onMount(() => {
    const el = gridEl;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      setGridPx((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    onCleanup(() => ro.disconnect());
  });

  const litCells = createMemo(() =>
    usePlayerFog() ? getVisionDisplayCells(fog().litSquares, FILES, RANKS) : [],
  );
  const fogPaths = createMemo(() => getVisionFogHolePaths(litCells()));

  /**
   * Hint lines in the shared 0–8 board space, trimmed clear of both piece
   * glyphs so the line reads as pointing *between* squares rather than through
   * them. Same FILES/RANKS projection the fog overlay uses, so a line cannot
   * drift from the grid it annotates.
   */
  const hintLines = createMemo(() => {
    const centre = (sq: Square) => {
      const col = FILES.indexOf(sq[0] as (typeof FILES)[number]);
      const row = RANKS.indexOf(sq[1] as (typeof RANKS)[number]);
      return col < 0 || row < 0 ? null : { x: col + 0.5, y: row + 0.5 };
    };
    // Half a square clear at the tail, a little more at the head so the
    // arrowhead lands on the target's edge instead of on top of it.
    const TAIL = 0.34;
    const HEAD = 0.46;
    const pull = (
      start: { x: number; y: number },
      end: { x: number; y: number },
      tail: number,
      head: number,
    ) => {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) return null;
      const ux = dx / len;
      const uy = dy / len;
      return {
        x1: start.x + ux * tail,
        y1: start.y + uy * tail,
        x2: end.x - ux * head,
        y2: end.y - uy * head,
      };
    };
    return (props.hintArrows ?? []).flatMap((a) => {
      const from = centre(a.from);
      const to = centre(a.to);
      if (!from || !to) return [];
      const tone = a.tone === "alert" ? "alert" : "guide";
      const via = a.via ? centre(a.via) : null;
      if (a.via) {
        if (!via) return [];
        const out = pull(from, via, TAIL, 0);
        const into = pull(via, to, 0, HEAD);
        if (!out || !into) return [];
        return [{
          key: `${a.from}${a.to}`,
          tone,
          points: `${out.x1},${out.y1} ${via.x},${via.y} ${into.x2},${into.y2}`,
        }];
      }
      const straight = pull(from, to, TAIL, HEAD);
      if (!straight) return [];
      return [{
        key: `${a.from}${a.to}`,
        tone,
        points: `${straight.x1},${straight.y1} ${straight.x2},${straight.y2}`,
      }];
    });
  });

  /** Alert rings live in the arrow overlay (above the fog veil) so a last-seen
   * square stays marked without lifting the tile out of the fog. */
  const alertRings = createMemo(() =>
    (props.hintAlertSquares ?? []).flatMap((sq) => {
      const col = FILES.indexOf(sq[0] as (typeof FILES)[number]);
      const row = RANKS.indexOf(sq[1] as (typeof RANKS)[number]);
      if (col < 0 || row < 0) return [];
      const inset = 0.07;
      return [{ key: sq, x: col + inset, y: row + inset, size: 1 - inset * 2 }];
    }),
  );

  const dualVision = createMemo(() => {
    if (!isObserver()) return null;
    return observerVisionFromSnap(props.snapshot, {
      siegedRooks: props.siegedRooks ?? props.snapshot.siegedRooks,
    });
  });

  const observerPathsW = createMemo(() => {
    const v = dualVision();
    if (!v) return [] as string[];
    return getVisionBorderPaths(getVisionDisplayCells(v.w.litSquares, FILES, RANKS));
  });
  const observerPathsB = createMemo(() => {
    const v = dualVision();
    if (!v) return [] as string[];
    return getVisionBorderPaths(getVisionDisplayCells(v.b.litSquares, FILES, RANKS));
  });

  const ghostAt = (sq: Square) => props.intentGhosts?.find((g) => g.at === sq);
  const canisterAt = (sq: Square) =>
    props.intentCanisters?.find((g) => g.at === sq);
  const checkAt = (sq: Square) =>
    !!props.intentChecks?.some((g) => g.at === sq);

  return (
    <div class={styles["board-layout-wrapper"]}>
      <div
        class={`chessboard ${styles["chessboard-container"]}`}
        data-testid="chessboard"
        data-phase={props.phase ?? "start"}
      >
        <div class={styles["board-phase-ring"]} aria-hidden="true" />
        <div
          ref={(el) => {
            gridEl = el;
          }}
          data-board-grid
          data-vision-mode={isObserver() ? "observer" : "player"}
          class={clsx(
            styles.chessboard,
            variant() !== "classic" && styles[`chessboard--${variant()}`],
            variant() === "classic" && styles["chessboard--classic"],
            usePlayerFog() && styles["chessboard--fog"],
            isObserver() && styles["chessboard--observer"],
          )}
        >
          <Show when={usePlayerFog()}>
            <svg
              class={styles["fog-overlay"]}
              viewBox="0 0 8 8"
              preserveAspectRatio="none"
              aria-hidden
            >
              <defs>
                <mask
                  id={maskId}
                  maskUnits="userSpaceOnUse"
                  x="0"
                  y="0"
                  width="8"
                  height="8"
                >
                  <rect width="8" height="8" fill="#fff" />
                  <Show when={fogPaths().length > 0}>
                    <g fill="none" stroke="#787878" stroke-width="0.13" stroke-linejoin="round">
                      <For each={fogPaths()}>{(d) => <path d={d} />}</For>
                    </g>
                    <g fill="#000">
                      <For each={fogPaths()}>{(d) => <path d={d} />}</For>
                    </g>
                  </Show>
                </mask>
              </defs>
              <rect
                width="8"
                height="8"
                fill="rgba(3, 7, 10, 0.88)"
                mask={`url(#${maskId})`}
              />
            </svg>
          </Show>
          <Show when={isObserver()}>
            <svg
              class={styles["observer-vision-overlay"]}
              viewBox="0 0 8 8"
              preserveAspectRatio="none"
              data-observer-vision
              aria-hidden
            >
              <Show when={observerPathsW().length > 0}>
                <g
                  data-observer-vision-side="w"
                  fill="none"
                  stroke={TEAM_PRIMARY.w}
                  stroke-width="0.1"
                  stroke-linecap="square"
                  stroke-linejoin="miter"
                >
                  <For each={observerPathsW()}>{(d) => <path d={d} />}</For>
                </g>
              </Show>
              <Show when={observerPathsB().length > 0}>
                <g
                  data-observer-vision-side="b"
                  fill="none"
                  stroke={TEAM_PRIMARY.b}
                  stroke-width="0.1"
                  stroke-linecap="square"
                  stroke-linejoin="miter"
                >
                  <For each={observerPathsB()}>{(d) => <path d={d} />}</For>
                </g>
              </Show>
            </svg>
          </Show>
          <Show when={hintLines().length > 0 || alertRings().length > 0}>
            <svg
              class={styles["hint-arrow-overlay"]}
              viewBox="0 0 8 8"
              preserveAspectRatio="none"
              data-testid="board-hint-arrows"
              aria-hidden
            >
              <defs>
                {/* `markerUnits="strokeWidth"` keeps the head proportional to
                    the line, so one marker serves every board size. */}
                <marker
                  id={hintHeadId}
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="4"
                  markerHeight="4"
                  markerUnits="strokeWidth"
                  orient="auto-start-reverse"
                >
                  <path d="M0 1 L9 5 L0 9 Z" fill="currentColor" />
                </marker>
                <marker
                  id={hintHeadAlertId}
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="4"
                  markerHeight="4"
                  markerUnits="strokeWidth"
                  orient="auto-start-reverse"
                >
                  <path d="M0 1 L9 5 L0 9 Z" fill="#cb2000" />
                </marker>
              </defs>
              <For each={alertRings()}>
                {(r) => (
                  <rect
                    data-hint-alert={r.key}
                    class={styles["hint-alert-ring"]}
                    x={r.x}
                    y={r.y}
                    width={r.size}
                    height={r.size}
                  />
                )}
              </For>
              <For each={hintLines()}>
                {(l) => (
                  <polyline
                    data-hint-arrow={l.key}
                    class={l.tone === "alert" ? styles["hint-arrow-alert"] : undefined}
                    points={l.points}
                    marker-end={`url(#${l.tone === "alert" ? hintHeadAlertId : hintHeadId})`}
                  />
                )}
              </For>
            </svg>
          </Show>
          <For each={RANKS}>
            {(rank) => (
              <For each={FILES}>
                {(file) => {
                  const square = `${file}${rank}` as Square;
                  const piece = () => map().get(square) ?? null;
                  const isLight = () => isLightSquare(file, rank);
                  const isFogged = () =>
                    !usePlayerFog() ? false : !fog().litSquares.has(square);
                  const revealed = () => fog().revealedPieces.has(square);
                  const hidePiece = () => {
                    if (fxHidden().has(square)) return true;
                    if (!usePlayerFog()) return false;
                    const p = piece();
                    if (!p) return false;
                    return isFogged() && p.color !== viewer() && !revealed();
                  };
                  const localFogVeil = () => {
                    const p = piece();
                    return isFogged() && !!p && !hidePiece();
                  };
                  const visiblePiece = () => (hidePiece() ? null : piece());
                  const rookMode = (): RookMode =>
                    rookModeAt(square, sieged());
                  const isSelected = () => props.selected === square;
                  const isLegal = () => props.legalDests?.includes(square) ?? false;
                  const isHint = () => props.hintSquares?.includes(square) ?? false;
                  const gasUsedAura = () => {
                    // Resolve absorb — green eases onto the unit with the canister drop
                    // (LiveStarChessBoard already fog-gates gasDrop / absorb squares).
                    if (gasAbsorb().has(square)) return true;
                    if (!specialsUsed().has(square)) return false;
                    const p = piece();
                    if (!p) return false;
                    // Player fog: do not leak enemy U: stamps through the veil.
                    if (usePlayerFog() && hidePiece()) return false;
                    return true;
                  };
                  const canister = () => {
                    const c = canisterAt(square);
                    if (!c) return undefined;
                    // Hide only when the actor unit is occulted (enemy in fog).
                    // Own fogged tiles still show queued canisters above the veil.
                    if (usePlayerFog() && hidePiece()) return undefined;
                    return c;
                  };
                  const ghost = () => {
                    // Intent destinations paint above fog (square lift + ghost z).
                    return ghostAt(square);
                  };
                  const intentCheck = () => {
                    // Attack/move intent rings paint above fog (square lift z=7).
                    // Enemies stay hidden via hidePiece — ring alone does not reveal.
                    return checkAt(square);
                  };
                  const mineColor = () => minesBySquare().get(square);
                  const showMine = () => {
                    const color = mineColor();
                    if (!color) return false;
                    if (spentMines().has(square)) return false;
                    // Player fog: mines only on lit squares (own mine lights its tile).
                    if (usePlayerFog() && isFogged()) return false;
                    return true;
                  };
                  return (
                    <div
                      class={clsx(
                        styles.square,
                        isLight() ? styles.light : styles.dark,
                        isSelected() && styles.selected,
                        isLegal() && styles["advice-highlight"],
                        isHint() && styles["hint-highlight"],
                      )}
                      data-square={square}
                      data-hint={isHint() ? square : undefined}
                      data-legal={isLegal() ? square : undefined}
                      data-tone={isLight() ? "light" : "dark"}
                      data-fog={
                        !usePlayerFog()
                          ? undefined
                          : isFogged()
                            ? "hidden"
                            : "visible"
                      }
                      data-intent-dest={ghost() ? square : undefined}
                      data-intent-canister={canister() ? square : undefined}
                      data-intent-check={intentCheck() ? square : undefined}
                      data-spider-mine={showMine() ? square : undefined}
                      role={props.onSquareClick ? "button" : undefined}
                      onClick={() => props.onSquareClick?.(square)}
                    >
                      <Show when={localFogVeil()}>
                        <div class={styles.fog} aria-hidden="true" />
                      </Show>
                      <Show when={showMine() ? mineColor() : undefined}>
                        {(c) => (
                          <SpiderMine
                            color={c()}
                            state={chasingMines().has(square) ? "chasing" : "idle"}
                          />
                        )}
                      </Show>
                      <Show when={visiblePiece()}>
                        {(p) => (
                          <PieceGlyph
                            color={p().color}
                            type={p().type}
                            pieceSet={pieceSet()}
                            mode={rookMode()}
                            armed={armedBishops().has(square)}
                            armAnim={armAnimBishops().has(square)}
                            class={clsx(
                              styles.piece,
                              gasUsedAura() && styles.pieceSpecialUsed,
                            )}
                            alt={`${p().color} ${p().type}`}
                            data-special-used={gasUsedAura() ? "true" : undefined}
                          />
                        )}
                      </Show>
                      <Show when={canister()}>
                        {(c) => (
                          <div
                            class={styles.intentCanister}
                            style={{ color: TEAM_PRIMARY[c().color] }}
                            aria-hidden="true"
                          >
                            <VespeneIcon size={14} />
                          </div>
                        )}
                      </Show>
                      <Show when={intentCheck()}>
                        <div
                          class={styles.intentCheckRing}
                          aria-hidden="true"
                        />
                      </Show>
                      <Show when={ghost()}>
                        {(g) => (
                          <div
                            class={clsx(
                              styles.intentPieceGhost,
                              g().via === "gas" && styles.intentPieceGhostGas,
                            )}
                            style={{ "--intent-ring": TEAM_PRIMARY[g().color] }}
                            data-intent-dest={square}
                            data-intent-gas={
                              g().via === "gas" ? "true" : undefined
                            }
                            aria-hidden="true"
                          >
                            <PieceGlyph
                              color={g().color}
                              type={g().piece}
                              pieceSet={pieceSet()}
                              mode={g().rookMode ?? "tank"}
                            />
                          </div>
                        )}
                      </Show>
                    </div>
                  );
                }}
              </For>
            )}
          </For>
          {/* Veil-reveal enemy movers — same MoveAnimation hulls as any other
              piece, inside a stacking context below the fog veil (z=2 < 5), so
              the veil's lit-cell holes reveal the slide and dark squares eat
              it. z-index isolates the hulls' own z=30 inside this context. */}
          <Show when={veilMoveCues().length > 0 && gridPx().w > 0}>
            <div class={styles["veil-move-layer"]} aria-hidden="true">
              <MoveAnimation
                cues={veilMoveCues()}
                progress={props.moveProgress ?? {}}
                leg={props.moveLeg}
                pieceSet={pieceSet()}
                boardWidth={gridPx().w}
                boardHeight={gridPx().h}
              />
            </div>
          </Show>
          {/* Board-level labels — sibling of squares/fog so theme cell z-index
              (e.g. vermeer spill) cannot trap ranks/files under the veil. */}
          <div class={styles["coordinate-layer"]} aria-hidden="true">
            <For each={RANKS}>
              {(rank, rIndex) => (
                <span
                  class={clsx(styles.coordinate, styles["rank-label"])}
                  style={{ top: `calc(${rIndex()} * 12.5% + 2px)` }}
                >
                  {rank}
                </span>
              )}
            </For>
            <For each={FILES}>
              {(file, fIndex) => (
                <span
                  class={clsx(styles.coordinate, styles["file-label"])}
                  style={{ right: `calc(${7 - fIndex()} * 12.5% + 4px)` }}
                >
                  {file}
                </span>
              )}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
};
