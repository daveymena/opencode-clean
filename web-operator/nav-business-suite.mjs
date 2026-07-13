import { chromium } from 'playwright';
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];

  // Go to Business Suite home
  await page.goto('https://business.facebook.com/latest/home/?asset_id=1278583508663384', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(8000);

  // Look for navigation links in sidebar
  console.log('=== Navigation sidebar links ===');
  const navLinks = await page.locator('nav a, [role="navigation"] a, aside a').all();
  for (const link of navLinks) {
    const href = await link.getAttribute('href').catch(() => '');
    const text = (await link.innerText().catch(() => '')).trim().substring(0, 50);
    if (text && href) {
      console.log(`  "${text}" → ${href.substring(0, 80)}`);
    }
  }

  // Also look for all nav items
  console.log('\n=== All sidebar items ===');
  const navItems = await page.locator('[role="navigation"] *:visible, [class*="nav"] *:visible').all();
  for (const item of navItems) {
    const tag = await item.evaluate(el => el.tagName).catch(() => '');
    const text = (await item.innerText().catch(() => '')).trim().substring(0, 40);
    if (text && ['A', 'SPAN', 'DIV'].includes(tag)) {
      console.log(`  [${tag}] "${text}"`);
    }
  }

  // Check for the "Todas las herramientas" dropdown
  const tools = page.locator('text=Todas las herramientas').first();
  console.log('\n"Todas las herramientas":', await tools.isVisible().catch(() => false));

  if (await tools.isVisible().catch(() => false)) {
    await tools.click();
    await delay(3000);
    console.log('Tools menu opened');

    // Show tools/submenu
    const toolItems = await page.locator('[role="menuitem"], [role="link"]:visible').all();
    for (const item of toolItems) {
      const text = (await item.innerText().catch(() => '')).trim().substring(0, 50);
      if (text) console.log(`  Tool: "${text}"`);
    }
  }

  // Check the URL for commerce-related paths
  await page.screenshot({ path: 'business-suite-nav.png' }).catch(() => {});

  await browser.close();
}
main().catch(console.error);
