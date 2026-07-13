import { chromium } from 'playwright';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const PAGE_ID = '61591838792522';

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // Post via Business Suite
  console.log('[1] Publicando desde Business Suite...');
  await page.goto('https://business.facebook.com/latest/home?asset_id=1278583508663384', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(6000);

  // Click "Crear publicación"
  const createPost = page.locator('span:has-text("Crear publicación")').first();
  if (await createPost.isVisible().catch(() => false)) {
    await createPost.click();
    console.log('Crear publicación clicked');
    await delay(5000);
  } else {
    console.log('No Crear publicación button');
  }

  // Check what appeared
  const text = await page.innerText('body').catch(() => '');
  console.log('After click:', text.replace(/\s+/g, ' ').trim().substring(300, 700));

  // Look for text fields
  const textAreas = await page.locator('[contenteditable="true"], textarea:visible, div[role="textbox"]').all();
  console.log(`Text areas: ${textAreas.length}`);

  await page.screenshot({ path: 'business-suite.png' });
  console.log('Screenshot saved');
  
  await browser.close();
}
main().catch(console.error);
