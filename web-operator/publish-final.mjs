import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const PROD_DIR = 'C:\\Users\\ADMIN\\Videos\\Agent-Sales-Bot\\artifacts\\ventas-pro\\public\\images\\products';

const PRODUCTS = [
  {
    name: '🎨 Diseño Gráfico',
    desc: 'Photoshop, Illustrator, InDesign y Corel Draw.\n• 45 secciones | 420 clases | 65h\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF\n• Desde $20,000 COP',
    img: 'diseno-grafico.jpg'
  },
  {
    name: '📊 Microsoft Office',
    desc: 'Word, Excel, PowerPoint, Access y Outlook.\n• 40 secciones | 380 clases | 60h\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF',
    img: 'office.jpg'
  },
  {
    name: '🇬🇧 Inglés Completo',
    desc: 'Básico a avanzado. Gramática, conversación, vocabulario.\n• 50 secciones | 450 clases | 70h\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF',
    img: 'ingles.jpg'
  },
  {
    name: '📈 Excel Avanzado',
    desc: 'Fórmulas, macros, VBA, tablas dinámicas y Power BI.\n• 35 secciones | 320 clases | 50h\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF',
    img: 'excel.jpg'
  },
  {
    name: '🔒 Hacking Ético',
    desc: 'Ciberseguridad, pentesting, Kali Linux, redes.\n• 42 secciones | 400 clases | 65h\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF',
    img: 'hacking-etico.jpg'
  }
];

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  // Go to page profile
  await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await delay(5000);

  let posted = 0;
  for (const product of PRODUCTS) {
    console.log(`\n=== ${product.name} ===`);

    // Click the composer button. Note: no aria-label on these elements, just role=button + text.
    const pensarBtn = page.locator('div[role="button"]:has-text("¿Qué estás pensando?")').first();
    if (await pensarBtn.isVisible().catch(() => false)) {
      await pensarBtn.click();
      console.log('  Clicked "¿Qué estás pensando?"');
    } else {
      const ideaBtn = page.locator('div[role="button"]:has-text("Comparte una idea...")').first();
      if (await ideaBtn.isVisible().catch(() => false)) {
        await ideaBtn.click();
        console.log('  Clicked "Comparte una idea..."');
      } else {
        // Last fallback: try any element with that text
        const fallback = page.locator(':has-text("Comparte una idea")').first();
        if (await fallback.isVisible().catch(() => false)) {
          await fallback.click();
          console.log('  Clicked fallback');
        } else {
          console.log('  No composer button found');
          continue;
        }
      }
    }
    await delay(4000);

    // Now look for the dialog/overlay composer
    // The dialog might have a textbox or contenteditable div
    let textbox = page.locator('[role="dialog"] [contenteditable="true"]').first();
    if (!(await textbox.isVisible().catch(() => false))) {
      textbox = page.locator('[role="dialog"] [role="textbox"]').first();
    }
    if (!(await textbox.isVisible().catch(() => false))) {
      textbox = page.locator('[contenteditable="true"]').first();
    }
    
    if (await textbox.isVisible().catch(() => false)) {
      await textbox.click();
      await delay(1000);
      const text = `${product.name}\n\n${product.desc}\n\n📲 Contáctanos para más información.`;
      await textbox.fill(text);
      console.log('  Text entered');
      await delay(1000);
    } else {
      console.log('  No textbox found in dialog');
      // Try typing into active element
      await page.keyboard.type(product.name + '\n\n' + product.desc);
      await delay(1000);
    }

    // Upload image via file input
    const imgPath = path.join(PROD_DIR, product.img);
    if (fs.existsSync(imgPath)) {
      // Find the file input in the dialog
      const fileInputs = await page.locator('[role="dialog"] input[type="file"]').all();
      let uploaded = false;
      if (fileInputs.length > 0) {
        await fileInputs[0].setInputFiles(imgPath);
        console.log('  Image set via dialog file input');
        uploaded = true;
      } else {
        // Try the general file input
        const allInputs = await page.locator('input[type="file"]').all();
        for (const inp of allInputs) {
          if (await inp.isVisible().catch(() => false)) {
            await inp.setInputFiles(imgPath);
            console.log('  Image set via visible file input');
            uploaded = true;
            break;
          }
        }
        if (!uploaded) {
          // Try clicking Foto/video and catching filechooser
          console.log('  Trying filechooser approach');
          const fcPromise = page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null);
          const fotoBtn = page.locator('div[aria-label="Foto/vídeo"]').first();
          if (await fotoBtn.isVisible().catch(() => false)) {
            await fotoBtn.click();
            const fc = await fcPromise;
            if (fc) {
              await fc.setFiles(imgPath);
              console.log('  Image set via filechooser');
              uploaded = true;
            }
          }
        }
      }
      if (uploaded) {
        await delay(8000); // Wait for upload preview
      }
    } else {
      console.log(`  Image not found: ${product.img}`);
    }

    // Click Publicar
    await delay(2000);
    const publishBtn = page.locator('[role="dialog"] div[aria-label="Publicar"]').first();
    if (await publishBtn.isVisible().catch(() => false)) {
      await publishBtn.click();
    } else {
      // Try any "Publicar" in dialog
      const altPublish = page.locator('[role="dialog"] [role="button"]:has-text("Publicar")').first();
      if (await altPublish.isVisible().catch(() => false)) {
        await altPublish.click();
      } else {
        console.log('  Publish button not found');
        await page.keyboard.press('Escape');
        await delay(2000);
        continue;
      }
    }
    console.log('  ✅ Published!');
    posted++;

    // Wait and go back to profile
    await delay(5000);
    await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await delay(5000);
  }

  console.log(`\n✅ ${posted}/${PRODUCTS.length} publicaciones creadas`);
  await browser.close();
}
main().catch(console.error);
