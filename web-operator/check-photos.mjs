import { chromium } from 'playwright';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // Try photos page
  await page.goto('https://www.facebook.com/profile.php?id=61591838792522&sk=photos', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(5000);

  console.log('URL:', page.url());
  const btns = await page.locator('[role="button"]').all();
  const seen = new Set();
  for (const btn of btns) {
    const text = (await btn.innerText().catch(() => '')).trim();
    const label = await btn.getAttribute('aria-label').catch(() => '');
    const key = text || label;
    if (key && !seen.has(key) && key.length < 50) {
      seen.add(key);
      console.log(`  "${key}"`);
    }
  }

  await browser.close();
}
main().catch(console.error);
