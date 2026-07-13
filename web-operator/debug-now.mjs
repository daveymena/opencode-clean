import { chromium } from 'playwright';
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];
  console.log('URL:', page.url());

  await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await delay(5000);

  console.log('Final URL:', page.url());

  // Dump ALL elements with aria-label containing common composer texts
  const allAria = ['¿Qué estás pensando?', 'Comparte una idea', 'Crear publicación', 'Foto/vídeo', 'Vídeo en directo', 'Escribe'];
  for (const aria of allAria) {
    const els = await page.locator(`[aria-label*="${aria}"]`).all();
    for (const el of els) {
      const visible = await el.isVisible().catch(() => false);
      const tag = await el.evaluate(el => el.tagName + '.' + (el.className || '').substring(0,30)).catch(() => '');
      console.log(`"${aria}": visible=${visible} tag=${tag}`);
    }
  }

  // Check roles
  const roles = ['textbox', 'combobox', 'dialog'];
  for (const role of roles) {
    const els = await page.locator(`[role="${role}"]`).all();
    for (const el of els) {
      const label = await el.getAttribute('aria-label').catch(() => '');
      const visible = await el.isVisible().catch(() => false);
      if (label) {
        console.log(`role=${role} label="${label}" visible=${visible}`);
      }
    }
  }

  await page.screenshot({ path: 'debug-now.png' }).catch(() => {});
  console.log('\nScreenshot saved');
  await browser.close();
}
main().catch(console.error);
