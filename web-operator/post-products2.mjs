import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const PROD_DIR = 'C:\\Users\\ADMIN\\Videos\\Agent-Sales-Bot\\artifacts\\ventas-pro\\public\\images\\products';

const PRODUCTS = [
  {
    name: '🎨 Diseño Gráfico',
    desc: 'Photoshop, Illustrator, InDesign y Corel Draw de básico a experto.\n• 45 secciones | 420 clases | 65h de contenido\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF',
    img: 'diseno-grafico.jpg'
  },
  {
    name: '📊 Microsoft Office',
    desc: 'Word, Excel, PowerPoint, Access y Outlook. Domina las herramientas ofimáticas.\n• 40 secciones | 380 clases | 60h de contenido\n• Acceso vitalicio vía Google Drive',
    img: 'office.jpg'
  },
  {
    name: '🇬🇧 Inglés Completo',
    desc: 'Inglés básico a avanzado. Gramática, conversación, vocabulario y pronunciación.\n• 50 secciones | 450 clases | 70h de contenido\n• Acceso vitalicio vía Google Drive',
    img: 'ingles.jpg'
  },
  {
    name: '📈 Excel Avanzado',
    desc: 'Fórmulas, tablas dinámicas, macros, VBA y Power BI.\n• 35 secciones | 320 clases | 50h de contenido\n• Acceso vitalicio vía Google Drive',
    img: 'excel.jpg'
  },
  {
    name: '🔒 Hacking Ético',
    desc: 'Ciberseguridad, pentesting, Kali Linux, redes y programación segura.\n• 42 secciones | 400 clases | 65h de contenido\n• Acceso vitalicio vía Google Drive',
    img: 'hacking-etico.jpg'
  }
];

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  
  // Find the page already on VentasPro profile
  let page = ctx.pages().find(p => p.url().includes('facebook.com/profile.php?id=61591838792522'));
  if (!page) {
    page = ctx.pages()[0];
    await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
  }
  console.log('Using page:', page.url());

  // Wait for page to be stable
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await delay(3000);

  let posted = 0;
  for (const product of PRODUCTS) {
    console.log(`\n--- ${product.name} ---`);

    // Ensure we're on the page
    if (!page.url().includes('profile.php')) {
      await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
        waitUntil: 'domcontentloaded', timeout: 30000
      });
      await delay(3000);
    }

    // Click "¿Qué estás pensando?"
    const composer = page.locator('[aria-label="¿Qué estás pensando?"]').first();
    if (!(await composer.isVisible().catch(() => false))) {
      console.log('  Composer not visible, trying reload');
      await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
        waitUntil: 'domcontentloaded', timeout: 30000
      });
      await delay(5000);
      if (!(await composer.isVisible().catch(() => false))) {
        console.log('  Still not visible, skipping');
        continue;
      }
    }
    await composer.click();
    console.log('  Composer clicked');
    await delay(3000);

    // Click "Foto/vídeo"
    const photoBtn = page.locator('[aria-label="Foto/vídeo"]').first();
    if (!(await photoBtn.isVisible().catch(() => false))) {
      console.log('  Photo button not found');
      await page.keyboard.press('Escape');
      await delay(1000);
      continue;
    }

    const fcPromise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
    await photoBtn.click();
    await delay(2000);

    const imgPath = path.join(PROD_DIR, product.img);
    if (!fs.existsSync(imgPath)) {
      console.log(`  Image not found: ${product.img}`);
      await page.keyboard.press('Escape');
      await delay(1000);
      continue;
    }

    const fc = await fcPromise;
    if (fc) {
      await fc.setFiles(imgPath);
      console.log('  File set via chooser');
      await delay(10000);
    } else {
      console.log('  No filechooser event');
      const inputs = await page.locator('input[type="file"]').all();
      if (inputs.length > 0) {
        await inputs[0].setInputFiles(imgPath);
        console.log('  File set via direct input');
        await delay(10000);
      } else {
        console.log('  No file inputs');
        await page.keyboard.press('Escape');
        await delay(1000);
        continue;
      }
    }

    // Type text
    const fullText = `${product.name}\n\n${product.desc}\n\n📲 Contáctanos para más información.`;
    const textbox = page.locator('[role="textbox"][aria-label*="Escribe"], [role="textbox"][aria-label*="escribe"], [contenteditable="true"]').first();
    if (await textbox.isVisible().catch(() => false)) {
      await textbox.fill(fullText);
      console.log('  Text filled');
    } else {
      await page.keyboard.type(fullText, { delay: 30 });
      console.log('  Text typed');
    }
    await delay(2000);

    // Click Publicar
    const publishBtn = page.locator('div[aria-label="Publicar"]').first();
    if (await publishBtn.isVisible().catch(() => false)) {
      await publishBtn.click();
      console.log('✅ Published!');
      posted++;
      await delay(5000);
    } else {
      const altBtns = await page.locator('[role="button"]:has-text("Publicar")').all();
      let published = false;
      for (const b of altBtns) {
        if (await b.isVisible().catch(() => false)) {
          await b.click();
          console.log('✅ Published (alt button)');
          published = true;
          posted++;
          break;
        }
      }
      if (!published) {
        console.log('  Publish button not found, pressing Enter');
        await page.keyboard.press('Enter');
        await delay(3000);
        posted++;
      }
      await delay(5000);
    }

    // Navigate back to profile
    await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await delay(3000);
  }

  console.log(`\n✅ ${posted}/${PRODUCTS.length} productos publicados`);
  await browser.close();
}
main().catch(console.error);
