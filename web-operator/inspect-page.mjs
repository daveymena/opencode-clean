import { chromium } from 'playwright';
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];
  
  await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await delay(5000);

  // Get html around the Foto/video button
  const fotovid = page.locator('div[aria-label="Foto/vídeo"]').first();
  const parentHtml = await fotovid.evaluate(el => {
    const parent = el.closest('[role="button"], div[role="presentation"]');
    if (!parent) return 'no parent found';
    const container = parent.parentElement;
    if (!container) return 'no container';
    const children = Array.from(container.children).slice(0, 5).map(c => {
      const aria = c.getAttribute('aria-label') || '';
      const text = (c.innerText || '').substring(0, 50);
      const tag = c.tagName;
      const cls = (c.className || '').substring(0, 30);
      return `${tag} aria="${aria}" text="${text}" class="${cls}"`;
    });
    return children.join('\n');
  }).catch(() => 'error');
  console.log('Around Foto/video:\n', parentHtml);

  // Check the inner text of nearby elements
  const fotovidText = await fotovid.evaluate(el => {
    const grandparent = el.closest('[role="region"], div[role="presentation"]');
    if (grandparent) return (grandparent.innerText || '').substring(0, 500);
    return 'no grandparent';
  }).catch(() => 'error');
  console.log('\nGrandparent text:\n', fotovidText);

  // Check all clickable areas in the main content
  const mainArea = page.locator('[role="main"]').first();
  if (await mainArea.isVisible().catch(() => false)) {
    const btns = await mainArea.locator('[role="button"]').all();
    for (const btn of btns) {
      const label = await btn.getAttribute('aria-label').catch(() => '');
      const text = (await btn.innerText().catch(() => '')).trim().substring(0, 40);
      if (label || text) {
        console.log(`Main btn: "${label || text}"`);
      }
    }
  }

  await browser.close();
}
main().catch(console.error);
