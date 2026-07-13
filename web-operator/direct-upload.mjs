import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const IMG_DIR = path.resolve('./fb-images');
const PAGE_ID = '61591838792522';

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // Try direct upload to page photos
  console.log('[1] Subiendo fotos al álbum de la página...');
  await page.goto(`https://www.facebook.com/photos/upload/?profile_id=${PAGE_ID}`, {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(5000);
  console.log('Upload URL:', page.url());

  // Look for file input or trigger upload
  const fcPromise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
  
  // Click the upload area or add photos button
  const addPhotoBtn = page.locator('div[aria-label="Añadir fotos"], div[aria-label="Add Photos"], div[role="button"]:has-text("Añadir")').first();
  if (await addPhotoBtn.isVisible().catch(() => false)) {
    await addPhotoBtn.click();
    console.log('Add photo clicked');
  } else {
    // Try clicking on the upload area directly
    const uploadArea = page.locator('[data-pagelet="ProfilePhotoUploader"], [data-testid*="photo"]').first();
    if (await uploadArea.isVisible().catch(() => false)) {
      await uploadArea.click();
      console.log('Upload area clicked');
    } else {
      // Just click in the center of the page
      await page.mouse.click(400, 300);
      console.log('Center clicked');
    }
  }
  await delay(2000);

  const fc = await fcPromise;
  if (fc) {
    // Upload both profile and cover
    await fc.setFiles([
      path.join(IMG_DIR, 'profile.png'),
      path.join(IMG_DIR, 'cover.png')
    ]);
    console.log('Both files selected for upload');
    await delay(10000); // Wait for upload

    await page.screenshot({ path: 'after-upload.png' });
    console.log('Upload done');
  } else {
    console.log('File chooser not triggered');
  }

  // Describe what was done
  console.log('\n=== RESUMEN ===');
  console.log('Página: VentasPro - Cursos Digitales');
  console.log('ID: ' + PAGE_ID);
  console.log('Imágenes generadas:');
  console.log('  - profile.png (512x512) - Logo VentasPro gradiente morado');
  console.log('  - cover.png (1640x624) - Banner profesional con productos');
  console.log('');
  console.log('Próximos pasos manuales necesarios:');
  console.log('1. En la página de Facebook, haz clic en la foto de perfil → "Actualizar foto de perfil"');
  console.log('2. Haz clic en la portada → "Añadir foto de portada"');
  console.log('3. Las imágenes están en: ' + IMG_DIR);

  await browser.close();
}
main().catch(console.error);
