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

  // Fill catalog name
  const nameInput = page.locator('input[placeholder*="nombre"]').first();
  if (await nameInput.isVisible().catch(() => false)) {
    await nameInput.click({ force: true }).catch(() => nameInput.evaluate(el => el.focus()));
    await delay(500);
    await nameInput.fill('VentasPro - Cursos Digitales');
    console.log('Catalog name filled');
  }

  // Ensure "Productos online" is selected (it should be default)
  // Uncheck the partner platform checkbox if it's checked
  const partnerCheckbox = page.locator('[aria-label="Conectarse a una plataforma de socios"]').first();
  if (await partnerCheckbox.isVisible().catch(() => false)) {
    const isChecked = await partnerCheckbox.isChecked().catch(() => false);
    console.log('Partner checkbox checked:', isChecked);
    if (isChecked) {
      await partnerCheckbox.click({ force: true });
      console.log('Unchecked partner platform');
    }
  }

  await delay(1000);

  // Click Siguiente
  const siguiente = page.locator('text=Siguiente').first();
  if (await siguiente.isVisible().catch(() => false)) {
    console.log('Clicking Siguiente...');
    await siguiente.click({ force: true });
    await delay(10000);
    console.log('URL after:', page.url());

    await page.screenshot({ path: 'catalog-next.png' }).catch(() => {});

    // Show page content
    const text = await page.innerText('body').catch(() => '');
    console.log('\nContent:', text.substring(0, 1500).replace(/\n/g, ' | '));

    // Check for buttons/options
    const btns = await page.locator('[role="button"]:visible').all();
    for (const btn of btns) {
      const t = (await btn.innerText().catch(() => '')).trim().substring(0, 60);
      if (t) console.log(`  Btn: "${t}"`);
    }

    // Check for inputs
    const inputs = await page.locator('input:visible, select:visible').all();
    for (const inp of inputs) {
      const type = await inp.getAttribute('type').catch(() => '');
      const placeholder = await inp.getAttribute('placeholder').catch(() => '');
      const aria = await inp.getAttribute('aria-label').catch(() => '');
      if (type || placeholder || aria) {
        console.log(`  Input: type=${type} placeholder="${placeholder}" aria="${aria}"`);
      }
    }
  } else {
    console.log('Siguiente not found');
    // Show what IS on the page
    const text = await page.innerText('body').catch(() => '');
    console.log('Page:', text.substring(0, 1000));
  }

  await browser.close();
}
main().catch(console.error);
