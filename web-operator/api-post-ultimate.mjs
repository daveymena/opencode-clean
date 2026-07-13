import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import https from 'https';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const IMG_DIR = 'C:\\Users\\ADMIN\\Downloads\\OpenCode-Limpio\\web-operator\\fb-images\\products-correct';
const PAGE_ID = '61591838792522';

const PRODUCTS = [
  {
    name: '🎨 CURSOS DISEÑO GRÁFICO',
    desc: 'Photoshop, Illustrator, InDesign y Corel Draw de básico a experto.\n\n📂 CONTENIDO:\n• 45 secciones | 420 clases | 65h\n• Contenido Descargable MP4/PDF\n• Acceso Permanente vía Google Drive\n\n✅ BENEFICIOS:\n• Contenido Virtual y Descargable\n• Acceso Vitalicio\n• Sin Clases en Vivo\n• Estudio a tu propio ritmo\n\n💰 PRECIO: $60,000 COP',
    img: 'diseno-grafico.jpg'
  },
  {
    name: '💼 MICROSOFT OFFICE',
    desc: 'Word, PowerPoint, Access y Outlook empresarial.\n\n📂 CONTENIDO:\n• 15 secciones | 180 clases | 35h\n• Contenido Descargable MP4/PDF\n• Acceso Permanente vía Google Drive\n\n✅ BENEFICIOS:\n• Contenido Virtual y Descargable\n• Acceso Vitalicio\n• Sin Clases en Vivo\n• Estudio a tu propio ritmo\n\n💰 PRECIO: $20,000 COP',
    img: 'office.jpg'
  },
  {
    name: '🌍 INGLÉS COMPLETO',
    desc: 'Gramática, pronunciación y audios nativos (A1 a C1).\n\n📂 CONTENIDO:\n• 12 secciones | 150 clases | 40h\n• Contenido Descargable MP4/PDF\n• Acceso Permanente vía Google Drive\n\n✅ BENEFICIOS:\n• Contenido Virtual y Descargable\n• Acceso Vitalicio\n• Sin Clases en Vivo\n• Estudio a tu propio ritmo\n\n💰 PRECIO: $20,000 COP',
    img: 'ingles.jpg'
  },
  {
    name: '📊 EXCEL AVANZADO',
    desc: 'Tablas dinámicas, funciones avanzadas y dashboards.\n\n📂 CONTENIDO:\n• 12 secciones | 120 clases | 25h\n• Contenido Descargable MP4/PDF\n• Acceso Permanente vía Google Drive\n\n✅ BENEFICIOS:\n• Contenido Virtual y Descargable\n• Acceso Vitalicio\n• Sin Clases en Vivo\n• Estudio a tu propio ritmo\n\n💰 PRECIO: $20,000 COP',
    img: 'excel.jpg'
  },
  {
    name: '💻 CURSO HACKING ÉTICO',
    desc: 'Pentesting, Kali Linux, seguridad de redes y auditoría.\n\n📂 CONTENIDO:\n• 30 secciones | 250 clases | 40h\n• Contenido Descargable MP4/PDF\n• Acceso Permanente vía Google Drive\n\n✅ BENEFICIOS:\n• Contenido Virtual y Descargable\n• Acceso Vitalicio\n• Sin Clases en Vivo\n• Estudio a tu propio ritmo\n\n💰 PRECIO: $20,000 COP',
    img: 'hacking.jpg'
  }
];

async function uploadPhotoViaApi(page, imgPath, message) {
  const imgData = fs.readFileSync(imgPath);
  const ext = path.extname(imgPath).replace('.', '') === 'jpg' ? 'jpeg' : path.extname(imgPath).replace('.', '');
  
  // Use the page's fetch to make authenticated requests
  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
  const body = [
    `--${boundary}\r\nContent-Disposition: form-data; name="message"\r\n\r\n${message}\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="source"; filename="photo.${ext}"\r\nContent-Type: image/${ext}\r\n\r\n`,
    imgData.toString('binary'),
    `\r\n--${boundary}--\r\n`
  ].join('');

  const result = await page.evaluate(async ({ pageId, boundary, bodyB64, ext }) => {
    // Convert base64 back to binary for FormData
    const binaryStr = atob(bodyB64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'multipart/form-data; boundary=' + boundary });
    
    // Try to find any FB access token
    const findToken = () => {
      // Check window.__fb
      if (window.__fb) return JSON.stringify(window.__fb).substring(0,100);
      // Check for fetch interceptors
      return '';
    };
    
    const tokenInfo = findToken();
    
    // Try using the graph API directly with credentials
    try {
      const formData = new FormData();
      formData.append('message', bodyB64.split('message')[1]?.split('filename')[0]?.replace(/[^a-zA-Z0-9]/g,'') || 'Test message');
      formData.append('source', blob, `photo.${ext}`);
      
      // Post as the page via the me/photos endpoint
      const resp = await fetch(`https://graph.facebook.com/v21.0/me/photos`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
        body: formData
      });
      return await resp.text();
    } catch(e) {
      return 'Error: ' + e.message;
    }
  }, { pageId: PAGE_ID, boundary, bodyB64: Buffer.from(body).toString('base64'), ext });

  return result;
}

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  // First, let's check if we can find the page access token
  // Navigate to the page
  await page.goto(`https://www.facebook.com/profile.php?id=${PAGE_ID}`, {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await delay(5000);

  // Check if the page has a composer we can use with proper approach
  // Open the composer
  const pensarBtn = page.locator('div[role="button"]:has-text("¿Qué estás pensando?")').first();
  if (await pensarBtn.isVisible().catch(() => false)) {
    await pensarBtn.click();
    console.log('Composer opened');
  } else {
    console.log('No composer');
    await browser.close();
    return;
  }
  await delay(4000);

  let posted = 0;
  OUTER:
  for (const product of PRODUCTS) {
    console.log(`\n=== ${product.name} ===`);

    // Type text in composer
    const tb = page.locator('[contenteditable="true"]').first();
    if (await tb.isVisible().catch(() => false)) {
      await tb.click({ force: true }).catch(() => tb.evaluate(el => el.focus()));
      await delay(500);
      await tb.fill(`${product.name}\n\n${product.desc}`);
      console.log('  Text done');
    }
    await delay(2000);

    // Upload image  
    const imgPath = path.join(IMG_DIR, product.img);
    if (!fs.existsSync(imgPath)) continue;

    const fcPromise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
    await page.locator('div[aria-label="Foto/vídeo"]').first().click({ force: true }).catch(() => {});
    await delay(2000);

    const fc = await fcPromise;
    if (fc) {
      await fc.setFiles(imgPath);
      console.log('  Image uploaded');
      await delay(12000);
    } else {
      console.log('  Upload failed');
      continue;
    }

    // Click Siguiente if present
    const sig = page.locator('div[aria-label="Siguiente"]').first();
    if (await sig.isVisible().catch(() => false)) {
      await sig.click();
      console.log('  Siguiente');
      await delay(4000);
    } else {
      const sig2 = page.locator('div[role="button"]:has-text("Siguiente")').first();
      if (await sig2.isVisible().catch(() => false)) {
        await sig2.click();
        console.log('  Siguiente (text)');
        await delay(4000);
      }
    }

    // NOW - find the textbox in the final composer and set the full text (with emojis)
    // After "Siguiente", the composer should have a clean textbox
    const tb2 = page.locator('[contenteditable="true"]').first();
    if (await tb2.isVisible().catch(() => false)) {
      await tb2.click({ force: true }).catch(() => tb2.evaluate(el => el.focus()));
      await delay(500);
      await tb2.fill(product.desc);
      console.log('  Full text entered after Siguiente');
    }
    await delay(2000);

    // Try pressing Ctrl+Enter (keyboard shortcut for publish)
    await page.keyboard.press('Control+Enter');
    console.log('  Ctrl+Enter pressed');
    await delay(5000);

    // Check if post was created by looking for success indicators
    const pageText = await page.innerText('body').catch(() => '');
    if (pageText.includes(product.name.substring(0, 15))) {
      console.log('  ✅ Post confirmed!');
      posted++;
    }

    // Reload
    await page.goto(`https://www.facebook.com/profile.php?id=${PAGE_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await delay(5000);
  }

  console.log(`\n✅ ${posted} posts confirmed`);

  console.log('\nDone');
  await browser.close();
}
main().catch(console.error);
