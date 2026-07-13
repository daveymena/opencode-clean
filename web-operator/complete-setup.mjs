import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const IMG_DIR = path.resolve('./fb-images');
const PAGE_ID = '61591838792522';
const PAGE_URL = `https://www.facebook.com/profile.php?id=${PAGE_ID}`;

async function injectAndUpload(page, filePath) {
  const fcPromise = page.waitForEvent('filechooser', { timeout: 20000 }).catch(() => null);
  const result = await page.evaluate(() => {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.position = 'fixed'; input.style.top = '0'; input.style.left = '0';
      input.style.opacity = '0.01'; input.style.zIndex = '99999';
      document.body.appendChild(input);
      input.addEventListener('click', () => resolve('triggered'), { once: true });
      input.click();
      setTimeout(() => resolve('timeout'), 5000);
    });
  });
  const fc = await fcPromise;
  if (fc) {
    await fc.setFiles(filePath);
    return true;
  }
  return false;
}

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0];

  // ===== 1. PROFILE PICTURE =====
  console.log('[1/5] Foto de perfil...');
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(4000);

  // Click profile SVG to open viewer
  const profileSvg = page.locator('svg[aria-label="VentasPro - Cursos Digitales"]').first();
  if (await profileSvg.isVisible().catch(() => false)) {
    await profileSvg.click();
    await delay(2000);
  }

  // Inject file input and upload
  const uploaded = await injectAndUpload(page, path.join(IMG_DIR, 'profile.png'));
  console.log(`  Uploaded: ${uploaded}`);
  await delay(5000);

  // Save - press Enter to confirm crop
  // First check if there's a visible Save button
  const saveBtn = page.locator('div[aria-label="Guardar"]').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    console.log('  Profile saved via button');
  } else {
    await page.keyboard.press('Enter');
    console.log('  Enter pressed to save');
  }
  await delay(3000);

  // ===== 2. COVER PHOTO =====
  console.log('\n[2/5] Foto de portada...');
  // Go to Business Suite
  await page.goto('https://business.facebook.com/latest/home?asset_id=1278583508663384', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(6000);

  // Click "Añadir foto de portada"
  const coverBtn = page.locator('div[aria-label="Añadir foto de portada"]').first();
  if (await coverBtn.isVisible().catch(() => false)) {
    console.log('  Cover button visible');
    const fcPromise = page.waitForEvent('filechooser', { timeout: 15000 }).catch(() => null);
    await coverBtn.click();
    await delay(3000);

    // If no direct filechooser, try injecting
    let fc = await fcPromise;
    if (!fc) {
      const uploaded2 = await injectAndUpload(page, path.join(IMG_DIR, 'cover.png'));
      console.log(`  Cover uploaded via injection: ${uploaded2}`);
      await delay(5000);
    } else {
      await fc.setFiles(path.join(IMG_DIR, 'cover.png'));
      console.log('  Cover file set');
      await delay(5000);
    }

    // Look for publish button
    const pubBtn = page.locator('div[aria-label="Publicar"]').first();
    if (await pubBtn.isVisible().catch(() => false)) {
      await pubBtn.click();
      console.log('  Cover published');
      await delay(3000);
    } else {
      await page.keyboard.press('Enter');
      await delay(2000);
    }
  } else {
    // Try on the regular Facebook page
    console.log('  Trying via Facebook page...');
    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await delay(4000);
    const injected = await injectAndUpload(page, path.join(IMG_DIR, 'cover.png'));
    console.log(`  Cover injected: ${injected}`);
    await delay(5000);
    await page.keyboard.press('Enter');
    await delay(2000);
  }

  // ===== 3. DESCRIPTION via Business Suite =====
  console.log('\n[3/5] Descripción...');
  await page.goto('https://business.facebook.com/latest/settings?asset_id=1278583508663384', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(6000);

  // Click Editar
  const editBtn = page.locator('span:has-text("Editar")').first();
  if (await editBtn.isVisible().catch(() => false)) {
    await editBtn.click();
    console.log('  Edit clicked');
    await delay(5000);

    // Find textarea
    const textareas = await page.locator('textarea:visible').all();
    if (textareas.length > 0) {
      await textareas[0].click();
      await delay(300);
      await textareas[0].fill('');
      await delay(500);
      await textareas[0].fill('Los mejores cursos digitales: Diseño Gráfico, Office, Inglés, Excel, Hacking Ético, Infografías, Programación, Marketing Digital, Negocios, Fotografía y más de 80 cursos. Contenido descargable MP4/PDF. Acceso vitalicio vía Google Drive. Aprende desde casa a tu propio ritmo.');
      console.log('  Description filled');
      await delay(500);
    }

    // Wait for save button to appear
    const saveDesc = page.locator('div[aria-label="Guardar cambios"], span:has-text("Guardar")').first();
    if (await saveDesc.isVisible().catch(() => false)) {
      await saveDesc.click();
      console.log('  Description saved');
      await delay(3000);
    }
  }

  // ===== 4. POST A PRODUCT =====
  console.log('\n[4/5] Publicando producto...');
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(5000);

  // Find the composer div and post
  const composer = page.locator('[role="textbox"], div[aria-label*="publicación"], div[contenteditable="true"]').first();
  if (await composer.isVisible().catch(() => false)) {
    await composer.click();
    await delay(2000);
    await composer.fill('');
    await delay(500);
    await composer.fill('🎨 CURSOS DISEÑO GRÁFICO\n\nPhotoshop, Illustrator, InDesign y Corel de básico a experto.\n• 45 secciones | 420 clases | 65h de contenido\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF\n• Precio: $60,000 COP\n\n¡Aprende desde casa a tu propio ritmo!\n\n📲 Escríbenos al WhatsApp para más información.');
    console.log('  Post content written');
    await delay(1000);

    // Click publish
    const publish = page.locator('div[aria-label="Publicar"]').first();
    if (await publish.isVisible().catch(() => false)) {
      await publish.click();
      console.log('  Post published!');
      await delay(3000);
    }
  } else {
    console.log('  Composer not found');
  }

  // ===== 5. VERIFY =====
  console.log('\n[5/5] Verificando...');
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(4000);
  await page.screenshot({ path: 'ventaspro-complete.png' });
  console.log('Screenshot saved');

  console.log('\n=== CONFIGURACIÓN COMPLETADA ===');
  await browser.close();
}
main().catch(console.error);
