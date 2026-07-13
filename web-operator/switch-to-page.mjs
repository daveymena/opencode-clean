import { chromium } from 'playwright';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // Go to the VentasPro page
  await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(5000);

  // Click Cambiar (profile switcher)
  const cambiar = page.locator('div[aria-label="Cambiar"]').first();
  if (await cambiar.isVisible().catch(() => false)) {
    await cambiar.click();
    console.log('Cambiar clicked');
    await delay(3000);

    // What's in the dialog?
    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.isVisible().catch(() => false)) {
      console.log('Dialog text:');
      console.log((await dialog.innerText().catch(() => '')).substring(0, 500));

      // Find all clickable items in dialog
      const items = await dialog.locator('[role="button"], [role="link"]').all();
      console.log(`Items in dialog: ${items.length}`);
      for (const item of items) {
        const text = (await item.innerText().catch(() => '')).trim();
        const label = await item.getAttribute('aria-label').catch(() => '');
        if (text || label) {
          console.log(`  "${text || label}"`);
        }
      }

      // Click on the VentasPro option
      const ventasOption = dialog.locator('text=VentasPro - Cursos Digitales').first();
      if (await ventasOption.isVisible().catch(() => false)) {
        await ventasOption.click();
        console.log('VentasPro selected');
        await delay(5000);
        console.log('URL after switch:', page.url());

        // Now check for composer
        await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
          waitUntil: 'domcontentloaded', timeout: 15000
        });
        await delay(5000);
        console.log('Page URL:', page.url());

        // Check for status box or composer
        const statusBox = page.locator('[aria-label*="Qué estás pensando"], [aria-label*="What\'s on your mind"], [role="textbox"]').first();
        console.log('Status box visible:', await statusBox.isVisible().catch(() => false));

        if (await statusBox.isVisible().catch(() => false)) {
          console.log('CAN POST! Ready to publish content.');
          await statusBox.click();
          await delay(2000);
          await statusBox.fill('🎨 CURSOS DISEÑO GRÁFICO\n\nPhotoshop, Illustrator, InDesign y Corel de básico a experto.\n• 45 secciones | 420 clases | 65h\n• Acceso vitalicio vía Google Drive\n• Contenido descargable MP4/PDF\n• Desde $20,000 COP\n\n📲 Contáctanos para más info.');
          await delay(1000);

          const publish = page.locator('div[aria-label="Publicar"]').first();
          if (await publish.isVisible().catch(() => false)) {
            await publish.click();
            console.log('POST PUBLISHED!');
            await delay(3000);
          }
        }
      }
    }
  }

  await page.screenshot({ path: 'switched-page.png' });
  console.log('Screenshot saved');
  await browser.close();
}
main().catch(console.error);
