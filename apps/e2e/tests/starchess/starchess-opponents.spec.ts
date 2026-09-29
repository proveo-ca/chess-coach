// SPEC: _spec/packages/starchess-core/adjutant-definitions.puml
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

for (const opponent of ["naive", "strategic"] as const) {
  test(`setup lists all definitions and starts ${opponent}`, async ({ page }) => {
    await page.getByRole("button", { name: "Single Player", exact: true }).click();
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
    await page.getByRole("button", { name: "Single Player", exact: true }).click();
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
    await expect(page).toHaveURL(/\/starchess\/$/);
  });
}
