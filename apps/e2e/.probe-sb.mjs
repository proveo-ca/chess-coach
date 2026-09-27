import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 393, height: 732 } });
await p.goto("http://localhost:5175/starchess/single?scfen=" + encodeURIComponent("SCFEN|4k3/2pppp2/8/8/8/8/2PPPP2/4K3|3|33|P|G:11:11|B:3:3|Q:w:;b:")); await p.waitForTimeout(3000);
const bb = p.getByTestId("turn-bonus-bubble"); if (await bb.isVisible().catch(() => false)) await bb.click().catch(() => {});
console.log(JSON.stringify(await p.evaluate(() => { const sb = document.querySelector(".mobile-sub-banner"); return [...sb.children].map(c => { const r = c.getBoundingClientRect(); return { tid: c.dataset.testid, cls: c.className.toString().split(" ").map(x => x.split("_")[1] ?? x).join("+"), w: Math.round(r.width), scrollW: c.scrollWidth, flex: getComputedStyle(c).flex, minW: getComputedStyle(c).minWidth, cssW: getComputedStyle(c).width }; }); })));
await b.close();
