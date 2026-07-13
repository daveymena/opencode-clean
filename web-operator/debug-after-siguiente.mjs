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
  await delay(5000);

  // Type text
  const tb = page.locator('[contenteditable="true"]').first();
  await tb.focus();
  await delay(500);
  await tb.fill('🎨 DISEÑO GRÁFICO\n\nPhotoshop, Illustrator, InDesign y Corel Draw.');
  await delay(2000);

  // Upload image
  const imgPath = 'C:\\Users\\ADMIN\\Downloads\\OpenCode-Limpio\\web-operator\\fb-images\\products-correct\\diseno-grafico.jpg';
  const fcPromise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
  await page.locator('div[aria-label="Foto/vídeo"]').first().click({ force: true }).catch(() => {});
  await delay(2000);
  const fc = await fcPromise;
  if (fc) { await fc.setFiles(imgPath); console.log('Uploaded'); await delay(10000); }

  // Click Siguiente
  const sigBtn = page.locator('div[aria-label="Siguiente"]').first();
  if (await sigBtn.isVisible().catch(() => false)) {
    console.log('Siguiente found, clicking...');
    await sigBtn.click();
    await delay(5000);
  } else {
    console.log('No Siguiente button');
  }

  // Now check the ENTIRE page for all visible buttons
  console.log('\n=== ALL VISIBLE BUTTONS AFTER SIGUIENTE ===');
  const btns = await page.locator('[role="button"]').all();
  for (const btn of btns) {
    if (await btn.isVisible().catch(() => false)) {
      const aria = await btn.getAttribute('aria-label').catch(() => '');
      const text = (await btn.innerText().catch(() => '')).trim().substring(0, 50);
      if (aria || text) {
        const rect = await btn.boundingBox().catch(() => null);
        console.log(`  "${aria || text}" x=${rect?.x} y=${rect?.y}`);
      }
    }
  }

  // Also print the first 500 chars of the main area
  const main = page.locator('[role="main"]').first();
  if (await main.isVisible().catch(() => false)) {
    console.log('\n=== MAIN AREA TEXT ===');
    console.log((await main.innerText().catch(() => '')).substring(0, 1000));
  }

  await page.screenshot({ path: 'after-siguiente.png' }).catch(() => {});
  await browser.close();
}
main().catch(console.error);
