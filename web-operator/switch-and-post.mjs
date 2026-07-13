import { chromium } from 'playwright';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const PAGE_ID = '61591838792522';
const PAGE_URL = `https://www.facebook.com/profile.php?id=${PAGE_ID}`;

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // Go to page
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(5000);

  // Click "Cambiar" to switch to page profile
  const cambiarBtns = page.locator('span:has-text("Cambiar")');
  const count = await cambiarBtns.count();
  console.log(`Found ${count} Cambiar buttons`);

  // Click the one that says "Cambia a la página de VentasPro..."
  const cambiarText = page.locator('text=Cambia a la página').first();
  if (await cambiarText.isVisible().catch(() => false)) {
    await cambiarText.click();
    console.log('Cambiar clicked for page switch');
    await delay(5000);
    console.log('URL after:', page.url());
  }

  // Now try posting
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(5000);
  console.log('URL:', page.url());

  // Check for composer
  const composer = page.locator('[role="textbox"], div[aria-label*="publicación"], [contenteditable="true"]').first();
  if (await composer.isVisible().catch(() => false)) {
    console.log('Composer found!');
    await composer.click();
    await delay(2000);
    await composer.fill('🎨 CURSOS DISEÑO GRÁFICO\n\nPhotoshop, Illustrator, InDesign y Corel de básico a experto.\n• 45 secciones | 420 clases | 65h de contenido\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF\n• Desde $20,000 COP\n\n📲 Escríbenos para más información.');
    await delay(1000);

    const publish = page.locator('div[aria-label="Publicar"]').first();
    if (await publish.isVisible().catch(() => false)) {
      await publish.click();
      console.log('Post published!');
      await delay(3000);
    } else {
      console.log('Publish button not found');
    }
  } else {
    console.log('No composer found');
    // Take screenshot to debug
    const btns = await page.locator('[role="button"]:visible').all();
    console.log('Visible buttons:');
    const seen = new Set();
    for (const btn of btns) {
      const t = await btn.innerText().catch(() => '');
      if (t && !seen.has(t)) { seen.add(t); console.log(`  "${t.substring(0, 60)}"`); }
    }
  }

  await page.screenshot({ path: 'after-switch.png' });
  await browser.close();
}
main().catch(console.error);
