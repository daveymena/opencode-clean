import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const PASSWORD = '6715320Dvd@';

async function humanDelay(page, min=800, max=2500) {
  const ms = Math.floor(Math.random() * (max - min + 1) + min);
  await page.waitForTimeout(ms);
}

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  let page = ctx.pages()[0];

  // STEP 1: Go to Facebook Pages
  console.log('=== STEP 1: Navigate to Pages ===');
  await page.goto('https://www.facebook.com/pages/?category=your_pages', { waitUntil: 'domcontentloaded' });
  await humanDelay(page, 2000, 3000);

  let url = page.url();
  console.log('URL:', url);

  // If not logged in, log in
  const bodyText = await page.innerText('body').catch(() => '');
  if (bodyText.includes('Iniciar sesión') || bodyText.includes('Log in')) {
    console.log('Need to log in first...');
    await page.goto('https://www.facebook.com/login/', { waitUntil: 'domcontentloaded' });
    await humanDelay(page, 1500, 2500);

    const emailField = await page.$('input[name="email"]');
    if (emailField) {
      const email = await emailField.inputValue();
      if (!email) {
        await emailField.fill('daveymena162@gmail.com');
        await humanDelay(page, 500, 1000);
      }
    }
    const passField = await page.$('input[name="pass"]');
    if (passField) {
      await passField.fill(PASSWORD);
      await humanDelay(page, 500, 1000);
    }
    const loginBtn = await page.$('button[name="login"]');
    if (loginBtn) {
      await loginBtn.click();
      await page.waitForTimeout(5000);
    }
    await page.goto('https://www.facebook.com/pages/?category=your_pages', { waitUntil: 'domcontentloaded' });
    await humanDelay(page, 2000, 3000);
  }

  // STEP 2: Check if VentasPro page exists
  console.log('=== STEP 2: Check existing pages ===');
  await page.goto('https://www.facebook.com/pages/?category=your_pages', { waitUntil: 'domcontentloaded' });
  await humanDelay(page, 2000, 3000);

  // Look for a "Create New Page" button or existing VentasPro page
  const pageLinks = await page.$$eval('a[href*="/profile.php"], a[href*="/pages/"]', els =>
    els.map(e => ({ href: e.href, text: e.innerText.trim() })).filter(e => e.text)
  );
  console.log('Page links:', JSON.stringify(pageLinks.slice(0, 10)));

  const hasVentasPro = pageLinks.some(l => l.text.toLowerCase().includes('ventas') || l.text.includes('VentasPro'));
  
  if (!hasVentasPro) {
    console.log('=== STEP 3: Create new page ===');
    await page.goto('https://www.facebook.com/pages/create', { waitUntil: 'domcontentloaded' });
    await humanDelay(page, 2000, 3000);

    // Click "Business or brand" option
    const bizBtn = page.locator('text=Negocio o marca').first();
    if (await bizBtn.isVisible().catch(() => false)) {
      await bizBtn.click();
      await humanDelay(page, 1000, 2000);
    }

    // Type page name
    const nameField = page.locator('input[name="page_name"], input[placeholder*="nombre"]').first();
    if (await nameField.isVisible().catch(() => false)) {
      await nameField.click();
      await humanDelay(page, 300, 700);
      await nameField.fill('VentasPro - Agent Sales Bot');
      await humanDelay(page, 500, 1000);
    }

    // Select category - search for "Software" or "Servicios"
    const catField = page.locator('input[placeholder*="categor"], input[aria-label*="categor"]').first();
    if (await catField.isVisible().catch(() => false)) {
      await catField.click();
      await humanDelay(page, 500, 1000);
      await catField.fill('Software');
      await humanDelay(page, 1000, 2000);
      // Click first suggestion
      const sug = page.locator('[role="option"], [role="menuitem"]').first();
      if (await sug.isVisible().catch(() => false)) {
        await sug.click();
        await humanDelay(page, 500, 1000);
      }
    }

    // Click Next/Create
    const nextBtn = page.locator('button:has-text("Siguiente"), button:has-text("Crear"), button:has-text("Next"), button:has-text("Create")').first();
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await humanDelay(page, 2000, 3000);
    }
    
    // Fill description on next step
    const descField = page.locator('textarea, [contenteditable="true"]').first();
    if (await descField.isVisible().catch(() => false)) {
      await descField.click();
      await humanDelay(page, 300, 700);
      await descField.fill('Automatización de ventas con IA. Agente conversacional inteligente que califica, nutre y cierra leads 24/7. Integración con WhatsApp, Instagram y Facebook Messenger.');
      await humanDelay(page, 1000, 2000);
    }

    // Click Create Page button
    const createBtn = page.locator('button:has-text("Crear página"), button:has-text("Create Page")').first();
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
      await humanDelay(page, 3000, 4000);
    }

    // Add website
    const webField = page.locator('input[type="url"], input[placeholder*="web"], input[placeholder*="sitio"]').first();
    if (await webField.isVisible().catch(() => false)) {
      await webField.click();
      await humanDelay(page, 300, 700);
      await webField.fill('https://ventaspro.ai');
      await humanDelay(page, 500, 1000);
    }

    const saveBtn = page.locator('button:has-text("Guardar"), button:has-text("Save")').first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await humanDelay(page, 2000, 3000);
    }
  }

  console.log('=== DONE: Page setup ===');
  await browser.close();
}
main().catch(console.error);
