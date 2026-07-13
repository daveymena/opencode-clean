import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const IMG_DIR = 'C:\\Users\\ADMIN\\Downloads\\OpenCode-Limpio\\web-operator\\fb-images\\products-correct';

const PRODUCTS = [
  { name: '🎨 DISEÑO GRÁFICO', img: 'diseno-grafico.jpg',
    desc: 'Photoshop, Illustrator, InDesign y Corel Draw.\n• 45 secciones | 420 clases | 65h\n• Acceso vitalicio vía Google Drive\n• Desde $60,000 COP',
    tag: '#DiseñoGráfico #Photoshop #CursosDigitales' },
  { name: '📊 MICROSOFT OFFICE', img: 'office.jpg',
    desc: 'Word, Excel, PowerPoint, Access y Outlook.\n• 40 secciones | 380 clases | 60h\n• Acceso vitalicio vía Google Drive\n• Solo $20,000 COP',
    tag: '#Office #Excel #Word #CursosDigitales' },
  { name: '🇬🇧 INGLÉS COMPLETO', img: 'ingles.jpg',
    desc: 'Básico a avanzado. Gramática, conversación, vocabulario.\n• 50 secciones | 450 clases | 70h\n• Acceso vitalicio vía Google Drive\n• Solo $20,000 COP',
    tag: '#Inglés #AprenderInglés #CursosDigitales' },
  { name: '📈 EXCEL AVANZADO', img: 'excel.jpg',
    desc: 'Fórmulas, macros, VBA, tablas dinámicas, Power BI.\n• 35 secciones | 320 clases | 50h\n• Acceso vitalicio vía Google Drive\n• Solo $20,000 COP',
    tag: '#Excel #ExcelAvanzado #PowerBI #CursosDigitales' },
  { name: '🔒 HACKING ÉTICO', img: 'hacking.jpg',
    desc: 'Ciberseguridad, pentesting, Kali Linux, redes.\n• 42 secciones | 400 clases | 65h\n• Acceso vitalicio vía Google Drive\n• Solo $20,000 COP',
    tag: '#HackingÉtico #Ciberseguridad #Pentesting #CursosDigitales' }
];

async function postProduct(page, product) {
  // 1. Open composer
  const c = page.locator('div[role="button"]:has-text("¿Qué estás pensando?")').first();
  if (await c.isVisible().catch(() => false)) { await c.click(); }
  else {
    const c2 = page.locator('div[role="button"]:has-text("Comparte una idea")').first();
    if (await c2.isVisible().catch(() => false)) { await c2.click(); }
    else { return false; }
  }
  await delay(4000);

  // 2. Type text FIRST
  const tb = page.locator('[contenteditable="true"]').first();
  if (await tb.isVisible().catch(() => false)) {
    await tb.click({ force: true }).catch(() => tb.evaluate(el => el.focus()));
    await delay(500);
    const text = `${product.name}\n\n${product.desc}\n\n${product.tag}\n\n📲 Contáctanos para más información.`;
    await tb.fill(text);
    console.log('  Text done');
  }
  await delay(2000);

  // 3. Upload image
  const imgPath = path.join(IMG_DIR, product.img);
  if (!fs.existsSync(imgPath)) return false;

  const fcPromise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
  await page.locator('div[aria-label="Foto/vídeo"]').first().click({ force: true }).catch(() => {});
  await delay(2000);

  const fc = await fcPromise;
  if (fc) {
    await fc.setFiles(imgPath);
    console.log('  Image uploaded');
    await delay(10000);
  } else { return false; }

  // 4. Click "Siguiente" (Next) button if present
  const sigBtn = page.locator('div[aria-label="Siguiente"]').first();
  if (await sigBtn.isVisible().catch(() => false)) {
    await sigBtn.click();
    console.log('  Siguiente clicked');
    await delay(3000);
  } else {
    // try text match
    const sigBtn2 = page.locator('div[role="button"]:has-text("Siguiente")').first();
    if (await sigBtn2.isVisible().catch(() => false)) {
      await sigBtn2.click();
      console.log('  Siguiente (text) clicked');
      await delay(3000);
    }
  }

  // 5. Click Publicar
  const pBtn = page.locator('div[aria-label="Publicar"]').first();
  if (await pBtn.isVisible().catch(() => false)) {
    await pBtn.click();
    console.log('  ✅ Publicado!');
    await delay(5000);
    return true;
  }

  // fallback: find by text
  const pBtns = page.locator('div[role="button"]:has-text("Publicar")');
  const count = await pBtns.count();
  for (let i = 0; i < count; i++) {
    const b = pBtns.nth(i);
    if (await b.isVisible().catch(() => false)) {
      await b.click({ force: true });
      console.log('  ✅ Publicado (alt)');
      await delay(5000);
      return true;
    }
  }

  // If still not found, try all Publicar buttons forcefully
  for (let i = 0; i < count; i++) {
    await pBtns.nth(i).click({ force: true, timeout: 2000 }).catch(() => {});
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
    await delay(3000);

    await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await delay(5000);
  }

  console.log(`\n✅ ${posted}/${PRODUCTS.length}`);
  await browser.close();
}
main().catch(console.error);
