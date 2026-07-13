import { chromium } from 'playwright';
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  // Check the page
  await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await delay(8000);

  // Scroll to load posts
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollBy(0, 2000));
    await delay(1500);
  }

  const text = await page.innerText('body').catch(() => '');

  // Search for post content (exclude page description)
  const postsKeywords = [
    'Photoshop, Illustrator',
    'CURSOS DISEÑO GRÁFICO',
    'Word, PowerPoint, Access',
    'MICROSOFT OFFICE',
    'Gramática, pronunciación',
    'INGLÉS COMPLETO',
    'Tablas dinámicas',
    'EXCEL AVANZADO',
    'Pentesting, Kali Linux',
    'CURSO HACKING ÉTICO',
    'Contáctanos para adquirir'
  ];

  let found = 0;
  for (const kw of postsKeywords) {
    if (text.includes(kw)) {
      console.log(`✅ "${kw.substring(0, 40)}..."`);
      found++;
    }
  }
  console.log(`\n${found}/${postsKeywords.length} keywords found in page`);

  // Screenshot
  await page.screenshot({ path: 'final-state.png' }).catch(() => {});
  console.log('Screenshot saved');

  // Check total post count
  const feedUnits = await page.locator('[data-pagelet^="FeedUnit"]').count();
  const articles = await page.locator('[role="article"]').count();
  console.log(`Feed units: ${feedUnits}, Articles: ${articles}`);

  await browser.close();
}
main().catch(console.error);
