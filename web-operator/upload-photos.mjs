import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const IMG_DIR = path.resolve('./fb-images');

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  const pageUrl = 'https://www.facebook.com/profile.php?id=61591838792522';

  // STEP 1: Upload profile picture
  console.log('[1] Subiendo foto de perfil...');
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(4000);

  // Click "Cambiar" button (Change profile picture)
  const cambiarBtn = page.locator('div[aria-label="Cambiar"]').first();
  if (await cambiarBtn.isVisible().catch(() => false)) {
    await cambiarBtn.click();
    console.log('  -> Cambiar clicked');
    await delay(3000);

    // Look for "Subir foto" option
    const uploadOption = page.locator('span:has-text("Subir foto")').first();
    if (await uploadOption.isVisible().catch(() => false)) {
      await uploadOption.click();
      console.log('  -> Subir foto clicked');
      await delay(2000);
    }

    // Try to find ANY visible file input
    let fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      await fileInput.setInputFiles(path.join(IMG_DIR, 'profile.png'));
      console.log('  -> Profile file set');
      await delay(5000);
    } else {
      // Maybe there's a hidden file input that's triggered by a button
      // Try clicking "Upload from computer" or similar
      const computerOpt = page.locator('span:has-text("desde el ordenador"), span:has-text("from computer")').first();
      if (await computerOpt.isVisible().catch(() => false)) {
        await computerOpt.click();
        console.log('  -> Computer option clicked');
        await delay(3000);

        fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.isVisible().catch(() => false)) {
          await fileInput.setInputFiles(path.join(IMG_DIR, 'profile.png'));
          console.log('  -> Profile file set via computer option');
          await delay(5000);
        }
      }
    }
  } else {
    console.log('  -> Cambiar not found');
  }

  // STEP 2: Upload cover photo
  console.log('\n[2] Subiendo foto de portada...');
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(4000);

  // Look for "Añadir foto de portada" or cover-related button
  const coverBtn = page.locator('div[aria-label="Añadir foto de portada"]').first();
  if (await coverBtn.isVisible().catch(() => false)) {
    await coverBtn.click();
    console.log('  -> Add cover clicked');
    await delay(3000);

    // Look for upload file option
    let fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      await fileInput.setInputFiles(path.join(IMG_DIR, 'cover.png'));
      console.log('  -> Cover file set');
      await delay(5000);
    } else {
      const fromComputer = page.locator('span:has-text("desde el ordenador"), span:has-text("from computer")').first();
      if (await fromComputer.isVisible().catch(() => false)) {
        await fromComputer.click();
        await delay(3000);
        fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.isVisible().catch(() => false)) {
          await fileInput.setInputFiles(path.join(IMG_DIR, 'cover.png'));
          console.log('  -> Cover file set via computer');
          await delay(5000);
        }
      }
    }
  } else {
    console.log('  -> Add cover not found');
  }

  // STEP 3: Now handle description via Business Suite settings
  console.log('\n[3] Editando descripción...');
  await page.goto('https://business.facebook.com/latest/settings?asset_id=1278583508663384', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(5000);

  // Look for "Editar" next to the page name
  const editBtn = page.locator('span:has-text("Editar")').first();
  if (await editBtn.isVisible().catch(() => false)) {
    await editBtn.click();
    console.log('  -> Edit clicked in settings');
    await delay(4000);
  }

  // Find textareas
  const textareas = await page.locator('textarea').all();
  console.log(`  -> Found ${textareas.length} textareas`);
  for (let i = 0; i < textareas.length; i++) {
    const val = await textareas[i].inputValue().catch(() => '');
    console.log(`    [${i}]="${val.substring(0, 80)}"`);
    const visible = await textareas[i].isVisible().catch(() => false);
    console.log(`    visible=${visible}`);
  }

  // Fill description textarea
  if (textareas.length > 0) {
    const desc = textareas[0];
    if (await desc.isVisible().catch(() => false)) {
      await desc.click();
      await delay(500);
      await desc.fill('');
      await delay(500);
      await desc.fill('Los mejores cursos digitales: Diseño Gráfico, Office, Inglés, Excel, Hacking Ético, Infografías, Programación, Marketing Digital, Negocios, Fotografía y más de 80 cursos. Contenido descargable MP4/PDF. Acceso vitalicio vía Google Drive. Aprende desde casa a tu propio ritmo. Sin clases en vivo. Calidad premium a precios accesibles.');
      console.log('  -> Description filled');
      await delay(1000);

      const saveBtn = page.locator('div[aria-label="Guardar cambios"]').first();
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
        console.log('  -> Saved');
        await delay(3000);
      }
    }
  }

  console.log('\nProceso completado!');
  await page.screenshot({ path: 'final-result.png' });
  await browser.close();
}
main().catch(console.error);
