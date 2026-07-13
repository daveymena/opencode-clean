import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const PAGE_ID = '61591838792522';

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  // Go to Commerce page
  await page.goto('https://business.facebook.com/commerce', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(8000);

  console.log('URL:', page.url());

  // Screenshot initial state
  await page.screenshot({ path: 'commerce-init.png' }).catch(() => {});

  // Look for main buttons
  const btns = await page.locator('[role="button"]:visible').all();
  console.log('\n=== Visible buttons ===');
  for (const btn of btns) {
    const aria = await btn.getAttribute('aria-label').catch(() => '');
    const text = (await btn.innerText().catch(() => '')).trim().substring(0, 60);
    if (aria || text) console.log(`  "${aria || text}"`);
  }

  // Look for "Crear catálogo", "Añadir productos", "Empezar"
  const createCatalog = page.locator('text=Crear catálogo').first();
  const addProducts = page.locator('text=Añadir productos').first();
  const empezar = page.locator('text=Empezar').first();
  const crear = page.locator('text=Crear').first();

  console.log('\n=== Action buttons ===');
  console.log('Crear catálogo:', await createCatalog.isVisible().catch(() => false));
  console.log('Añadir productos:', await addProducts.isVisible().catch(() => false));
  console.log('Empezar:', await empezar.isVisible().catch(() => false));
  console.log('Crear:', await crear.isVisible().catch(() => false));

  // Click "Empezar" if visible
  if (await empezar.isVisible().catch(() => false)) {
    console.log('\nClicking Empezar...');
    await empezar.click();
    await delay(5000);
    await page.screenshot({ path: 'commerce-empezar.png' }).catch(() => {});

    // Check URL and content after click
    console.log('URL after:', page.url());
    const text = await page.innerText('body').catch(() => '');
    console.log('Content:', text.substring(0, 500).replace(/\n/g, ' | '));
  }

  // Look for any "Siguiente" or "Continuar" or form elements
  await delay(2000);
  const inputsImgs = await page.locator('input[type="file"]').all();
  console.log(`\nFile inputs: ${inputsImgs.length}`);

  // Check for text fields
  const textInputs = await page.locator('input[type="text"], input:not([type]), textarea').all();
  console.log(`Text inputs: ${textInputs.length}`);

  await browser.close();
}
main().catch(console.error);
