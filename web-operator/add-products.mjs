import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const IMG_DIR = path.resolve('./fb-images');
const PROD_IMG_DIR = 'C:\\Users\\ADMIN\\Videos\\Agent-Sales-Bot\\artifacts\\ventas-pro\\public\\images\\products';
const CATALOG_PATH = 'C:\\Users\\ADMIN\\Videos\\Agent-Sales-Bot\\CATALOGO_FINAL_81_ULTIMATE.json';

// Products to add (first 5 key products)
const FEATURED_PRODUCTS = [
  { id: 'MP-001', title: 'Cursos Diseño Gráfico', desc: 'Photoshop, Illustrator, InDesign y Corel de básico a experto. 45 secciones, 420 clases, 65h de contenido.', price: '60000' },
  { id: 'MP-002', title: 'Office Completo', desc: 'Word, PowerPoint, Access y Outlook empresarial. 15 secciones, 180 clases, 35h.', price: '20000' },
  { id: 'MP-003', title: 'Inglés Completo', desc: 'Gramática, pronunciación y audios nativos. Nivel A1 a C1. 12 secciones, 150 clases, 40h.', price: '20000' },
  { id: 'MP-004', title: 'Excel Avanzado', desc: 'Tablas dinámicas, funciones avanzadas y dashboards. 12 secciones, 120 clases, 25h.', price: '20000' },
  { id: 'MP-005', title: 'Hacking Ético', desc: 'Pentesting, Kali Linux, seguridad de redes y auditoría. 30 secciones, 250 clases, 40h.', price: '20000' },
];

async function injectAndUpload(page, filePath) {
  const fcPromise = page.waitForEvent('filechooser', { timeout: 15000 }).catch(() => null);
  await page.evaluate(() => {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.style.position = 'fixed'; input.style.top = '0'; input.style.left = '0';
      input.style.opacity = '0.01'; input.style.zIndex = '99999';
      document.body.appendChild(input);
      input.addEventListener('click', () => resolve('ok'), { once: true });
      input.click();
      setTimeout(() => resolve('timeout'), 5000);
    });
  });
  const fc = await fcPromise;
  if (fc) { await fc.setFiles(filePath); return true; }
  return false;
}

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // First copy product images to local accessible dir
  console.log('Copiando imágenes de productos...');
  const localProdDir = path.join(IMG_DIR, 'products');
  if (!fs.existsSync(localProdDir)) fs.mkdirSync(localProdDir);

  const prodFiles = fs.readdirSync(PROD_IMG_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
  console.log(`Product images available: ${prodFiles.length}`);

  // Copy first 10 images
  let imgMap = {};
  for (let i = 0; i < Math.min(prodFiles.length, 10); i++) {
    const src = path.join(PROD_IMG_DIR, prodFiles[i]);
    const dest = path.join(localProdDir, prodFiles[i]);
    if (fs.statSync(src).size > 500) {
      fs.copyFileSync(src, dest);
      imgMap[prodFiles[i]] = dest;
    }
  }
  console.log(`Copied ${Object.keys(imgMap).length} product images`);

  // 1. Upload product photos to Facebook page
  console.log('\n[1] Subiendo fotos de productos a la página...');
  await page.goto(`https://www.facebook.com/profile.php?id=61591838792522&sk=photos`, {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(4000);

  // Look for "Add Photos" / upload button
  // Try the photo upload URL
  await page.goto(`https://www.facebook.com/photos/upload/?profile_id=61591838792522`, {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(4000);

  // Upload first product image
  const firstImages = Object.values(imgMap).slice(0, 3);
  for (let i = 0; i < firstImages.length; i++) {
    console.log(`  Uploading image ${i+1}...`);
    const success = await injectAndUpload(page, firstImages[i]);
    console.log(`  Uploaded: ${success}`);
    if (success) {
      await delay(5000);
      // Click Post / Save
      const postBtn = page.locator('div[aria-label="Publicar"]').first();
      if (await postBtn.isVisible().catch(() => false)) {
        await postBtn.click();
      } else {
        await page.keyboard.press('Enter');
      }
      await delay(3000);
    }
  }

  // 2. Post about each product via Business Suite
  console.log('\n[2] Publicando productos en la página...');
  for (let i = 0; i < FEATURED_PRODUCTS.length; i++) {
    const prod = FEATURED_PRODUCTS[i];
    console.log(`\n  Posting: ${prod.title}...`);

    // Go to Business Suite
    await page.goto('https://business.facebook.com/latest/home?asset_id=1278583508663384', {
      waitUntil: 'domcontentloaded', timeout: 20000
    });
    await delay(5000);

    // Click "Crear publicación"
    const createPostBtn = page.locator('span:has-text("Crear publicación")').first();
    if (await createPostBtn.isVisible().catch(() => false)) {
      await createPostBtn.click();
      console.log('  Crear publicación clicked');
      await delay(5000);

      // Look for the post composer in the dialog
      const postArea = page.locator('[role="textbox"], [contenteditable="true"]:visible, div[aria-label*="publicación"]').first();
      if (await postArea.isVisible().catch(() => false)) {
        await postArea.click();
        await delay(500);
        await postArea.fill(prod.title + '\n\n' + prod.desc + '\n\n💰 Precio: $' + prod.price + ' COP\n📲 Contáctanos para más información.');
        console.log('  Post content written');
        await delay(1000);

        // Click publish
        const publishBtn = page.locator('div[aria-label="Publicar"]').first();
        if (await publishBtn.isVisible().catch(() => false)) {
          await publishBtn.click();
          console.log('  Post published!');
          await delay(3000);
        } else {
          console.log('  Publish button not found');
        }
      } else {
        console.log('  Post area not found');
      }
    } else {
      console.log('  Crear publicación not found');
    }
  }

  // 3. Check Commerce Manager for catalog
  console.log('\n[3] Verificando Commerce Manager...');
  await page.goto('https://www.facebook.com/commerce_manager/', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(5000);

  // Click "Añadir productos"
  const addProducts = page.locator('span:has-text("Añadir productos")').first();
  if (await addProducts.isVisible().catch(() => false)) {
    await addProducts.click();
    console.log('  Añadir productos clicked');
    await delay(5000);
    console.log('  URL:', page.url());
    const t = await page.innerText('body').catch(() => '');
    console.log(t.replace(/\s+/g, ' ').trim().substring(0, 500));
  }

  await page.screenshot({ path: 'products-done.png' });
  console.log('\nDone!');
  await browser.close();
}
main().catch(console.error);
