import { chromium } from 'playwright';
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  await page.goto('https://business.facebook.com/commerce', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(8000);

  console.log('URL:', page.url());

  // Click "Añadir productos" with force (bypass overlay)
  const addBtn = page.locator('text=Añadir productos').first();
  if (await addBtn.isVisible().catch(() => false)) {
    console.log('Clicking Añadir productos...');
    await addBtn.click({ force: true });
    await delay(8000);
    console.log('URL after:', page.url());

    // Take screenshot
    await page.screenshot({ path: 'commerce-add-products.png' }).catch(() => {});

    // Check what's on the page
    const text = await page.innerText('body').catch(() => '');
    console.log('Content:', text.substring(0, 800).replace(/\n/g, ' | '));

    // Look for options like "Crear catálogo", "Subir productos", etc.
    const btns = await page.locator('[role="button"]:visible').all();
    for (const btn of btns) {
      const t = (await btn.innerText().catch(() => '')).trim().substring(0, 60);
      const aria = await btn.getAttribute('aria-label').catch(() => '');
      if (t) console.log(`  Btn: "${t}"`);
      if (aria && aria !== t) console.log(`  Aria: "${aria}"`);
    }
  }

  await browser.close();
}
main().catch(console.error);
