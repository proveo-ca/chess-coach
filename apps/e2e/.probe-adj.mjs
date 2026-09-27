import { chromium } from "@playwright/test";
const b = await chromium.launch();
for (const rate of [20]) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.6 });
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && errs.push("console: " + m.text().slice(0, 160)));
  await p.addInitScript(() => localStorage.setItem("starchess_vfx_tier", JSON.stringify({ tier: "full", probedAt: Date.now(), probeVersion: 1, liteStreak: 0 })));
  const cdp = await ctx.newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  await p.goto("http://localhost:5175/starchess/tutorial/live-play/live-play-attack-4"); await p.waitForTimeout(4000 * rate / 2 + 2000);
  const blackAt = () => p.evaluate(() => [...document.querySelectorAll("[data-board-grid] [data-square]")].filter(s => s.querySelector("[data-piece]") && s.querySelector("[data-piece] [data-team='b'], [data-piece][data-color='b']")).map(s => s.dataset.square).join(","));
  const snap = () => p.evaluate(() => [...document.querySelectorAll("[data-board-grid] [data-square] [data-piece]")].map(e => e.closest("[data-square]").dataset.square + e.dataset.piece).sort().join(" "));
  const before = await snap();
  await p.evaluate(() => { const o = window.__adj = { calls: 0, ms: 0 }; });
  const end = p.getByTestId("turn-end").first();
  const hasEnd = await end.isVisible().catch(() => false);
  if (hasEnd) await end.click({ timeout: 30000 }).catch(e => errs.push("end click: " + e.message.split("\n")[0]));
  await p.waitForTimeout(8000 * Math.max(1, rate / 2));
  const after = await snap();
  console.log(`${rate}x endVisible=${hasEnd} changed=${before !== after}\n  before: ${before}\n  after:  ${after}\n  errors: ${JSON.stringify(errs.slice(0, 5))}`);
  await ctx.close();
}
await b.close();
