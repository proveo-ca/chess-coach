// SPEC: _spec/apps/starchess/demos.puml, _spec/apps/starchess/architecture/board-entities.puml, _spec/apps/starchess/architecture/p1-strategy-starchess-board.puml
/**
 * Snapshot-driven StarChess board — eclipse/butter/vermeer (default eclipse).
 * Vision via VisionStrategy (player fog | observer dual borders).
 * Presentation CSS matches apps/ui StarChessBoardView + StarChessSquare at 3bed049.
 */
import { For, Show, createEffect, createMemo, createSignal, createUniqueId, onCleanup } from "solid-js";
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
import {
  mapWithMovePathOccupancy,
  getVisionDisplayCells,
  getVisionBorderPaths,
  getVisionFogHolePaths,
  observerVisionFromSnap,
  type MoveVisionCue,
} from "~/presentation/board/fogProjection";
import { rookModeAt, rookModeForSieged } from "~/presentation/board/rookMode";
import { pieceUrl } from "~/presentation/board/pieceUrl";
import { RookGlyph } from "~/presentation/board/components/RookGlyph";
import { visionStrategyFor } from "~/presentation/board/vision/VisionStrategy";
import { TEAM_PRIMARY } from "~/presentation/animations/teamColors";
import { InlineBishop } from "~/presentation/animations/pieces/components/InlineBishop";
import { SpiderMine } from "~/presentation/specials/components/SpiderMine";
import { VespeneIcon } from "~/components/primitives/icons";
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
  /** Tutorial destination rings. */
  hintSquares?: readonly Square[];
  onSquareClick?: (square: Square) => void;
  /**
   * Hide board glyphs on these squares (combat / king-damage overlays own them).
   * Must not mutate placement — vision reads SCFEN occupancy, not chess.js FEN.
   */
  hideSquares?: ReadonlySet<Square> | readonly Square[];
  /** Active move slides — progressive path fog while `moveProgress[id] === 1`. */
  moveCues?: readonly MoveCue[];
  moveProgress?: Readonly<Record<string, 0 | 1>>;
  /** Hide mine glyphs after boom / while missile overlay owns them. */
  spentMines?: readonly Square[];
  /** Wake / chase — legs out on these squares. */
  chasingMines?: readonly Square[];
  /** Goliath squares with Charon launchers armed (inline SVG). */
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
  const viewer = () => props.viewer ?? "w";
  const variant = (): BoardSkin => props.variant ?? "eclipse";
  const pieceSet = (): PieceSet => props.pieceSet ?? "nerd";
  const useInlineUnits = () => pieceSet() === "nerd";
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

  const litCells = createMemo(() =>
    usePlayerFog() ? getVisionDisplayCells(fog().litSquares, FILES, RANKS) : [],
  );
  const fogPaths = createMemo(() => getVisionFogHolePaths(litCells()));

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
        <div
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
                        {(p) => {
                          if (p().type === "r") {
                            return (
                              <RookGlyph
                                color={p().color}
                                pieceSet={pieceSet()}
                                mode={rookMode()}
                                class={clsx(
                                  styles.piece,
                                  gasUsedAura() && styles.pieceSpecialUsed,
                                )}
                                alt={`${p().color} r`}
                                data-special-used={
                                  gasUsedAura() ? "true" : undefined
                                }
                              />
                            );
                          }
                          if (
                            useInlineUnits() &&
                            p().type === "b" &&
                            armedBishops().has(square)
                          ) {
                            return (
                              <div
                                class={clsx(
                                  styles.piece,
                                  gasUsedAura() && styles.pieceSpecialUsed,
                                )}
                                data-piece-inline="b"
                                data-special-used={gasUsedAura() ? "true" : undefined}
                                data-charon-armed="true"
                              >
                                <InlineBishop
                                  color={p().color}
                                  face="front"
                                  armed
                                  armAnim={armAnimBishops().has(square)}
                                />
                              </div>
                            );
                          }
                          return (
                            <img
                              class={clsx(
                                styles.piece,
                                gasUsedAura() && styles.pieceSpecialUsed,
                              )}
                              src={pieceUrl(p().color, p().type, pieceSet())}
                              alt={`${p().color} ${p().type}`}
                              data-special-used={gasUsedAura() ? "true" : undefined}
                              draggable={false}
                            />
                          );
                        }}
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
                            class={styles.intentPieceGhost}
                            style={{ "--intent-ring": TEAM_PRIMARY[g().color] }}
                            data-intent-dest={square}
                            data-piece-inline={
                              g().piece === "r" && pieceSet() === "nerd"
                                ? "r"
                                : undefined
                            }
                            aria-hidden="true"
                          >
                            <Show
                              when={g().piece === "r"}
                              fallback={
                                <img
                                  src={pieceUrl(g().color, g().piece, pieceSet())}
                                  alt=""
                                  draggable={false}
                                />
                              }
                            >
                              <RookGlyph
                                color={g().color}
                                pieceSet={pieceSet()}
                                mode={g().rookMode ?? "tank"}
                              />
                            </Show>
                          </div>
                        )}
                      </Show>
                    </div>
                  );
                }}
              </For>
            )}
          </For>
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
