import { For, Show, createMemo } from "solid-js";
import type { Component } from "solid-js";
import type { Square } from "chess.js";
import clsx from "clsx";

import { placementToMap } from "@chess-coach/starchess-core";

import { useMatchStore } from "~/app/MatchStoreContext";
import { displayedSnapshot, fogForViewer } from "~/app/selectors";
import {
  FILES,
  RANKS,
  StarChessSquare,
  isLightSquare,
} from "~/presentation/board/StarChessSquare";
import { getVisionDisplayCells } from "~/presentation/board/fogProjection";
import { useBoardInput } from "~/presentation/board/useBoardInput";
import styles from "~/presentation/board/StarChessBoard.module.css";

export const StarChessBoard: Component<{ fog?: boolean }> = (props) => {
  const store = useMatchStore();
  const input = useBoardInput();

  const map = createMemo(() =>
    placementToMap(displayedSnapshot(store.state()).placement),
  );
  const fog = createMemo(() =>
    props.fog === false
      ? { litSquares: new Set<Square>(), revealedPieces: new Set<Square>() }
      : fogForViewer(store.state()),
  );
  const litCells = createMemo(() =>
    props.fog === false
      ? []
      : getVisionDisplayCells(fog().litSquares, FILES, RANKS),
  );
  const hidden = createMemo(() => store.state().timeline.hiddenSquares);
  const specials = createMemo(() => store.state().specialsUsed);
  const mines = createMemo(() => displayedSnapshot(store.state()).mines ?? []);
  const flipped = createMemo(() => store.state().viewer === "b");

  const files = createMemo(() => (flipped() ? [...FILES].reverse() : [...FILES]));
  const ranks = createMemo(() => (flipped() ? [...RANKS].reverse() : [...RANKS]));

  const intentGhosts = createMemo(() => {
    const ghosts = new Map<Square, { type: "p" | "n" | "b" | "r" | "q" | "k"; color: "w" | "b" }>();
    const actions = store.state().liveSnapshot.queue?.actions ?? [];
    for (const a of actions) {
      if (a.timing === "C" && a.to) {
        const fromPiece = map().get(a.from);
        if (fromPiece) ghosts.set(a.to, fromPiece);
      }
    }
    return ghosts;
  });

  return (
    <div class={styles.wrap} data-testid="starchess-board">
      <div class={styles.board} role="grid" aria-label="StarChess board">
        <Show when={props.fog !== false}>
          <svg class={styles.fogSvg} viewBox="0 0 8 8" aria-hidden>
            <defs>
              <mask id="sc-fog-mask">
                <rect width="8" height="8" fill="white" />
                <For each={litCells()}>
                  {(cell) => {
                    const col = flipped() ? 7 - cell.col : cell.col;
                    const row = flipped() ? 7 - cell.row : cell.row;
                    return <rect x={col} y={row} width="1" height="1" fill="black" />;
                  }}
                </For>
              </mask>
            </defs>
            <rect
              width="8"
              height="8"
              fill="rgb(10 16 20 / 0.72)"
              mask="url(#sc-fog-mask)"
            />
          </svg>
        </Show>
        <For each={ranks()}>
          {(rank) => (
            <For each={files()}>
              {(file) => {
                const square = `${file}${rank}` as Square;
                const piece = () => map().get(square) ?? null;
                const mine = () => mines().find((m) => m.at === square);
                const fogged = () => {
                  if (props.fog === false) return false;
                  const v = fog();
                  return !v.litSquares.has(square);
                };
                const hidePiece = () => {
                  if (hidden().has(square)) return true;
                  if (props.fog === false) return false;
                  const v = fog();
                  if (v.litSquares.has(square)) return false;
                  if (v.revealedPieces.has(square)) return false;
                  const p = piece();
                  if (p && p.color === store.state().viewer) return false;
                  return fogged();
                };
                return (
                  <StarChessSquare
                    square={square}
                    piece={piece()}
                    isLight={isLightSquare(file, rank)}
                    isSelected={store.state().selected === square}
                    isValidMove={store.state().legalDests.includes(square)}
                    isFogged={fogged() && !fog().revealedPieces.has(square)}
                    hidePiece={hidePiece()}
                    specialUsed={specials().has(square)}
                    spiderMine={!!mine()}
                    spiderMineColor={mine()?.color}
                    intentGhost={intentGhosts().get(square) ?? null}
                    onClick={() => input.onSquareClick(square)}
                  />
                );
              }}
            </For>
          )}
        </For>
        <Show when={store.state().timeline.cues.length > 0}>
          <div class={clsx(styles.cueBanner)} aria-live="polite">
            {store.state().timeline.cues[0]?.kind}
          </div>
        </Show>
      </div>
    </div>
  );
};
