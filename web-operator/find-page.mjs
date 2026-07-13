import { chromium } from 'playwright';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  await page.goto('https://www.facebook.com/pages/?category=your_pages', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(4000);

  // Find all page links
  const links = await page.locator('a[href*="/profile.php?id="]').all();
  console.log('Page links:');
  for (const link of links) {
    const text = (await link.innerText().catch(() => '')).trim();
    const href = await link.getAttribute('href').catch(() => '');
    if (text) console.log('  -', text, '->', href);
  }

  // Look for VentasPro text anywhere
  const ventasElements = await page.locator('text=VentasPro').all();
  console.log('\nVentasPro elements found:', ventasElements.length);
  for (const el of ventasElements) {
    const text = (await el.innerText().catch(() => '')).trim();
    const tag = await el.evaluate(e => e.tagName).catch(() => '');
    console.log(`  [${tag}] "${text.substring(0, 60)}"`);
  }

  await browser.close();
}
main().catch(console.error);
