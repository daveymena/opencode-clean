import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0];
  
  // Check page content to see if logged in
  const url = page.url();
  const title = await page.title();
  const html = await page.content();
  
  const isLoggedIn = !html.includes('Iniciar sesión') && !html.includes('login') && html.includes('VentasPro') || html.includes('home') || html.includes('notifications');
  
  console.log('URL:', url);
  console.log('Title:', title);
  console.log('Logged in:', !html.includes('Iniciar sesión'));
  
  // Save a screenshot
  await page.screenshot({ path: 'facebook-screenshot.png', fullPage: false });
  console.log('Screenshot saved');
  
  await browser.close();
}
main().catch(console.error);
