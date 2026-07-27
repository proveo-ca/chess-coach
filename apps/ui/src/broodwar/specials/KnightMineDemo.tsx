import type { Square } from "chess.js";
import { Chess } from "chess.js";
import {
  For,
  Show,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from "solid-js";

import { findBoardGrid, squareBoxStyle } from "~/broodwar/animations/boardGeom";
import { LONG_PRESS_MS } from "~/broodwar/specials/adjacent";
import styles from "~/broodwar/specials/SpecialMoves.module.css";
import type { SpecialTiming } from "~/broodwar/types";
import { ChessBoard } from "~/components/features/ChessBoard";
import { setStorybookCapabilities } from "~/screens/storybookCapabilities";
import { NERD_CAPABILITIES } from "~/store/capabilitiesStore";
import { loadFen } from "~/store/gameStore";
import { setActivePlayerColor, setNerdModeUnlocked, setPlayerIdentity } from "~/store/settingsStore";

const KNIGHT_START: Square = "d4";
/** Knight move sample target (legal N jump). */
const KNIGHT_TO: Square = "e6";
const FEN_START = "r6k/8/8/8/3N4/8/8/K6R w - - 0 1";
const FEN_AFTER_MOVE = "r6k/8/4N3/8/8/8/8/K6R w - - 0 1";

type OverlayBox = { top: number; left: number; width: number; height: number };

/**
 * Storybook: long-press knight → arm spider mine under its square.
 * Timing `before`: mine at current square, then move.
 * Timing `after`: move first, then mine arms under the new square.
 */
export const KnightMineDemo: Component = () => {
  const [fen, setFen] = createSignal(FEN_START);
  const [timing, setTiming] = createSignal<SpecialTiming>("before");
  const [mineQueued, setMineQueued] = createSignal(false);
  const [mineAt, setMineAt] = createSignal<Square | null>(null);
  const [moveQueued, setMoveQueued] = createSignal(false);
  const [playing, setPlaying] = createSignal(false);
  const [overlayBox, setOverlayBox] = createSignal<OverlayBox | null>(null);
  const [caption, setCaption] = createSignal(
    "Long-press the knight on d4 to queue a spider mine · pick timing · Resolve",
  );

  let hostRef: HTMLDivElement | undefined;
  let pressTimer = 0;
  const timers: number[] = [];

  const after = (ms: number, fn: () => void) => {
    timers.push(window.setTimeout(fn, ms));
  };

  const clearTimers = () => {
    while (timers.length) window.clearTimeout(timers.pop());
  };

  const clearPress = () => {
    window.clearTimeout(pressTimer);
    pressTimer = 0;
  };

  const syncOverlay = () => {
    const host = hostRef;
    if (!host) return;
    const el = findBoardGrid(host);
    if (!el) return;
    const hr = host.getBoundingClientRect();
    const br = el.getBoundingClientRect();
    // Align to the board content box (inside the 4px border), matching ChessBoard.
    setOverlayBox({
      top: br.top - hr.top + el.clientTop,
      left: br.left - hr.left + el.clientLeft,
      width: el.clientWidth,
      height: el.clientHeight,
    });
  };

  const prepare = () => {
    setStorybookCapabilities({ ...NERD_CAPABILITIES, readOnly: true });
    setNerdModeUnlocked(true);
    setPlayerIdentity("Nerd");
    setActivePlayerColor("w");
    loadFen(fen());
  };

  const reset = () => {
    clearTimers();
    setPlaying(false);
    setMineQueued(false);
    setMineAt(null);
    setMoveQueued(false);
    setFen(FEN_START);
    loadFen(FEN_START);
    setCaption("Long-press the knight on d4 to queue a spider mine · pick timing · Resolve");
    requestAnimationFrame(() => requestAnimationFrame(syncOverlay));
  };

  const queueMine = () => {
    clearPress();
    if (playing()) return;
    setMineQueued(true);
    // Preview arm under current knight square until resolve.
    const g = new Chess(fen());
    const here = g.board().flat().find((c) => c?.type === "n" && c.color === "w")?.square;
    setMineAt(here ?? KNIGHT_START);
    setCaption(
      timing() === "before"
        ? "Mine queued (before) · optional: tap e6 to queue move · Resolve"
        : "Mine queued (after) · optional: tap e6 to queue move · Resolve",
    );
  };

  const queueMove = () => {
    if (playing() || !mineQueued()) return;
    setMoveQueued(true);
    setCaption(
      timing() === "before"
        ? "Queued: mine on d4 → move d4→e6 · Resolve"
        : "Queued: move d4→e6 → mine on e6 · Resolve",
    );
  };

  const resolve = () => {
    if (!mineQueued() || playing()) return;
    setPlaying(true);
    clearTimers();

    const doMove = () => {
      setFen(FEN_AFTER_MOVE);
      loadFen(FEN_AFTER_MOVE);
      syncOverlay();
    };

    if (timing() === "before") {
      // specialBefore: mine stays on start square, then classical move.
      setMineAt(KNIGHT_START);
      setCaption("specialBefore: spider mine armed on d4");
      after(500, () => {
        if (moveQueued()) {
          doMove();
          setCaption("move: knight → e6 · mine remains on d4");
        } else {
          setCaption("Mine armed on d4 (no move queued)");
        }
        setPlaying(false);
      });
      return;
    }

    // specialAfter: move first, then mine under new location.
    setMineAt(null);
    if (moveQueued()) {
      setCaption("move: knight → e6");
      doMove();
      after(450, () => {
        setMineAt(KNIGHT_TO);
        setCaption("specialAfter: spider mine armed under knight on e6");
        setPlaying(false);
      });
    } else {
      after(200, () => {
        const g = new Chess(fen());
        const here = g.board().flat().find((c) => c?.type === "n" && c.color === "w")?.square;
        setMineAt(here ?? KNIGHT_START);
        setCaption("specialAfter: spider mine armed under knight (no move)");
        setPlaying(false);
      });
    }
  };

  onMount(() => {
    prepare();
    const ro = new ResizeObserver(() => syncOverlay());
    const kick = () => {
      syncOverlay();
      if (hostRef) ro.observe(hostRef);
      const grid = hostRef ? findBoardGrid(hostRef) : null;
      if (grid) ro.observe(grid);
    };
    requestAnimationFrame(() => requestAnimationFrame(kick));
    window.addEventListener("resize", syncOverlay);
    onCleanup(() => {
      ro.disconnect();
      window.removeEventListener("resize", syncOverlay);
      clearPress();
      clearTimers();
    });
  });

  createEffect(() => {
    void fen();
    prepare();
    requestAnimationFrame(() => requestAnimationFrame(syncOverlay));
  });

  return (
    <div class={styles.demo}>
      <div class={styles.toolbar}>
        <div class={styles.timing} role="group" aria-label="Special timing">
          <button
            type="button"
            data-active={timing() === "before"}
            onClick={() => !playing() && setTiming("before")}
          >
            Before move
          </button>
          <button
            type="button"
            data-active={timing() === "after"}
            onClick={() => !playing() && setTiming("after")}
          >
            After move
          </button>
        </div>
        <button
          type="button"
          class={styles.resolve}
          disabled={!mineQueued() || playing()}
          onClick={resolve}
        >
          Resolve
        </button>
        <button type="button" class={styles.resolve} style={{ background: "#555" }} onClick={reset}>
          Reset
        </button>
      </div>

      <div class={styles.host} ref={hostRef}>
        <ChessBoard
          variant="eclipse"
          fogOfWar
          spiderMines={mineAt() ? [mineAt()!] : []}
        />
        <Show when={overlayBox()}>
          {(box) => (
            <div
              class={styles.boardOverlay}
              data-special="knight-mine"
              style={{
                top: `${box().top}px`,
                left: `${box().left}px`,
                width: `${box().width}px`,
                height: `${box().height}px`,
              }}
            >
              <Show when={!playing()}>
                <div
                  class={`${styles.hit} ${styles.hitKnight}`}
                  style={squareBoxStyle(
                    fen() === FEN_AFTER_MOVE ? KNIGHT_TO : KNIGHT_START,
                    box().width,
                    box().height,
                  )}
                  data-long-press="knight"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    clearPress();
                    pressTimer = window.setTimeout(queueMine, LONG_PRESS_MS);
                  }}
                  onPointerUp={clearPress}
                  onPointerLeave={clearPress}
                  onPointerCancel={clearPress}
                  onContextMenu={(e) => e.preventDefault()}
                />
              </Show>

              <Show when={mineQueued() && !moveQueued() && !playing() && fen() === FEN_START}>
                <For each={[KNIGHT_TO] satisfies Square[]}>
                  {(sq) => (
                    <div
                      class={`${styles.hit} ${styles.hitMove}`}
                      style={squareBoxStyle(sq, box().width, box().height)}
                      data-move-target={sq}
                      onClick={queueMove}
                    />
                  )}
                </For>
              </Show>
            </div>
          )}
        </Show>
      </div>
      <p class={styles.caption}>{caption()}</p>
    </div>
  );
};
