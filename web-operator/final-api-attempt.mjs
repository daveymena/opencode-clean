import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const IMG_DIR = 'C:\\Users\\ADMIN\\Downloads\\OpenCode-Limpio\\web-operator\\fb-images\\products-correct';
const PAGE_ID = '61591838792522';

const PRODUCTS = [
  { name: '🎨 CURSOS DISEÑO GRÁFICO', img: 'diseno-grafico.jpg',
    msg: '🎨 CURSOS DISEÑO GRÁFICO\n\nPhotoshop, Illustrator, InDesign y Corel Draw.\n📂 45 secciones | 420 clases | 65h\n✅ Acceso Vitalicio\n💰 $60,000 COP' },
  { name: '💼 MICROSOFT OFFICE', img: 'office.jpg',
    msg: '💼 MICROSOFT OFFICE\n\nWord, PowerPoint, Access y Outlook.\n📂 15 secciones | 180 clases | 35h\n✅ Acceso Vitalicio\n💰 $20,000 COP' },
  { name: '🌍 INGLÉS COMPLETO', img: 'ingles.jpg',
    msg: '🌍 INGLÉS COMPLETO\n\nGramática, pronunciación y audios nativos (A1 a C1).\n📂 12 secciones | 150 clases | 40h\n✅ Acceso Vitalicio\n💰 $20,000 COP' },
  { name: '📊 EXCEL AVANZADO', img: 'excel.jpg',
    msg: '📊 EXCEL AVANZADO\n\nTablas dinámicas, funciones avanzadas y dashboards.\n📂 12 secciones | 120 clases | 25h\n✅ Acceso Vitalicio\n💰 $20,000 COP' },
  { name: '💻 CURSO HACKING ÉTICO', img: 'hacking.jpg',
    msg: '💻 CURSO HACKING ÉTICO\n\nPentesting, Kali Linux, seguridad de redes.\n📂 30 secciones | 250 clases | 40h\n✅ Acceso Vitalicio\n💰 $20,000 COP' }
];

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  // Go to the page as VentasPro
  await page.goto(`https://www.facebook.com/profile.php?id=${PAGE_ID}`, {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await delay(5000);

  // Method: Use Facebook's FB.api from the page context
  // The FB SDK is already loaded on Facebook pages
  console.log('=== Testing FB.api ===');
  const testResult = await page.evaluate(async () => {
    return new Promise((resolve) => {
      if (typeof FB === 'undefined' || !FB.api) {
        resolve('FB.api not available');
        return;
      }
      FB.api('/me', { fields: 'id,name' }, (response) => {
        resolve(JSON.stringify(response));
      });
    });
  }).catch(() => 'error');
  console.log('FB.api /me:', testResult);

  // If FB.api works, try posting via it
  if (!testResult.includes('not available') && !testResult.includes('error')) {
    let posted = 0;
    for (const product of PRODUCTS) {
      console.log(`\n--- ${product.name} ---`);
      const imgPath = path.join(IMG_DIR, product.img);

      const result = await page.evaluate(async ({ pageId, message, imgPath: _imgPath }) => {
        return new Promise((resolve) => {
          // Try posting to page feed with photo
          FB.api(
            `/${pageId}/photos`,
            'POST',
            {
              message: message,
              // For photos, we need to upload the file first
              // But FB.api doesn't support file uploads directly
              // We can try posting text only first
              url: _imgPath  // This expects a URL, not a local file
            },
            (response) => {
              resolve(JSON.stringify(response));
            }
          );
        });
      }, { pageId: PAGE_ID, message: product.msg, imgPath });
      console.log('  FB.api result:', result);
      await delay(2000);
    }
  }

  // Alternative: Try using Facebook's own composer submission mechanism
  // When you click Publicar in the composer, Facebook sends a POST to a specific endpoint
  // Let's try to intercept what happens when we click Publicar manually

  console.log('\n=== Trying composer form submission ===');
  
  // Open composer for one product
  const firstProduct = PRODUCTS[0];
  const pensarBtn = page.locator('div[role="button"]:has-text("¿Qué estás pensando?")').first();
  if (await pensarBtn.isVisible().catch(() => false)) {
    await pensarBtn.click();
    await delay(4000);
  }

  // Type text
  const tb = page.locator('[contenteditable="true"]').first();
  if (await tb.isVisible().catch(() => false)) {
    await tb.click({ force: true });
    await delay(500);
    await tb.fill(firstProduct.msg);
    console.log('Text typed');
  }
  await delay(2000);

  // Upload image
  const imgPath = path.join(IMG_DIR, firstProduct.img);
  const fcPromise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
  await page.locator('div[aria-label="Foto/vídeo"]').first().click({ force: true }).catch(() => {});
  await delay(2000);

  const fc = await fcPromise;
  if (fc) {
    await fc.setFiles(imgPath);
    console.log('Image uploaded');
    await delay(12000);
  }

  // Click Siguiente
  const sig = page.locator('div[aria-label="Siguiente"]').first();
  if (await sig.isVisible().catch(() => false)) {
    await sig.click();
    console.log('Siguiente');
    await delay(4000);
  }

  // NOW - intercept the actual POST request when clicking Publicar
  // Set up request interception
  let postUrl = '';
  page.on('request', req => {
    const url = req.url();
    if (url.includes('create') || url.includes('story') || url.includes('feed') || url.includes('publish')) {
      console.log('  Intercepted:', url.substring(0, 200));
      postUrl = url;
    }
  });

  // Find the Publicar button and click it - use force: true
  const pubBtn = page.locator('div[aria-label="Publicar"]').first();
  if (await pubBtn.isVisible().catch(() => false)) {
    await pubBtn.click({ force: true });
    console.log('Publicar clicked (force)');
    await delay(5000);
  } else {
    // Try clicking via evaluate
    const clicked = await page.evaluate(() => {
      const btns = document.querySelectorAll('[aria-label="Publicar"]');
      for (const btn of btns) {
        if (btn.offsetParent !== null) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    console.log('Publicar clicked via evaluate:', clicked);
    await delay(5000);
  }

  console.log('Post URL intercepted:', postUrl || 'none');

  await page.screenshot({ path: 'after-publish.png' }).catch(() => {});
  await delay(3000);

  // Check if there are now posts
  await page.goto(`https://www.facebook.com/profile.php?id=${PAGE_ID}`, {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await delay(5000);
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 2000));
    await delay(1500);
  }

  const text = await page.innerText('body').catch(() => '');
  for (const kw of ['Photoshop, Illustrator', 'Word, PowerPoint', 'Gramática', 'Tablas dinámicas', 'Pentesting']) {
    if (text.includes(kw)) console.log(`✅ Post content found: "${kw}"`);
  }

  await browser.close();
}
main().catch(console.error);
