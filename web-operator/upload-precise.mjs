import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const IMG_DIR = path.resolve('./fb-images');
const PAGE_ID = '61591838792522';
const PAGE_URL = `https://www.facebook.com/profile.php?id=${PAGE_ID}`;

async function uploadPhoto(page, buttonLabel, filePath, description) {
  console.log(`\n[${description}]...`);

  // Navigate to page
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(5000);

  // Find the button by label
  const btn = page.locator(`div[aria-label="${buttonLabel}"]`).first();
  const visible = await btn.isVisible().catch(() => false);
  console.log(`  Button "${buttonLabel}" visible: ${visible}`);

  if (!visible) return false;

  // Setup filechooser
  const fcPromise = page.waitForEvent('filechooser', { timeout: 15000 }).catch(() => null);

  // Click the button
  await btn.click();
  console.log('  Button clicked');
  await delay(2000);

  // Check if a menu appeared
  const menuItems = await page.locator('[role="menuitem"]:visible, [role="option"]:visible, span[role="menuitem"]:visible').all();
  console.log(`  Menu items found: ${menuItems.length}`);
  for (const item of menuItems) {
    const text = await item.innerText().catch(() => '');
    console.log(`    "${text}"`);
  }

  // If menu appeared, click "Subir foto"
  if (menuItems.length > 0) {
    const subir = page.locator('span:has-text("Subir foto")').first();
    if (await subir.isVisible().catch(() => false)) {
      const fc2Promise = page.waitForEvent('filechooser', { timeout: 15000 }).catch(() => null);
      await subir.click();
      console.log('  Subir foto clicked');
      const fc = await fc2Promise;
      if (fc) {
        await fc.setFiles(filePath);
        console.log(`  ${description} file set`);
        return true;
      }
    }
  }

  // Check if filechooser was triggered directly
  const fc = await fcPromise;
  if (fc) {
    await fc.setFiles(filePath);
    console.log(`  ${description} file selected directly`);
    await delay(5000);
    return true;
  }

  console.log('  No filechooser triggered');
  return false;
}

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // Upload profile picture
  await uploadPhoto(page, 'Cambiar', path.join(IMG_DIR, 'profile.png'), 'Foto de perfil');
  await delay(5000);

  // Wait for crop/save - press Enter to accept default crop
  await page.keyboard.press('Enter');
  await delay(3000);

  // Upload cover photo via old-style URL (Facebook has specific pages for this)
  console.log('\n[Foto de portada]...');
  await page.goto(`${PAGE_URL}&sk=photos`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(5000);

  // Try direct upload via Business Suite
  await page.goto('https://business.facebook.com/latest/home?asset_id=1278583508663384', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(6000);

  // Find ANY add cover button
  const coverOptions = [
    'div[aria-label="Añadir foto de portada"]',
    'span:has-text("Añadir foto de portada")',
    'span:has-text("Add Cover")',
    'div[aria-label*="portada"]',
    'div[aria-label*="cover"]'
  ];

  let coverClicked = false;
  for (const selector of coverOptions) {
    const el = page.locator(selector).first();
    if (await el.isVisible().catch(() => false)) {
      console.log(`  Found cover element: ${selector}`);
      const fcPromise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
      await el.click();
      const fc = await fcPromise;
      if (fc) {
        await fc.setFiles(path.join(IMG_DIR, 'cover.png'));
        console.log('  Cover file selected');
        coverClicked = true;
        await delay(8000);
        break;
      }
    }
  }

  if (!coverClicked) {
    console.log('  Could not upload cover photo automatically');
  }

  // Post a product to the page
  console.log('\n[Publicando producto]...');
  await page.goto(`https://www.facebook.com/profile.php?id=${PAGE_ID}`, {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(5000);

  // Click on "Crear publicación" or the composer
  const composer = page.locator('div[aria-label*="publicación"], div[role="textbox"], div[aria-label*="publicaci"]').first();
  if (await composer.isVisible().catch(() => false)) {
    await composer.click();
    console.log('  Composer clicked');
    await delay(3000);

    // Type the post content
    const postField = page.locator('div[aria-label*="publicación"]').first();
    if (await postField.isVisible().catch(() => false)) {
      await postField.fill('');
      await delay(500);
      await postField.fill('🎨 CURSOS DISEÑO GRÁFICO\n\nPhotoshop, Illustrator, InDesign y Corel de básico a experto.\n• 45 secciones | 420 clases | 65h de contenido\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF\n• Precio: $60,000 COP\n\n¡Aprende desde casa a tu propio ritmo!\n\n📲 Escríbenos al WhatsApp para más información.');
      console.log('  Post content written');
      await delay(1000);
    }

    // Click Publicar
    const publishBtn = page.locator('div[aria-label="Publicar"]').first();
    if (await publishBtn.isVisible().catch(() => false)) {
      await publishBtn.click();
      console.log('  Published!');
      await delay(3000);
    } else {
      console.log('  Publish button not found');
    }
  } else {
    console.log('  Composer not found');
  }

  await page.screenshot({ path: 'ventaspro-done.png' });
  console.log('\nProceso finalizado');
  await browser.close();
}
main().catch(console.error);
