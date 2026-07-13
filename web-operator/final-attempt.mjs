import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const IMG_DIR = path.resolve('./fb-images');

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // ===== COVER PHOTO via Business Suite =====
  console.log('[1] Subiendo portada desde Business Suite...');
  await page.goto('https://business.facebook.com/latest/home?asset_id=1278583508663384', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(5000);

  const coverBtn = page.locator('div[aria-label="Añadir foto de portada"]').first();
  if (await coverBtn.isVisible().catch(() => false)) {
    console.log('  -> Cover button visible');
    // Set up filechooser listener
    const fcPromise = page.waitForEvent('filechooser', { timeout: 15000 }).catch(() => null);
    await coverBtn.click();
    console.log('  -> Cover button clicked');
    await delay(2000);

    const fc = await fcPromise;
    if (fc) {
      await fc.setFiles(path.join(IMG_DIR, 'cover.png'));
      console.log('  -> Cover file sent');
      await delay(8000); // Wait for upload + processing

      // Look for save/publish
      const publish = page.locator('div[aria-label="Publicar"]').first();
      if (await publish.isVisible().catch(() => false)) {
        await publish.click();
        console.log('  -> Cover published');
        await delay(3000);
      }
    } else {
      console.log('  -> No file chooser event');
    }
  }

  // ===== PROFILE PHOTO via Facebook page direct =====
  console.log('\n[2] Subiendo foto de perfil...');
  await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(5000);

  // Use page.evaluate to programmatically trigger upload
  const result = await page.evaluate(async (profilePicPath) => {
    // Read the file
    const response = await fetch('file:///' + profilePicPath.replace(/\\/g, '/'));
    const blob = await response.blob();
    
    // Create a FormData and send via Graph API
    // We need the page access token - get it from FB's cookies
    // Actually, let's try to use the Facebook upload endpoint directly
    
    // Find the change profile pic button and simulate a proper click
    
    // Alternative: use the profile pic upload URL
    return 'Cannot upload from evaluate';
  }, path.join(IMG_DIR, 'profile.png'));
  console.log('  ->', result);

  // Look for the profile picture camera/change button
  // Try to find the edit profile picture button programmatically
  await page.goto('https://www.facebook.com/profile.php?id=61591838792522&sk=photos', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(4000);

  // Click Cambiar
  const cambiar = page.locator('div[aria-label="Cambiar"]').first();
  if (await cambiar.isVisible().catch(() => false)) {
    console.log('  -> Cambiar visible');
    await cambiar.click();
    await delay(3000);

    // Get menu items
    const menuItems = await page.locator('[role="menuitem"]:visible, [role="option"]:visible').all();
    console.log(`  -> Menu items: ${menuItems.length}`);
    for (const item of menuItems) {
      const t = await item.innerText().catch(() => '');
      console.log(`     "${t}"`);
    }

    // Click "Subir foto" 
    const subir = page.locator('span:has-text("Subir foto")').first();
    if (await subir.isVisible().catch(() => false)) {
      console.log('  -> Subir foto visible');
      const fcPromise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
      await subir.click();
      const fc = await fcPromise;
      if (fc) {
        await fc.setFiles(path.join(IMG_DIR, 'profile.png'));
        console.log('  -> Profile pic sent');
        await delay(5000);

        // Look for crop/save confirmation
        const guardar = page.locator('div[aria-label="Guardar"]').first();
        if (await guardar.isVisible().catch(() => false)) {
          await guardar.click();
          console.log('  -> Profile pic saved');
          await delay(3000);
        }
      }
    }
  }

  // ===== DESCRIPTION via Business Suite settings =====
  console.log('\n[3] Editando descripción...');
  await page.goto('https://business.facebook.com/latest/settings?asset_id=1278583508663384', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(5000);

  // Try clicking "Editar"
  const editBtn = page.locator('span:has-text("Editar")').first();
  if (await editBtn.isVisible().catch(() => false)) {
    await editBtn.click();
    console.log('  -> Edit clicked');
    await delay(5000);

    // Look for modal/dialog
    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.isVisible().catch(() => false)) {
      console.log('  -> Dialog opened');
      const dialogText = await dialog.innerText().catch(() => '');
      console.log('  Dialog text:', dialogText.replace(/\s+/g, ' ').trim().substring(0, 300));

      // Find textarea in dialog
      const ta = dialog.locator('textarea').first();
      if (await ta.isVisible().catch(() => false)) {
        console.log('  -> Textarea found');
        await ta.click();
        await delay(300);
        await ta.fill('');
        await delay(500);
        await ta.fill('Los mejores cursos digitales: Diseño Gráfico, Office, Inglés, Excel, Hacking Ético, Infografías, Programación, Marketing Digital, Negocios, Fotografía y más de 80 cursos. Contenido descargable MP4/PDF. Acceso vitalicio vía Google Drive. Aprende desde casa a tu propio ritmo.');
        console.log('  -> Description filled');
        await delay(500);
      }

      // Look for Save button in dialog
      const save = dialog.locator('div[aria-label="Guardar cambios"], span:has-text("Guardar")').first();
      if (await save.isVisible().catch(() => false)) {
        await save.click();
        console.log('  -> Changes saved');
        await delay(3000);
      }
    }
  }

  console.log('\n=== Configuración completada ===');
  await page.screenshot({ path: 'final-attempt.png' });
  await browser.close();
}
main().catch(console.error);
