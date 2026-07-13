import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const IMG_DIR = path.resolve('./fb-images');
const PAGE_ID = '61591838792522';

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  await page.goto(`https://www.facebook.com/profile.php?id=${PAGE_ID}`, {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(4000);

  // Click profile SVG to open in viewer
  const svg = page.locator('svg[aria-label="VentasPro - Cursos Digitales"]').first();
  await svg.click();
  console.log('Clicked profile pic');
  await delay(4000);

  console.log('Viewer URL:', page.url());

  // Find buttons in the viewer
  const viewerBtns = await page.locator('[role="button"]:visible').all();
  const seen = new Set();
  for (const btn of viewerBtns) {
    const t = (await btn.innerText().catch(() => '')).trim();
    const l = await btn.getAttribute('aria-label').catch(() => '');
    const k = t || l;
    if (k && !seen.has(k) && k.length < 60) {
      seen.add(k);
      console.log(`  "${k}"`);
    }
  }

  // Try clicking "Options" or similar
  const options = page.locator('span:has-text("Opciones"), div[aria-label="Opciones"]').first();
  if (await options.isVisible().catch(() => false)) {
    console.log('\nOptions found!');
    await options.click();
    await delay(3000);

    // Look for "Update Profile Picture"
    const update = page.locator('span:has-text("Actualizar foto de perfil"), span:has-text("Update profile picture")').first();
    if (await update.isVisible().catch(() => false)) {
      console.log('Update profile picture found!');
      const fcPromise = page.waitForEvent('filechooser', { timeout: 15000 }).catch(() => null);
      await update.click();
      await delay(2000);

      const fc = await fcPromise;
      if (fc) {
        await fc.setFiles(path.join(IMG_DIR, 'profile.png'));
        console.log('Profile file uploaded via viewer');
        await delay(5000);
        
        // Save crop
        await page.keyboard.press('Enter');
        await delay(3000);
        console.log('Profile picture saved!');
      } else {
        console.log('File chooser not triggered');
      }
    } else {
      console.log('Update option not found');
    }
  } else {
    console.log('\nNo options button');
  }

  await page.screenshot({ path: 'viewer-approach.png' });
  console.log('Done');
  await browser.close();
}
main().catch(console.error);
