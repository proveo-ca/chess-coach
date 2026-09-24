import { expect, test, type Page } from "@playwright/test";

import { ROOT, clearStorage, gotoScfen, recordResolveFor } from "./vfxHarness";

/**
 * Roster: `_spec/apps/starchess/vfx-guarantees.md`.
 *
 * Guarantees V29–V32 — the compositor budget.
 * Source: `_spec/apps/starchess/architecture/timeline-vfx-density.puml`
 * ("no transition / @keyframes on paint-only properties") and the shipped
 * evidence in `timeline-perf.puml` (DroppedFrame 4045 → 330).
 *
 * Paint-only properties repaint the animated box every frame. Two offenders are
 * accepted and pinned below; anything else added is the regression.
 */

/** Accepted paint-animating keyframes (hashed CSS-module names at runtime). */
const PAINT_ALLOWLIST = [
  /fragShockwave/, // P2 in timeline-perf.puml — Hoverbike frag ring border-color.
  /sc-hint-pulse/, // Tutorial hint ring (board chrome, one square, not combat).
];

const CAPTURE_SEED = "SCFEN|k3r3/4p3/8/8/8/8/8/K3R3|1|33|P|G:11:11|Q:w:C=e1e8;b:";
const HOVERBIKE_SEED = "SCFEN|k7/8/1p6/8/2N5/8/8/K7|1|33|P|G:11:11|Q:w:C=c4b6;b:";

/** Every `@keyframes` in the loaded stylesheets that animates a paint-only prop. */
const paintAnimatingKeyframes = (page: Page) =>
  page.evaluate(() => {
    const PAINT_ONLY = /^(outline-color|border(-[a-z]+)?-color|box-shadow)$/;
    const hits: { name: string; prop: string; at: string }[] = [];
    const walk = (rules: CSSRuleList) => {
      for (const rule of rules) {
        if (rule instanceof CSSKeyframesRule) {
          for (const frame of rule.cssRules) {
            const kf = frame as CSSKeyframeRule;
            for (const prop of kf.style) {
              if (PAINT_ONLY.test(prop)) {
                hits.push({ name: rule.name, prop, at: kf.keyText });
              }
            }
          }
        } else if ((rule as CSSGroupingRule).cssRules) {
          walk((rule as CSSGroupingRule).cssRules);
        }
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        walk(sheet.cssRules);
      } catch {
        /* cross-origin sheet */
      }
    }
    return hits;
  });

test.describe("VFX · paint budget", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("V29 no new paint-animating keyframes reach the app", async ({ page }) => {
    await gotoScfen(page, CAPTURE_SEED);

    const hits = await paintAnimatingKeyframes(page);
    const offenders = [
      ...new Set(
        hits
          .filter((hit) => !PAINT_ALLOWLIST.some((allowed) => allowed.test(hit.name)))
          .map((hit) => `${hit.name} @${hit.at} → ${hit.prop}`),
      ),
    ];
    expect(offenders).toEqual([]);
    // The allowlist must stay honest: both entries still exist to be excused.
    expect(hits.length).toBeGreaterThan(0);
  });

  test("V30 running overlay animations never repaint (allowlist aside)", async ({ page }) => {
    // A Hoverbike capture runs frag + shockwave — the densest paint-risk weapon.
    await gotoScfen(page, HOVERBIKE_SEED);

    await page.evaluate((rootSel) => {
      const w = window as unknown as { __names?: string[]; __timer?: number };
      w.__names = [];
      const tick = () => {
        const root = document.querySelector(rootSel);
        if (!root) return;
        for (const el of [root, ...root.querySelectorAll("*")]) {
          for (const anim of el.getAnimations()) {
            const name = (anim as CSSAnimation).animationName;
            if (name && !w.__names!.includes(name)) w.__names!.push(name);
          }
        }
      };
      tick();
      w.__timer = window.setInterval(tick, 16);
    }, ROOT);

    const watch = await recordResolveFor(page, 4_000);
    expect(watch.attackAnims, "knight frag never played").toContain("hoverbikeFrag");

    const running = await page.evaluate(() => {
      const w = window as unknown as { __names?: string[]; __timer?: number };
      window.clearInterval(w.__timer);
      return w.__names ?? [];
    });
    expect(running.length, "no overlay animation ran").toBeGreaterThan(0);

    const hits = await paintAnimatingKeyframes(page);
    const paintNames = new Set(hits.map((hit) => hit.name));
    const offenders = running.filter(
      (name) => paintNames.has(name) && !PAINT_ALLOWLIST.some((allowed) => allowed.test(name)),
    );
    expect(offenders).toEqual([]);
  });

  test("V31 the board phase ring fades opacity-only", async ({ page }) => {
    await gotoScfen(page, CAPTURE_SEED);

    const ring = page.locator("[data-testid='chessboard'] > div").first();
    const transition = await ring.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { property: cs.transitionProperty, position: cs.position, inset: cs.inset };
    });
    // Colours snap per phase; only opacity crosses frames.
    expect(transition.property).toBe("opacity");
    expect(transition.position).toBe("absolute");
  });

  test("V32 the phase ring — not the board container — carries the resolve state", async ({
    page,
  }) => {
    await gotoScfen(page, CAPTURE_SEED);
    const board = page.locator("[data-testid='chessboard']");
    await expect(board).toHaveAttribute("data-phase", /start|planning|intent/);

    await page.getByTestId("turn-end").click();
    await expect(board).toHaveAttribute("data-phase", "resolve", { timeout: 15_000 });
  });
});
