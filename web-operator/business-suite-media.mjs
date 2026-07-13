import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const IMG_DIR = path.resolve('./fb-images');

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // Try to go to Business Suite media/upload
  console.log('Trying Business Suite content/media...');
  await page.goto('https://business.facebook.com/latest/media?asset_id=1278583508663384', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(6000);

  console.log('Media URL:', page.url());
  const text = await page.innerText('body').catch(() => '');
  console.log('Media text:', text.replace(/\s+/g, ' ').trim().substring(0, 500));

  // Look for add photo button
  const addPhoto = page.locator('div[aria-label="Añadir fotos"], div[aria-label="Add photos"], span:has-text("Añadir fotos")').first();
  console.log('Add photo visible:', await addPhoto.isVisible().catch(() => false));

  // Capture all buttons
  const btns = await page.locator('[role="button"]:visible').all();
  const seen = new Set();
  console.log('\nVisible buttons:');
  for (const btn of btns) {
    const t = (await btn.innerText().catch(() => '')).trim();
    const l = await btn.getAttribute('aria-label').catch(() => '');
    const k = t || l;
    if (k && !seen.has(k) && k.length < 60) {
      seen.add(k);
      console.log(`  "${k}"`);
    }
  }

  // Also try settings page info
  console.log('\n\nTrying page info section in settings...');
  await page.goto('https://business.facebook.com/latest/settings?asset_id=1278583508663384', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(6000);

  const settingsText = await page.innerText('body').catch(() => '');
  console.log('Settings text:', settingsText.replace(/\s+/g, ' ').trim().substring(0, 800));

  await browser.close();
}
main().catch(console.error);
