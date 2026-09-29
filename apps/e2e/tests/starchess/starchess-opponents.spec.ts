// SPEC: _spec/packages/starchess-core/adjutant-definitions.puml
import { expect, test, type Page } from "@playwright/test";

const OPENING = "SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";
const WIN = "SCFEN|4k3/4Q3/8/8/8/8/8/4K3|5|31|P|G:11:11|Q:w:C=e7e8;b:";

const openSetup = async (page: Page) => {
  await page.getByRole("button", { name: "Single Player", exact: true }).click();
  await page.getByRole("button", { name: "Yolo", exact: true }).click();
};

const seedSession = async (page: Page, opponent: string, scfen = OPENING) => {
  const blob = JSON.stringify({
    v: 1, id: "opponent-resume", startedAt: "2026-09-29T00:00:00.000Z",
    map: "eclipse", playerColor: "w", opponent, scfen,
    economies: { w: { stored: 3, deployed: 4 }, b: { stored: 3, deployed: 4 } },
  });
  await page.evaluate((value) => localStorage.setItem("starchess_match_session", value), blob);
  return blob;
};

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

for (const opponent of ["naive", "strategic"] as const) {
  test(`setup lists all definitions and starts ${opponent}`, async ({ page }) => {
    await openSetup(page);
    const select = page.getByTestId("new-game-opponent");
    await expect(select.locator("option")).toHaveText([
      "Adjutant (Script)",
      "Adjutant (Strategic)",
      "Adjutant (Machine Learning) — not implemented",
      "Adjutant (RLHF) — not implemented",
      "Adjutant (RLCD) — not implemented",
    ]);
    for (const placeholder of ["machine-learning", "rlhf", "rlcd"]) {
      await expect(select.locator(`option[value="${placeholder}"]`)).toBeDisabled();
    }
    await select.selectOption(opponent);
    await page.reload();
    await openSetup(page);
    await expect(page.getByTestId("new-game-opponent")).toHaveValue(opponent);
    await page.getByTestId("new-game-start").click();
    await expect(page).toHaveURL(new RegExp(`opponent=${opponent}`));
    await expect(page.getByTestId("starchess-board-chrome")).toBeVisible();
    await expect(page.getByText(`Game vs Adjutant (${opponent === "naive" ? "Script" : "Strategic"})`, { exact: true })).toBeVisible();
  });
}

for (const opponent of ["machine-learning", "rlhf", "rlcd"]) {
  test(`direct ${opponent} URL cannot start a live match`, async ({ page }) => {
    await page.goto(`single?opponent=${opponent}`);
    await expect(page.getByTestId("opponent-unavailable")).toBeVisible();
    await expect(page.getByTestId("starchess-board-chrome")).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("starchess_match_session"))).toBeNull();
    await page.getByRole("button", { name: "Return to menu" }).click();
    await expect(page).toHaveURL(/\/starchess\/?$/);
  });

  test(`saved ${opponent} session stays unavailable without changing match data`, async ({ page }) => {
    const blob = await seedSession(page, opponent);
    await page.evaluate(() => {
      localStorage.setItem("starchess_match_history", JSON.stringify({ games: [] }));
      localStorage.setItem("starchess_achievements", JSON.stringify({ unlocks: {} }));
    });
    await page.goto("single");
    await expect(page.getByTestId("opponent-unavailable")).toBeVisible();
    await expect(page.getByTestId("starchess-board-chrome")).toHaveCount(0);
    expect(await page.evaluate(() => ({
      session: localStorage.getItem("starchess_match_session"),
      history: localStorage.getItem("starchess_match_history"),
      achievements: localStorage.getItem("starchess_achievements"),
    }))).toEqual({ session: blob, history: JSON.stringify({ games: [] }), achievements: JSON.stringify({ unlocks: {} }) });
  });
}

test("a bare single route retains the resumed strategic opponent on rematch", async ({ page }) => {
  await seedSession(page, "strategic", WIN);
  await page.goto("single");
  await expect(page.getByText("Game vs Adjutant (Strategic)", { exact: true })).toBeVisible();
  await page.getByTestId("turn-end").click();
  await expect(page.getByTestId("new-achievements-modal")).toBeVisible();
  await page.getByTestId("achievements-continue").click();
  await page.getByTestId("match-result-another-game").click();
  await expect(page).toHaveURL(/opponent=strategic/);
  await expect(page.getByText("Game vs Adjutant (Strategic)", { exact: true })).toBeVisible();
});

test("saved setup normalizes a placeholder to a playable selection", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("starchess_setup", JSON.stringify({ opponent: "machine-learning" })));
  await page.reload();
  await openSetup(page);
  await expect(page.getByTestId("new-game-opponent")).toHaveValue("naive");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("starchess_setup")!))).toEqual({ opponent: "naive" });
});
