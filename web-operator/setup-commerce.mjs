import { chromium } from 'playwright';
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const PAGE_ID = '61591838792522';

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  // Step 1: Go to Commerce Manager
  console.log('Navigating to Commerce Manager...');
  await page.goto('https://commerce.facebook.com/', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await delay(8000);
  console.log('URL:', page.url());

  // Step 2: Look for "Comenzar" or "Crear cuenta de comercio" or similar
  const text = await page.innerText('body').catch(() => '');
  console.log('Page title/text sample:', text.substring(0, 500).replace(/\n/g, ' | '));

  // Screenshot
  await page.screenshot({ path: 'commerce-manager-1.png' }).catch(() => {});

  // Step 3: Try clicking "Crear" or "Empezar"
  const crearBtn = page.locator('text=Crear cuenta de comercio').first();
  const empezarBtn = page.locator('text=Empezar').first();
  const comenzarBtn = page.locator('text=Comenzar').first();

  if (await crearBtn.isVisible().catch(() => false)) {
    console.log('Clicking Crear cuenta de comercio');
    await crearBtn.click();
    await delay(5000);
  } else if (await empezarBtn.isVisible().catch(() => false)) {
    console.log('Clicking Empezar');
    await empezarBtn.click();
    await delay(5000);
  } else if (await comenzarBtn.isVisible().catch(() => false)) {
    console.log('Clicking Comenzar');
    await comenzarBtn.click();
    await delay(5000);
  } else {
    console.log('No create button found. Existing commerce account?');
    // Check for catalog section
    const catalogSection = page.locator('text=Catálogos').first();
    if (await catalogSection.isVisible().catch(() => false)) {
      console.log('Catalog section visible - may already have account');
    }
  }

  await delay(3000);
  await page.screenshot({ path: 'commerce-manager-2.png' }).catch(() => {});
  console.log('\nCommerce Manager state captured.');

  // Step 4: Look for catalog or product options
  const allBtns = await page.locator('[role="button"]').all();
  let btnCount = 0;
  for (const btn of allBtns) {
    if (await btn.isVisible().catch(() => false)) {
      const text = (await btn.innerText().catch(() => '')).trim().substring(0, 50);
      if (text) {
        btnCount++;
        if (btnCount <= 30) console.log(`  Btn ${btnCount}: "${text}"`);
      }
    }
  }

  await browser.close();
}
main().catch(console.error);
