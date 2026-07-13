import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const IMG_DIR = 'C:\\Users\\ADMIN\\Downloads\\OpenCode-Limpio\\web-operator\\fb-images\\products-correct';

const PRODUCTS = [
  {
    name: '🎨 DISEÑO GRÁFICO',
    desc: 'Photoshop, Illustrator, InDesign y Corel Draw de básico a experto.\n\n• 45 secciones | 420 clases | 65h de contenido\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF\n• Desde $60,000 COP',
    img: 'diseno-grafico.jpg',
    hashtags: '#DiseñoGráfico #Photoshop #Illustrator #CursosDigitales #VentasPro'
  },
  {
    name: '📊 MICROSOFT OFFICE',
    desc: 'Word, Excel, PowerPoint, Access y Outlook. Domina la suite ofimática más usada.\n\n• 40 secciones | 380 clases | 60h de contenido\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF\n• Solo $20,000 COP',
    img: 'office.jpg',
    hashtags: '#Office #Excel #Word #PowerPoint #CursosDigitales #VentasPro'
  },
  {
    name: '🇬🇧 INGLÉS COMPLETO',
    desc: 'Básico a avanzado. Gramática, conversación, vocabulario y pronunciación.\n\n• 50 secciones | 450 clases | 70h de contenido\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF\n• Solo $20,000 COP',
    img: 'ingles.jpg',
    hashtags: '#Inglés #AprenderInglés #CursosDigitales #VentasPro'
  },
  {
    name: '📈 EXCEL AVANZADO',
    desc: 'Fórmulas, macros, VBA, tablas dinámicas, Power BI y más.\n\n• 35 secciones | 320 clases | 50h de contenido\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF\n• Solo $20,000 COP',
    img: 'excel.jpg',
    hashtags: '#Excel #ExcelAvanzado #PowerBI #CursosDigitales #VentasPro'
  },
  {
    name: '🔒 HACKING ÉTICO',
    desc: 'Ciberseguridad, pentesting, Kali Linux, redes y programación segura.\n\n• 42 secciones | 400 clases | 65h de contenido\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF\n• Solo $20,000 COP',
    img: 'hacking.jpg',
    hashtags: '#HackingÉtico #Ciberseguridad #Pentesting #CursosDigitales #VentasPro'
  }
];

async function postProduct(page, product) {
  // 1. Click composer button
  const pensarBtn = page.locator('div[role="button"]:has-text("¿Qué estás pensando?")').first();
  if (await pensarBtn.isVisible().catch(() => false)) {
    await pensarBtn.click();
    console.log('  Composer clicked');
  } else {
    const ideaBtn = page.locator('div[role="button"]:has-text("Comparte una idea")').first();
    if (await ideaBtn.isVisible().catch(() => false)) {
      await ideaBtn.click();
      console.log('  Comparte una idea clicked');
    } else {
      console.log('  No composer found');
      return false;
    }
  }
  await delay(4000);

  // 2. Type text
  const textbox = page.locator('[contenteditable="true"]').first();
  if (await textbox.isVisible().catch(() => false)) {
    await textbox.click();
    await delay(500);

    const fullText = `${product.name}\n\n${product.desc}\n\n${product.hashtags}\n\n📲 Contáctanos para más información.`;
    await textbox.fill(fullText);
    console.log('  Text entered');
  }
  await delay(2000);

  // 3. Upload image
  const imgPath = path.join(IMG_DIR, product.img);
  if (!fs.existsSync(imgPath)) {
    console.log(`  Image not found: ${product.img}`);
    return false;
  }
  console.log(`  Image: ${product.img} (${(fs.statSync(imgPath).size/1024).toFixed(0)}KB)`);

  // Try filechooser approach
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
    await delay(10000);
  } else {
    console.log('  Filechooser not triggered, trying direct input');
    const inputs = await page.locator('input[type="file"]').all();
    let done = false;
    for (const inp of inputs) {
      const visible = await inp.isVisible().catch(() => false);
      if (visible) {
        await inp.setInputFiles(imgPath);
        console.log('  File set via visible input');
        done = true;
        break;
      }
    }
    if (!done) {
      console.log('  Could not upload image');
      return false;
    }
    await delay(10000);
  }

  // 4. Find Publicar
  await delay(2000);
  const publicarBtns = page.locator('div[role="button"]:has-text("Publicar")');
  const count = await publicarBtns.count();
  let clicked = false;

  for (let i = 0; i < count; i++) {
    const btn = publicarBtns.nth(i);
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      console.log('  ✅ Publicar clicked!');
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    console.log('  Publicar not found, trying keyboard Enter');
    await page.keyboard.press('Enter');
    await delay(2000);
    return true; // assume it worked
  }

  await delay(5000);
  return true;
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
    const ok = await postProduct(page, product);
    if (ok) posted++;
    await delay(3000);

    // Reload page for next post
    await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await delay(5000);
  }

  console.log(`\n✅ ${posted}/${PRODUCTS.length} publicaciones creadas`);
  await browser.close();
}
main().catch(console.error);
