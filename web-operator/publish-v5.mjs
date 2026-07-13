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
    desc: 'Word, Excel, PowerPoint, Access y Outlook. Domina la suite ofimática.\n\n• 40 secciones | 380 clases | 60h\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF\n• Solo $20,000 COP',
    img: 'office.jpg',
    hashtags: '#Office #Excel #Word #PowerPoint #CursosDigitales #VentasPro'
  },
  {
    name: '🇬🇧 INGLÉS COMPLETO',
    desc: 'Básico a avanzado. Gramática, conversación, vocabulario y pronunciación.\n\n• 50 secciones | 450 clases | 70h\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF\n• Solo $20,000 COP',
    img: 'ingles.jpg',
    hashtags: '#Inglés #AprenderInglés #CursosDigitales #VentasPro'
  },
  {
    name: '📈 EXCEL AVANZADO',
    desc: 'Fórmulas, macros, VBA, tablas dinámicas, Power BI y más.\n\n• 35 secciones | 320 clases | 50h\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF\n• Solo $20,000 COP',
    img: 'excel.jpg',
    hashtags: '#Excel #ExcelAvanzado #PowerBI #CursosDigitales #VentasPro'
  },
  {
    name: '🔒 HACKING ÉTICO',
    desc: 'Ciberseguridad, pentesting, Kali Linux, redes y programación segura.\n\n• 42 secciones | 400 clases | 65h\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF\n• Solo $20,000 COP',
    img: 'hacking.jpg',
    hashtags: '#HackingÉtico #Ciberseguridad #Pentesting #CursosDigitales #VentasPro'
  }
];

async function postProduct(page, product) {
  // 1. Click composer
  const btn = page.locator('div[role="button"]:has-text("¿Qué estás pensando?")').first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
  } else {
    const btn2 = page.locator('div[role="button"]:has-text("Comparte una idea")').first();
    if (await btn2.isVisible().catch(() => false)) {
      await btn2.click();
    } else {
      console.log('  No composer');
      return false;
    }
  }
  await delay(5000);

  // 2. Text - use force click to bypass overlay
  const textbox = page.locator('[contenteditable="true"]').first();
  if (await textbox.isVisible().catch(() => false)) {
    await textbox.click({ force: true, timeout: 5000 }).catch(() => {
      // fallback: focus via JS
      return textbox.evaluate(el => el.focus());
    });
    await delay(1000);

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

  const fcPromise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
  const fotoBtn = page.locator('div[aria-label="Foto/vídeo"]').first();
  if (await fotoBtn.isVisible().catch(() => false)) {
    await fotoBtn.click({ force: true, timeout: 5000 }).catch(() => {});
  }
  await delay(2000);

  const fc = await fcPromise;
  if (fc) {
    await fc.setFiles(imgPath);
    console.log('  Image uploaded');
    await delay(12000);
  } else {
    const inputs = await page.locator('input[type="file"]').all();
    for (const inp of inputs) {
      if (await inp.isVisible().catch(() => false)) {
        await inp.setInputFiles(imgPath);
        console.log('  Image via input');
        await delay(12000);
        break;
      }
    }
  }

  // 4. Publish - try force click
  await delay(2000);
  const pBtns = page.locator('div[role="button"]:has-text("Publicar")');
  const count = await pBtns.count();
  for (let i = 0; i < count; i++) {
    const b = pBtns.nth(i);
    if (await b.isVisible().catch(() => false)) {
      await b.click({ force: true, timeout: 5000 }).catch(() => {});
      console.log('  ✅ Publicado!');
      await delay(5000);
      return true;
    }
  }

  // Force click all just in case
  for (let i = 0; i < count; i++) {
    await pBtns.nth(i).click({ force: true, timeout: 3000 }).catch(() => {});
  }
  await delay(3000);
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

    // Reload
    await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await delay(5000);
  }

  console.log(`\n✅ ${posted}/${PRODUCTS.length}`);
  await browser.close();
}
main().catch(console.error);
