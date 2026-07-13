import { chromium } from 'playwright';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(5000);

  // Click Cambiar
  const cambiar = page.locator('div[aria-label="Cambiar"]').first();
  console.log('Cambiar visible:', await cambiar.isVisible().catch(() => false));
  await cambiar.click();
  console.log('Clicked. Waiting 4s...');
  await delay(4000);

  // Get ALL visible elements with text
  const allSpans = await page.locator('span:visible').all();
  console.log('\nAll visible spans with text:');
  for (const s of allSpans) {
    const text = (await s.innerText().catch(() => '')).trim();
    if (text && text.length < 60) {
      console.log(`  "${text}"`);
    }
  }

  // Get ALL role elements that appeared
  const allRoles = await page.locator('[role]:visible').all();
  console.log('\nAll visible role elements:');
  const seen = new Set();
  for (const r of allRoles) {
    const role = await r.getAttribute('role').catch(() => '');
    const text = (await r.innerText().catch(() => '')).trim().substring(0, 50);
    const label = await r.getAttribute('aria-label').catch(() => '');
    const key = text || label;
    if (key && !seen.has(key)) {
      seen.add(key);
      console.log(`  role=${role} label="${label}" text="${text}"`);
    }
  }

  // Look for ANY file input
  const fileInputs = await page.locator('input[type="file"]').all();
  console.log(`\nFile inputs: ${fileInputs.length}`);

  // Look for input type=file in entire document
  const allInputs = await page.locator('input').all();
  console.log(`Total inputs: ${allInputs.length}`);
  for (const inp of allInputs) {
    const type = await inp.getAttribute('type').catch(() => '');
    const id = await inp.getAttribute('id').catch(() => '');
    if (type === 'file') {
      console.log(`  FILE INPUT found: id="${id}"`);
    }
  }

  await page.screenshot({ path: 'after-cambiar.png' });
  console.log('\nScreenshot saved');
  await browser.close();
}
main().catch(console.error);
