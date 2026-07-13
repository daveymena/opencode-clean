import { chromium } from 'playwright';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const PAGE_ID = '61591838792522';

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // Go to page
  await page.goto(`https://www.facebook.com/profile.php?id=${PAGE_ID}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(4000);

  // Click "Cambiar" to open profile switcher
  const cambiar = page.locator('div[aria-label="Cambiar"]').first();
  await cambiar.click();
  console.log('Cambiar clicked');
  await delay(3000);

  // Now the dialog should be open - find VentasPro in it and click
  // Look for the profile item
  const ventasItem = page.locator('span:has-text("VentasPro - Cursos Digitales")').first();
  if (await ventasItem.isVisible().catch(() => false)) {
    await ventasItem.click();
    console.log('VentasPro profile selected');
    await delay(5000);
    console.log('URL after switch:', page.url());
  } else {
    console.log('VentasPro item not visible in switch dialog');
    // Debug: what's in the dialog
    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.isVisible().catch(() => false)) {
      console.log('Dialog content:', await dialog.innerText().catch(() => ''));
    }
  }

  // Now try to find the composer
  await delay(3000);
  const composers = await page.locator('[role="textbox"]:visible, [contenteditable="true"]:visible').all();
  console.log(`Composers found: ${composers.length}`);

  // If we're on the page as the page, try posting
  const publishBtn = page.locator('div[aria-label="Publicar"]').first();
  console.log('Publish btn visible:', await publishBtn.isVisible().catch(() => false));

  // Look for the status box
  const statusBox = page.locator('div[aria-label*="¿Qué estás pensando"], div[aria-label*="What\'s on your mind"]').first();
  console.log('Status box visible:', await statusBox.isVisible().catch(() => false));

  await page.screenshot({ path: 'after-switch-profile.png' });
  console.log('Screenshot saved');
  await browser.close();
}
main().catch(console.error);
