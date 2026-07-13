import { chromium } from 'playwright';
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
    waitUntil: 'domcontentloaded', timeout: 30000
  });
  await delay(5000);

  // Check specific buttons
  const targets = ['¿Qué estás pensando?', 'Comparte una idea'];
  for (const t of targets) {
    const els = await page.locator(`:has-text("${t}")`).all();
    console.log(`\n"${t}" elements: ${els.length}`);
    for (const el of els) {
      const visible = await el.isVisible().catch(() => false);
      const tag = await el.evaluate(el => el.tagName).catch(() => '');
      const ariaLabel = await el.getAttribute('aria-label').catch(() => '');
      const role = await el.getAttribute('role').catch(() => '');
      const rect = await el.boundingBox().catch(() => null);
      console.log(`  tag=${tag} visible=${visible} role="${role}" aria="${ariaLabel}" box=${JSON.stringify(rect)}`);
      console.log(`  text="${(await el.innerText().catch(() => '')).substring(0, 50)}"`);
    }
  }

  // Also check: maybe the button is an image or has different structure
  // Check the page source for the composer area
  const mainEl = page.locator('[role="main"]').first();
  if (await mainEl.isVisible().catch(() => false)) {
    const html = await mainEl.evaluate(el => {
      // Find elements with "pensando" or "comparte" text (case-insensitive)
      const walker = document.createTreeWalker(el, 4, null, false);
      const results = [];
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent.trim();
        if (text && (text.includes('pensando') || text.includes('comparte'))) {
          results.push({
            tag: node.tagName,
            text: text.substring(0, 60),
            parentTag: node.parentElement?.tagName,
            parentRole: node.parentElement?.getAttribute('role') || ''
          });
        }
      }
      return results;
    }).catch(() => []);
    console.log('\nNodes with "pensando" or "comparte":');
    for (const r of html) {
      console.log(`  tag=${r.tag} text="${r.text}" parent=${r.parentTag} role=${r.parentRole}`);
    }
  }

  await browser.close();
}
main().catch(console.error);
