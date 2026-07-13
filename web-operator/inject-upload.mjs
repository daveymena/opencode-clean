import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const IMG_DIR = path.resolve('./fb-images');
const PAGE_ID = '61591838792522';

async function uploadViaInjection(page, filePath) {
  // Set up filechooser for the injection
  const fcPromise = page.waitForEvent('filechooser', { timeout: 20000 }).catch(() => null);

  // Inject a file input and click it programmatically
  const fileBytes = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const mimeType = 'image/png';

  const injected = await page.evaluate(async ({ fileName, mimeType }) => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.position = 'fixed';
      input.style.top = '0';
      input.style.left = '0';
      input.style.opacity = '0.01';
      input.style.pointerEvents = 'none';
      input.style.zIndex = '99999';
      document.body.appendChild(input);

      input.addEventListener('click', () => {
        resolve('filechooser_triggered');
      }, { once: true });

      // Also listen for change
      input.addEventListener('change', () => {
        resolve('file_set_directly');
      }, { once: true });

      // Click the input programmatically - this should trigger filechooser
      input.click();

      // If no filechooser after 3s, try dispatching click
      setTimeout(() => {
        resolve('timeout_no_filechooser');
      }, 5000);
    });
  }, { fileName, mimeType });

  console.log(`  Injection result: ${injected}`);

  const fc = await fcPromise;
  if (fc) {
    await fc.setFiles(filePath);
    console.log(`  File set via filechooser: ${fileName}`);
    return true;
  }
  return false;
}

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // Try profile picture upload via injection
  console.log('[1] Intentando upload vía inyección de file input...');
  await page.goto(`https://www.facebook.com/profile.php?id=${PAGE_ID}`, {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(4000);

  // Click the profile picture first to open viewer, then inject
  const profileSvg = page.locator('svg[aria-label="VentasPro - Cursos Digitales"]').first();
  if (await profileSvg.isVisible().catch(() => false)) {
    await profileSvg.click();
    console.log('Profile pic clicked');
    await delay(3000);
  }

  // Now inject file input
  const success = await uploadViaInjection(page, path.join(IMG_DIR, 'profile.png'));
  console.log('Upload success:', success);

  if (success) {
    await delay(5000);
    // Look for save/crop button
    const saveBtn = page.locator('div[aria-label="Guardar"]').first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      console.log('Saved!');
      await delay(3000);
    } else {
      await page.keyboard.press('Enter');
      await delay(2000);
    }
  }

  await page.screenshot({ path: 'inject-result.png' });
  console.log('Done');
  await browser.close();
}
main().catch(console.error);
