import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const IMG_DIR = path.resolve('./fb-images');

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  const pageUrl = 'https://www.facebook.com/profile.php?id=61591838792522';

  // Helper to upload via filechooser event
  async function clickAndUpload(clickTarget, filePath, description) {
    // Set up filechooser listener BEFORE clicking
    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 15000 }).catch(() => null);

    // Click the button that triggers the file picker
    await clickTarget.click();
    console.log(`  -> ${description} clicked`);

    // Wait for file chooser
    const fileChooser = await fileChooserPromise;
    if (fileChooser) {
      await fileChooser.setFiles(filePath);
      console.log(`  -> ${description} file selected`);
      await delay(3000);
      return true;
    } else {
      console.log(`  -> File chooser not triggered for ${description}`);
      return false;
    }
  }

  // ===== STEP 1: Upload profile picture =====
  console.log('[1] Foto de perfil...');
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(4000);

  // Click "Cambiar" button
  const cambiar = page.locator('div[aria-label="Cambiar"]').first();
  if (await cambiar.isVisible().catch(() => false)) {
    // Setup filechooser before clicking Cambiar
    const fcPromise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
    await cambiar.click();
    await delay(2000);

    let fc = await fcPromise;
    if (!fc) {
      // Maybe a submenu appeared - look for "Subir foto"
      const subir = page.locator('span:has-text("Subir foto")').first();
      if (await subir.isVisible().catch(() => false)) {
        console.log('  -> Subir foto option found');
        const fc2Promise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
        await subir.click();
        fc = await fc2Promise;
      }
    }

    if (fc) {
      await fc.setFiles(path.join(IMG_DIR, 'profile.png'));
      console.log('  -> Profile pic selected for upload');
      await delay(5000);

      // Try clicking Save/Crop
      const saveBtn = page.locator('div[aria-label="Guardar"]').first();
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
        console.log('  -> Profile pic saved');
        await delay(3000);
      } else {
        // Maybe auto-saves
        console.log('  -> No save btn, might auto-save');
      }
    } else {
      console.log('  -> File chooser not triggered for profile');
    }
  } else {
    console.log('  -> Cambiar button not visible');
  }

  // ===== STEP 2: Upload cover photo =====
  console.log('\n[2] Foto de portada...');
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(4000);

  // Click "Añadir foto de portada" or cover photo area
  const addCover = page.locator('div[aria-label="Añadir foto de portada"]').first();
  if (await addCover.isVisible().catch(() => false)) {
    const fcPromise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
    await addCover.click();
    let fc = await fcPromise;

    if (fc) {
      await fc.setFiles(path.join(IMG_DIR, 'cover.png'));
      console.log('  -> Cover selected for upload');
      await delay(5000);

      const saveBtn = page.locator('div[aria-label="Guardar"]').first();
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
        console.log('  -> Cover saved');
        await delay(3000);
      }
    } else {
      console.log('  -> File chooser not triggered for cover');
    }
  } else {
    console.log('  -> Add cover button not visible');
  }

  // ===== STEP 3: Update description via Business Suite =====
  console.log('\n[3] Descripción...');
  await page.goto('https://business.facebook.com/latest/settings?asset_id=1278583508663384', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(5000);

  // Click Editar
  const editBtn = page.locator('span:has-text("Editar")').first();
  if (await editBtn.isVisible().catch(() => false)) {
    await editBtn.click();
    console.log('  -> Edit clicked');
    await delay(4000);
  }

  // Find all visible textareas
  const textareas = await page.locator('textarea:visible').all();
  console.log(`  -> ${textareas.length} visible textareas`);
  for (let i = 0; i < textareas.length; i++) {
    const val = await textareas[i].inputValue().catch(() => '');
    console.log(`    [${i}] "${val.substring(0, 60)}"`);
    const id = await textareas[i].getAttribute('id').catch(() => '');
    console.log(`        id="${id}"`);
  }

  if (textareas.length > 0) {
    // Usually the first textarea is the description
    const descField = textareas[0];
    await descField.click();
    await delay(300);
    await descField.fill('');
    await delay(500);
    await descField.fill('Los mejores cursos digitales: Diseño Gráfico, Office, Inglés, Excel, Hacking Ético, Infografías, Programación, Marketing Digital, Negocios, Fotografía y más de 80 cursos. Contenido descargable MP4/PDF. Acceso vitalicio vía Google Drive. Aprende desde casa a tu propio ritmo.');
    console.log('  -> Description filled');
    await delay(1000);
  }

  // Look for Save button
  const saveBtns = await page.locator('div[aria-label="Guardar cambios"], span:has-text("Guardar")').all();
  for (const sb of saveBtns) {
    if (await sb.isVisible().catch(() => false)) {
      await sb.click();
      console.log('  -> Changes saved');
      await delay(2000);
      break;
    }
  }

  console.log('\n¡Listo!');
  await page.screenshot({ path: 'final-ventaspro.png' });
  await browser.close();
}
main().catch(console.error);
