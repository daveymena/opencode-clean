import { chromium } from 'playwright';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  await page.goto('https://www.facebook.com/pages/create', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(4000);

  // Fill form
  const nameLabel = page.locator('span:has-text("Nombre de la p\u00e1gina")').first();
  const nameInput = nameLabel.locator('..').locator('input').first();
  await nameInput.fill('VentasPro - Cursos Digitales');
  await delay(800);

  const catLabel = page.locator('text=Categor\u00eda').first();
  const catInput = catLabel.locator('..').locator('input').first();
  await catInput.fill('Educaci\u00f3n');
  await delay(2000);

  const sug = page.locator('[role="listbox"] [role="option"]').first();
  if (await sug.isVisible().catch(() => false)) {
    await sug.click();
    console.log('Category selected');
  } else {
    await page.keyboard.press('Enter');
    console.log('Category enter pressed');
  }
  await delay(1000);

  // Click create
  const createBtn = page.locator('[role="button"]:has-text("Crear p\u00e1gina")').first();
  const btnVisible = await createBtn.isVisible().catch(() => false);
  console.log('Create button visible:', btnVisible);
  if (btnVisible) {
    await createBtn.click();
    console.log('Clicked create');
  }
  await delay(8000);

  // Check what happened
  const text = await page.innerText('body').catch(() => '');
  console.log('\nPAGE TEXT:', text.replace(/\s+/g, ' ').trim().substring(0, 2000));

  const dialogs = await page.locator('[role="dialog"]').all();
  console.log(`\nDialogs: ${dialogs.length}`);

  // Check for errors
  const errors = await page.locator('[role="alert"], [aria-live="polite"]').all();
  for (const e of errors) {
    const t = await e.innerText().catch(() => '');
    if (t) console.log('ERROR:', t.substring(0, 200));
  }

  await browser.close();
}
main().catch(console.error);
