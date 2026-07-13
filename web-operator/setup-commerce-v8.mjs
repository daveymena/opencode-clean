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

  // Click Empezar to open portfolio creation dialog
  const empezar = page.locator('text=Empezar').first();
  if (await empezar.isVisible().catch(() => false)) {
    await empezar.click({ force: true });
    await delay(5000);
  }

  // The dialog should now be visible with the portfolio form
  // Fill business name
  const nameInputs = page.locator('input[type="text"]:visible');
  const allInputs = await nameInputs.all();
  console.log(`Text inputs visible: ${allInputs.length}`);

  // Find inputs by placeholder
  for (const inp of allInputs) {
    const placeholder = await inp.getAttribute('placeholder').catch(() => '');
    const visible = await inp.isVisible().catch(() => false);
    console.log(`  placeholder="${placeholder}" visible=${visible}`);
  }

  // Fill business name (first text input with placeholder "Jasper's Market" or similar)
  const bizNameInput = page.locator('input[placeholder*="Market"], input[placeholder*="Business"]').first();
  if (await bizNameInput.isVisible().catch(() => false)) {
    await bizNameInput.click({ force: true });
    await delay(300);
    await bizNameInput.fill('VentasPro');
    console.log('Business name filled');
  } else {
    // Fallback: use the first visible text input (not the catalog name one)
    for (const inp of allInputs) {
      const placeholder = await inp.getAttribute('placeholder').catch(() => '');
      if (placeholder && !placeholder.includes('nombre') && !placeholder.includes('catalog')) {
        await inp.click({ force: true });
        await delay(300);
        await inp.fill('VentasPro');
        console.log('Business name filled (fallback)');
        break;
      }
    }
  }

  // Fill user name
  for (const inp of allInputs) {
    const placeholder = await inp.getAttribute('placeholder').catch(() => '');
    if (placeholder && placeholder.includes('nombre') && placeholder.includes('apellido')) {
      await inp.click({ force: true });
      await delay(300);
      await inp.fill('Davey Mena');
      console.log('User name filled');
      break;
    }
  }

  // Fill email
  for (const inp of allInputs) {
    const placeholder = await inp.getAttribute('placeholder').catch(() => '');
    const type = await inp.getAttribute('type').catch(() => '');
    if (placeholder === '' || (!placeholder && type === 'text') || placeholder?.includes('email') || placeholder?.includes('correo')) {
      // This might be the email input
      await inp.click({ force: true });
      await delay(300);
      await inp.fill('daveymena162@gmail.com');
      console.log('Email filled');
      break;
    }
  }

  await delay(1000);

  // Also fill catalog name (in the background form)
  const catNameInput = page.locator('input[placeholder*="nombre que te ayude"]').first();
  if (await catNameInput.isVisible().catch(() => false)) {
    await catNameInput.fill('VentasPro - Cursos Digitales');
    console.log('Catalog name filled');
  }

  await delay(1000);

  // Click Enviar
  const enviar = page.locator('text=Enviar').first();
  if (await enviar.isVisible().catch(() => false)) {
    console.log('Clicking Enviar...');
    await enviar.click({ force: true });
    await delay(10000);
    console.log('URL after:', page.url());

    await page.screenshot({ path: 'portfolio-submitted.png' }).catch(() => {});

    // Check result
    const text = await page.innerText('body').catch(() => '');
    console.log('Result:', text.substring(0, 1000).replace(/\n/g, ' | '));
  } else {
    console.log('Enviar button not found');
  }

  await browser.close();
}
main().catch(console.error);
