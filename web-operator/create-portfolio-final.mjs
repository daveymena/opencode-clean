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

  // Click "Empezar" to open portfolio creation dialog
  await page.locator('text=Empezar').first().click({ force: true });
  await delay(5000);

  // Screenshot of the dialog
  await page.screenshot({ path: 'dialog-open.png' }).catch(() => {});

  // Find the dialog and all its inputs
  const dialog = page.locator('[role="dialog"]').first();
  if (!(await dialog.isVisible().catch(() => false))) {
    console.log('No dialog visible');
    await browser.close();
    return;
  }

  const inputs = await dialog.locator('input:visible').all();
  console.log(`Found ${inputs.length} inputs in dialog`);
  
  for (const inp of inputs) {
    const placeholder = await inp.getAttribute('placeholder').catch(() => '');
    const type = await inp.getAttribute('type').catch(() => '');
    console.log(`  placeholder="${placeholder}" type=${type}`);
  }

  // Fill Business Name (first text input - "Jasper's Market" placeholder)
  if (inputs.length >= 1) {
    await inputs[0].click({ force: true });
    await delay(300);
    await inputs[0].fill('VentasPro');
    console.log('Business name: VentasPro');
  }

  // Fill Full Name (second text input - "Introduce tu nombre..." placeholder)
  if (inputs.length >= 2) {
    await inputs[1].click({ force: true });
    await delay(300);
    await inputs[1].fill('Duvier Davey Mena Mosquera');
    console.log('Full name: Duvier Davey Mena Mosquera');
  }

  // Fill Email (third text input - no placeholder)
  if (inputs.length >= 3) {
    await inputs[2].click({ force: true });
    await delay(300);
    await inputs[2].fill('daveymena162@gmail.com');
    console.log('Email: daveymena162@gmail.com');
  }

  await delay(1000);

  // Click Enviar
  const enviar = page.locator('text=Enviar').first();
  if (!(await enviar.isVisible().catch(() => false))) {
    console.log('Enviar button not visible');
    await browser.close();
    return;
  }

  // Set up a navigation/response listener
  page.on('response', resp => {
    const url = resp.url();
    if (url.includes('catalog') || url.includes('business') || url.includes('create')) {
      console.log(`Response: ${resp.status()} ${url.substring(0, 100)}`);
    }
  });

  console.log('Clicking Enviar...');
  await enviar.click({ force: true });
  await delay(8000);

  console.log('URL after:', page.url());

  // Check current state
  const text = await page.innerText('body').catch(() => '');
  
  // Look for errors or success indicators
  if (text.includes('error') || text.includes('Error') || text.includes('incorrecto')) {
    console.log('ERROR DETECTED');
    console.log(text.substring(0, 1500).replace(/\n/g, ' | '));
  } else if (page.url().includes('catalogs/new')) {
    console.log('Still on catalog creation page - may have validation errors');
    console.log('Dialog still visible:', await dialog.isVisible().catch(() => false));
    
    // Check for any error messages in the dialog
    if (await dialog.isVisible().catch(() => false)) {
      const dialogText = await dialog.innerText().catch(() => '');
      console.log('Dialog text:', dialogText.substring(0, 1000).replace(/\n/g, ' | '));
    }
  } else {
    console.log('Navigated to new page!');
    console.log(text.substring(0, 1000).replace(/\n/g, ' | '));
  }

  await page.screenshot({ path: 'portfolio-after-submit.png' }).catch(() => {});
  await browser.close();
}
main().catch(console.error);
