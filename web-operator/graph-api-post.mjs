import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const IMG_DIR = 'C:\\Users\\ADMIN\\Downloads\\OpenCode-Limpio\\web-operator\\fb-images\\products-correct';
const PAGE_ID = '61591838792522';

const PRODUCTS = [
  {
    name: '🎨 CURSOS DISEÑO GRÁFICO',
    desc: 'Photoshop, Illustrator, InDesign y Corel Draw de básico a experto.',
    contenido: '45 secciones | 420 clases | 65h de contenido',
    precio: '$60,000 COP',
    beneficios: [
      'Contenido Virtual y Descargable (MP4/PDF)',
      'Acceso Permanente vía Google Drive',
      'Sin Clases en Vivo / Sin Grupos',
      'Estudio Autónomo a tu propio ritmo'
    ],
    img: 'diseno-grafico.jpg'
  },
  {
    name: '💼 MICROSOFT OFFICE',
    desc: 'Word, PowerPoint, Access y Outlook empresarial.',
    contenido: '15 secciones | 180 clases | 35h de contenido',
    precio: '$20,000 COP',
    beneficios: [
      'Contenido Virtual y Descargable (MP4/PDF)',
      'Acceso Permanente vía Google Drive',
      'Sin Clases en Vivo / Sin Grupos',
      'Estudio Autónomo a tu propio ritmo'
    ],
    img: 'office.jpg'
  },
  {
    name: '🌍 INGLÉS COMPLETO',
    desc: 'Gramática, pronunciación y audios nativos (A1 a C1).',
    contenido: '12 secciones | 150 clases | 40h de contenido',
    precio: '$20,000 COP',
    beneficios: [
      'Contenido Virtual y Descargable (MP4/PDF)',
      'Acceso Permanente vía Google Drive',
      'Sin Clases en Vivo / Sin Grupos',
      'Estudio Autónomo a tu propio ritmo'
    ],
    img: 'ingles.jpg'
  },
  {
    name: '📊 EXCEL AVANZADO',
    desc: 'Tablas dinámicas, funciones avanzadas y dashboards.',
    contenido: '12 secciones | 120 clases | 25h de contenido',
    precio: '$20,000 COP',
    beneficios: [
      'Contenido Virtual y Descargable (MP4/PDF)',
      'Acceso Permanente vía Google Drive',
      'Sin Clases en Vivo / Sin Grupos',
      'Estudio Autónomo a tu propio ritmo'
    ],
    img: 'excel.jpg'
  },
  {
    name: '💻 CURSO HACKING ÉTICO',
    desc: 'Pentesting, Kali Linux, seguridad de redes y auditoría.',
    contenido: '30 secciones | 250 clases | 40h de contenido',
    precio: '$20,000 COP',
    beneficios: [
      'Contenido Virtual y Descargable (MP4/PDF)',
      'Acceso Permanente vía Google Drive',
      'Sin Clases en Vivo / Sin Grupos',
      'Estudio Autónomo a tu propio ritmo'
    ],
    img: 'hacking.jpg'
  }
];

async function getAccessToken(page) {
  // Try to extract access token from Facebook's cookies/JS
  const token = await page.evaluate(() => {
    try {
      // Check if there's a stored token
      const cookies = document.cookie.split(';').map(c => c.trim());
      // Look for Facebook access token in various places
      if (window.__blob) return '';
      return '';
    } catch(e) { return ''; }
  });
  return token;
}

async function uploadPhotoViaAPI(page, imgPath, message) {
  // Read image as base64
  const imgBase64 = fs.readFileSync(imgPath, { encoding: 'base64' });
  const ext = path.extname(imgPath).replace('.', '');

  // Use fetch to upload via Facebook's internal API
  const result = await page.evaluate(async ({ pageId, imgBase64, ext, message }) => {
    // First, get the access token from the page's FB object
    // Facebook stores access tokens in window.FB or via the graph API
    let token = '';
    
    // Try to get from cookies
    const cookies = document.cookie.split(';').map(c => c.trim());
    for (const c of cookies) {
      if (c.startsWith('xs=')) {
        // This is the session cookie, can't use directly for API
      }
    }
    
    // Try using the internal Facebook API
    try {
      const formData = new FormData();
      // Convert base64 to blob
      const byteChars = atob(imgBase64);
      const byteArrays = [];
      for (let offset = 0; offset < byteChars.length; offset += 512) {
        const slice = byteChars.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        byteArrays.push(new Uint8Array(byteNumbers));
      }
      const blob = new Blob(byteArrays, { type: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
      formData.append('source', blob, `photo.${ext}`);
      formData.append('message', message);
      
      // Try to post directly using Facebook's API via the page's access
      const response = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      return await response.json();
    } catch (e) {
      return { error: e.message };
    }
  }, { pageId: PAGE_ID, imgBase64, ext, message });

  return result;
}

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  // First, let's see what cookies/access we have
  const cookies = await ctx.cookies();
  console.log('Cookies:');
  for (const c of cookies) {
    if (c.name.includes('token') || c.name.includes('access') || c.name === 'c_user' || c.name === 'xs') {
      console.log(`  ${c.name}: ${c.value.substring(0, 20)}...`);
    }
  }

  // Check if there's a FB access token in localStorage
  const fbToken = await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    const fbKeys = keys.filter(k => k.toLowerCase().includes('fb') || k.toLowerCase().includes('facebook') || k.toLowerCase().includes('token'));
    const results = {};
    for (const k of fbKeys) {
      results[k] = localStorage.getItem(k).substring(0, 100);
    }
    return results;
  }).catch(() => ({}));
  console.log('\nFB localStorage keys:', JSON.stringify(Object.keys(fbToken).slice(0, 5)));

  // Try a simpler approach: use Facebook's own AJAX posting endpoint
  // Facebook uses a specific internal API for creating feed posts
  // We can intercept this from the browser
  
  // Navigate to the page and try to use the Facebook composer's internal mechanism
  await page.goto(`https://www.facebook.com/profile.php?id=${PAGE_ID}`, {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await delay(5000);

  // Let's try the simplest possible approach:
  // Navigate to a direct post creation URL
  // Facebook has: https://www.facebook.com/sharer/sharer.php?u=... 
  // But for pages, maybe we can use a composer URL
  
  // Actually, let's just try posting via Business Suite which has a proper post interface
  await page.goto(`https://business.facebook.com/latest/creator_studio/?business_id=${PAGE_ID}`, {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await delay(5000);
  console.log('Business Suite URL:', page.url());

  // Look for "Crear publicación" or similar
  const crearPub = page.locator('text=Crear publicación').first();
  console.log('Crear publicación visible:', await crearPub.isVisible().catch(() => false));

  if (await crearPub.isVisible().catch(() => false)) {
    await crearPub.click();
    console.log('Clicked Crear publicación');
    await delay(5000);

    // Find text area
    const textArea = page.locator('[role="textbox"], [contenteditable="true"]').first();
    if (await textArea.isVisible().catch(() => false)) {
      console.log('Text area found');
      await textArea.click();
      await delay(500);
      await textArea.fill('Test post via Business Suite');
      await delay(1000);
    }
  }

  await page.screenshot({ path: 'business-suite.png' }).catch(() => {});
  console.log('\nDone');
  await browser.close();
}
main().catch(console.error);
