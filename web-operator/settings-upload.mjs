import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const IMG_DIR = path.resolve('./fb-images');
const PAGE_ID = '61591838792522';

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // Go to page
  await page.goto(`https://www.facebook.com/profile.php?id=${PAGE_ID}`, {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(5000);

  // Click "Configuración" (Settings) button
  const settingsBtn = page.locator('span:has-text("Configuración")').first();
  const settingsVisible = await settingsBtn.isVisible().catch(() => false);
  console.log('Settings button visible:', settingsVisible);

  if (settingsVisible) {
    await settingsBtn.click();
    console.log('Settings clicked');
    await delay(5000);

    // Check current URL
    console.log('URL after settings:', page.url());
    const text = await page.innerText('body').catch(() => '');
    console.log('Text:', text.replace(/\s+/g, ' ').trim().substring(0, 600));

    // Look for page photo options
    const photoOptions = await page.locator('[aria-label*="Foto"], [aria-label*="foto"], [aria-label*="Photo"], [aria-label*="photo"]').all();
    console.log(`Photo options: ${photoOptions.length}`);

    // Look for any file chooser
    await page.screenshot({ path: 'settings-page.png' });
    console.log('Screenshot saved');
  }

  // Alternative: Try clicking on the profile picture directly to open lightbox
  console.log('\nTrying profile picture click...');
  await page.goto(`https://www.facebook.com/profile.php?id=${PAGE_ID}`, {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(5000);

  const profileSvg = page.locator('svg[aria-label="VentasPro - Cursos Digitales"]').first();
  if (await profileSvg.isVisible().catch(() => false)) {
    // Set up filechooser BEFORE clicking
    const fcPromise = page.waitForEvent('filechooser', { timeout: 15000 }).catch(() => null);
    await profileSvg.click();
    console.log('Profile picture clicked');
    await delay(3000);

    // Check if we navigated to a photo viewer
    console.log('URL after click:', page.url());
    const text = await page.innerText('body').catch(() => '');
    console.log('Text:', text.replace(/\s+/g, ' ').trim().substring(0, 500));

    // Look for update options
    const updateOpts = await page.locator('span:has-text("Actualizar"), span:has-text("Update")').all();
    console.log(`Update options: ${updateOpts.length}`);

    const fc = await fcPromise;
    if (fc) {
      console.log('Filechooser triggered!');
      await fc.setFiles(path.join(IMG_DIR, 'profile.png'));
      console.log('Profile file set');
      await delay(5000);
    }

    await page.screenshot({ path: 'photo-viewer.png' });
  }

  await browser.close();
}
main().catch(console.error);
