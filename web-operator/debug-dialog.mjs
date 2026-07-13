import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const PROD_DIR = 'C:\\Users\\ADMIN\\Videos\\Agent-Sales-Bot\\artifacts\\ventas-pro\\public\\images\\products';

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await delay(5000);

  // Click composer
  const pensarBtn = page.locator('div[role="button"]:has-text("¿Qué estás pensando?")').first();
  if (await pensarBtn.isVisible().catch(() => false)) {
    await pensarBtn.click();
    console.log('Composer clicked');
  } else {
    const ideaBtn = page.locator('div[role="button"]:has-text("Comparte una idea")').first();
    if (await ideaBtn.isVisible().catch(() => false)) {
      await ideaBtn.click();
      console.log('Share idea clicked');
    } else {
      console.log('No composer');
      await browser.close();
      return;
    }
  }
  await delay(4000);

  // Type text
  const textbox = page.locator('[role="dialog"] [contenteditable="true"]').first();
  if (await textbox.isVisible().catch(() => false)) {
    await textbox.click();
    await delay(500);
    await textbox.fill('🎨 Diseño Gráfico - Prueba\n\nCurso completo de Photoshop, Illustrator y más.');
    console.log('Text entered');
  }
  await delay(1000);

  // Upload image
  const imgPath = path.join(PROD_DIR, '41.jpg');
  const fcPromise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
  const fotoBtn = page.locator('[role="dialog"] div[aria-label="Foto/vídeo"]').first();
  if (await fotoBtn.isVisible().catch(() => false)) {
    await fotoBtn.click();
    console.log('Foto/video clicked');
  }
  await delay(2000);

  const fc = await fcPromise;
  if (fc) {
    await fc.setFiles(imgPath);
    console.log('File set, waiting for preview...');
    await delay(10000);
  }

  // NOW DEBUG THE DIALOG
  const dialog = page.locator('[role="dialog"]').first();
  if (await dialog.isVisible().catch(() => false)) {
    console.log('\n=== DIALOG CONTENTS ===');
    console.log('Dialog HTML structure (first 3000 chars):');
    const html = await dialog.evaluate(el => el.innerHTML.substring(0, 3000)).catch(() => '');
    console.log(html);

    console.log('\n=== ALL BUTTONS IN DIALOG ===');
    const btns = await dialog.locator('[role="button"]').all();
    for (const b of btns) {
      const aria = await b.getAttribute('aria-label').catch(() => '');
      const text = (await b.innerText().catch(() => '')).trim().substring(0, 80);
      const tag = await b.evaluate(el => el.tagName).catch(() => '');
      const cls = await b.evaluate(el => (el.className || '').substring(0, 40)).catch(() => '');
      const visible = await b.isVisible().catch(() => false);
      const rect = await b.boundingBox().catch(() => null);
      console.log(`  tag=${tag} aria="${aria}" text="${text}" visible=${visible} box=${JSON.stringify(rect)}`);
    }

    console.log('\n=== ALL INPUTS IN DIALOG ===');
    const inputs = await dialog.locator('input').all();
    for (const inp of inputs) {
      const type = await inp.getAttribute('type').catch(() => '');
      const aria = await inp.getAttribute('aria-label').catch(() => '');
      const visible = await inp.isVisible().catch(() => false);
      console.log(`  type=${type} aria="${aria}" visible=${visible}`);
    }

    console.log('\n=== LOOKING FOR "Publicar" ===');
    // Search for "Publicar" in the entire dialog
    const publicarEls = await dialog.locator(':has-text("Publicar")').all();
    for (const el of publicarEls) {
      const visible = await el.isVisible().catch(() => false);
      const role = await el.getAttribute('role').catch(() => '');
      const tag = await el.evaluate(el => el.tagName).catch(() => '');
      const text = (await el.innerText().catch(() => '')).trim().substring(0, 50);
      const cls = await el.evaluate(el => (el.className || '').substring(0, 40)).catch(() => '');
      console.log(`  tag=${tag} role="${role}" text="${text}" visible=${visible} class=${cls}`);
    }
  } else {
    console.log('No dialog visible');
    console.log('Page text (first 500):', (await page.innerText('body').catch(() => '')).replace(/\s+/g, ' ').substring(0, 500));
  }

  await browser.close();
}
main().catch(console.error);
