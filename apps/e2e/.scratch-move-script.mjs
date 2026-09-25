import { chromium } from '@playwright/test';

const url = 'http://localhost:5175/starchess/tutorial/king/king-attack-4';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/opt/ms-playwright/chromium-1228/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

page.on('console', (msg) => console.log('[console]', msg.type(), msg.text()));
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForSelector("[data-testid='chessboard']", { timeout: 30000 });

async function move(from, to) {
  await page.locator(`[data-square='${from}']`).click();
  await page.waitForTimeout(150);
  await page.locator(`[data-square='${to}']`).click();
  await page.waitForTimeout(150);
}

await move('c3', 'c2');
await move('f4', 'f3');

await page.screenshot({ path: '/tmp/claude-1000/-Users-pluvo-Projects-proveo-chess-coach/833b5813-9f90-45f9-9550-a9be48c14df6/scratchpad/after-moves.png' });

const html = await page.locator("[data-testid='chessboard']").innerHTML();
console.log('---BOARD_HTML_LEN---', html.length);

await browser.close();
