import { chromium } from 'playwright';
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  await page.goto('https://business.facebook.com/products/catalogs/new/', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(8000);

  // Click "Empezar" to create business portfolio
  const empezar = page.locator('text=Empezar').first();
  if (await empezar.isVisible().catch(() => false)) {
    console.log('Clicking Empezar...');
    await empezar.click({ force: true });
    await delay(10000);
    console.log('URL after:', page.url());

    await page.screenshot({ path: 'portfolio-setup.png' }).catch(() => {});

    // Show page content to understand what's needed
    const text = await page.innerText('body').catch(() => '');
    console.log('\nContent:', text.substring(0, 2000).replace(/\n/g, ' | '));

    // Find all interactive elements
    const btns = await page.locator('[role="button"]:visible').all();
    for (const btn of btns) {
      const t = (await btn.innerText().catch(() => '')).trim().substring(0, 60);
      if (t) console.log(`  Btn: "${t}"`);
    }

    const inputs = await page.locator('input:visible, select:visible, textarea:visible').all();
    for (const inp of inputs) {
      const type = await inp.getAttribute('type').catch(() => '');
      const placeholder = await inp.getAttribute('placeholder').catch(() => '');
      const aria = await inp.getAttribute('aria-label').catch(() => '');
      if (type || placeholder || aria) {
        console.log(`  Input: type=${type} placeholder="${placeholder}" aria="${aria}"`);
      }
    }
  } else {
    console.log('Empezar not visible. Current URL:', page.url());
  }

  await browser.close();
}
main().catch(console.error);
