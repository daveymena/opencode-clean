import { chromium } from 'playwright';
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  await page.goto('https://business.facebook.com/products/catalogs/new/', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(10000);

  console.log('URL:', page.url());

  // Wait for page to fully load
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await delay(3000);

  // Screenshot
  await page.screenshot({ path: 'catalog-new.png' }).catch(() => {});

  // Print all visible text
  const text = await page.innerText('body').catch(() => '');
  console.log('\n=== Page content ===');
  console.log(text.substring(0, 2000));

  // Find all visible buttons, inputs, selects
  console.log('\n=== Buttons ===');
  const btns = await page.locator('[role="button"]:visible').all();
  for (const btn of btns) {
    const t = (await btn.innerText().catch(() => '')).trim().substring(0, 80);
    if (t) console.log(`  "${t}"`);
  }

  console.log('\n=== Inputs ===');
  const inputs = await page.locator('input:visible, select:visible, textarea:visible').all();
  for (const inp of inputs) {
    const type = await inp.getAttribute('type').catch(() => '');
    const name = await inp.getAttribute('name').catch(() => '');
    const placeholder = await inp.getAttribute('placeholder').catch(() => '');
    const aria = await inp.getAttribute('aria-label').catch(() => '');
    if (type || name || placeholder || aria) {
      console.log(`  type=${type} name=${name} placeholder="${placeholder}" aria="${aria}"`);
    }
  }

  // Look for option/radio elements for catalog type (e-commerce, travel, etc.)
  console.log('\n=== Radio/checkbox elements ===');
  const radios = await page.locator('[role="radio"]:visible, [type="radio"]:visible, [role="checkbox"]:visible').all();
  console.log(`Count: ${radios.length}`);
  for (const r of radios) {
    const label = await r.evaluate(el => {
      const parent = el.closest('label') || el.parentElement;
      return parent?.textContent?.trim().substring(0, 80) || '';
    }).catch(() => '');
    if (label) console.log(`  "${label}"`);
  }

  await browser.close();
}
main().catch(console.error);
