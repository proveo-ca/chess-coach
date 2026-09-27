import { expect, test, type Page } from "@playwright/test";

/**
 * Silent menu CPU probe → VFX tier. Spec: `_spec/apps/starchess/vfx-tier.puml`.
 *
 * The probe measures the menu playground's real combat VFX and only a ~20×
 * slowdown may pick `lite` (thresholds in `presentation/animations/vfxProbe.ts`).
 * Throttling is Chromium's `Emulation.setCPUThrottlingRate`.
 */

const KEY = "starchess_vfx_tier";

type TierState = { tier: string; probedAt: number; liteStreak: number; lastLagMs: number };

const stored = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}") as Partial<TierState>, KEY);

/** Load the menu at `rate`× CPU and wait for the probe to record a verdict. */
const probeMenu = async (page: Page, rate: number, previousProbe = 0) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  await page.goto("./");
  await expect
    .poll(async () => (await stored(page)).probedAt ?? 0, { timeout: 45_000, intervals: [500] })
    .toBeGreaterThan(previousProbe);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  return stored(page);
};

test.describe("VFX tier · menu CPU probe", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "CPU throttling is a Chromium CDP feature");
  test.use({ viewport: { width: 390, height: 844 } });
  test.describe.configure({ timeout: 120_000 });

  for (const rate of [1, 6, 10]) {
    test(`${rate}× keeps the full tier`, async ({ page }) => {
      const s = await probeMenu(page, rate);
      expect(s).toMatchObject({ tier: "full", liteStreak: 0 });
      await expect(page.locator("html")).toHaveAttribute("data-vfx-tier", "full");
    });
  }

  test("20× goes lite on the second probe, and the tier reaches every route", async ({ page }) => {
    const first = await probeMenu(page, 20);
    // One slow probe is noise: stay full, keep the probe stale.
    expect(first).toMatchObject({ tier: "full", liteStreak: 1 });

    const second = await probeMenu(page, 20, first.probedAt);
    expect(second).toMatchObject({ tier: "lite", liteStreak: 0 });
    await expect(page.locator("html")).toHaveAttribute("data-vfx-tier", "lite");

    // A deep link that never mounts the menu still gets the tier.
    await page.goto("single");
    await expect(page.locator("html")).toHaveAttribute("data-vfx-tier", "lite");
  });

  test("reduced motion never probes", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.waitForTimeout(12_000);
    expect((await stored(page)).probedAt ?? 0).toBe(0);
    await expect(page.locator("html")).toHaveAttribute("data-vfx-tier", "full");
  });
});
