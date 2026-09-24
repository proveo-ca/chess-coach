import { expect, test, type Page } from "@playwright/test";

const STONKS =
  "SCFEN|4k3/8/8/3q4/2P5/8/8/4K3|1|33|P|G:11:11|Q:w:C=c4d5;b:";
const MEDAL =
  "SCFEN|7k/8/8/8/1b6/8/2PR4/3K4|11|33|P|G:12:22|S:d2|Q:w:B=stimStep:c2:c3;b:C=b4d2";
const WIN =
  "SCFEN|4k3/4Q3/8/8/8/8/8/4K3|5|31|P|G:11:11|Q:w:C=e7e8;b:";

const armWatcher = (page: Page) =>
  page.evaluate(() => {
    const bag = new Set<string>();
    const read = () => {
      for (const el of document.querySelectorAll("[data-testid='achievement-bubble']")) {
        bag.add(
          `${el.getAttribute("data-short-id")}:${el.getAttribute("data-level")}:${el.getAttribute("data-origin")}`,
        );
      }
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true });
    (window as unknown as { __ach: Set<string> }).__ach = bag;
  });

const seen = (page: Page) =>
  page.evaluate(() => [...((window as unknown as { __ach?: Set<string> }).__ach ?? [])]);

const dismissBonus = async (page: Page) => {
  const bubble = page.getByTestId("turn-bonus-bubble");
  const shown = await bubble
    .waitFor({ state: "visible", timeout: 800 })
    .then(() => true)
    .catch(() => false);
  if (shown) await bubble.click();
};

const open = async (page: Page, scfen: string) => {
  await page.goto(
    `single?team=w&opponent=strategic&map=eclipse&scfen=${encodeURIComponent(scfen)}`,
  );
  await expect(page.getByTestId("starchess-board-chrome")).toBeVisible({ timeout: 20_000 });
  await dismissBonus(page);
  await armWatcher(page);
};

const hasLevel = (rows: string[], shortId: string) =>
  rows.some((row) => {
    const [id, level] = row.split(":");
    return id === shortId && Number(level) >= 2;
  });

test.describe("live achievement bubbles", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
    await page.evaluate(() => localStorage.clear());
  });

  test("Stonks reaches level 2 when a Marine takes a BattleShip", async ({ page }) => {
    await open(page, STONKS);
    await page.getByTestId("turn-end").click();
    await expect.poll(() => seen(page), { timeout: 20_000 }).toContain("stonks:2:c4");
  });

  test("Medal of Honor fires when a marine intercepts and dies", async ({ page }) => {
    await open(page, MEDAL);
    await page.getByTestId("turn-end").click();
    await expect.poll(() => seen(page), { timeout: 20_000 }).toContain("medal:1:c2");
  });

  test("a short strategic win lists new achievements before VICTORY", async ({ page }) => {
    await open(page, WIN);
    await page.getByTestId("turn-end").click();
    const report = page.getByTestId("new-achievements-modal");
    await expect(report).toBeVisible({ timeout: 20_000 });
    await expect(report.locator("[data-short-id='flawless']")).toBeVisible();
    await expect(report.locator("[data-short-id='cheese']")).toBeVisible();
    await expect(report.locator("[data-short-id='beat']")).toBeVisible();
    await expect(page.getByTestId("match-result-modal")).toHaveCount(0);
    await page.getByTestId("achievements-continue").click();
    await expect(page.getByTestId("match-result-headline")).toHaveText("VICTORY");
    await expect(page.getByTestId("match-result-another-game")).toBeVisible();
    await expect(page.getByTestId("match-result-replay")).toBeVisible();
  });
});
