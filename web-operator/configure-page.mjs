import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1) + min); }
async function human() { await delay(rnd(500, 1500)); }

const PAGE_URL = 'https://www.facebook.com/profile.php?id=61591838792522';
const IMG_DIR = path.resolve('./fb-images');

async function uploadFile(page, selector, filePath) {
  const input = page.locator(selector);
  if (await input.isVisible().catch(() => false)) {
    await input.setInputFiles(filePath);
    console.log('  -> File set:', path.basename(filePath));
    return true;
  }
  return false;
}

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // STEP 1: Navigate to the page
  console.log('[1/6] Navegando a la página VentasPro...');
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(4000);
  console.log('  -> Page loaded');

  // STEP 2: Update description / About section
  console.log('[2/6] Actualizando descripción...');

  // Click "Editar página" or "Edit page"
  const editBtn = page.locator('div[aria-label="Editar página"], div[aria-label="Edit page"], span:has-text("Editar página")').first();
  if (await editBtn.isVisible().catch(() => false)) {
    await editBtn.click();
    console.log('  -> Edit page clicked');
    await delay(3000);
  } else {
    // Try "Editar" button
    const editBtn2 = page.locator('div[aria-label="Editar"], span:has-text("Editar")').first();
    if (await editBtn2.isVisible().catch(() => false)) {
      await editBtn2.click();
      console.log('  -> Edit clicked');
      await delay(3000);
    }
  }

  // Look for description textarea
  const descField = page.locator('textarea[aria-label*="descripci"], textarea[aria-label*="Descripci"], div[contenteditable="true"]').first();
  if (await descField.isVisible().catch(() => false)) {
    await descField.click();
    await human();
    await descField.fill('');
    await human();
    await descField.fill('Los mejores cursos digitales: Diseño Gráfico, Office, Inglés, Excel, Hacking Ético, Infografías, Programación, Marketing Digital, Negocios, Fotografía y más de 80 cursos. Contenido descargable MP4/PDF. Acceso vitalicio vía Google Drive. Aprende desde casa a tu propio ritmo. Sin clases en vivo. Calidad premium a precios accesibles.');
    console.log('  -> Description updated');
    await human();
  } else {
    console.log('  -> Description field not found');
  }

  // Save changes
  const saveBtn = page.locator('div[aria-label="Guardar cambios"], div[aria-label="Save changes"], span:has-text("Guardar")').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    console.log('  -> Changes saved');
    await delay(3000);
  } else {
    // Try clicking outside to save
    await page.keyboard.press('Escape');
    await delay(1000);
  }

  // Go back to page
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(3000);

  // STEP 3: Upload profile picture
  console.log('[3/6] Subiendo foto de perfil...');
  const profileImg = path.join(IMG_DIR, 'profile.png');

  // Click on profile picture area
  const profilePicArea = page.locator('div[aria-label*="foto del perfil"], div[aria-label*="profile picture"], div[aria-label*="Foto del perfil"]').first();
  if (await profilePicArea.isVisible().catch(() => false)) {
    await profilePicArea.click();
    await delay(2000);
  } else {
    // Click on the page profile picture directly
    const profileImgEl = page.locator('image[preserveAspectRatio="xMidYMid slice"], img[alt*="VentasPro"]').first();
    if (await profileImgEl.isVisible().catch(() => false)) {
      await profileImgEl.click();
      await delay(2000);
    }
  }

  // Check for "Upload photo" dialog
  const uploadBtn = page.locator('span:has-text("Subir foto"), span:has-text("Upload photo"), div[aria-label*="Subir"]').first();
  if (await uploadBtn.isVisible().catch(() => false)) {
    await uploadBtn.click();
    await delay(2000);
  }

  // File input for profile picture
  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.isVisible().catch(() => false)) {
    await fileInput.setInputFiles(profileImg);
    console.log('  -> Profile image uploaded');
    await delay(3000);

    // Click Save/Crop
    const savePhoto = page.locator('div[aria-label*="Guardar"], div[aria-label*="Save"], span:has-text("Guardar")').first();
    if (await savePhoto.isVisible().catch(() => false)) {
      await savePhoto.click();
      console.log('  -> Profile photo saved');
      await delay(3000);
    } else {
      await page.keyboard.press('Enter');
      await delay(2000);
    }
  } else {
    console.log('  -> File input not found for profile');
  }

  // Go back to page
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(3000);

  // STEP 4: Upload cover image
  console.log('[4/6] Subiendo foto de portada...');
  const coverImg = path.join(IMG_DIR, 'cover.png');

  // Click on cover photo area (not the profile pic, the banner)
  const coverArea = page.locator('div[aria-label*="portada"], div[aria-label*="cover"]').first();
  if (await coverArea.isVisible().catch(() => false)) {
    await coverArea.click();
    await delay(2000);
  } else {
    // Another approach: click on the camera icon or edit cover button
    const editCover = page.locator('span:has-text("Editar portada"), span:has-text("Edit cover"), div[aria-label*="portada"]').first();
    if (await editCover.isVisible().catch(() => false)) {
      await editCover.click();
      await delay(2000);
    }
  }

  const fileInput2 = page.locator('input[type="file"]').first();
  if (await fileInput2.isVisible().catch(() => false)) {
    await fileInput2.setInputFiles(coverImg);
    console.log('  -> Cover image uploaded');
    await delay(3000);

    const saveCover = page.locator('div[aria-label*="Guardar"], span:has-text("Guardar")').first();
    if (await saveCover.isVisible().catch(() => false)) {
      await saveCover.click();
      console.log('  -> Cover saved');
      await delay(3000);
    } else {
      await page.keyboard.press('Enter');
      await delay(2000);
    }
  } else {
    console.log('  -> File input not found for cover');
  }

  // STEP 5: Set up CTA button
  console.log('[5/6] Configurando botón CTA...');
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(4000);

  // Look for "Add Button" or similar
  const addBtn = page.locator('span:has-text("Añadir botón"), span:has-text("Add Button"), div[aria-label*="botón"]').first();
  if (await addBtn.isVisible().catch(() => false)) {
    await addBtn.click();
    console.log('  -> Add button clicked');
    await delay(2000);

    // Select button type - "Shop Now" or "Contact Us" or "Learn More"
    const shopNow = page.locator('span:has-text("Comprar ahora"), span:has-text("Shop Now"), div[role="button"]:has-text("Comprar")').first();
    if (await shopNow.isVisible().catch(() => false)) {
      await shopNow.click();
      await delay(1000);
    }

    // Enter website URL
    const urlField = page.locator('input[type="url"], input[placeholder*="enlace"]').first();
    if (await urlField.isVisible().catch(() => false)) {
      await urlField.fill('https://ventaspro.ai/tienda');
      await human();
    }

    // Save CTA
    const saveCta = page.locator('div[aria-label*="Guardar"], span:has-text("Guardar")').first();
    if (await saveCta.isVisible().catch(() => false)) {
      await saveCta.click();
      console.log('  -> CTA saved');
      await delay(2000);
    }
  } else {
    console.log('  -> Add button not found');
  }

  // STEP 6: Verify
  console.log('[6/6] Verificando...');
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(3000);
  
  const pageTitle = await page.title().catch(() => '');
  console.log('  -> Page title:', pageTitle);
  await page.screenshot({ path: 'page-final.png' });
  console.log('  -> Screenshot saved');

  console.log('\n¡Configuración completada!');
  await browser.close();
}
main().catch(console.error);
