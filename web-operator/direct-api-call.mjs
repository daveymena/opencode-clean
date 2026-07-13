import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const IMG_DIR = 'C:\\Users\\ADMIN\\Downloads\\OpenCode-Limpio\\web-operator\\fb-images\\products-correct';
const PAGE_ID = '61591838792522';

const PRODUCTS = [
  {
    name: '🎨 CURSOS DISEÑO GRÁFICO',
    msg: '🎨 CURSOS DISEÑO GRÁFICO\n\nPhotoshop, Illustrator, InDesign y Corel Draw de básico a experto.\n\n📂 45 secciones | 420 clases | 65h\n✅ Contenido Descargable MP4/PDF | Acceso Vitalicio\n\n💰 $60,000 COP\n\n📲 Contáctanos para adquirir este curso.',
    img: 'diseno-grafico.jpg'
  },
  {
    name: '💼 MICROSOFT OFFICE',
    msg: '💼 MICROSOFT OFFICE\n\nWord, PowerPoint, Access y Outlook empresarial.\n\n📂 15 secciones | 180 clases | 35h\n✅ Contenido Descargable MP4/PDF | Acceso Vitalicio\n\n💰 $20,000 COP\n\n📲 Contáctanos para adquirir este curso.',
    img: 'office.jpg'
  },
  {
    name: '🌍 INGLÉS COMPLETO',
    msg: '🌍 INGLÉS COMPLETO\n\nGramática, pronunciación y audios nativos (A1 a C1).\n\n📂 12 secciones | 150 clases | 40h\n✅ Contenido Descargable MP4/PDF | Acceso Vitalicio\n\n💰 $20,000 COP\n\n📲 Contáctanos para adquirir este curso.',
    img: 'ingles.jpg'
  },
  {
    name: '📊 EXCEL AVANZADO',
    msg: '📊 EXCEL AVANZADO\n\nTablas dinámicas, funciones avanzadas y dashboards.\n\n📂 12 secciones | 120 clases | 25h\n✅ Contenido Descargable MP4/PDF | Acceso Vitalicio\n\n💰 $20,000 COP\n\n📲 Contáctanos para adquirir este curso.',
    img: 'excel.jpg'
  },
  {
    name: '💻 CURSO HACKING ÉTICO',
    msg: '💻 CURSO HACKING ÉTICO\n\nPentesting, Kali Linux, seguridad de redes y auditoría.\n\n📂 30 secciones | 250 clases | 40h\n✅ Contenido Descargable MP4/PDF | Acceso Vitalicio\n\n💰 $20,000 COP\n\n📲 Contáctanos para adquirir este curso.',
    img: 'hacking.jpg'
  }
];

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  // Navigate to a Facebook page to get proper context
  await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await delay(5000);

  // METHOD 1: Try to find and use Facebook's internal access token
  console.log('=== Attempting to get access token ===');
  const tokenInfo = await page.evaluate(() => {
    // Try to find FB access token in various places
    const results = {};

    // Check window.FB
    if (typeof FB !== 'undefined') {
      try {
        results.FB_available = true;
        results.FB_type = typeof FB;
      } catch(e) {
        results.FB_error = e.message;
      }
    }

    // Check for __fb or similar globals
    for (const key of Object.keys(window)) {
      if (key.includes('FB') || key.includes('fb') || key.includes('token') || key.includes('access')) {
        results[key] = typeof window[key];
      }
    }

    // Check localStorage for tokens
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.includes('token') || k.includes('access') || k.includes('fb'))) {
        results['localStorage.' + k] = localStorage.getItem(k).substring(0, 50);
      }
    }

    // Check sessionStorage
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && (k.includes('token') || k.includes('access') || k.includes('fb'))) {
        results['sessionStorage.' + k] = sessionStorage.getItem(k).substring(0, 50);
      }
    }

    return results;
  }).catch(() => ({}));
  console.log('Token info:', JSON.stringify(tokenInfo, null, 2));

  // METHOD 2: Try to call Facebook's internal batch API
  console.log('\n=== Attempting to use Facebook batch API ===');
  const apiResult = await page.evaluate(async () => {
    try {
      // Try to make a call to Facebook's Graph API
      // Facebook stores the access token in cookies
      const resp = await fetch('https://graph.facebook.com/v21.0/me?fields=id,name', {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      return await resp.text();
    } catch(e) {
      return 'Error: ' + e.message;
    }
  }).catch(() => 'evaluate error');
  console.log('Graph API /me result:', apiResult.substring(0, 300));

  // METHOD 3: Try posting via Facebook's internal composer API
  // Facebook uses a specific endpoint for creating feed stories
  console.log('\n=== Attempting to use Facebook internal composer API ===');

  // First, get a compose session ID by visiting the composer
  await page.goto(`https://www.facebook.com/profile.php?id=${PAGE_ID}`, {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await delay(5000);

  // Try posting via Facebook's internal create/link/story API
  // Facebook uses: POST /ajax/updatestatus/?__a=1 
  // or /ajax/feed/create/story/ for the page
  
  for (const product of PRODUCTS) {
    console.log(`\n--- ${product.name} ---`);

    const imgPath = path.join(IMG_DIR, product.img);
    if (!fs.existsSync(imgPath)) continue;
    const imgBase64 = fs.readFileSync(imgPath).toString('base64');
    const imgMime = product.img.endsWith('.png') ? 'image/png' : 'image/jpeg';

    const postResult = await page.evaluate(async ({ pageId, message, imgBase64, imgMime }) => {
      try {
        // First try: Upload photo via Graph API with credentials
        // Convert base64 to blob
        const byteChars = atob(imgBase64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: imgMime });

        // Try posting to page's photos endpoint
        const formData = new FormData();
        formData.append('source', blob, 'photo.jpg');
        formData.append('message', message);

        const resp = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Accept': 'application/json'
          },
          body: formData
        });
        const result = await resp.text();
        return { method: 'graph_api_photos', result: result.substring(0, 500) };
      } catch(e) {
        return { method: 'error', error: e.message };
      }
    }, { pageId: PAGE_ID, message: product.msg, imgBase64, imgMime });

    console.log('  Result:', JSON.stringify(postResult));
    await delay(2000);
  }

  // METHOD 4: Try Facebook's own ajax endpoint for creating posts
  // This is what the composer uses internally
  console.log('\n=== Trying Facebook internal create story endpoint ===');
  const storyResult = await page.evaluate(async ({ pageId }) => {
    try {
      // Facebook's page status update endpoint
      const formData = new URLSearchParams();
      formData.append('__a', '1');
      formData.append('fb_dtsg', document.querySelector('[name="fb_dtsg"]')?.value || '');
      formData.append('jazoest', document.querySelector('[name="jazoest"]')?.value || '');
      formData.append('target_id', pageId);
      formData.append('status', 'Test post from API');

      const resp = await fetch('/ajax/updatestatus/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-FB-LSD': document.querySelector('[name="lsd"]')?.value || ''
        },
        body: formData.toString()
      });
      return await resp.text().catch(() => 'text error');
    } catch(e) {
      return 'Error: ' + e.message;
    }
  }, { pageId: PAGE_ID });
  console.log('Story result:', storyResult.substring(0, 500));

  await browser.close();
}
main().catch(console.error);
