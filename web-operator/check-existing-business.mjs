import { chromium } from 'playwright';
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  // Try to access the old Business Manager at business.facebook.com (without /latest/)
  await page.goto('https://business.facebook.com/overview', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(8000);
  console.log('URL:', page.url());

  const text = await page.innerText('body').catch(() => '');
  console.log('Text:', text.substring(0, 1000).replace(/\n/g, ' | '));

  // Check if the "old" business manager view is available
  const oldBM = page.locator('text=Business Manager').first();
  const businesses = page.locator('text=Empresas').first();
  console.log('Business Manager:', await oldBM.isVisible().catch(() => false));
  console.log('Empresas:', await businesses.isVisible().catch(() => false));

  // Also try creating business via this URL
  // https://business.facebook.com/create/
  await page.goto('https://business.facebook.com/create/', {
    waitUntil: 'domcontentloaded', timeout: 20000
  }).catch(() => {});
  await delay(5000);
  console.log('\nCreate URL:', page.url());
  const createText = await page.innerText('body').catch(() => '');
  console.log('Create text:', createText.substring(0, 500).replace(/\n/g, ' | '));

  await page.screenshot({ path: 'business-overview.png' }).catch(() => {});
  await browser.close();
}
main().catch(console.error);
