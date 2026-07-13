import { chromium } from 'playwright';
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  await page.goto('https://www.facebook.com/profile.php?id=61591838792522&sk=timeline', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await delay(5000);

  // Scroll down a bit to trigger loading
  await page.evaluate(() => window.scrollBy(0, 800));
  await delay(3000);

  // Get all text from main content area
  const main = page.locator('[role="main"]').first();
  if (await main.isVisible().catch(() => false)) {
    const text = await main.innerText().catch(() => '');
    const lines = text.split('\n').filter(l => l.trim()).slice(0, 100);
    console.log('Main content lines:');
    lines.forEach((l, i) => console.log(i+1 + ':', l.substring(0, 120)));
  }

  await browser.close();
}
main().catch(console.error);
