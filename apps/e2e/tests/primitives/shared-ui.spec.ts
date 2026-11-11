// SPEC: _spec/_plans/chess-ui-primitives.puml
import { expect, test } from "@playwright/test";

for (const product of ["chess", "starchess"]) {
  test(`${product} form controls work without application modules`, async ({ page }) => {
    const appRequests: string[] = [];
    const errors: string[] = [];
    page.on("request", (request) => {
      if (/\/apps\//.test(request.url())) appRequests.push(request.url());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(
      `/iframe.html?id=primitives-controls--form-controls&viewMode=story&globals=product:${product}`,
    );
    await page.getByRole("textbox", { name: "Player name" }).fill("Player");
    await expect(page.getByRole("textbox", { name: "Disabled input" })).toBeDisabled();
    await page.getByRole("combobox", { name: "Difficulty" }).selectOption({ label: "Hard" });
    await page.getByRole("checkbox", { name: "Enable hints" }).press("Space");
    await expect(page.getByText("Hint status: on")).toBeVisible();
    expect(appRequests).toEqual([]);
    expect(errors).toEqual([]);
  });
  test(`${product} dialog restores focus after Escape`, async ({ page }) => {
    await page.goto(
      `/iframe.html?id=primitives-controls--dialog&viewMode=story&globals=product:${product}`,
    );
    const trigger = page.getByRole("button", { name: "Open dialog" });
    await trigger.click();
    await expect(page.getByRole("dialog", { name: "Example dialog" })).toBeVisible();
    await expect(
      product === "chess"
        ? page.getByRole("button", { name: "Close modal" })
        : page.getByRole("dialog"),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
  test(`${product} navigation remains usable on a narrow viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      `/iframe.html?id=primitives-controls--navigation&viewMode=story&globals=product:${product}`,
    );
    const back = page.getByRole("button", { name: "Back", exact: true });
    await expect(back).toBeVisible();
    const bounds = await back.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(40);
    expect(bounds?.width).toBeGreaterThanOrEqual(40);
    await expect(page.getByRole("button", { name: "Go back" })).toBeDisabled();
    await page.getByRole("button", { name: "Go forward" }).click();
    await expect(page.getByText("Step 2")).toBeVisible();
  });
}

test("product variants retain distinct button appearance", async ({ page }) => {
  await page.goto("/iframe.html?id=primitives-controls--product-variants&viewMode=story");
  const chess = page.getByRole("button", { name: "Play chess", exact: true });
  const star = page.getByRole("button", { name: "Play StarChess", exact: true });
  await expect(chess).toBeVisible();
  await expect(star).toBeVisible();
  expect(await chess.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
    await star.evaluate((el) => getComputedStyle(el).backgroundColor),
  );
});

test("Chess adapters preserve route base and menu dialog", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173/chess/");
  await page.getByRole("button", { name: "Credits", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Solo Analysis", exact: true }).click();
  await expect(page).toHaveURL(/\/chess\/analysis$/);
  await page.getByTestId("analysis-back").click();
  await expect(page.getByRole("button", { name: "Solo Analysis", exact: true })).toBeVisible();
});

test("StarChess adapter preserves link navigation under its base", async ({ page }) => {
  await page.goto("http://127.0.0.1:5175/starchess/review");
  const back = page.getByTestId("review-back-menu");
  await expect(back).toHaveAttribute("href", /^\/starchess\/?$/);
  await back.click();
  await expect(page).toHaveURL(/\/starchess\/?$/);
  await expect(page.getByTestId("starchess-menu")).toBeVisible();
});

test("every package story mounts without application modules or runtime errors", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const response = await request.get("/index.json");
  expect(response.ok()).toBe(true);
  const index = (await response.json()) as {
    entries: Record<string, { id: string; type: string }>;
  };
  const stories = Object.values(index.entries).filter((entry) => entry.type === "story");
  expect(stories.length).toBeGreaterThan(10);
  const errors: string[] = [];
  const appRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (req) => {
    if (/\/apps\//.test(req.url())) appRequests.push(req.url());
  });
  for (const story of stories) {
    await test.step(story.id, async () => {
      await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);
      await expect(page.locator("#storybook-root > *").first()).toBeAttached();
      await expect(page.locator(".sb-errordisplay")).not.toBeVisible();
      expect(errors).toEqual([]);
    });
  }
  expect(appRequests).toEqual([]);
});
