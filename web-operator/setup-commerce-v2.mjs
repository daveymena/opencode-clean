import { chromium } from 'playwright';
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const PAGE_ID = '61591838792522';
const URLS = [
  'https://business.facebook.com/commerce',
  'https://www.facebook.com/commerce',
  'https://business.facebook.com/latest/commerce/',
  'https://www.facebook.com/business/commerce',
  'https://facebook.com/commerce_manager'
];

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  for (const url of URLS) {
    console.log(`\nTrying: ${url}...`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await delay(3000);
      const currentUrl = page.url();
      const text = await page.innerText('body').catch(() => '');
      console.log(`  Final URL: ${currentUrl.substring(0, 80)}`);
      console.log(`  Text: ${text.substring(0, 200).replace(/\n/g, ' | ')}`);
      
      // If we end up on a commerce page, take a screenshot
      if (currentUrl.includes('commerce') || currentUrl.includes('Commerce')) {
        console.log('  ✅ Commerce page found!');
        await page.screenshot({ path: 'commerce-' + url.replace(/[^a-zA-Z0-9]/g, '-') + '.png' }).catch(() => {});
        break;
      }
    } catch (e) {
      console.log(`  ❌ ${e.message.substring(0, 80)}`);
    }
  }

  // Also try navigating from Business Suite
  console.log('\n=== Navigating via Business Suite ===');
  await page.goto('https://business.facebook.com/latest/home?business_id=' + PAGE_ID, {
    waitUntil: 'domcontentloaded', timeout: 20000
  }).catch(() => {});
  await delay(5000);
  console.log('Business Suite URL:', page.url());

  // Look for commerce/commerce links
  const links = await page.locator('a[href*="commerce"], a[href*="Commerce"]').all();
  console.log(`Commerce links found: ${links.length}`);
  for (const link of links) {
    const href = await link.getAttribute('href').catch(() => '');
    const text = (await link.innerText().catch(() => '')).trim();
    console.log(`  "${text}" → ${href?.substring(0, 100)}`);
  }

  await browser.close();
}
main().catch(console.error);
