import { chromium } from 'playwright';

const EMAIL = 'daveymena162@gmail.com';
const PASS = '6715320D.';
const URL = 'http://144.91.112.79:3000';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2000);
  const emailInput = page.locator('input[type="email"]').first();
  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PASS);
    await page.waitForTimeout(300);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(5000);
  }

  await page.locator('text=opencode1').first().click();
  await page.waitForTimeout(2000);
  await page.locator('text=opencox').first().click();
  await page.waitForTimeout(2000);
  await page.getByRole('link', { name: 'Source' }).click().catch(() => page.locator('text=Source').first().click());
  await page.waitForTimeout(3000);

  // Select "Git" tab
  await page.locator('button:has-text("Git")').first().click();
  await page.waitForTimeout(2000);

  // Fix branch from "main" to "master"
  const branchInput = page.locator('input[id*="ref"]').first();
  const branchVal = await branchInput.inputValue();
  console.log(`Current branch: "${branchVal}"`);
  
  if (branchVal !== 'master') {
    await branchInput.click();
    await branchInput.fill('');
    await branchInput.fill('master');
    await page.waitForTimeout(500);
    console.log('Branch changed to master');
  }

  // Save
  await page.locator('button:has-text("Save")').first().click();
  await page.waitForTimeout(3000);

  console.log('\n=== AFTER FIX ===');
  const text = await page.evaluate(() => document.body.innerText);
  console.log(text.substring(0, 2000));

  // Go to Deployments and trigger deploy
  await page.getByRole('link', { name: 'Deployments' }).click().catch(() => page.locator('text=Deployments').first().click());
  await page.waitForTimeout(3000);

  // Click Deploy
  const deployBtn = page.locator('button:has-text("Deploy")').first();
  if (await deployBtn.isVisible().catch(() => false)) {
    console.log('\nClicking Deploy...');
    await deployBtn.click();
    await page.waitForTimeout(10000);
    
    // Check deployment status
    const deployText = await page.evaluate(() => document.body.innerText);
    console.log('\n=== AFTER DEPLOY ===');
    console.log(deployText.substring(0, 5000));

    // Click View on the new deployment
    const viewBtns = page.locator('button:has-text("View")');
    if (await viewBtns.first().isVisible().catch(() => false)) {
      await viewBtns.first().click();
      await page.waitForTimeout(8000);
      const logText = await page.evaluate(() => document.body.innerText);
      console.log('\n=== DEPLOYMENT LOGS ===');
      console.log(logText.substring(0, 15000));
      await page.screenshot({ path: 'C:\\Users\\ADMIN\\Downloads\\OpenCode-Limpio\\web-operator\\ep-build-log.png', fullPage: true });
    }
  }

  await page.screenshot({ path: 'C:\\Users\\ADMIN\\Downloads\\OpenCode-Limpio\\web-operator\\ep-deploying.png', fullPage: true });
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
