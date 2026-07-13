import { chromium } from 'playwright';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  await page.goto('https://www.facebook.com/pages/create', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await delay(5000);

  // Look for the name field specifically
  // Facebook often uses a label "Nombre de la página"
  const allElements = await page.locator('*').all();
  console.log(`Total elements: ${allElements.length}`);

  // Find elements containing "Nombre" text
  const nameLabels = await page.locator('text=Nombre de la página').all();
  console.log(`\nFound ${nameLabels.length} elements with "Nombre de la página"`);
  for (const label of nameLabels) {
    const tag = await label.evaluate(el => el.tagName);
    const text = (await label.innerText().catch(() => '')).trim();
    console.log(`  tag=${tag} text="${text}"`);
    // Get sibling/parent input
    const parent = await label.evaluate(el => {
      const p = el.closest('div');
      const input = p ? p.querySelector('input, [contenteditable="true"]') : null;
      return input ? { tag: input.tagName, role: input.getAttribute('role'), placeholder: input.getAttribute('placeholder'), 'aria-label': input.getAttribute('aria-label'), type: input.getAttribute('type'), id: input.id } : null;
    });
    console.log(`  parent input:`, JSON.stringify(parent));
  }

  // Find all inputs (including hidden) near the name label area
  const allInputs2 = await page.locator('input:visible, [contenteditable="true"]:visible').all();
  console.log(`\nVisible inputs/editable: ${allInputs2.length}`);
  for (const inp of allInputs2) {
    const info = await inp.evaluate(el => ({
      tag: el.tagName,
      type: el.getAttribute('type') || '',
      placeholder: el.getAttribute('placeholder') || '',
      'aria-label': el.getAttribute('aria-label') || '',
      id: el.id || '',
      className: (el.className || '').substring(0, 60),
      value: (el.value || el.textContent || '').substring(0, 30)
    }));
    console.log(`  `, JSON.stringify(info));
  }

  await browser.close();
}
main().catch(console.error);
