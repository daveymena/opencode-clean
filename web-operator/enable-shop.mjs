import { chromium } from 'playwright';
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  // Go to the VentasPro page settings
  await page.goto('https://www.facebook.com/profile.php?id=61591838792522&sk=settings', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(8000);
  console.log('Settings URL:', page.url());

  const text = await page.innerText('body').catch(() => '');
  console.log('Settings page:', text.substring(0, 1000).replace(/\n/g, ' | '));

  // Look for "Tienda" or "Shop" or "Commerce" settings
  const shopSettings = page.locator('text=Tienda').first();
  const commerceSettings = page.locator('text=Comercio').first();
  console.log('\nTienda:', await shopSettings.isVisible().catch(() => false));
  console.log('Comercio:', await commerceSettings.isVisible().catch(() => false));

  // Check for "Añadir tienda" or similar
  const addShop = page.locator('text=Añadir tienda').first();
  console.log('Añadir tienda:', await addShop.isVisible().catch(() => false));

  // Also try the actual shop URL
  await page.goto('https://www.facebook.com/profile.php?id=61591838792522&sk=shop', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(5000);
  console.log('\nShop URL:', page.url());
  const shopText = await page.innerText('body').catch(() => '');
  console.log('Shop page:', shopText.substring(0, 500).replace(/\n/g, ' | '));

  // Check for "Añadir producto" or "Crear tienda"
  const createShop = page.locator('text=Crear tienda').first();
  const addProduct = page.locator('text=Añadir producto').first();
  console.log('Crear tienda:', await createShop.isVisible().catch(() => false));
  console.log('Añadir producto:', await addProduct.isVisible().catch(() => false));

  await page.screenshot({ path: 'shop-settings.png' }).catch(() => {});
  await browser.close();
}
main().catch(console.error);
