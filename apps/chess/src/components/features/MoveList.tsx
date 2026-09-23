import { For, Show, createEffect, createMemo, createSignal, on, onCleanup, onMount } from "solid-js";
import type { Component } from "solid-js";

import styles from "~/components/features/MoveList.module.css";
import { CoachEmotionIcon } from "~/components/primitives/CoachEmotionIcon";
import { ChevronLeftIcon, ChevronRightIcon, HintIcon } from "~/components/primitives/icons";
import { formatCp, pairMovesIntoRows, resolveAnnotations } from "~/engine/moveAnnotations";
import { useGameAnalysis } from "~/hooks/useGameAnalysis";
import { useMoveListPagination } from "~/hooks/useMoveListPagination";
import { currentIndex, fenHistory, reviewAnalysisMode, setViewIndex } from "~/store/gameStore";
import { blunderThresholdCp } from "~/store/settingsStore";
import { footerFloat } from "~/store/viewportLayoutStore";
// SPEC: _spec/apps/ui/components.puml, _spec/apps/ui/responsiveness/rules.md
import type { AnnotationTag, GameAnalysis, MoveRow } from "~/types/analysis";
import type { GameRecord, MoveRecord } from "~/types/game";
import { DESKTOP_MQ } from "~/utils/breakpoints";
import {
  measureShellChrome,
  measureTopTrackBudget,
  observeFooterFloatLayout,
  remToPx,
  syncFooterFloatAttr,
} from "~/utils/footerFloatMeasure";

const FLOAT_WINDOW = 3;
/** Vertical rem per turn-row used for the §4b fit check. */
const MOVE_LIST_ROW_REM = 2.1;
/** Wrapper padding rem for the §4b fit check (page-nav budgeted separately). */
const MOVE_LIST_CHROME_REM = 1.5;
/** Page-nav row rem — only when turn count exceeds rowsPerPage. */
const MOVE_LIST_NAV_REM = 2.8;
/** Slack so "barely fits" docked allocations don't clip and paint over the board. */
const MOVE_LIST_FIT_SLACK_PX = 48;

// ── Presentational sub-components ──────────────────────────────────────

const TagIcon: Component<{ tag: AnnotationTag; size?: number }> = (props) => {
  const size = () => props.size ?? 16;
  switch (props.tag) {
    case "best":
      return (
        <span class={`${styles.tag} ${styles["tag--best"]}`} title="Best move">
          <CoachEmotionIcon emotion="happy" title="best move" size={size()} />
        </span>
      );
    case "blunder":
      return (
        <span class={`${styles.tag} ${styles["tag--blunder"]}`} title="Blunder">
          <CoachEmotionIcon emotion="shocked" title="blunder" size={size()} />
        </span>
      );
    case "forced":
      return (
        <span class={`${styles.tag} ${styles["tag--forced"]}`} title="Forced — no better option">
          <CoachEmotionIcon emotion="shrug" title="forced" size={size()} />
        </span>
      );
    case "inaccuracy":
      return (
        <span class={`${styles.tag} ${styles["tag--inaccuracy"]}`} title="Inaccuracy">
          <CoachEmotionIcon emotion="thinking" title="inaccuracy" size={size()} />
        </span>
      );
    case "hint":
      return (
        <span class={`${styles.tag} ${styles["tag--hint"]}`} title="Hint used">
          <HintIcon size={size()} />
        </span>
      );
  }
};

const cpColorClass = (cp: number): string => {
  if (cp > 0) return styles["cp--positive"];
  if (cp < 0) return styles["cp--negative"];
  return styles["cp--neutral"];
};

const PlyCell: Component<{
  move: MoveRecord;
  index: number;
  cpDelta: number | null;
  tags: AnnotationTag[];
  active: boolean;
  onJump: () => void;
  showCp?: boolean;
  compact?: boolean;
}> = (props) => (
  <button
    type="button"
    class={styles.ply}
    classList={{ [styles["ply--active"]]: props.active }}
    onClick={props.onJump}
    data-ply={props.index}
  >
    <span class={styles.san}>{props.move.san}</span>
    <span class={styles["ply-meta"]}>
      {props.showCp && props.cpDelta != null && (
        <span
          class={`${styles.cp} ${cpColorClass(props.cpDelta)}`}
          data-testid="ply-cp"
        >
          {formatCp(props.cpDelta)}
        </span>
      )}
      <span class={styles.tags} data-testid="ply-tags">
        <For each={props.tags}>{(tag) => <TagIcon tag={tag} size={props.compact ? 14 : 16} />}</For>
      </span>
    </span>
  </button>
);

function floatWindowRows(all: MoveRow[], activePly: number): MoveRow[] {
  if (all.length === 0) return [];
  let idx = all.findIndex((r) => r.whiteIndex === activePly || r.blackIndex === activePly);
  if (idx < 0) idx = activePly < 0 ? 0 : all.length - 1;
  let start = Math.max(0, idx - Math.floor(FLOAT_WINDOW / 2));
  if (start + FLOAT_WINDOW > all.length) start = Math.max(0, all.length - FLOAT_WINDOW);
  return all.slice(start, start + FLOAT_WINDOW);
}

// ── Container component ────────────────────────────────────────────────

interface Props {
  game: GameRecord | null;
  activePly?: number | null;
  analysis?: GameAnalysis;
  /** Review /:id — float a dismissible 3-turn strip when a full docked page won't fit (§4b).
   *  Docks in the top Screen region; footer keeps BoardControls when floating. */
  floatingCapable?: boolean;
}

export const MoveList: Component<Props> = (props) => {
  // Only run our own analysis when the parent doesn't already supply one.
  // Passing a null game when `props.analysis` is present keeps the hook inert
  // (no pool jobs) — otherwise the Review screen would analyze each game twice.
  const internalAnalysis = useGameAnalysis(() => (props.analysis ? null : props.game));
  const analysisSignal = () => props.analysis ?? internalAnalysis();
  const annotations = () => {
    const g = props.game;
    if (!g) return [];
    const a = analysisSignal();
    return resolveAnnotations(
      g.moves,
      a.cpDeltas,
      a.wasBestMoves,
      a.bestMoveUcis,
      blunderThresholdCp(),
    );
  };
  const rows = () =>
    props.game ? pairMovesIntoRows(props.game.moves, props.game.startingFen) : [];

  // Responsive rows per page: 3 on desktop (≥720), 6 on portrait phone (fits
  // under the board on tall mobile so §4b can dock; short heights still float).
  const [isDesktopWidth, setIsDesktopWidth] = createSignal(false);
  const [dismissed, setDismissed] = createSignal(false);

  onMount(() => {
    const media = window.matchMedia(DESKTOP_MQ);
    const update = () => setIsDesktopWidth(media.matches);
    update();
    media.addEventListener("change", update);
    onCleanup(() => media.removeEventListener("change", update));
  });

  const rowsPerPage = () => (isDesktopWidth() ? 3 : 6);

  // §4 — Review /:id owns footer-float when CoachPanel is absent.
  let measureFloatMode: (() => void) | undefined;
  onMount(() => {
    if (!props.floatingCapable) return;

    measureFloatMode = () => {
      const shell = document.querySelector<HTMLElement>('[data-testid="screen-root"]');
      if (!shell) {
        syncFooterFloatAttr(false);
        return;
      }
      // Fit check: top chrome (excl. MoveList) + board + MoveList budget + footer
      // + shell padding. Desktop also floats when the list won't fit in the fixed
      // top grid track (--avatar-height + 1rem) so board Y stays stable across screens.
      const { topH, midContentH, bottomH, padY } = measureShellChrome(shell);
      const turnCount = rows().length;
      const desktop = window.matchMedia(DESKTOP_MQ).matches;
      const rpp = desktop ? 3 : 6;
      const budgetRows = Math.min(rpp, Math.max(turnCount, 1));
      const chromeRem =
        MOVE_LIST_CHROME_REM + (turnCount > rpp ? MOVE_LIST_NAV_REM : 0);
      const inflow = remToPx(chromeRem + budgetRows * MOVE_LIST_ROW_REM);
      const exceedsViewport =
        topH + midContentH + inflow + bottomH + padY + MOVE_LIST_FIT_SLACK_PX >
        window.innerHeight + 1;
      const exceedsTopCap = desktop && topH + inflow > measureTopTrackBudget() + 1;
      syncFooterFloatAttr(exceedsViewport || exceedsTopCap);
    };

    const disconnect = observeFooterFloatLayout(measureFloatMode);
    onCleanup(() => {
      disconnect();
      measureFloatMode = undefined;
      syncFooterFloatAttr(false);
      setDismissed(false);
    });
  });

  // Re-measure when the turn list grows/shrinks (loadGame, branching).
  createEffect(() => {
    if (!props.floatingCapable) return;
    void rows().length;
    measureFloatMode?.();
  });

  // Dismiss on play / enter analysis (fenHistory changes while analysis is on);
  // reappear on history-nav-only index changes. loadGame changes fen while
  // analysis is off — that must not dismiss. Switching Review games resets.
  let prevFenSig = "";
  let prevIdx = -1;
  let trackedGameId: string | null | undefined = undefined;
  createEffect(() => {
    if (!props.floatingCapable) return;
    const gameId = props.game?.id ?? null;
    const fenSig = fenHistory().join("\0");
    const idx = currentIndex();
    const mode = reviewAnalysisMode();
    if (trackedGameId !== gameId) {
      trackedGameId = gameId;
      prevFenSig = fenSig;
      prevIdx = idx;
      setDismissed(false);
      return;
    }
    if (prevFenSig === "") {
      prevFenSig = fenSig;
      prevIdx = idx;
      return;
    }
    if (fenSig !== prevFenSig) {
      if (mode) setDismissed(true);
    } else if (idx !== prevIdx) {
      setDismissed(false);
    }
    prevFenSig = fenSig;
    prevIdx = idx;
  });
  createEffect(
    on(
      reviewAnalysisMode,
      (mode, prev) => {
        if (!props.floatingCapable) return;
        if (mode && !prev) setDismissed(true);
        if (!mode && prev) setDismissed(false);
      },
      { defer: true },
    ),
  );

  const { activePly, activePage, totalPages, visibleRows, goToStart, goToEnd, goToPrev, goToNext } =
    useMoveListPagination(rows, { rowsPerPage, activePly: () => props.activePly });

  // Float strip follows the viewing cursor even when docked list is pinned to
  // the analysis branch ply (ReviewScreen).
  const stripPly = () => currentIndex() - 1;
  const floatRows = createMemo(() => floatWindowRows(rows(), stripPly()));

  const jump = (plyIndex: number) => {
    if (plyIndex < 0) return;
    setViewIndex(plyIndex + 1);
  };

  // Swipe left/right for page navigation on mobile (docked mode only).
  let wrapperRef: HTMLDivElement | undefined;
  let touchStartX = 0;

  const onTouchStart = (e: TouchEvent) => {
    touchStartX = e.touches[0].clientX;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (footerFloat()) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      if (dx < 0) goToNext();
      else goToPrev();
    }
  };

  onMount(() => {
    wrapperRef?.addEventListener("touchstart", onTouchStart, { passive: true });
    wrapperRef?.addEventListener("touchend", onTouchEnd, { passive: true });
  });
  onCleanup(() => {
    wrapperRef?.removeEventListener("touchstart", onTouchStart);
    wrapperRef?.removeEventListener("touchend", onTouchEnd);
  });

  const renderRow = (row: MoveRow, compact = false) => {
    const ply = () => (compact ? stripPly() : activePly());
    return (
      <div
        class={compact ? styles["float-turn"] : styles.row}
        classList={{
          [styles["float-turn--active"]]:
            compact && (ply() === row.whiteIndex || ply() === row.blackIndex),
        }}
        data-turn={row.turn}
      >
        <span class={styles.turn}>{row.turn}.</span>
        {row.white ? (
          <PlyCell
            move={row.white}
            index={row.whiteIndex}
            cpDelta={analysisSignal().cpDeltas[row.whiteIndex] ?? null}
            tags={annotations()[row.whiteIndex] ?? []}
            active={ply() === row.whiteIndex}
            onJump={() => jump(row.whiteIndex)}
            showCp={props.game?.playerColor === "w"}
            compact={compact}
          />
        ) : (
          <span />
        )}
        {row.black ? (
          <PlyCell
            move={row.black}
            index={row.blackIndex}
            cpDelta={analysisSignal().cpDeltas[row.blackIndex] ?? null}
            tags={annotations()[row.blackIndex] ?? []}
            active={ply() === row.blackIndex}
            onJump={() => jump(row.blackIndex)}
            showCp={props.game?.playerColor === "b"}
            compact={compact}
          />
        ) : (
          <span />
        )}
      </div>
    );
  };

  const floating = () => props.floatingCapable === true && footerFloat();

  return (
    <Show when={!(floating() && dismissed())}>
      <div
        ref={(el) => {
          wrapperRef = el;
        }}
        class={`${styles.wrapper} mobile-nav-clear`}
        classList={{ [styles.floating]: floating(), "floating-move-list": floating() }}
        aria-label="Move list"
        data-testid={floating() ? "floating-move-list" : "move-list"}
        data-analysis-loading={analysisSignal().loading ? "true" : "false"}
        role={floating() ? "status" : undefined}
      >
        <Show when={floating()}>
          <button
            type="button"
            class={styles["floating-dismiss"]}
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
          >
            ×
          </button>
        </Show>
        <Show
          when={props.game && props.game.moves.length > 0}
          fallback={<div class={styles.empty}>No moves recorded.</div>}
        >
          <Show when={floating()}>
            <div class={styles["float-strip"]} data-testid="floating-move-strip">
              <For each={floatRows()}>{(row) => renderRow(row, true)}</For>
            </div>
          </Show>
          <Show when={!floating()}>
            <Show when={totalPages() > 1}>
              <div class={styles["page-nav"]}>
                <button
                  class={styles["page-btn"]}
                  onClick={goToStart}
                  disabled={activePage() === 0}
                  aria-label="First page"
                >
                  <ChevronLeftIcon size={14} />
                  <ChevronLeftIcon size={14} />
                </button>
                <button
                  class={styles["page-btn"]}
                  onClick={goToPrev}
                  disabled={activePage() === 0}
                  aria-label="Previous page"
                >
                  <ChevronLeftIcon size={14} />
                </button>
                <span class={styles["page-indicator"]}>
                  {activePage() + 1} / {totalPages()}
                </span>
                <button
                  class={styles["page-btn"]}
                  onClick={goToNext}
                  disabled={activePage() >= totalPages() - 1}
                  aria-label="Next page"
                >
                  <ChevronRightIcon size={14} />
                </button>
                <button
                  class={styles["page-btn"]}
                  onClick={goToEnd}
                  disabled={activePage() >= totalPages() - 1}
                  aria-label="Last page"
                >
                  <ChevronRightIcon size={14} />
                  <ChevronRightIcon size={14} />
                </button>
              </div>
            </Show>
            <For each={visibleRows()}>{(row) => renderRow(row, false)}</For>
          </Show>
        </Show>
      </div>
    </Show>
  );
};
