import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0];
  
  // Wait for page to fully load
  await page.waitForLoadState('networkidle').catch(() => {});
  
  const html = await page.content();
  
  // Check what's on the page
  if (html.includes('Iniciar sesión') || html.includes('login') || html.includes('identify')) {
    console.log('PAGE: Login screen');
    
    // Try to extract any pre-filled email
    const emailField = await page.$('input[name="email"], input[type="email"], input[name="login_email"]');
    if (emailField) {
      const value = await emailField.inputValue();
      console.log('Email pre-filled:', value || 'EMPTY');
    } else {
      console.log('No email field found');
    }
    
    // Check for saved account buttons
    const savedAccounts = await page.$$('[data-testid="saved_account"]');
    console.log('Saved accounts:', savedAccounts.length);
  } else if (html.includes('home') || html.includes('feed') || html.includes('notifications')) {
    console.log('PAGE: Logged in (Facebook feed)');
  } else if (html.includes('checkpoint')) {
    console.log('PAGE: Security checkpoint');
  } else {
    console.log('PAGE: Unknown state');
    console.log('URL:', page.url());
  }
  
  const screenshotBase64 = await page.screenshot({ encoding: 'base64', fullPage: false });
  console.log('SCREENSHOT_BASE64:' + screenshotBase64);
  
  await browser.close();
}
main().catch(console.error);
