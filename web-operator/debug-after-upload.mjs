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
  await tb.click({ force: true }).catch(() => tb.evaluate(el => el.focus()));
  await delay(500);
  await tb.fill('🔒 Prueba de Hacking Ético\n\nCiberseguridad, pentesting y Kali Linux.\n\n#HackingÉtico');
  await delay(2000);

  // Upload image
  const imgPath = 'C:\\Users\\ADMIN\\Downloads\\OpenCode-Limpio\\web-operator\\fb-images\\products-correct\\hacking.jpg';
  const fcPromise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
  await page.locator('div[aria-label="Foto/vídeo"]').first().click({ force: true }).catch(() => {});
  await delay(2000);

  const fc = await fcPromise;
  if (fc) {
    await fc.setFiles(imgPath);
    console.log('File uploaded, waiting...');
    await delay(10000);
  } else {
    console.log('Filechooser failed');
    await browser.close();
    return;
  }

  // --- DEBUG: dump all aria labels and texts ---
  console.log('\n=== ALL VISIBLE BUTTONS ===');
  const allBtns = await page.locator('[role="button"]').all();
  for (const b of allBtns) {
    if (await b.isVisible().catch(() => false)) {
      const aria = await b.getAttribute('aria-label').catch(() => '');
      const text = (await b.innerText().catch(() => '')).trim().substring(0, 60);
      if (aria || text) {
        console.log(`  "${aria || text}"`);
      }
    }
  }

  console.log('\n=== SPANS WITH "Publicar" ===');
  const publicarSpans = await page.locator('span:has-text("Publicar")').all();
  for (const s of publicarSpans) {
    const visible = await s.isVisible().catch(() => false);
    const parent = await s.evaluate(el => el.parentElement?.getAttribute('role') || el.parentElement?.tagName || '').catch(() => '');
    const txt = (await s.innerText().catch(() => '')).trim();
    const rect = await s.boundingBox().catch(() => null);
    console.log(`  visible=${visible} text="${txt}" parent=${parent} box=${JSON.stringify(rect)}`);
  }

  console.log('\n=== DIVS WITH "Publicar" ===');
  const publicarDivs = await page.locator('div:has-text("Publicar")').all();
  for (const d of publicarDivs) {
    const visible = await d.isVisible().catch(() => false);
    const role = await d.getAttribute('role').catch(() => '');
    const aria = await d.getAttribute('aria-label').catch(() => '');
    const txt = (await d.innerText().catch(() => '')).trim().substring(0, 80);
    if (txt) {
      const rect = await d.boundingBox().catch(() => null);
      console.log(`  visible=${visible} role="${role}" aria="${aria}" text="${txt.substring(0,50)}" box=${JSON.stringify(rect)}`);
    }
  }

  // Try pressing Tab then Enter to submit
  console.log('\nTrying Tab + Enter...');
  await page.keyboard.press('Tab');
  await delay(500);
  await page.keyboard.press('Enter');
  await delay(3000);

  await browser.close();
}
main().catch(console.error);
