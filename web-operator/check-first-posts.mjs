import { chromium } from 'playwright';
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await delay(5000);

  // Scroll down to load posts
  await page.evaluate(() => window.scrollBy(0, 1500));
  await delay(3000);
  await page.evaluate(() => window.scrollBy(0, 1500));
  await delay(3000);

  const text = await page.innerText('body').catch(() => '');
  
  // Check for post content with product names
  const keywords = ['DISEÑO GRÁFICO', 'Photoshop', 'MICROSOFT OFFICE', 'Word, Excel', 'INGLÉS', 'EXCEL AVANZADO', 'HACKING ÉTICO', 'Kali Linux'];
  for (const kw of keywords) {
    const idx = text.toUpperCase().indexOf(kw.toUpperCase());
    if (idx >= 0) {
      const ctx2 = text.substring(Math.max(0, idx - 30), Math.min(text.length, idx + 120));
      console.log(`✅ "${kw}" encontrado: ${ctx2.replace(/\n/g, ' | ').trim()}`);
    }
  }

  // Also look for specific post elements
  const posts = page.locator('[data-pagelet^="ProfileTimeline"]').first();
  if (await posts.isVisible().catch(() => false)) {
    const postText = await posts.innerText().catch(() => '');
    console.log('\nTimeline content:\n', postText.substring(0, 1000));
  }

  await browser.close();
}
main().catch(console.error);
