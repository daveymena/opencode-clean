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

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  // Ensure on page profile
  await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await delay(5000);

  let posted = 0;
  for (const product of PRODUCTS) {
    console.log(`\n=== ${product.name} ===`);

    // Click composer button (role=button with matching text, no aria-label)
    const pensarBtn = page.locator('div[role="button"]:has-text("¿Qué estás pensando?")').first();
    if (await pensarBtn.isVisible().catch(() => false)) {
      await pensarBtn.click();
      console.log('  Composer clicked');
    } else {
      const ideaBtn = page.locator('div[role="button"]:has-text("Comparte una idea")').first();
      if (await ideaBtn.isVisible().catch(() => false)) {
        await ideaBtn.click();
        console.log('  Share idea clicked');
      } else {
        console.log('  No composer found');
        continue;
      }
    }
    await delay(4000);

    // Find text input in the dialog and type
    const textbox = page.locator('[role="dialog"] [contenteditable="true"]').first();
    if (await textbox.isVisible().catch(() => false)) {
      await textbox.click();
      await delay(500);
      const text = `${product.name}\n\n${product.desc}\n\n📲 Contáctanos para más información.`;
      await textbox.fill(text);
      console.log('  Text entered');
    } else {
      console.log('  No contenteditable, trying keyboard');
      await page.keyboard.type(product.name + '\n\n' + product.desc);
    }
    await delay(2000);

    // Upload image
    const imgPath = path.join(PROD_DIR, product.img);
    if (fs.existsSync(imgPath)) {
      console.log(`  Image found: ${product.img} (${(fs.statSync(imgPath).size / 1024).toFixed(0)}KB)`);

      // Click Foto/video to trigger file chooser
      const fcPromise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
      const fotoBtn = page.locator('[role="dialog"] div[aria-label="Foto/vídeo"]').first();
      if (await fotoBtn.isVisible().catch(() => false)) {
        await fotoBtn.click();
        console.log('  Foto/video clicked');
      } else {
        // Look for Foto/video in the whole page
        const fotoBtnGlobal = page.locator('div[aria-label="Foto/vídeo"]').first();
        if (await fotoBtnGlobal.isVisible().catch(() => false)) {
          await fotoBtnGlobal.click();
          console.log('  Foto/video (global) clicked');
        }
      }
      await delay(2000);

      const fc = await fcPromise;
      if (fc) {
        await fc.setFiles(imgPath);
        console.log('  File set via filechooser');
        await delay(8000);
      } else {
        // Direct file input approach
        const inputs = await page.locator('input[type="file"]').all();
        for (const inp of inputs) {
          const visible = await inp.isVisible().catch(() => false);
          if (visible) {
            await inp.setInputFiles(imgPath);
            console.log('  File set via visible input');
            await delay(8000);
            break;
          }
        }
      }
    } else {
      console.log(`  Image NOT found: ${product.img}`);
    }

    // Find and click Publicar
    await delay(2000);
    const publishBtn = page.locator('[role="dialog"] div[aria-label="Publicar"]').first();
    if (await publishBtn.isVisible().catch(() => false)) {
      await publishBtn.click();
      console.log('  ✅ Published!');
      posted++;
    } else {
      // Broader search
      const altBtns = await page.locator('[role="button"]:has-text("Publicar")').all();
      let clicked = false;
      for (const b of altBtns) {
        if (await b.isVisible().catch(() => false)) {
          await b.click();
          console.log('  ✅ Published (alt)');
          clicked = true;
          posted++;
          break;
        }
      }
      if (!clicked) {
        console.log('  Publish button NOT found in dialog');
        // Debug: dump dialog contents
        const dialog = page.locator('[role="dialog"]').first();
        if (await dialog.isVisible().catch(() => false)) {
          const btns = await dialog.locator('[role="button"]').all();
          for (const b of btns) {
            const t = (await b.innerText().catch(() => '')).trim().substring(0, 60);
            if (t) console.log(`  Dialog btn: "${t}"`);
          }
        }
        await page.keyboard.press('Escape');
        await delay(2000);
        continue;
      }
    }

    await delay(5000);
    await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await delay(5000);
  }

  console.log(`\n✅ ${posted}/${PRODUCTS.length} publicaciones`);
  await browser.close();
}
main().catch(console.error);
