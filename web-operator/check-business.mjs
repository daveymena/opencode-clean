import { chromium } from 'playwright';
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  // Go to Meta Business Suite settings
  await page.goto('https://business.facebook.com/settings/', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(8000);
  console.log('URL:', page.url());

  const text = await page.innerText('body').catch(() => '');
  console.log('Content:', text.substring(0, 1500).replace(/\n/g, ' | '));

  // Look for existing business info
  const bizInfo = page.locator('text=Información de la empresa').first();
  const bizName = page.locator('text=VentasPro').first();
  console.log('\nBusiness info section:', await bizInfo.isVisible().catch(() => false));
  console.log('VentasPro found:', await bizName.isVisible().catch(() => false));

  // Check if there's business ID in URL
  const match = page.url().match(/business_id=(\d+)/);
  if (match) console.log('Business ID:', match[1]);

  await page.screenshot({ path: 'business-settings.png' }).catch(() => {});
  await browser.close();
}
main().catch(console.error);
