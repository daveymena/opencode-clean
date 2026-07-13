import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const PROD_IMG_DIR = 'C:\\Users\\ADMIN\\Videos\\Agent-Sales-Bot\\artifacts\\ventas-pro\\public\\images\\products';
const PAGE_ID = '61591838792522';

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // Go to page photos
  await page.goto(`https://www.facebook.com/profile.php?id=${PAGE_ID}&sk=photos`, {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(5000);

  // Click "Añadir fotos o vídeos" button
  const addPhotos = page.locator('span:has-text("Añadir fotos o vídeos")').first();
  if (await addPhotos.isVisible().catch(() => false)) {
    console.log('Add photos button visible');
    
    // Set up file chooser listener BEFORE clicking
    const fcPromise = page.waitForEvent('filechooser', { timeout: 15000 }).catch(err => {
      console.log('Filechooser error:', err.message);
      return null;
    });

    await addPhotos.click();
    console.log('Add photos clicked');
    await delay(3000);

    // Check for file inputs
    let fileInputs = await page.locator('input[type="file"]').all();
    console.log(`File inputs after click: ${fileInputs.length}`);

    // Also check for any hidden inputs
    for (const fi of fileInputs) {
      const visible = await fi.isVisible().catch(() => false);
      const bounding = await fi.boundingBox().catch(() => null);
      console.log(`  visible=${visible}, box=${JSON.stringify(bounding)}, id=${await fi.getAttribute('id').catch(() => '')}`);
    }

    // Wait for filechooser
    const fc = await fcPromise;
    if (fc) {
      // Upload first 5 product images
      const prodFiles = fs.readdirSync(PROD_IMG_DIR)
        .filter(f => f.endsWith('.jpg'))
        .filter(f => fs.statSync(path.join(PROD_IMG_DIR, f)).size > 500)
        .slice(0, 5)
        .map(f => path.join(PROD_IMG_DIR, f));

      console.log(`Setting ${prodFiles.length} files via filechooser`);
      await fc.setFiles(prodFiles);
      console.log('Files set!');
      await delay(10000);

      // Look for publish/upload button
      const publishBtn = page.locator('div[aria-label="Publicar"]').first();
      if (await publishBtn.isVisible().catch(() => false)) {
        console.log('Publishing...');
        await publishBtn.click();
        await delay(3000);
      } else {
        // Try pressing Enter
        await page.keyboard.press('Enter');
        await delay(2000);
      }
      console.log('Upload flow completed');
    } else {
      console.log('No filechooser event received');
      
      // Try alternative: maybe the file input is already in the DOM
      if (fileInputs.length > 0) {
        await fileInputs[0].setInputFiles(
          fs.readdirSync(PROD_IMG_DIR)
            .filter(f => f.endsWith('.jpg'))
            .filter(f => fs.statSync(path.join(PROD_IMG_DIR, f)).size > 500)
            .slice(0, 3)
            .map(f => path.join(PROD_IMG_DIR, f))
        );
        console.log('Files set directly on input');
        await delay(10000);
      }
    }
  } else {
    console.log('Add photos button not found - already on upload page?');
    // Look for alternative upload methods
    const uploadArea = page.locator('[role="button"]:has-text("Añadir")').first();
    if (await uploadArea.isVisible().catch(() => false)) {
      const fcPromise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
      await uploadArea.click();
      const fc = await fcPromise;
      if (fc) {
        const prodFiles = fs.readdirSync(PROD_IMG_DIR)
          .filter(f => f.endsWith('.jpg'))
          .filter(f => fs.statSync(path.join(PROD_IMG_DIR, f)).size > 500)
          .slice(0, 3)
          .map(f => path.join(PROD_IMG_DIR, f));
        await fc.setFiles(prodFiles);
        console.log('Files set via alternative button');
        await delay(10000);
      }
    }
  }

  await page.screenshot({ path: 'upload-real.png' });
  console.log('Done');
  await browser.close();
}
main().catch(console.error);
