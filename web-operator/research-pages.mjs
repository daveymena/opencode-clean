import { chromium } from 'playwright';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // Search for similar Facebook pages
  console.log('Buscando páginas de ejemplo de cursos digitales...');

  // Go to Facebook search
  await page.goto('https://www.facebook.com/search/pages/?q=cursos%20digitales%20colombia', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(5000);

  console.log('Search URL:', page.url());
  const text = await page.innerText('body').catch(() => '');
  console.log(text.replace(/\s+/g, ' ').trim().substring(0, 1500));

  // Get first few page results
  const pageLinks = await page.locator('a[href*="/profile.php?id="]').all();
  console.log(`\nPages found: ${pageLinks.length}`);
  for (let i = 0; i < Math.min(pageLinks.length, 10); i++) {
    const href = await pageLinks[i].getAttribute('href').catch(() => '');
    const name = (await pageLinks[i].innerText().catch(() => '')).trim();
    if (name) console.log(`  [${i}] ${name.substring(0, 60)}`);
  }

  // Also search specifically
  await page.goto('https://www.facebook.com/search/pages/?q=venta%20de%20cursos%20digitales', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(5000);

  const pageLinks2 = await page.locator('a[href*="/profile.php?id="]').all();
  console.log(`\nSecond search - Pages found: ${pageLinks2.length}`);
  for (let i = 0; i < Math.min(pageLinks2.length, 10); i++) {
    const name = (await pageLinks2[i].innerText().catch(() => '')).trim();
    if (name) console.log(`  [${i}] ${name.substring(0, 60)}`);
  }

  await page.screenshot({ path: 'search-results.png' });
  console.log('\nScreenshot saved');
  await browser.close();
}
main().catch(console.error);
