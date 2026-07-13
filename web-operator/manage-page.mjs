import { chromium } from 'playwright';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const PAGE_ID = '61591838792522';

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // Try Administrar página
  await page.goto(`https://www.facebook.com/profile.php?id=${PAGE_ID}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(4000);

  const adminPage = page.locator('span:has-text("Administrar página")').first();
  if (await adminPage.isVisible().catch(() => false)) {
    await adminPage.click();
    await delay(5000);
    console.log('Administrar página URL:', page.url());

    // Look for composer or post creation
    const t = await page.innerText('body').catch(() => '');
    console.log(t.replace(/\s+/g, ' ').trim().substring(0, 1000));

    // Try clicking on the page name post area
    await page.screenshot({ path: 'manage-page.png' });
    console.log('Screenshot saved');
  }

  // Try direct feed URL
  console.log('\nTrying feed URL...');
  await page.goto(`https://www.facebook.com/profile.php?id=${PAGE_ID}&sk=feed`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(5000);
  console.log('Feed URL:', page.url());
  
  const textAreas = await page.locator('[role="textbox"]:visible').all();
  console.log(`Textboxes found: ${textAreas.length}`);

  // Try clicking the page name at the top to trigger post creation
  const pageName = page.locator('span:has-text("VentasPro - Cursos Digitales")').first();
  if (await pageName.isVisible().catch(() => false)) {
    await pageName.click();
    await delay(3000);
    console.log('After click URL:', page.url());
  }

  // One more approach - click "Publicaciones" tab
  const postsTab = page.locator('span:has-text("Publicaciones")').first();
  if (await postsTab.isVisible().catch(() => false)) {
    await postsTab.click();
    await delay(3000);
    console.log('Posts tab URL:', page.url());
    const t2 = await page.innerText('body').catch(() => '');
    console.log(t2.replace(/\s+/g, ' ').trim().substring(0, 500));
  }

  await browser.close();
}
main().catch(console.error);
