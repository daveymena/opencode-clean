import { chromium } from 'playwright';
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  // Check the page's posts section specifically
  await page.goto('https://www.facebook.com/profile.php?id=61591838792522&sk=timeline', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await delay(8000);

  // Scroll multiple times to trigger loading
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 2000));
    await delay(2000);
  }

  const text = await page.innerText('body').catch(() => '');

  // Check for distinct post patterns
  const patterns = [
    'Diseño Gráfico', 'Photoshop', 'Illustrator',
    'Office', 'Word, Excel',
    'Inglés', 'Gramática',
    'Excel Avanzado', 'Power BI',
    'Hacking Ético', 'Kali Linux',
    'Publicado', 'Compartió'
  ];

  console.log('=== Searching for post content ===');
  for (const pat of patterns) {
    const idx = text.indexOf(pat);
    if (idx >= 0) {
      const before = text.substring(Math.max(0, idx - 50), idx);
      const after = text.substring(idx, Math.min(text.length, idx + 100));
      console.log(`"${pat}" at ${idx}: ...${before.trim().substring(0,30)}|${after.replace(/\n/g, ' ').trim().substring(0,100)}`);
    }
  }

  // Check specifically for post-like elements
  const articleCount = await page.locator('[role="article"]').count();
  console.log(`\nArticles on page: ${articleCount}`);

  // Look for feed stories
  const feedStories = await page.locator('[data-pagelet^="FeedUnit"]').count();
  console.log(`Feed units: ${feedStories}`);

  // Screenshot
  await page.screenshot({ path: 'page-state.png' }).catch(() => {});
  console.log('\nScreenshot saved');

  await browser.close();
}
main().catch(console.error);
