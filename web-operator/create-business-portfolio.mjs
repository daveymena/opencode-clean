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

  // Click Empezar to open the dialog
  await page.locator('text=Empezar').first().click({ force: true });
  await delay(5000);

  // Find all visible input fields in the dialog
  const dialog = page.locator('[role="dialog"]').first();
  if (await dialog.isVisible().catch(() => false)) {
    const inputs = await dialog.locator('input:visible').all();
    console.log('Inputs in dialog:');
    for (const inp of inputs) {
      const placeholder = await inp.getAttribute('placeholder').catch(() => '');
      const aria = await inp.getAttribute('aria-label').catch(() => '');
      const type = await inp.getAttribute('type').catch(() => '');
      console.log(`  type=${type} placeholder="${placeholder}" aria="${aria}"`);
    }
  }

  // Fill the form
  // Business name
  const bizInput = page.locator('input[placeholder*="Market"]').first();
  if (await bizInput.isVisible().catch(() => false)) {
    await bizInput.click({ force: true });
    await delay(300);
    await bizInput.fill('VentasPro');
    console.log('Business name: VentasPro');
  }

  // User name
  const nameInput = page.locator('input[placeholder*="nombre"]').first();
  if (await nameInput.isVisible().catch(() => false)) {
    await nameInput.click({ force: true });
    await delay(300);
    await nameInput.fill('Davey Mena');
    console.log('User name: Davey Mena');
  }

  // Email - find the email input (might be without placeholder)
  // It's likely the last visible text input in the dialog
  if (await dialog.isVisible().catch(() => false)) {
    const inputs = await dialog.locator('input[type="text"]:visible').all();
    if (inputs.length >= 3) {
      const emailInput = inputs[inputs.length - 1]; // Last text input should be email
      const placeholder = await emailInput.getAttribute('placeholder').catch(() => '');
      console.log(`Email input placeholder: "${placeholder}"`);
      await emailInput.click({ force: true });
      await delay(300);
      await emailInput.fill('daveymena162@gmail.com');
      console.log('Email: daveymena162@gmail.com');
    }
  }

  await delay(1000);

  // Click Enviar
  const enviar = page.locator('text=Enviar').first();
  if (await enviar.isVisible().catch(() => false)) {
    await enviar.click({ force: true });
    console.log('Enviar clicked');
    await delay(5000);
  }

  // Check for error or success
  console.log('URL after:', page.url());
  const text = await page.innerText('body').catch(() => '');
  
  // Look for error messages in red
  const errorEls = await page.locator('[color*="error"], [class*="error"], [class*="Error"], [style*="color: red"]').all();
  console.log(`Error elements: ${errorEls.length}`);
  for (const e of errorEls) {
    console.log('  Error:', (await e.innerText().catch(() => '')).trim());
  }

  // Wait more and check again
  await delay(5000);
  console.log('\nFinal URL:', page.url());

  // If we're on a catalog page, take screenshot
  await page.screenshot({ path: 'portfolio-result.png' }).catch(() => {});
  
  await browser.close();
}
main().catch(console.error);
