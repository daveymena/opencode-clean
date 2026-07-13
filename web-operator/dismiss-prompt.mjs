import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0];

  // Click "Ahora no" for password remember prompt
  const btn = page.locator('text=Ahora no').first();
  const visible = await btn.isVisible().catch(() => false);
  if (visible) {
    await btn.click();
    console.log('Clicked Ahora no');
    await page.waitForTimeout(1000);
  }

  console.log('URL:', page.url());
  const html = await page.content();
  if (html.includes('Iniciar sesión')) {
    console.log('STATUS: Login page');
  } else if (html.includes('checkpoint')) {
    console.log('STATUS: Checkpoint');
  } else {
    console.log('STATUS: Logged in');
  }

  await browser.close();
}
main().catch(console.error);
