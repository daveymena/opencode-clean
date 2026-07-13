import { chromium } from 'playwright';
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const PAGE_ID = '61591838792522';

const PRODUCTS = [
  {
    text: `🎨 CURSOS DISEÑO GRÁFICO

Photoshop, Illustrator, InDesign y Corel Draw de básico a experto.

📂 45 secciones | 420 clases | 65h de contenido
✅ Contenido Descargable MP4/PDF | Acceso Vitalicio vía Google Drive

💰 PRECIO: $60,000 COP

📲 Contáctanos para adquirir este curso.`
  },
  {
    text: `💼 MICROSOFT OFFICE

Word, PowerPoint, Access y Outlook empresarial.

📂 15 secciones | 180 clases | 35h de contenido
✅ Contenido Descargable MP4/PDF | Acceso Vitalicio vía Google Drive

💰 PRECIO: $20,000 COP

📲 Contáctanos para adquirir este curso.`
  },
  {
    text: `🌍 INGLÉS COMPLETO

Gramática, pronunciación y audios nativos (A1 a C1).

📂 12 secciones | 150 clases | 40h de contenido
✅ Contenido Descargable MP4/PDF | Acceso Vitalicio vía Google Drive

💰 PRECIO: $20,000 COP

📲 Contáctanos para adquirir este curso.`
  },
  {
    text: `📊 EXCEL AVANZADO

Tablas dinámicas, funciones avanzadas y dashboards.

📂 12 secciones | 120 clases | 25h de contenido
✅ Contenido Descargable MP4/PDF | Acceso Vitalicio vía Google Drive

💰 PRECIO: $20,000 COP

📲 Contáctanos para adquirir este curso.`
  },
  {
    text: `💻 CURSO HACKING ÉTICO

Pentesting, Kali Linux, seguridad de redes y auditoría.

📂 30 secciones | 250 clases | 40h de contenido
✅ Contenido Descargable MP4/PDF | Acceso Vitalicio vía Google Drive

💰 PRECIO: $20,000 COP

📲 Contáctanos para adquirir este curso.`
  }
];

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  await page.goto(`https://www.facebook.com/profile.php?id=${PAGE_ID}`, {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await delay(5000);

  let posted = 0;
  for (const product of PRODUCTS) {
    console.log(`\n=== ${product.text.substring(0, 40)} ===`);

    // 1. Click composer button
    const btn = page.locator('div[role="button"]:has-text("¿Qué estás pensando?")').first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      console.log('  Composer clicked');
    } else {
      const btn2 = page.locator('div[role="button"]:has-text("Comparte una idea")').first();
      if (await btn2.isVisible().catch(() => false)) {
        await btn2.click();
        console.log('  Share idea clicked');
      } else { continue; }
    }
    await delay(5000);

    // 2. Type text
    const tb = page.locator('[contenteditable="true"]').first();
    if (await tb.isVisible().catch(() => false)) {
      await tb.click({ force: true }).catch(() => tb.evaluate(el => el.focus()));
      await delay(500);
      // Clear existing text
      await tb.evaluate(el => el.innerHTML = '');
      await delay(200);
      await tb.fill(product.text);
      console.log('  Text filled');
      await delay(2000);
    } else { continue; }

    // 3. Look for "Publicar" button - but ONLY the one on the POST composer, not the comment
    // The post composer's Publicar should appear after text is entered
    
    // Wait a moment for the UI to update
    await delay(2000);

    // Find ALL visible "Publicar" buttons and click ONLY the one that's part of the composer
    const pubBtns = await page.locator('div[aria-label="Publicar"]').all();
    let clickedPublish = false;
    for (const btn of pubBtns) {
      if (await btn.isVisible().catch(() => false)) {
        const rect = await btn.boundingBox().catch(() => null);
        const text = (await btn.innerText().catch(() => '')).trim();
        console.log(`  Found Publicar: "${text}" x=${rect?.x} y=${rect?.y}`);
        
        // Click the FIRST visible one (the post composer's one should be at the top of the page)
        if (!clickedPublish) {
          await btn.click({ force: true, timeout: 5000 }).catch(e => {
            console.log(`  Click failed: ${e.message}`);
          });
          clickedPublish = true;
          console.log('  ✅ Publicar clicked');
        }
      }
    }

    // Also try finding by text
    if (!clickedPublish) {
      const btns = await page.locator('[role="button"]:has-text("Publicar")').all();
      for (const btn of btns) {
        if (await btn.isVisible().catch(() => false)) {
          const aria = await btn.getAttribute('aria-label').catch(() => '');
          const text = (await btn.innerText().catch(() => '')).trim();
          // Skip "Publicar comentario" - find the actual "Publicar"
          if (aria === 'Publicar' || text === 'Publicar') {
            await btn.click({ force: true, timeout: 5000 }).catch(() => {});
            clickedPublish = true;
            console.log('  ✅ Publicar (exact match) clicked');
            break;
          }
        }
      }
    }

    if (clickedPublish) {
      posted++;
      await delay(5000);
    } else {
      console.log('  ❌ No Publicar button found');
      console.log('  Debugging: checking for composer state...');
      const textboxExists = await page.locator('[contenteditable="true"]').first().isVisible().catch(() => false);
      console.log(`  Textbox still visible: ${textboxExists}`);
    }

    // Reload page
    await page.goto(`https://www.facebook.com/profile.php?id=${PAGE_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await delay(5000);
  }

  // Verify posts
  await page.evaluate(() => window.scrollBy(0, 3000));
  await delay(3000);
  await page.evaluate(() => window.scrollBy(0, 3000));
  await delay(3000);

  const text = await page.innerText('body').catch(() => '');
  console.log('\n=== Verification ===');
  for (const kw of ['Photoshop, Illustrator', 'Word, PowerPoint', 'Gramática', 'Tablas dinámicas', 'Pentesting']) {
    if (text.includes(kw)) console.log(`✅ "${kw}"`);
    else console.log(`❌ "${kw}" not found`);
  }

  await browser.close();
}
main().catch(console.error);
