import { expect, test, type Page } from "@playwright/test";

/**
 * StarCraft-name easter egg: Levenshtein runs on name blur (not keystroke).
 * - yes → /starchess/ (proxied same-origin from coach :5173)
 * - keep chess classic → unlock Nerd identity, stay on /chess/
 */

const NERD_DIALOG = { name: "Activate nerd mode?" } as const;

async function clearCoachStorage(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByPlaceholder("Your name")).toBeVisible({ timeout: 20_000 });
}

async function fillNameWithoutBlur(page: Page, name: string) {
  const input = page.getByPlaceholder("Your name");
  await input.click();
  await input.fill("");
  // type() keeps focus; do not blur yet
  await input.pressSequentially(name, { delay: 15 });
}

test.describe("Nerd mode easter egg", () => {
  test("does not prompt until name blur; yes opens StarChess", async ({ page }) => {
    await clearCoachStorage(page);

    await fillNameWithoutBlur(page, "Kerrigam");
    await expect(page.getByRole("dialog", NERD_DIALOG)).toHaveCount(0);

    await page.getByPlaceholder("Your name").blur();
    await expect(page.getByRole("dialog", NERD_DIALOG)).toBeVisible();

    await page.getByRole("button", { name: "yes" }).click();
    await expect(page).toHaveURL(/\/starchess\//);
    await expect(page.getByTestId("starchess-board-chrome")).toBeVisible({ timeout: 20_000 });
  });

  test("keep chess classic unlocks Nerd identity and stays on /chess", async ({ page }) => {
    await clearCoachStorage(page);

    await fillNameWithoutBlur(page, "Zeratul");
    await expect(page.getByRole("dialog", NERD_DIALOG)).toHaveCount(0);

    await page.getByPlaceholder("Your name").blur();
    await expect(page.getByRole("dialog", NERD_DIALOG)).toBeVisible();

    await page.getByRole("button", { name: "keep chess classic" }).click();
    await expect(page.getByRole("dialog", NERD_DIALOG)).toHaveCount(0);
    await expect(page).toHaveURL(/\/chess\//);

    const identity = page.locator("#player-identity");
    await expect(identity.locator('option[value="Nerd"]')).toHaveCount(1);
    await expect(identity).toHaveValue("Nerd");
  });
});
