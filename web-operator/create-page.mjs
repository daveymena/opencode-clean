import { chromium } from 'playwright';

async function humanDelay(min=800, max=2000) {
  return new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1) + min)));
}

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // Go to page create
  await page.goto('https://www.facebook.com/pages/create', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await humanDelay(3000, 4000);

  // Find page name input - it's inside a form
  const nameInput = page.locator('input[aria-label*="Nombre de la página"], input[placeholder*="nombre"], input[name="page_name"]').first();
  if (await nameInput.isVisible().catch(() => false)) {
    await nameInput.click();
    await humanDelay(300, 700);
    await nameInput.fill('VentasPro - Agent Sales Bot');
    console.log('Filled page name');
    await humanDelay(1000, 2000);
  } else {
    console.log('Name input not found');
    // Try finding by label
    const label = page.locator('text=Nombre de la página').first();
    if (await label.isVisible().catch(() => false)) {
      const input = page.locator('input').filter({ has: page.locator('..') }).first();
      // Try adjacent input
      const adjacentInput = label.locator('..').locator('input').first();
      if (await adjacentInput.isVisible().catch(() => false)) {
        await adjacentInput.fill('VentasPro - Agent Sales Bot');
        console.log('Filled via adjacent');
      }
    }
  }

  await humanDelay(1000, 2000);

  // Find category input and fill
  const catInput = page.locator('input[aria-label*="Categor"], input[placeholder*="categor"]').first();
  if (await catInput.isVisible().catch(() => false)) {
    await catInput.click();
    await humanDelay(300, 700);
    await catInput.fill('Software');
    await humanDelay(1500, 2500);
    // Click first suggestion dropdown item
    const suggestion = page.locator('[role="listbox"] [role="option"], [role="menuitemcheckbox"], [role="option"]').first();
    if (await suggestion.isVisible().catch(() => false)) {
      await suggestion.click();
      console.log('Category selected');
      await humanDelay(500, 1000);
    }
  }

  await humanDelay(1000, 2000);

  // Find description field
  const descInput = page.locator('textarea, [contenteditable="true"]').first();
  if (await descInput.isVisible().catch(() => false)) {
    await descInput.click();
    await humanDelay(300, 700);
    await descInput.fill('Automatización de ventas con IA. Agente conversacional inteligente que califica, nutre y cierra leads 24/7. Integración con WhatsApp, Instagram y Facebook Messenger.');
    console.log('Filled description');
    await humanDelay(1000, 2000);
  }

  // Click Create Page button
  const createBtn = page.locator('button:has-text("Crear página"), button:has-text("Create Page")').first();
  if (await createBtn.isVisible().catch(() => false)) {
    await createBtn.click();
    console.log('Clicked Create Page');
    await humanDelay(3000, 5000);
  }

  const url = page.url();
  console.log('Final URL:', url);
  
  // Take screenshot
  await page.screenshot({ path: 'page-created.png' });
  console.log('Screenshot saved');

  await browser.close();
}
main().catch(console.error);
