/**
 * Navigation touch targets + single-player overflow guards.
 *
 * jsdom cannot measure layout (no hit testing, media queries unevaluated),
 * so this asserts the static contract instead: mobile-only rules that clear
 * 40×40px on every arrow used to navigate, the ResourceBar name-over-strips
 * wrap, and no data-testid selectors in touched stylesheets (mirrors
 * `npm run check:css-layout`). Real pixels are covered by the
 * Navigation/Chrome stories at the Mobile 390×844 viewport.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dirname, "..");
const UI = join(SRC, "..", "..", "ui", "src");

const css = (path: string): string => readFileSync(path, "utf8");

/** All `@media <query>` block bodies in the file (without the opener). */
const mediaBlocks = (text: string, query: string): string[] => {
  const out: string[] = [];
  const opener = `@media ${query} {`;
  let from = 0;
  while (true) {
    const at = text.indexOf(opener, from);
    if (at < 0) return out;
    // Block ends at the next @media opener or EOF (these files nest one level).
    const next = text.indexOf("@media", at + opener.length);
    out.push(text.slice(at + opener.length, next < 0 ? undefined : next));
    from = next < 0 ? text.length : next;
    if (next < 0) return out;
  }
};

/** Snippet must appear *inside* a `@media <query>` block, not just after it. */
const mediaHas = (text: string, query: string, snippet: string): boolean =>
  mediaBlocks(text, query).some((block) => block.includes(snippet));

/** CSS with every `@media … { … }` block stripped (brace-matched). */
const desktopCss = (text: string): string => {
  let out = "";
  let i = 0;
  while (true) {
    const at = text.indexOf("@media", i);
    if (at < 0) return out + text.slice(i);
    out += text.slice(i, at);
    const open = text.indexOf("{", at);
    if (open < 0) return out;
    let depth = 0;
    let j = open;
    while (j < text.length) {
      if (text[j] === "{") depth++;
      else if (text[j] === "}") {
        depth--;
        if (depth === 0) break;
      }
      j++;
    }
    i = j + 1;
  }
};

describe("nav touch targets (static CSS contract)", () => {
  it("ChevronNav clears 40×40px on mobile in both apps (kept in sync)", () => {
    for (const file of [
      join(SRC, "components/primitives/ChevronNav.module.css"),
      join(UI, "components/primitives/ChevronNav.module.css"),
    ]) {
      const text = css(file);
      expect(mediaHas(text, "(max-width: 719px)", ".nav"), `${file} mobile 40px rule`).toBe(true);
      expect(
        mediaHas(text, "(max-width: 719px)", "min-height: 40px"),
        `${file} min-height`,
      ).toBe(true);
      expect(
        mediaHas(text, "(max-width: 719px)", "min-width: 40px"),
        `${file} min-width`,
      ).toBe(true);
    }
  });

  it("review turn arrows + list pager clear 40×40px on mobile", () => {
    const turn = css(join(SRC, "components/atoms/ReviewTurnNav.module.css"));
    expect(mediaHas(turn, "(max-width: 719px)", ".btn"), "turn .btn rule").toBe(true);
    expect(mediaHas(turn, "(max-width: 719px)", "min-height: 40px"), "turn min-height").toBe(true);
    expect(mediaHas(turn, "(max-width: 719px)", "min-width: 40px"), "turn min-width").toBe(true);

    const filters = css(join(SRC, "components/atoms/MatchHistoryFilters.module.css"));
    expect(mediaHas(filters, "(max-width: 719px)", ".page-btn"), "pager rule").toBe(true);
    expect(mediaHas(filters, "(max-width: 719px)", "min-height: 40px"), "pager min-height").toBe(
      true,
    );
    expect(mediaHas(filters, "(max-width: 719px)", "min-width: 40px"), "pager min-width").toBe(
      true,
    );
  });

  it("tutorial breadcrumb crumbs clear 40px tall on mobile", () => {
    const text = css(join(SRC, "components/primitives/Breadcrumb.module.css"));
    expect(mediaHas(text, "(max-width: 719px)", ".crumb"), "crumb rule").toBe(true);
    expect(mediaHas(text, "(max-width: 719px)", "min-height: 40px"), "crumb min-height").toBe(
      true,
    );
  });

  it("single-player live bar is one row filling its own band row", () => {
    // No forced name-over-strips wrap and no dual wrappers on live chrome:
    // the viewer bar is one flex row ([name][strips]) in its own top-section
    // row below the nav band. Dual bars ship on review only.
    const bar = css(join(SRC, "presentation/hud/components/ResourceBar.module.css"));
    expect(bar, "no name-own-row wrap rule").not.toContain("flex: 1 1 100%");
  });

  it("desktop silhouettes stay tight (no 40px floor outside mobile)", () => {
    const files = [
      join(SRC, "components/primitives/ChevronNav.module.css"),
      join(UI, "components/primitives/ChevronNav.module.css"),
      join(SRC, "components/atoms/ReviewTurnNav.module.css"),
      join(SRC, "components/atoms/MatchHistoryFilters.module.css"),
      join(SRC, "components/primitives/Breadcrumb.module.css"),
    ];
    for (const file of files) {
      const base = desktopCss(css(file));
      expect(base, `${file} desktop has no 40px min-height`).not.toMatch(/min-height:\s*40px/);
      expect(base, `${file} desktop has no 40px min-width`).not.toMatch(/min-width:\s*40px/);
    }
  });

  it("both ChevronNav copies carry the identical mobile rule", () => {
    const a = mediaBlocks(
      css(join(SRC, "components/primitives/ChevronNav.module.css")),
      "(max-width: 719px)",
    ).join("\n");
    const b = mediaBlocks(
      css(join(UI, "components/primitives/ChevronNav.module.css")),
      "(max-width: 719px)",
    ).join("\n");
    expect(a.length, "starchess has a 719 block").toBeGreaterThan(0);
    expect(a, "ui copy drifted from starchess copy").toBe(b);
  });
  it("touched stylesheets never select via data-testid (css-layout contract)", () => {
    const files = [
      join(SRC, "components/primitives/ChevronNav.module.css"),
      join(UI, "components/primitives/ChevronNav.module.css"),
      join(SRC, "components/atoms/ReviewTurnNav.module.css"),
      join(SRC, "components/atoms/MatchHistoryFilters.module.css"),
      join(SRC, "components/primitives/Breadcrumb.module.css"),
      join(SRC, "presentation/hud/components/ResourceBar.module.css"),
      join(SRC, "app/BaseScreen.module.css"),
      join(SRC, "stories/Navigation.stories.module.css"),
    ];
    for (const file of files) {
      expect(css(file), `${file} must not style via data-testid`).not.toMatch(/data-testid/);
    }
  });

  it("Navigation story shells mirror production layout (no inline styles)", () => {
    const text = css(join(SRC, "stories/Navigation.stories.module.css"));
    for (const sel of [".topChrome", ".turnFill", ".dualResources", ".bannerFilters"]) {
      expect(text, `${sel} mirror shell`).toMatch(new RegExp(`\\${sel}\\s*{`));
    }
    expect(text, "dual pair wraps centered").toMatch(/justify-content:\s*center/);
    expect(text, "story live bar mirror").toMatch(/\.liveBar\.liveBar\s*\{/);
    expect(
      mediaHas(text, "(min-width: 720px)", ".topChrome .liveBar"),
      "story live bar fit-content on desktop",
    ).toBe(true);
    expect(
      mediaBlocks(css(join(SRC, "app/BaseScreen.module.css")), "(min-width: 720px)").some(
        (block) =>
          block.includes(".topChrome .topResourceBar") && block.includes("width: fit-content"),
      ),
      "desktop fit-content lives in the min-width:720 band",
    ).toBe(true);
    expect(
      mediaHas(
        text,
        "(max-width: 719px) and (min-width: 480px) and (max-height: 639px)",
        "flex-wrap: nowrap",
      ),
      "dual pair holds side-by-side in the dynamic band",
    ).toBe(true);
  });

  it("live chrome renders the viewer bar only (dual bars are review-only)", () => {
    const base = readFileSync(join(SRC, "app/BaseScreen.tsx"), "utf8");
    expect(base, "no live dual wrapper").not.toContain("liveDualResources");
    expect(base, "no live dual compact").not.toContain("liveDualCompact");
    expect(base, "no mobile compact on live bars").not.toContain("compact={mobileViewport()}");
  });

  it("top section rows: nav band first, chrome stack after", () => {
    const base = readFileSync(join(SRC, "app/BaseScreen.tsx"), "utf8");
    const navClose = base.indexOf("</ScreenBackNav>", base.indexOf("live-back"));
    const chromeOpen = base.indexOf("styles.topChrome", navClose);
    expect(navClose, "nav band closes").toBeGreaterThan(-1);
    expect(chromeOpen, "chrome stack follows the nav band as sibling rows").toBeGreaterThan(
      navClose,
    );
  });
});
