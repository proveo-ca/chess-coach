/**
 * Snapshot-driven StarChess board — eclipse/butter/vermeer only (default eclipse).
 * Presentation CSS matches apps/ui StarChessBoardView + StarChessSquare at 3bed049.
 * // SPEC: _spec/apps/ui/starchess/demos.puml
 */
import { For, Show, createEffect, createMemo, createSignal, createUniqueId, onCleanup } from "solid-js";
import type { Component } from "solid-js";
import type { PieceSymbol, Square } from "chess.js";
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
} from "~/presentation/board/StarChessSquare";
import {
  mapWithMovePathOccupancy,
  fogWithGasUsedReveal,
  getVisionDisplayCells,
  getVisionBorderPaths,
  getVisionFogHolePaths,
  observerVisionFromSnap,
  type MoveVisionCue,
} from "~/presentation/board/fogProjection";
import { pieceUrl } from "~/presentation/board/pieceUrl";
import { TEAM_PRIMARY } from "~/presentation/animations/teamColors";
import { InlineRook } from "~/presentation/pieces/InlineRook";
import { MOVE_SQUARE_MS } from "~/presentation/constants";
import type { MoveCue } from "~/presentation/types";
import boardStyles from "~/presentation/board/StarChessBoardView.module.css";
import sqStyles from "~/presentation/board/StarChessSquare.module.css";

export type BoardVariant = "eclipse" | "butter" | "vermeer";

/** `player` = single-viewer fog veil; `observer` = full board + dual vision borders. */
export type VisionMode = "player" | "observer";

export type IntentGhost = {
  at: Square;
  color: StarChessColor;
  piece: PieceSymbol;
  rookMode?: RookMode;
};

export const EclipseBoard: Component<{
  snapshot: ScFenSnapshot;
  viewer?: StarChessColor;
  fog?: boolean;
  /**
   * DualNav review: no fog veil; stroke both sides' `getSideVision` in team colors.
   * Default `player` keeps live fog.
   */
  visionMode?: VisionMode;
  /** Only eclipse | butter | vermeer — default eclipse. */
  variant?: BoardVariant;
  siegedRooks?: readonly Square[];
  intentGhosts?: readonly IntentGhost[];
  selected?: Square | null;
  legalDests?: readonly Square[];
  onSquareClick?: (square: Square) => void;
  /**
   * Hide board glyphs on these squares (combat / king-damage overlays own them).
   * Must not mutate placement — vision reads SCFEN occupancy, not chess.js FEN.
   */
  hideSquares?: ReadonlySet<Square> | readonly Square[];
  /** Active move slides — progressive path fog while `moveProgress[id] === 1`. */
  moveCues?: readonly MoveCue[];
  moveProgress?: Readonly<Record<string, 0 | 1>>;
}> = (props) => {
  const maskId = createUniqueId();
  const viewer = () => props.viewer ?? "w";
  const variant = (): BoardVariant => props.variant ?? "eclipse";
  const isObserver = () => props.visionMode === "observer";
  /** Player fog veil — off in observer mode or when fog=false. */
  const usePlayerFog = () => !isObserver() && props.fog !== false;
  const map = createMemo(() => placementToMap(props.snapshot.placement));
  const sieged = createMemo(
    () => new Set(props.siegedRooks ?? props.snapshot.siegedRooks ?? []),
  );
  const specialsUsed = createMemo(
    () => new Set(props.snapshot.specialsUsed ?? []),
  );
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
      });
    }
    const baseMap = map();
    const visionMap =
      relocating.length > 0
        ? mapWithMovePathOccupancy(baseMap, relocating, now)
        : baseMap;
    const base = getSideVision(visionMap, viewer(), {
      rookModeFor: (sq) => (sieged().has(sq) ? "siege" : "tank"),
      mines: props.snapshot.mines,
    });
    const used = props.snapshot.specialsUsed;
    if (!used?.length) return base;
    return fogWithGasUsedReveal(base, new Set(used), viewer(), props.snapshot);
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

  return (
    <div class={boardStyles["board-layout-wrapper"]}>
      <div class={boardStyles["chessboard-container"]} data-testid="chessboard">
        <div
          data-board-grid
          data-vision-mode={isObserver() ? "observer" : "player"}
          class={clsx(
            boardStyles.chessboard,
            boardStyles[`chessboard--${variant()}`],
            usePlayerFog() && boardStyles["chessboard--fog"],
            isObserver() && boardStyles["chessboard--observer"],
          )}
        >
          <Show when={usePlayerFog()}>
            <svg
              class={boardStyles["fog-overlay"]}
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
              class={boardStyles["observer-vision-overlay"]}
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
            {(rank, rIndex) => (
              <For each={FILES}>
                {(file, fIndex) => {
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
                  const ghost = () => ghostAt(square);
                  const rookMode = (): RookMode =>
                    sieged().has(square) ? "siege" : "tank";
                  const isSelected = () => props.selected === square;
                  const isLegal = () => props.legalDests?.includes(square) ?? false;
                  const gasUsed = () => specialsUsed().has(square);
                  return (
                    <div
                      class={clsx(
                        sqStyles.square,
                        isLight() ? sqStyles.light : sqStyles.dark,
                        isSelected() && sqStyles.selected,
                        isLegal() && sqStyles["advice-highlight"],
                        gasUsed() && sqStyles.pieceSpecialUsed,
                      )}
                      data-square={square}
                      data-tone={isLight() ? "light" : "dark"}
                      data-fog={
                        !usePlayerFog()
                          ? undefined
                          : isFogged()
                            ? "hidden"
                            : "visible"
                      }
                      data-intent-dest={ghost() ? square : undefined}
                      role={props.onSquareClick ? "button" : undefined}
                      onClick={() => props.onSquareClick?.(square)}
                    >
                      <Show when={fIndex() === 0}>
                        <span class={clsx(sqStyles.coordinate, sqStyles["rank-label"])}>
                          {rank}
                        </span>
                      </Show>
                      <Show when={rIndex() === 7}>
                        <span class={clsx(sqStyles.coordinate, sqStyles["file-label"])}>
                          {file}
                        </span>
                      </Show>
                      <Show when={localFogVeil()}>
                        <div class={sqStyles.fog} aria-hidden="true" />
                      </Show>
                      <Show when={visiblePiece()}>
                        {(p) => (
                          <Show
                            when={p().type === "r"}
                            fallback={
                              <img
                                class={sqStyles.piece}
                                src={pieceUrl(p().color, p().type)}
                                alt=""
                                draggable={false}
                              />
                            }
                          >
                            <div class={sqStyles.piece} data-piece-inline="r">
                              <InlineRook color={p().color} mode={rookMode()} />
                            </div>
                          </Show>
                        )}
                      </Show>
                      <Show when={ghost()}>
                        {(g) => (
                          <Show
                            when={g().piece === "r"}
                            fallback={
                              <img
                                class={sqStyles.intentPieceGhost}
                                src={pieceUrl(g().color, g().piece)}
                                alt=""
                                style={{ "--intent-ring": TEAM_PRIMARY[g().color] }}
                                data-intent-dest={square}
                                draggable={false}
                                aria-hidden="true"
                              />
                            }
                          >
                            <div
                              class={sqStyles.intentPieceGhost}
                              style={{ "--intent-ring": TEAM_PRIMARY[g().color] }}
                              data-intent-dest={square}
                              data-piece-inline="r"
                              aria-hidden="true"
                            >
                              <InlineRook
                                color={g().color}
                                mode={g().rookMode ?? "tank"}
                              />
                            </div>
                          </Show>
                        )}
                      </Show>
                    </div>
                  );
                }}
              </For>
            )}
          </For>
        </div>
      </div>
    </div>
  );
};
