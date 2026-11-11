// SPEC: _spec/apps/chess/responsiveness/rules.md
import { setFooterFloat } from "~/store/viewportLayoutStore";

/**
 * §4 float fit check must use board-column *content* height (ChessBoard
 * only) and top-region *content* height — mobile leftover lives in `1fr`
 * top/bottom tracks that must not count as chrome budget.
 */

export function remToPx(rem: number): number {
  return rem * parseFloat(getComputedStyle(document.documentElement).fontSize || "16");
}

export function syncFooterFloatAttr(shouldFloat: boolean) {
  setFooterFloat(shouldFloat);
  const shell = document.querySelector<HTMLElement>('[data-testid="screen-root"]');
  if (shell) shell.dataset.footerFloat = shouldFloat ? "true" : "false";
}

/**
 * Content height of the top Screen region (0 when empty / display:none).
 * Sums children so a stretched mobile `1fr` top track (board-hug leftover)
 * is not counted as chrome budget for §4 float.
 */
export function measureTopRegionHeight(shell: HTMLElement): number {
  const top = shell.querySelector<HTMLElement>('[data-region="top"]');
  if (!top) return 0;
  const style = getComputedStyle(top);
  if (style.display === "none" || style.visibility === "hidden") return 0;
  const kids = Array.from(top.children) as HTMLElement[];
  let sum = 0;
  let visible = 0;
  const gap = parseFloat(style.rowGap || style.gap || "0") || 0;
  for (const kid of kids) {
    const ks = getComputedStyle(kid);
    if (ks.display === "none") continue;
    // Fixed overlays + docked MoveList (budgeted separately in §4b) are not
    // counted as static top chrome — otherwise fit checks double-count the list.
    if (ks.position === "fixed" || ks.position === "absolute") continue;
    const testId = kid.getAttribute("data-testid");
    if (testId === "move-list" || testId === "floating-move-list") continue;
    // MoveList may be wrapped (e.g. Review mobile pin slot).
    if (kid.querySelector?.('[data-testid="move-list"], [data-testid="floating-move-list"]')) {
      continue;
    }
    sum += kid.getBoundingClientRect().height;
    visible += 1;
  }
  if (visible === 0) return 0;
  if (visible > 1) sum += gap * (visible - 1);
  const padY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
  return sum + padY;
}

/**
 * Content height of the board stack — sum of children (+ column gap), ignoring
 * the stretched middle row that may be much taller on mobile.
 */
export function measureBoardColumnContentHeight(shell: HTMLElement): number {
  const col = shell.querySelector<HTMLElement>("[data-board-column]");
  if (!col) {
    const middle = shell.querySelector<HTMLElement>('[data-region="middle"]');
    return middle?.scrollHeight ?? 0;
  }
  const style = getComputedStyle(col);
  const gap = parseFloat(style.rowGap || style.gap || "0") || 0;
  const kids = Array.from(col.children) as HTMLElement[];
  let sum = 0;
  let visible = 0;
  for (const kid of kids) {
    const ks = getComputedStyle(kid);
    if (ks.display === "none") continue;
    sum += kid.getBoundingClientRect().height;
    visible += 1;
  }
  if (visible > 1) sum += gap * (visible - 1);
  return sum;
}

/**
 * Content height of the bottom Screen region (0 when empty / collapsed).
 * Skips fixed overlays so §4b can budget MoveList separately while
 * BoardControls / captures still count against the viewport.
 */
export function measureBottomRegionHeight(shell: HTMLElement): number {
  const bottom = shell.querySelector<HTMLElement>('[data-region="bottom"]');
  if (!bottom) return 0;
  const style = getComputedStyle(bottom);
  if (style.display === "none" || style.visibility === "hidden") return 0;
  // Collapsed footer track (CoachPanel float) — no in-flow budget.
  if (shell.dataset.footerFloat === "true" && !shell.querySelector('[data-region="top"] [data-testid="floating-move-list"]')) {
    return 0;
  }
  const kids = Array.from(bottom.children) as HTMLElement[];
  let sum = 0;
  let visible = 0;
  const gap = parseFloat(style.rowGap || style.gap || "0") || 0;
  for (const kid of kids) {
    const ks = getComputedStyle(kid);
    if (ks.display === "none") continue;
    if (ks.position === "fixed" || ks.position === "absolute") continue;
    sum += kid.getBoundingClientRect().height;
    visible += 1;
  }
  if (visible === 0) return 0;
  if (visible > 1) sum += gap * (visible - 1);
  const padY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
  return sum + padY;
}

/** Shell padding-block — desktop `padding-block: 2rem` must count in §4 fit checks. */
export function measureShellPaddingY(shell: HTMLElement): number {
  const style = getComputedStyle(shell);
  return (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
}

export function measureShellChrome(shell: HTMLElement): {
  topH: number;
  midContentH: number;
  bottomH: number;
  padY: number;
} {
  return {
    topH: measureTopRegionHeight(shell),
    midContentH: measureBoardColumnContentHeight(shell),
    bottomH: measureBottomRegionHeight(shell),
    padY: measureShellPaddingY(shell),
  };
}

/** Avatar-height CSS var → px (CoachPanel in-flow budget). */
export function measureAvatarHeightBudget(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--avatar-height").trim();
  if (raw.endsWith("rem")) return remToPx(parseFloat(raw));
  if (raw.endsWith("px")) return parseFloat(raw);
  return remToPx(8);
}

/**
 * Desktop board-screen top grid track budget — `--avatar-height + 1rem`
 * (extra rem for opponent CapturedPieces under the title stack).
 */
export function measureTopTrackBudget(): number {
  return measureAvatarHeightBudget() + remToPx(1);
}

/**
 * Observe shell + board-column for layout changes that affect §4 float mode.
 * Returns a disconnect function.
 */
export function observeFooterFloatLayout(onMeasure: () => void): () => void {
  const ro = new ResizeObserver(() => onMeasure());
  const shell = document.querySelector<HTMLElement>('[data-testid="screen-root"]');
  if (shell) {
    ro.observe(shell);
    const col = shell.querySelector("[data-board-column]");
    if (col) ro.observe(col);
  }
  window.addEventListener("resize", onMeasure);
  const t = window.setTimeout(onMeasure, 100);
  onMeasure();
  return () => {
    clearTimeout(t);
    ro.disconnect();
    window.removeEventListener("resize", onMeasure);
  };
}
