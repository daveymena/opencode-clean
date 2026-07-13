import { chromium } from 'playwright';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  const pageUrl = 'https://www.facebook.com/profile.php?id=61591838792522';
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(5000);

  // Get ALL aria-labels and visible text
  const allLabels = await page.locator('[aria-label]').all();
  console.log('=== ARIA LABELS ===');
  const labelSet = new Set();
  for (const el of allLabels) {
    const label = await el.getAttribute('aria-label').catch(() => '');
    if (label && !labelSet.has(label) && label.length < 80) {
      labelSet.add(label);
      const tag = await el.evaluate(e => e.tagName).catch(() => '');
      const role = await el.getAttribute('role').catch(() => '');
      console.log(`  [${tag}] role=${role} label="${label}"`);
    }
  }

  console.log('\n=== VISIBLE BUTTON TEXT ===');
  const buttons = await page.locator('[role="button"]').all();
  const btnSet = new Set();
  for (const btn of buttons) {
    const text = (await btn.innerText().catch(() => '')).trim();
    const label = await btn.getAttribute('aria-label').catch(() => '');
    if ((text || label) && text.length < 60) {
      const key = text || label;
      if (!btnSet.has(key)) {
        btnSet.add(key);
        console.log(`  "${key}"`);
      }
    }
  }

  console.log('\n=== SPANS WITH TEXT ===');
  const spans = await page.locator('span:visible').all();
  const spanSet = new Set();
  for (const sp of spans) {
    const text = (await sp.innerText().catch(() => '')).trim();
    if (text && text.length < 60 && !spanSet.has(text) && !text.includes('\n')) {
      spanSet.add(text);
      // Only show relevant ones
      if (text.includes('Ventas') || text.includes('Editar') || text.includes('Foto') || text.includes('Portada') || text.includes('Añadir') || text.includes('Botón') || text.includes('Descripción') || text.includes('About') || text.includes('info') || text.includes('page')) {
        console.log(`  "${text}"`);
      }
    }
  }

  // Look for file inputs
  const fileInputs = await page.locator('input[type="file"]').all();
  console.log(`\n=== FILE INPUTS: ${fileInputs.length} ===`);

  // Look for contenteditable divs
  const editable = await page.locator('[contenteditable="true"]').all();
  console.log(`\nEDITABLE DIVS: ${editable.length}`);

  // Take screenshot
  await page.screenshot({ path: 'ventaspro-page.png' });
  console.log('\nScreenshot saved');

  await browser.close();
}
main().catch(console.error);
