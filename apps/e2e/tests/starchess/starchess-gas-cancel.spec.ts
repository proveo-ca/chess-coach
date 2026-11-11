import { expect, test, type Page } from "@playwright/test";

import { settledPieceAt } from "./helpers";

/**
 * Backing out of a gas lift. Two affordances, one contract: Esc on desktop,
 * drop-outside-the-board everywhere (the only one a touch device has), with the
 * hint bubble naming whichever applies. The armed-special half matters more than
 * it looks — board-click targeting has no dismiss chrome of its own, so before
 * Esc reached it the only exits were a valid target or a page reload.
 */
const GAS_BOARD =
  "SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:22:22|Q:w:;b:";
/** Same board with a mineral bank, so the Command Center can open Deploy. */
const DEPLOY_BOARD =
  "SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:22:22|B:4:4|Q:w:;b:";

const gotoScfen = async (page: Page, scfen: string) => {
  await page.goto(`single?scfen=${encodeURIComponent(scfen)}`);
  await expect(page.getByTestId("starchess-board-chrome")).toBeVisible({ timeout: 20_000 });
  // These boards deep-link into Turn 11 — clear its broadcast first.
  const bubble = page.getByTestId("turn-bonus-bubble");
  const shown = await bubble
    .waitFor({ state: "visible", timeout: 1_000 })
    .then(() => true)
    .catch(() => false);
  if (shown) {
    await bubble.click();
    await expect(page.getByTestId("turn-bonus-bubble")).toBeHidden({ timeout: 2_000 });
  }
};

const rack = (page: Page) => page.getByTestId("gas-deploy").locator("button").first();

/** Lift a canister and hold it over `square` without releasing. */
const liftGasOver = async (page: Page, square: string) => {
  const from = await rack(page).boundingBox();
  const to = await page.locator(`[data-square='${square}']`).boundingBox();
  if (!from || !to) throw new Error("no rack/square box");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  const [tx, ty] = [to.x + to.width / 2, to.y + to.height / 2];
  const [fx, fy] = [from.x + from.width / 2, from.y + from.height / 2];
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(fx + ((tx - fx) * i) / 8, fy + ((ty - fy) * i) / 8);
  }
};

test.describe("StarChess gas deploy — cancelling a lift", () => {
  test("the lift names its own escape hatch", async ({ page }) => {
    await gotoScfen(page, GAS_BOARD);
    await expect(page.getByTestId("gas-cancel-hint")).toHaveCount(0);

    await liftGasOver(page, "e2");
    // Every e2e browser is a desktop client (fine pointer + non-mobile UA), so
    // the keyboard half must be named here. Touch clients get the shorter copy —
    // `isDesktopClient` decides, covered in the client-platform unit suite.
    await expect(page.getByTestId("gas-cancel-hint")).toContainText("Press Esc");
    await expect(page.getByTestId("gas-cancel-hint")).toContainText("outside the board");
    await page.mouse.up();
  });

  test("Escape returns the canister and queues nothing", async ({ page }) => {
    await gotoScfen(page, GAS_BOARD);
    const queueBefore = await page.getByTestId("turn-queue").textContent();

    await liftGasOver(page, "e2");
    await expect(page.locator("[data-drag-count]")).toHaveCount(1);

    await page.keyboard.press("Escape");
    // Canister flies home (240ms) and takes the hint with it.
    await expect(page.locator("[data-drag-count]")).toHaveCount(0, { timeout: 3_000 });
    await expect(page.getByTestId("gas-cancel-hint")).toHaveCount(0);
    await page.mouse.up();

    // Nothing armed, nothing queued, marine untouched.
    await expect(page.getByTestId("turn-queue")).toHaveText(queueBefore ?? "");
    await expect(settledPieceAt(page, "e2", "w p")).toBeVisible();
  });

  test("dropping outside the board cancels", async ({ page }) => {
    await gotoScfen(page, GAS_BOARD);
    const queueBefore = await page.getByTestId("turn-queue").textContent();

    await liftGasOver(page, "e2");
    await page.mouse.move(4, 400); // clear of every square
    await page.mouse.up();

    await expect(page.locator("[data-drag-count]")).toHaveCount(0, { timeout: 3_000 });
    await expect(page.getByTestId("turn-queue")).toHaveText(queueBefore ?? "");
  });

  /**
   * The lift used to hang its release on the rack button, so it only ever
   * terminated while pointer capture held. These three are the ways capture
   * stops delivering — each one stranded the canister mid-air with the rack
   * refusing every retry (`onPointerDown` bails while `drag()` is set).
   */
  test("a release the button never sees still retires the lift", async ({ page }) => {
    await gotoScfen(page, GAS_BOARD);
    await liftGasOver(page, "e2");
    await expect(page.locator("[data-drag-count]")).toHaveCount(1);

    // Capture dropped mid-gesture — the release now hits whatever is underneath.
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="gas-deploy"] button');
      for (const id of [1, 0]) {
        try {
          (btn as Element & { releasePointerCapture(i: number): void }).releasePointerCapture(id);
        } catch {
          /* not the live pointer id */
        }
      }
    });
    await page.mouse.move(6, 380);
    await page.mouse.up();

    await expect(page.locator("[data-drag-count]")).toHaveCount(0, { timeout: 3_000 });
    await expect(page.getByTestId("gas-cancel-hint")).toHaveCount(0);
  });

  test("a missed release is recovered on the next move", async ({ page }) => {
    await gotoScfen(page, GAS_BOARD);
    await liftGasOver(page, "e2");
    await expect(page.locator("[data-drag-count]")).toHaveCount(1);

    // Released over browser chrome / outside the window: the page sees no
    // pointerup at all, just a later move with no button held.
    await page.evaluate(() => {
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerId: 1,
          pointerType: "mouse",
          buttons: 0,
          clientX: 30,
          clientY: 30,
          bubbles: true,
        }),
      );
    });
    await expect(page.locator("[data-drag-count]")).toHaveCount(0, { timeout: 3_000 });
    await page.mouse.up();
  });

  test("losing window focus retires the lift", async ({ page }) => {
    await gotoScfen(page, GAS_BOARD);
    await liftGasOver(page, "e2");
    await expect(page.locator("[data-drag-count]")).toHaveCount(1);

    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(page.locator("[data-drag-count]")).toHaveCount(0, { timeout: 3_000 });
    await page.mouse.up();
  });

  test("the rack accepts a new lift after each of those", async ({ page }) => {
    await gotoScfen(page, GAS_BOARD);
    // Strand-then-recover, twice, then confirm the rack is not latched shut.
    for (const strand of ["blur", "buttons"] as const) {
      await liftGasOver(page, "e2");
      await page.evaluate((mode) => {
        if (mode === "blur") window.dispatchEvent(new Event("blur"));
        else
          window.dispatchEvent(
            new PointerEvent("pointermove", {
              pointerId: 1,
              pointerType: "mouse",
              buttons: 0,
              clientX: 30,
              clientY: 30,
              bubbles: true,
            }),
          );
      }, strand);
      await expect(page.locator("[data-drag-count]")).toHaveCount(0, { timeout: 3_000 });
      await page.mouse.up();
    }
    // A real drop still arms the marine's gas step (queue shows e2→e3).
    await liftGasOver(page, "e2");
    await page.mouse.up();
    await expect(page.getByTestId("turn-queue")).toContainText("e2→e3", { timeout: 3_000 });
  });

  test("Escape disarms board-click targeting and the board stays live", async ({ page }) => {
    await gotoScfen(page, DEPLOY_BOARD);

    // Gas the Command Center → Deploy picker → a unit → adjacent-square targeting.
    await liftGasOver(page, "e1");
    await page.mouse.up();
    await expect(page.getByTestId("deploy-modal")).toBeVisible();
    await page.locator("[data-spawn-piece]:not([disabled])").first().click();
    await expect(page.locator("[data-spawn-target]").first()).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("[data-spawn-target]")).toHaveCount(0);

    // Still a live board: selecting the marine offers its step again.
    await page.locator("[data-square='e2']").click();
    await expect(page.locator("[data-legal='e3']")).toBeVisible();
  });
});
