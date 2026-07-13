import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await delay(5000);

  // Open composer
  await page.locator('div[role="button"]:has-text("¿Qué estás pensando?")').first().click();
  await delay(4000);

  // Type text
  const tb = page.locator('[contenteditable="true"]').first();
  await tb.focus();
  await delay(500);
  await tb.fill('🎨 DISEÑO GRÁFICO - Test post\n\nThis is a test post to debug the publish button.');
  await delay(2000);

  // Upload image
  const imgPath = 'C:\\Users\\ADMIN\\Downloads\\OpenCode-Limpio\\web-operator\\fb-images\\products-correct\\diseno-grafico.jpg';
  const fcPromise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
  await page.locator('div[aria-label="Foto/vídeo"]').first().click({ force: true }).catch(() => {});
  await delay(2000);
  const fc = await fcPromise;
  if (fc) { await fc.setFiles(imgPath); console.log('Uploaded'); await delay(10000); }

  // Click Siguiente
  const sig = page.locator('div[aria-label="Siguiente"]').first();
  if (await sig.isVisible().catch(() => false)) {
    await sig.click(); await delay(4000);
  }

  // DEBUG: search for ALL elements with text containing "Publicar"
  console.log('\n=== Searching for "Publicar" in all elements ===');
  const allPublicar = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, 4, null, false);
    const results = [];
    let node;
    while (node = walker.nextNode()) {
      const text = (node.textContent || '').trim();
      if (text.includes('Publicar') && text.length < 50) {
        const rect = node.getBoundingClientRect();
        const parent = node.parentElement?.tagName || '';
        const role = node.getAttribute?.('role') || '';
        const aria = node.getAttribute?.('aria-label') || '';
        results.push({
          tag: node.tagName,
          text: text.substring(0, 40),
          role,
          aria,
          parent,
          visible: rect.width > 0 && rect.height > 0,
          rect: `${rect.x},${rect.y},${rect.width}x${rect.height}`
        });
      }
    }
    return results;
  }).catch(() => []);

  for (const r of allPublicar) {
    console.log(`  [${r.tag}] role=${r.role} aria="${r.aria}" visible=${r.visible} rect=${r.rect} text="${r.text}"`);
  }

  // Also look specifically for buttons
  console.log('\n=== All buttons with "Publicar" text ===');
  const pubBtns = await page.locator('[role="button"]:has-text("Publicar")').all();
  for (const btn of pubBtns) {
    const v = await btn.isVisible().catch(() => false);
    const aria = await btn.getAttribute('aria-label').catch(() => '');
    const text = (await btn.innerText().catch(() => '')).trim().substring(0, 40);
    const rect = await btn.boundingBox().catch(() => null);
    console.log(`  visible=${v} aria="${aria}" text="${text}" box=${JSON.stringify(rect)}`);
  }

  await browser.close();
}
main().catch(console.error);
