import { chromium } from 'playwright';
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(5000);

  console.log('Page title:', await page.title().catch(() => ''));
  console.log('URL:', page.url());

  // Dump aria labels of major buttons
  const btns = await page.locator('[role="button"]').all();
  let count = 0;
  for (const btn of btns) {
    const label = await btn.getAttribute('aria-label').catch(() => '');
    const text = (await btn.innerText().catch(() => '')).trim().substring(0, 60);
    if (label || text) {
      console.log(++count + ':', JSON.stringify(label || text));
    }
  }

  // Check for Cambiar
  const cambiar = await page.locator('text=Cambiar').all();
  console.log('\nCambiar elements:', cambiar.length);
  for (const c of cambiar) {
    console.log('  visible:', await c.isVisible().catch(() => false),
                'text:', (await c.innerText().catch(() => '')).trim().substring(0, 50));
  }

  // Check for textbox composer
  const composer = page.locator('[role="textbox"]').first();
  console.log('\nComposer visible:', await composer.isVisible().catch(() => false));
  if (await composer.isVisible().catch(() => false)) {
    console.log('Composer label:', await composer.getAttribute('aria-label').catch(() => ''));
  }

  await browser.close();
}
main().catch(console.error);
