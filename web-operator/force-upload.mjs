import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const IMG_DIR = path.resolve('./fb-images');
const PAGE_ID = '61591838792522';

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // ===== STEP 1: Upload cover photo via Business Suite =====
  console.log('[1] Subiendo portada...');
  await page.goto('https://business.facebook.com/latest/home?asset_id=1278583508663384', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(5000);

  // Wait for cover button
  const coverBtn = page.locator('div[aria-label="Añadir foto de portada"]').first();
  const coverVisible = await coverBtn.isVisible().catch(() => false);
  console.log('  Cover button visible:', coverVisible);

  if (coverVisible) {
    // Set up filechooser listener
    const fcPromise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
    await coverBtn.click();
    console.log('  Cover button clicked');

    const fc = await fcPromise;
    if (fc) {
      await fc.setFiles(path.join(IMG_DIR, 'cover.png'));
      console.log('  Cover file selected');
      await delay(8000);

      // Look for publish button
      const pubBtn = page.locator('div[aria-label="Publicar"]').first();
      if (await pubBtn.isVisible().catch(() => false)) {
        await pubBtn.click();
        console.log('  Cover published');
        await delay(4000);
      }
    } else {
      console.log('  No filechooser triggered');
    }
  }

  // ===== STEP 2: Try Facebook API via page injected functions =====
  console.log('\n[2] Subiendo foto de perfil vía inyección DOM...');
  await page.goto(`https://www.facebook.com/profile.php?id=${PAGE_ID}`, {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(4000);

  // Read the profile image as base64
  const profileBase64 = fs.readFileSync(path.join(IMG_DIR, 'profile.png')).toString('base64');

  // Inject a script that creates a file and uploads it through Facebook's API
  const injected = await page.evaluate(async ({ pageId, base64 }) => {
    // Convert base64 to blob
    const byteChars = atob(base64);
    const byteNums = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNums[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNums);
    const blob = new Blob([byteArray], { type: 'image/png' });
    const file = new File([blob], 'profile.png', { type: 'image/png' });

    // Try to find the upload mechanism via the Cambiar button
    const cambiarBtn = document.querySelector('div[aria-label="Cambiar"]');
    if (!cambiarBtn) return 'Cambiar not found';

    cambiarBtn.click();
    await new Promise(r => setTimeout(r, 2000));

    // Find "Subir foto" menu item
    const allMenuItems = document.querySelectorAll('span');
    let subirItem = null;
    for (const item of allMenuItems) {
      if (item.textContent === 'Subir foto' || item.textContent === 'Upload Photo') {
        subirItem = item;
        break;
      }
    }

    if (!subirItem) {
      // Maybe the menu didn't appear, or the text is different
      // Check for any visible dropdown menu
      const menus = document.querySelectorAll('[role="menu"]');
      return 'Subir foto not found, menus: ' + menus.length;
    }

    // Click Subir foto
    subirItem.click();
    await new Promise(r => setTimeout(r, 2000));

    // After clicking Subir foto, Facebook should create a file input
    // We need to intercept it
    const fileInputs = document.querySelectorAll('input[type="file"]');
    for (const fi of fileInputs) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fi.files = dt.files;
      fi.dispatchEvent(new Event('change', { bubbles: true }));
      return 'File set on input: ' + fi.id;
    }

    return 'No file inputs found after click';
  }, { pageId: PAGE_ID, base64: profileBase64 });
  console.log('  Injection result:', injected);
  await delay(3000);

  // ===== STEP 3: Update description via Graph API =====
  console.log('\n[3] Editando descripción...');
  await page.goto('https://business.facebook.com/latest/settings?asset_id=1278583508663384', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(5000);

  // Click Editar
  const editBtn = page.locator('span:has-text("Editar")').first();
  if (await editBtn.isVisible().catch(() => false)) {
    await editBtn.click();
    console.log('  Edit clicked');
    await delay(5000);

    // Find dialogs and textareas
    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.isVisible().catch(() => false)) {
      const ta = dialog.locator('textarea').first();
      if (await ta.isVisible().catch(() => false)) {
        await ta.click();
        await delay(500);
        await ta.fill('Los mejores cursos digitales: Diseño Gráfico, Office, Inglés, Excel, Hacking Ético, Infografías, Programación, Marketing Digital, Negocios, Fotografía y más de 80 cursos. Contenido descargable MP4/PDF. Acceso vitalicio vía Google Drive. Aprende desde casa a tu propio ritmo.');
        console.log('  Description filled');
        await delay(500);
      }

      const save = dialog.locator('div[aria-label="Guardar cambios"], span:has-text("Guardar")').first();
      if (await save.isVisible().catch(() => false)) {
        await save.click();
        console.log('  Saved');
        await delay(3000);
      }
    } else {
      console.log('  No dialog appeared');
    }
  }

  // ===== FINAL: Take screenshot =====
  await page.goto(`https://www.facebook.com/profile.php?id=${PAGE_ID}`, {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(4000);
  await page.screenshot({ path: 'ventaspro-final.png' });
  console.log('\nScreenshot taken');

  await browser.close();
}
main().catch(console.error);
