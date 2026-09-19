import { expect, test } from "@playwright/test";

import { settledPieceAt } from "./helpers";
import type { Page } from "@playwright/test";

/** Canonical deep link: baseURL is `/starchess/`. */
const gotoScfen = async (page: Page, scfen: string) => {
  await page.goto(`single?scfen=${encodeURIComponent(scfen)}`);
  await expect(page.getByTestId("starchess-board-chrome")).toBeVisible({ timeout: 20_000 });
  // Deep links can seat a milestone turn — clear its broadcast first.
  const bubble = page.getByTestId("turn-bonus-bubble");
  const shown = await bubble
    .waitFor({ state: "visible", timeout: 500 })
    .then(() => true)
    .catch(() => false);
  if (shown) {
    await bubble.click();
    await expect(page.getByTestId("turn-bonus-bubble")).toBeHidden({ timeout: 2_000 });
  }
};

/** Resolves true once a rookBattery attack hull mounts (HE volley playing). */
const sawRookBattery = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const sel = "[data-starchess-attack-layer] [data-attack-anim='rookBattery']";
        if (document.querySelector(sel)) {
          resolve(true);
          return;
        }
        const done = (v: boolean) => {
          obs.disconnect();
          window.clearTimeout(t);
          resolve(v);
        };
        const obs = new MutationObserver(() => {
          if (document.querySelector(sel)) done(true);
        });
        obs.observe(document.body, { childList: true, subtree: true });
        const t = window.setTimeout(() => done(false), 15_000);
      }),
  );

test.describe("Sieged tank shelling (fog rook-siege beats)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
    await page.evaluate(() => localStorage.clear());
  });

  test("vacated d2 still takes HE: marine slips via B gas, explosion resolves", async ({
    page,
  }) => {
    // Tank intent on d2 stands while the marine is there; B pawnDouble slips
    // it to d1 (promoting) pre-attack — the shell still lands on d2.
    const scfen =
      "SCFEN|7k/8/8/8/3R4/8/3p4/K7|11|33|P|G:21:22|Q:w:C=d4d2;b:B=pawnDouble:d2:d1:q|S:d4";
    await gotoScfen(page, scfen);
    await expect(settledPieceAt(page, "d4", "w r")).toBeVisible();
    await expect(settledPieceAt(page, "d2", "b p")).toBeVisible();

    await page.getByTestId("turn-end").click();

    expect(await sawRookBattery(page)).toBe(true);

    // Settled: d2 empty (shelled, not occupied), marine promoted on d1,
    // tank still sieged on d4.
    await expect(settledPieceAt(page, "d2", "b p")).toHaveCount(0);
    await expect(settledPieceAt(page, "d1", "b q")).toBeVisible({ timeout: 15_000 });
    await expect(settledPieceAt(page, "d4", "w r")).toBeVisible();
  });

  test("d7 intent intercepts at d6: B-gas marine steps into the ray", async ({ page }) => {
    // Tank intent on d7; B pawnDouble steps the marine d7→d6 pre-attack —
    // the collision rules kill the interceptor, d7 never takes the hit.
    const scfen =
      "SCFEN|7k/3p4/8/8/3R4/8/8/K7|11|33|P|G:21:22|Q:w:C=d4d7;b:B=pawnDouble:d7:d6|S:d4";
    await gotoScfen(page, scfen);
    await expect(settledPieceAt(page, "d4", "w r")).toBeVisible();
    await expect(settledPieceAt(page, "d7", "b p")).toBeVisible();

    await page.getByTestId("turn-end").click();

    expect(await sawRookBattery(page)).toBe(true);

    // Settled: interceptor dead on d6, d7 untouched, tank still sieged on d4.
    await expect(settledPieceAt(page, "d6", "b p")).toHaveCount(0);
    await expect(settledPieceAt(page, "d7", "b p")).toHaveCount(0);
    await expect(settledPieceAt(page, "d4", "w r")).toBeVisible({ timeout: 15_000 });
  });
});
