import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const PAGE_ID = '61591838792522';
const PAGE_URL = `https://www.facebook.com/profile.php?id=${PAGE_ID}`;
const SETTINGS_URL = `https://www.facebook.com/profile.php?id=${PAGE_ID}&sk=settings`;
const IMG_DIR = path.resolve('./fb-images');

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // STEP 1: Go to Settings
  console.log('[1] Abriendo configuración de la página...');
  await page.goto(SETTINGS_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(5000);

  let text = await page.innerText('body').catch(() => '');
  console.log('Settings page text:', text.replace(/\s+/g, ' ').trim().substring(0, 500));

  // Look for page info / edit page option
  const editInfo = page.locator('span:has-text("Editar información de la página"), span:has-text("Page Info")').first();
  if (await editInfo.isVisible().catch(() => false)) {
    await editInfo.click();
    await delay(3000);
  }

  // Look for description field
  const descField = page.locator('textarea, [contenteditable="true"]').first();
  if (await descField.isVisible().catch(() => false)) {
    await descField.click();
    await delay(500);
    await descField.fill('');
    await delay(500);
    await descField.fill('Los mejores cursos digitales: Diseño Gráfico, Office, Inglés, Excel, Hacking Ético, Infografías, Programación, Marketing Digital, Negocios, Fotografía y más de 80 cursos. Contenido descargable MP4/PDF. Acceso vitalicio vía Google Drive. Aprende desde casa a tu propio ritmo. Sin clases en vivo. Calidad premium a precios accesibles.');
    console.log('  -> Description filled');
    await delay(1000);
  } else {
    console.log('  -> No description field');
  }

  // Save
  const saveBtn = page.locator('div[aria-label="Guardar cambios"]').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    console.log('  -> Saved');
    await delay(2000);
  }

  // STEP 2: Upload profile picture via the photo page
  console.log('\n[2] Subiendo foto de perfil...');
  await page.goto(`https://www.facebook.com/photo/?profile_id=${PAGE_ID}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(3000);

  // Try direct upload URL approach
  // Facebook profile photo upload
  const profileInput = page.locator('input[type="file"]').first();
  if (await profileInput.isVisible().catch(() => false)) {
    await profileInput.setInputFiles(path.join(IMG_DIR, 'profile.png'));
    console.log('  -> Profile upload via file input');
    await delay(5000);
  } else {
    console.log('  -> No file input visible');
  }

  // STEP 3: Go back and try cover photo via URL
  console.log('\n[3] Buscando métodos alternativos para imágenes...');

  // Alternative: use the page's own photo upload via the profile picture button
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(4000);

  // Click on the profile image to open the photo viewer
  const profileImg = page.locator('[role="img"][aria-label*="VentasPro"]').first();
  if (await profileImg.isVisible().catch(() => false)) {
    await profileImg.click();
    console.log('  -> Clicked profile image');
    await delay(3000);

    // Look for "Update profile picture" button in the viewer
    const updatePic = page.locator('span:has-text("Actualizar foto de perfil"), span:has-text("Update profile picture")').first();
    if (await updatePic.isVisible().catch(() => false)) {
      await updatePic.click();
      await delay(2000);

      // Upload photo
      const fileIn = page.locator('input[type="file"]').first();
      if (await fileIn.isVisible().catch(() => false)) {
        await fileIn.setInputFiles(path.join(IMG_DIR, 'profile.png'));
        console.log('  -> Profile uploaded from viewer');
        await delay(5000);
      }
    }
  }

  await page.screenshot({ path: 'config-result.png' });
  console.log('\nDone');
  await browser.close();
}
main().catch(console.error);
