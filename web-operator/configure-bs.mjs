import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const IMG_DIR = path.resolve('./fb-images');

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // Go to Business Suite
  console.log('Navigating to Business Suite...');
  await page.goto('https://business.facebook.com/latest/home', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(5000);

  console.log('URL:', page.url());

  // STEP 1: Add cover photo - click on "Añadir foto de portada"
  console.log('\n[1] Añadiendo foto de portada...');
  const addCover = page.locator('span:has-text("Añadir foto de portada")').first();
  if (await addCover.isVisible().catch(() => false)) {
    await addCover.click();
    console.log('  -> Add cover clicked');
    await delay(3000);
  }

  // Look for file input for upload
  let fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.isVisible().catch(() => false)) {
    await fileInput.setInputFiles(path.join(IMG_DIR, 'cover.png'));
    console.log('  -> Cover file selected');
    await delay(5000);

    // Look for Save/Publish button
    const publishBtn = page.locator('span:has-text("Publicar"), span:has-text("Guardar"), div[aria-label="Publicar"]').first();
    if (await publishBtn.isVisible().catch(() => false)) {
      await publishBtn.click();
      console.log('  -> Cover published');
      await delay(3000);
    }
  } else {
    console.log('  -> No file input found');
  }

  // Go to Settings
  console.log('\n[2] Abriendo configuración...');
  await page.goto('https://business.facebook.com/latest/settings?asset_id=1278583508663384', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(4000);

  const settingsText = await page.innerText('body').catch(() => '');
  console.log('Settings:', settingsText.replace(/\s+/g, ' ').trim().substring(0, 500));

  // Look for Page info/edit
  const pageInfo = page.locator('span:has-text("Información de la página"), span:has-text("Page info")').first();
  if (await pageInfo.isVisible().catch(() => false)) {
    await pageInfo.click();
    await delay(3000);
  }

  // Find description field
  const descField = page.locator('textarea, [contenteditable="true"]').first();
  if (await descField.isVisible().catch(() => false)) {
    await descField.click();
    await delay(500);
    await descField.fill('Los mejores cursos digitales: Diseño Gráfico, Office, Inglés, Excel, Hacking Ético, Infografías, Programación, Marketing Digital, Negocios, Fotografía y más de 80 cursos. Contenido descargable MP4/PDF. Acceso vitalicio vía Google Drive. Aprende desde casa a tu propio ritmo. Sin clases en vivo. Calidad premium a precios accesibles.');
    console.log('  -> Description updated');
    await delay(1000);

    const save = page.locator('span:has-text("Guardar")').first();
    if (await save.isVisible().catch(() => false)) {
      await save.click();
      console.log('  -> Description saved');
      await delay(2000);
    }
  }

  // STEP 3: Upload profile picture
  console.log('\n[3] Subiendo foto de perfil...');
  // Try the profile picture area in Business Suite
  const profileArea = page.locator('[aria-label*="foto del perfil"], [aria-label*="profile photo"]').first();
  if (await profileArea.isVisible().catch(() => false)) {
    await profileArea.click();
    await delay(3000);

    const uploadPhoto = page.locator('input[type="file"]').first();
    if (await uploadPhoto.isVisible().catch(() => false)) {
      await uploadPhoto.setInputFiles(path.join(IMG_DIR, 'profile.png'));
      console.log('  -> Profile file selected');
      await delay(5000);

      const saveProfile = page.locator('span:has-text("Guardar")').first();
      if (await saveProfile.isVisible().catch(() => false)) {
        await saveProfile.click();
        console.log('  -> Profile saved');
        await delay(2000);
      }
    }
  }

  await page.screenshot({ path: 'bs-result.png' });
  console.log('\nDone!');
  await browser.close();
}
main().catch(console.error);
