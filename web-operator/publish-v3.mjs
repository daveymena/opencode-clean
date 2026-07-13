import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const PROD_DIR = 'C:\\Users\\ADMIN\\Videos\\Agent-Sales-Bot\\artifacts\\ventas-pro\\public\\images\\products';

const PRODUCTS = [
  { name: '🎨 Diseño Gráfico',         img: '41.jpg', desc: 'Photoshop, Illustrator, InDesign y Corel Draw.\n• 45 secciones | 420 clases | 65h\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF\n• Desde $20,000 COP' },
  { name: '📊 Microsoft Office',        img: '42.jpg', desc: 'Word, Excel, PowerPoint, Access y Outlook.\n• 40 secciones | 380 clases | 60h\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF' },
  { name: '🇬🇧 Inglés Completo',        img: '43.jpg', desc: 'Básico a avanzado. Gramática, conversación, vocabulario.\n• 50 secciones | 450 clases | 70h\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF' },
  { name: '📈 Excel Avanzado',         img: '44.jpg', desc: 'Fórmulas, macros, VBA, tablas dinámicas y Power BI.\n• 35 secciones | 320 clases | 50h\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF' },
  { name: '🔒 Hacking Ético',          img: '45.jpg', desc: 'Ciberseguridad, pentesting, Kali Linux, redes.\n• 42 secciones | 400 clases | 65h\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF' }
];

async function postInline(page, product) {
  // Step 1: Click composer button
  const pensarBtn = page.locator('div[role="button"]:has-text("¿Qué estás pensando?")').first();
  if (await pensarBtn.isVisible().catch(() => false)) {
    await pensarBtn.click();
  } else {
    const ideaBtn = page.locator('div[role="button"]:has-text("Comparte una idea")').first();
    if (await ideaBtn.isVisible().catch(() => false)) {
      await ideaBtn.click();
    } else {
      return false;
    }
  }
  await delay(3000);

  // Step 2: Find contenteditable text field anywhere on page (not in dialog)
  let textbox = page.locator('[contenteditable="true"]').first();
  if (!(await textbox.isVisible().catch(() => false))) {
    textbox = page.locator('[role="textbox"]').first();
  }
  if (await textbox.isVisible().catch(() => false)) {
    await textbox.click();
    await delay(500);
    const text = `${product.name}\n\n${product.desc}\n\n📲 Contáctanos para más información.`;
    await textbox.fill(text);
    console.log('  Text entered');
  } else {
    console.log('  No textbox');
    return false;
  }
  await delay(2000);

  // Step 3: Upload image via filechooser (click Foto/video on the page)
  const imgPath = path.join(PROD_DIR, product.img);
  if (!fs.existsSync(imgPath)) {
    console.log(`  Image not found: ${product.img}`);
    return false;
  }

  // Find the file input that Facebook creates when you click Foto/video
  // First check if there's a visible file input
  let inputs = await page.locator('input[type="file"]').all();
  let existingInput = null;
  for (const inp of inputs) {
    if (await inp.isVisible().catch(() => false)) {
      existingInput = inp;
      break;
    }
  }

  if (existingInput) {
    await existingInput.setInputFiles(imgPath);
    console.log('  File set directly');
    await delay(8000);
  } else {
    // Click Foto/video to trigger filechooser
    const fcPromise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
    const fotoBtn = page.locator('div[aria-label="Foto/vídeo"]').first();
    if (await fotoBtn.isVisible().catch(() => false)) {
      await fotoBtn.click();
      console.log('  Foto/video clicked');
    }
    await delay(2000);

    const fc = await fcPromise;
    if (fc) {
      await fc.setFiles(imgPath);
      console.log('  File set via filechooser');
      await delay(8000);
    } else {
      console.log('  No filechooser available');
      return false;
    }
  }
  await delay(2000);

  // Step 4: Find and click Publicar
  // Look at the whole page for publish buttons that are VISIBLE
  const publicar = page.locator('div[role="button"]:has-text("Publicar")');
  const count = await publicar.count();
  console.log(`  Found ${count} "Publicar" buttons`);

  for (let i = 0; i < count; i++) {
    const btn = publicar.nth(i);
    const visible = await btn.isVisible().catch(() => false);
    const text = (await btn.innerText().catch(() => '')).trim();
    console.log(`    #${i}: visible=${visible} text="${text.substring(0,30)}"`);

    // Also check parent visibility
    if (visible) {
      await btn.click();
      console.log('  ✅ Publicar clicked!');
      await delay(5000);

      // Check if dialog with "Publicar" appears (confirmation)
      const confirmBtn = page.locator('[role="dialog"] div[aria-label="Publicar"]').first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        console.log('  Confirmation dialog, clicking again');
        await confirmBtn.click();
        await delay(3000);
      }
      return true;
    }
  }

  console.log('  No visible Publicar button');
  await page.keyboard.press('Escape');
  await delay(2000);
  return false;
}

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await delay(5000);

  let posted = 0;
  for (const product of PRODUCTS) {
    console.log(`\n=== ${product.name} ===`);
    const ok = await postInline(page, product);
    if (ok) posted++;
    await delay(3000);

    // Reload page for next post
    await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await delay(5000);
  }

  console.log(`\n✅ ${posted}/${PRODUCTS.length} publicaciones`);
  await browser.close();
}
main().catch(console.error);
