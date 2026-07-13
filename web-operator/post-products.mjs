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
    desc: 'Word, Excel, PowerPoint, Access y Outlook. Domina las herramientas ofimáticas más usadas.\n• 40 secciones | 380 clases | 60h de contenido\n• Acceso vitalicio vía Google Drive',
    img: 'office.jpg'
  },
  {
    name: '🇬🇧 Inglés',
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

async function postProduct(page, product) {
  // Click "¿Qué estás pensando?"
  const composer = page.locator('[aria-label="¿Qué estás pensando?"]').first();
  if (!(await composer.isVisible().catch(() => false))) {
    console.log(`[${product.name}] Composer not found`);
    return false;
  }
  await composer.click();
  await delay(3000);

  // Click Foto/video button
  const photoBtn = page.locator('[aria-label="Foto/vídeo"]').first();
  if (!(await photoBtn.isVisible().catch(() => false))) {
    console.log(`[${product.name}] Photo button not found`);
    await page.keyboard.press('Escape');
    await delay(1000);
    return false;
  }

  // Setup filechooser listener before clicking
  const fcPromise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
  await photoBtn.click();
  await delay(2000);

  const imgPath = path.join(PROD_DIR, product.img);
  const fc = await fcPromise;
  if (fc) {
    await fc.setFiles(imgPath);
    console.log(`[${product.name}] File set: ${product.img}`);
    await delay(8000); // Wait for upload preview
  } else {
    console.log(`[${product.name}] No filechooser, trying direct input`);
    const inputs = await page.locator('input[type="file"]').all();
    if (inputs.length > 0) {
      await inputs[0].setInputFiles(imgPath);
      console.log(`[${product.name}] File set via direct input`);
      await delay(8000);
    } else {
      console.log(`[${product.name}] No file inputs found`);
      await page.keyboard.press('Escape');
      await delay(1000);
      return false;
    }
  }

  // Type the text
  const textbox = page.locator('[role="textbox"][aria-label*="publicación"], [role="textbox"][aria-label*="post"], [role="textbox"][aria-label*="escribe"]').first();
  if (await textbox.isVisible().catch(() => false)) {
    const fullText = `${product.name}\n\n${product.desc}\n\n📲 Contáctanos para más información.\n💡 Todos nuestros cursos: $20,000 COP cada uno`;
    await textbox.fill(fullText);
    console.log(`[${product.name}] Text filled`);
    await delay(2000);
  } else {
    // Try keyboard typing
    await page.keyboard.type(product.name + '\n\n' + product.desc);
    await delay(1000);
  }

  // Click Publicar
  const publishBtn = page.locator('div[aria-label="Publicar"]').first();
  if (await publishBtn.isVisible().catch(() => false)) {
    await publishBtn.click();
    console.log(`[${product.name}] Published!`);
    await delay(5000);
    return true;
  } else {
    // Try clicking the active publish button
    const all = await page.locator('div[role="button"]:has-text("Publicar")').all();
    for (const b of all) {
      if (await b.isVisible().catch(() => false)) {
        await b.click();
        console.log(`[${product.name}] Published via alt button`);
        await delay(5000);
        return true;
      }
    }
    console.log(`[${product.name}] Publish button not found`);
    await page.keyboard.press('Escape');
    await delay(1000);
    return false;
  }
}

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(5000);

  let posted = 0;
  for (const product of PRODUCTS) {
    console.log(`\n--- Posting ${product.name} ---`);
    const ok = await postProduct(page, product);
    if (ok) posted++;
    await delay(3000);
  }

  console.log(`\n===== ${posted}/${PRODUCTS.length} posts created =====`);
  await browser.close();
}
main().catch(console.error);
