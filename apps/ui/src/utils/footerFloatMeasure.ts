// SPEC: _spec/apps/ui/responsiveness/rules.md
import { setFooterFloat } from "~/store/viewportLayoutStore";

/**
 * §4 float fit check must use board-column *content* height, not the stretched
 * middle `1fr` grid track (tall mobile would otherwise always float).
 */

export function remToPx(rem: number): number {
  return rem * parseFloat(getComputedStyle(document.documentElement).fontSize || "16");
}

export function syncFooterFloatAttr(shouldFloat: boolean) {
  setFooterFloat(shouldFloat);
  const shell = document.querySelector<HTMLElement>('[data-testid="screen-root"]');
  if (shell) shell.dataset.footerFloat = shouldFloat ? "true" : "false";
}

/** Visible height of the top Screen region (0 when empty / display:none). */
export function measureTopRegionHeight(shell: HTMLElement): number {
  const top = shell.querySelector<HTMLElement>('[data-region="top"]');
  if (!top) return 0;
  const style = getComputedStyle(top);
  if (style.display === "none" || style.visibility === "hidden") return 0;
  return top.getBoundingClientRect().height;
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

export function measureShellChrome(shell: HTMLElement): { topH: number; midContentH: number } {
  return {
    topH: measureTopRegionHeight(shell),
    midContentH: measureBoardColumnContentHeight(shell),
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
