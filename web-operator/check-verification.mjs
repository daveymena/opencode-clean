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

  // Click Empezar
  await page.locator('text=Empezar').first().click({ force: true });
  await delay(5000);

  // Fill form
  const inputs = await page.locator('[role="dialog"] input:visible').all();
  if (inputs[0]) { await inputs[0].click({ force: true }); await inputs[0].fill('VentasPro'); await delay(200); }
  if (inputs[1]) { await inputs[1].click({ force: true }); await inputs[1].fill('Duvier Davey Mena Mosquera'); await delay(200); }
  if (inputs[2]) { await inputs[2].click({ force: true }); await inputs[2].fill('daveymena162@gmail.com'); await delay(200); }

  await delay(1000);

  // Click Enviar
  await page.locator('text=Enviar').first().click({ force: true });
  await delay(8000);

  // Check EVERYTHING in dialog
  const dialog = page.locator('[role="dialog"]').first();
  if (await dialog.isVisible().catch(() => false)) {
    const html = await dialog.evaluate(el => el.innerHTML.substring(0, 5000)).catch(() => '');
    console.log('Dialog HTML:');
    console.log(html);
    
    // Look for any new inputs (verification code, etc.)
    const allInputs = await dialog.locator('input').all();
    console.log(`\nAll inputs in dialog: ${allInputs.length}`);
    for (const inp of allInputs) {
      const visible = await inp.isVisible().catch(() => false);
      const type = await inp.getAttribute('type').catch(() => '');
      const placeholder = await inp.getAttribute('placeholder').catch(() => '');
      const name = await inp.getAttribute('name').catch(() => '');
      console.log(`  visible=${visible} type=${type} name="${name}" placeholder="${placeholder}"`);
    }

    // Also look for any buttons
    const btns = await dialog.locator('[role="button"]').all();
    for (const btn of btns) {
      const t = (await btn.innerText().catch(() => '')).trim().substring(0, 50);
      if (t) console.log(`  Dialog btn: "${t}"`);
    }

    // Look for any links
    const links = await dialog.locator('a').all();
    for (const link of links) {
      const t = (await link.innerText().catch(() => '')).trim().substring(0, 50);
      const href = await link.getAttribute('href').catch(() => '');
      if (t) console.log(`  Link: "${t}" → ${href?.substring(0, 80)}`);
    }
  }

  await page.screenshot({ path: 'dialog-after-submit-detailed.png' }).catch(() => {});
  await browser.close();
}
main().catch(console.error);
