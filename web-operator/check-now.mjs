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

  // Scroll
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 2000));
    await delay(1500);
  }

  const text = await page.innerText('body').catch(() => '');
  console.log('=== Checking for posts ===');
  const checks = ['Photoshop', 'Word, PowerPoint', 'Gramática', 'Tablas dinámicas', 'Pentesting', 'Contáctanos'];
  for (const c of checks) {
    console.log(text.includes(c) ? `✅ ${c}` : `❌ ${c}`);
  }

  // Show all unique "Publicar" button states
  console.log('\n=== Publicar buttons ===');
  const pubBtns = await page.locator('[aria-label="Publicar"]').all();
  console.log(`[aria-label="Publicar"] count: ${pubBtns.length}`);
  for (const b of pubBtns) {
    console.log(`  visible=${await b.isVisible().catch(() => false)}`);
  }

  await browser.close();
}
main().catch(console.error);
