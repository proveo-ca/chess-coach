import { expect, test } from "@playwright/test";

import { clearStorage, gotoScfen, recordResolve, settledPiece } from "./vfxHarness";

/**
 * Roster: `_spec/apps/starchess/vfx-guarantees.md`.
 *
 * Guarantees V10–V18 — every cue kind the Composite can play reaches its layer
 * during a real resolve. This is the anti-teleport family: a resolve that
 * commits the board without ever rendering its VFX is the regression class
 * documented in `_spec/apps/starchess/animation-pipeline.md`
 * ("pieces appear to teleport … with an empty overlay root").
 *
 * One SCFEN seed per kind; seeds are pre-queued so `End` is the only input.
 * Cue presence is read from the in-page sampler ({@link recordResolve}) — a
 * Playwright poll is too coarse for a 250ms boom or a 600ms slide; only settled
 * placement is asserted through locators.
 */

test.describe("VFX · cue coverage", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test("V10 a classical move plays through the move layer", async ({ page }) => {
    await gotoScfen(page, "SCFEN|4k3/8/8/8/8/8/4P3/4K3|1|33|P|G:11:11|Q:w:C=e2e3;b:");
    const watch = await recordResolve(page);

    expect(watch.ever).toContain("move");
    await expect(settledPiece(page, "e3", "w p")).toBeVisible({ timeout: 15_000 });
    await expect(settledPiece(page, "e2", "w p")).toHaveCount(0);
  });

  test("V11 pawn gas step plays the canister drop and the stim move", async ({ page }) => {
    await gotoScfen(page, "SCFEN|4k3/8/8/8/8/8/4P3/4K3|11|33|P|G:12:22|Q:w:B=pawnDouble:e2:e3;b:");
    const watch = await recordResolve(page);

    expect(watch.ever).toContain("gasDrop");
    expect(watch.ever).toContain("move");
    await expect(settledPiece(page, "e3", "w p")).toBeVisible({ timeout: 15_000 });
  });

  test("V12 a capture plays the attacker's weapon and the victim's death", async ({ page }) => {
    await gotoScfen(page, "SCFEN|k3r3/4p3/8/8/8/8/8/K3R3|1|33|P|G:11:11|Q:w:C=e1e8;b:");
    const watch = await recordResolve(page);

    expect(watch.ever).toContain("attack");
    expect(watch.ever).toContain("death");
    expect(watch.attackAnims).toEqual(["rookBattery"]);

    await expect(settledPiece(page, "e7", "w r")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-square='e7'] img[alt='b p']")).toHaveCount(0);
  });

  test("V13 Charon snipe fires the bishop missile anim", async ({ page }) => {
    await gotoScfen(page, "SCFEN|k6q/8/8/8/3B4/8/8/K7|11|33|P|G:02:22|Q:w:B=bishopSnipe:d4:h8;b:");
    const watch = await recordResolve(page);

    expect(watch.ever).toContain("gasDrop");
    expect(watch.attackAnims).toContain("bishopCharon");
    expect(watch.ever).toContain("death");
    await expect(page.locator("[data-square='h8'] img[alt='b q']")).toHaveCount(0, {
      timeout: 15_000,
    });
  });

  test("V14 promotion plays the deploy drop before the unit exists", async ({ page }) => {
    await gotoScfen(page, "SCFEN|k7/4P3/8/8/8/8/8/4K3|1|33|P|G:11:11|Q:w:C=e7e8q;b:");
    const watch = await recordResolve(page);

    expect(watch.ever).toContain("deploy");
    expect(watch.deployPieces).toContain("q");
    await expect(settledPiece(page, "e8", "w q")).toBeVisible({ timeout: 15_000 });
  });

  test("V15 spawn plays the canister drop and the deploy", async ({ page }) => {
    await gotoScfen(page, "SCFEN|4k3/8/8/8/8/8/8/4K3|1|33|P|G:01:11|B:3:3|Q:w:B=spawn:e1:d1:p;b:");
    const watch = await recordResolve(page);

    expect(watch.ever).toContain("gasDrop");
    expect(watch.deployPieces).toContain("p");
    await expect(settledPiece(page, "d1", "w p")).toBeVisible({ timeout: 15_000 });
  });

  test("V16 Tactical Jump uses the jump layer and its trail — never a slide", async ({ page }) => {
    await gotoScfen(page, "SCFEN|k6b/8/8/8/8/8/8/Q6K|21|33|P|G:03:33|Q:w:B=queenWarp:a1:d4;b:");
    const watch = await recordResolve(page);

    expect(watch.ever).toContain("jump");
    expect(watch.ever).toContain("jumpTrail");
    // A warp that renders through the move layer is the "jump looks like a slide" bug.
    expect(watch.max.move).toBe(0);
    await expect(settledPiece(page, "d4", "w q")).toBeVisible({ timeout: 15_000 });
  });

  test("V17 spider-mine chase plays the missile and its wake", async ({ page }) => {
    await gotoScfen(page, "SCFEN|7k/8/8/8/8/8/8/R3K3|1|33|P|G:11:11|M:b:a4|Q:w:C=a1a8;b:");
    const watch = await recordResolve(page);

    expect(watch.ever).toContain("move");
    expect(watch.ever).toContain("mineMissile");
    expect(watch.ever).toContain("mineTrail");
    expect(watch.ever).toContain("death");
  });

  test("V18 a connecting king shot booms, then burns", async ({ page }) => {
    // Kd1 vs kd2 — turn-open mutual shots chip HP on mount and on every End.
    await gotoScfen(page, "SCFEN|8/8/8/8/8/8/3k4/3K4|1|33|P|G:11:11|Q:w:;b:");
    await expect(page.getByTestId("king-lives")).toHaveAttribute("data-w", "2", {
      timeout: 15_000,
    });

    const watch = await recordResolve(page, { idleMs: 500 });

    expect(watch.ever).toContain("kingDamage");
    expect(watch.ever).toContain("attack");
    expect(watch.attackAnims).toEqual(["kingDualCannon"]);
    // The hit boom is 250ms — the sampler is the only reliable observer.
    expect(watch.kingPhases.filter((phase) => phase.endsWith(":boom"))).not.toEqual([]);
    // Fire persists after the boom — the hull keeps burning at 1–2 HP.
    await expect(
      page.locator("[data-king-damage='smallFire'], [data-king-damage='bigFire']").first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
