import { chromium } from 'playwright';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(5000);

  // Find the profile picture SVG region
  const svg = page.locator('svg[aria-label="VentasPro - Cursos Digitales"]').first();
  console.log('Profile SVG visible:', await svg.isVisible().catch(() => false));
  
  // Get the parent container of the profile picture
  const parentInfo = await svg.evaluate(el => {
    let parent = el.parentElement;
    let depth = 0;
    const path = [];
    while (parent && depth < 10) {
      path.push({
        tag: parent.tagName,
        role: parent.getAttribute('role') || '',
        'aria-label': parent.getAttribute('aria-label') || '',
        class: (parent.className || '').substring(0, 40)
      });
      parent = parent.parentElement;
      depth++;
    }
    return path;
  }).catch(() => null);
  console.log('\nSVG parent chain:');
  if (parentInfo) {
    parentInfo.forEach((p, i) => console.log(`  [${i}] ${p.tag} role="${p.role}" label="${p['aria-label']}" class="${p.class}"`));
  }

  // Find all clickable elements around the profile picture area
  // Look for elements with "foto" in their aria-label
  const photoLabels = await page.locator('[aria-label*="foto" i], [aria-label*="photo" i]').all();
  console.log(`\nElements with "foto/photo" labels: ${photoLabels.length}`);
  for (const el of photoLabels) {
    const label = await el.getAttribute('aria-label').catch(() => '');
    const tag = await el.evaluate(e => e.tagName).catch(() => '');
    const role = await el.getAttribute('role').catch(() => '');
    const visible = await el.isVisible().catch(() => false);
    console.log(`  [${tag}] role=${role} visible=${visible} label="${label}"`);
  }

  // Look for all svg/icons that could be camera icons
  const allSvg = await page.locator('svg:visible').all();
  console.log(`\nVisible SVGs: ${allSvg.length}`);
  for (const s of allSvg.slice(0, 30)) {
    const ariaLabel = await s.getAttribute('aria-label').catch(() => '');
    const role = await s.getAttribute('role').catch(() => '');
    if (ariaLabel) {
      console.log(`  aria-label="${ariaLabel}" role=${role}`);
    }
  }

  await browser.close();
}
main().catch(console.error);
