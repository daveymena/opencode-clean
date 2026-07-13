import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // Go to Business Suite
  await page.goto('https://business.facebook.com/latest/home?asset_id=1278583508663384', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(5000);

  // Find cover button
  const coverBtn = page.locator('div[aria-label="Añadir foto de portada"]').first();
  console.log('Cover btn visible:', await coverBtn.isVisible().catch(() => false));
  console.log('Cover btn text:', await coverBtn.innerText().catch(() => ''));

  // Click it and see what happens
  await coverBtn.click();
  console.log('Clicked. Waiting 3s...');
  await delay(3000);

  // Look for any new dialogs/menus
  const newButtons = await page.locator('[role="menuitem"], [role="menuitemradio"], [role="option"]:visible').all();
  console.log('Menu items found:', newButtons.length);
  for (const btn of newButtons) {
    console.log('  -', await btn.innerText().catch(() => ''));
  }

  // Look for file inputs
  const fileInputs = await page.locator('input[type="file"]').all();
  console.log('File inputs:', fileInputs.length);

  // Check the page text for options
  const text = await page.innerText('body').catch(() => '');
  console.log('\nPage text after click:', text.replace(/\s+/g, ' ').trim().substring(300, 800));

  await browser.close();
}
main().catch(console.error);
