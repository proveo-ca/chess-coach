import { expect, test } from "@playwright/test";

import {
  BOARD_GRID,
  LAYER_ORDER,
  ROOT,
  clearStorage,
  gotoScfen,
  recordResolve,
} from "./vfxHarness";

/**
 * Guarantees V1–V9 — the Composite overlay contract.
 * Roster: `_spec/apps/starchess/vfx-guarantees.md`.
 * Source: `_spec/apps/starchess/architecture/composite-vfx-stack.puml`
 *       + `_spec/apps/starchess/architecture/timeline-perf.puml` (light paint/GPU).
 */

/** One classical slide — enough to prove the stack survives a resolve. */
const MOVE_SEED = "SCFEN|4k3/8/8/8/8/8/4P3/4K3|1|33|P|G:11:11|Q:w:C=e2e3;b:";

test.describe("VFX · overlay contract", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("V1 combat root mounts once, inert, above the board", async ({ page }) => {
    await gotoScfen(page, MOVE_SEED);

    const root = page.locator(ROOT);
    await expect(root).toHaveCount(1);
    await expect(root).toHaveAttribute("aria-hidden", "");

    const style = await root.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        pointerEvents: cs.pointerEvents,
        zIndex: cs.zIndex,
        overflow: cs.overflow,
        position: cs.position,
      };
    });
    expect(style.pointerEvents).toBe("none");
    expect(style.zIndex).toBe("30");
    // Trails overflow the board box — clipping them is the regression this pins.
    expect(style.overflow).toBe("visible");
    expect(style.position).toBe("absolute");
  });

  test("V2 all eight layers stay mounted, in order, with zero cues", async ({ page }) => {
    await gotoScfen(page, MOVE_SEED);

    const order = await page.locator(ROOT).evaluate((el) =>
      [...el.children].map(
        (c) => c.getAttributeNames().find((n) => n.startsWith("data-starchess")) ?? c.tagName,
      ),
    );
    expect(order).toEqual([...LAYER_ORDER]);
  });

  test("V3 layers are never remounted during a resolve (no per-layer Show)", async ({ page }) => {
    await gotoScfen(page, MOVE_SEED);
    const watch = await recordResolve(page);

    expect(watch.ever).toContain("move");
    expect(watch.samples).toBeGreaterThan(10);
    // A single child-order signature for the whole resolve = stack never rebuilt.
    expect(watch.layerOrders).toEqual([LAYER_ORDER.join(",")]);
    expect(watch.rootSwaps).toBe(1);
    expect(watch.layerRemounts).toBe(0);
    expect(watch.rootMissing).toBe(0);
  });

  test("V4 root keeps `contain: layout style` — never paint", async ({ page }) => {
    await gotoScfen(page, MOVE_SEED);
    const watch = await recordResolve(page);

    expect(watch.containValues).toEqual(["layout style"]);
    for (const value of watch.containValues) expect(value).not.toContain("paint");
  });

  test("V5 `data-overlay-dpr` clamps the device pixel ratio to 2", async ({ page }) => {
    await gotoScfen(page, MOVE_SEED);

    const { attr, expected } = await page.evaluate((rootSel) => {
      const el = document.querySelector(rootSel)!;
      return {
        attr: el.getAttribute("data-overlay-dpr"),
        expected: String(Math.min(window.devicePixelRatio || 1, 2)),
        cssVar: getComputedStyle(el).getPropertyValue("--overlay-dpr").trim(),
      };
    }, ROOT);
    expect(attr).toBe(expected);
    expect(Number(attr)).toBeLessThanOrEqual(2);
  });

  test("V6 root registers on the board grid across viewports and resizes", async ({ page }) => {
    const viewports = [
      { width: 1280, height: 900 },
      { width: 800, height: 600 },
      { width: 390, height: 844 },
    ];

    await gotoScfen(page, MOVE_SEED);
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      // ResizeObserver → measure() → box; give the observer a frame to land.
      await expect
        .poll(
          async () =>
            page.evaluate(
              ({ rootSel, gridSel }) => {
                const root = document.querySelector(rootSel);
                const grid = document.querySelector(gridSel);
                if (!root || !grid) return -1;
                const r = root.getBoundingClientRect();
                const g = grid.getBoundingClientRect();
                return Math.max(
                  Math.abs(r.x - g.x),
                  Math.abs(r.y - g.y),
                  Math.abs(r.width - g.width),
                  Math.abs(r.height - g.height),
                );
              },
              { rootSel: ROOT, gridSel: BOARD_GRID },
            ),
          { timeout: 10_000, message: `overlay drift at ${viewport.width}x${viewport.height}` },
        )
        .toBeLessThanOrEqual(1);
    }
  });

  test("V7 overlay stays registered while cues play", async ({ page }) => {
    await gotoScfen(page, MOVE_SEED);
    const watch = await recordResolve(page);

    expect(watch.ever).toContain("move");
    expect(watch.rootDrift).toBeLessThanOrEqual(1);
  });

  test("V8 idle overlay carries no `will-change` (active anims only)", async ({ page }) => {
    await gotoScfen(page, MOVE_SEED);

    const idle = await page.evaluate((rootSel) => {
      const root = document.querySelector(rootSel)!;
      return [root, ...root.querySelectorAll("*")]
        .map((el) => getComputedStyle(el).willChange)
        .filter((value) => value && value !== "auto");
    }, ROOT);
    expect(idle).toEqual([]);
  });

  test("V9 board grid is measured, not guessed — overlay covers 8×8 squares", async ({ page }) => {
    await gotoScfen(page, MOVE_SEED);

    const geom = await page.evaluate(
      ({ rootSel, gridSel }) => {
        const root = document.querySelector(rootSel)!.getBoundingClientRect();
        const square = document
          .querySelector(`${gridSel} [data-square]`)!
          .getBoundingClientRect();
        return { root: root.width, square: square.width };
      },
      { rootSel: ROOT, gridSel: BOARD_GRID },
    );
    expect(geom.root).toBeGreaterThan(0);
    expect(geom.root / geom.square).toBeGreaterThan(7.5);
    expect(geom.root / geom.square).toBeLessThan(8.5);
  });
});
