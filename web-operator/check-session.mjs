import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0];
  
  await page.waitForTimeout(3000);
  const url = page.url();
  const title = await page.title();
  const html = await page.content();
  
  console.log('URL:', url);
  console.log('Title:', title);
  
  if (html.includes('Iniciar sesión') || html.includes('login_form')) {
    console.log('STATUS: Login page');
  } else if (html.includes('checkpoint') || url.includes('checkpoint')) {
    console.log('STATUS: Checkpoint/2FA');
  } else {
    console.log('STATUS: Logged in!');
  }
  
  await browser.close();
}
main().catch(console.error);
