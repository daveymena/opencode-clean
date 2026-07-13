import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0];

  await page.waitForLoadState('domcontentloaded');

  // Find password field and type
  const passField = await page.$('input[name="pass"], input[type="password"]');
  if (passField) {
    await passField.fill('6715320Dvd@');
    console.log('Password filled');
  } else {
    console.log('No password field found');
  }

  // Click login button
  const loginBtn = await page.$('button[name="login"], button[type="submit"]');
  if (loginBtn) {
    await loginBtn.click();
    console.log('Login clicked');
  }

  // Wait for navigation
  await page.waitForTimeout(5000);
  
  const url = page.url();
  const html = await page.content();
  
  if (!html.includes('Iniciar sesión') && !html.includes('login')) {
    console.log('LOGGED IN! URL:', url);
  } else if (html.includes('checkpoint')) {
    console.log('2FA CHECKPOINT - need manual code');
  } else {
    console.log('Still on login page');
    // Take screenshot to debug
    await page.screenshot({ path: 'login-result.png' });
  }

  await browser.close();
}
main().catch(console.error);
