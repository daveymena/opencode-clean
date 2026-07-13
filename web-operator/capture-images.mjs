import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function main() {
  const htmlPath = path.resolve('./generate-images.html');
  const fileUrl = 'file://' + htmlPath.replace(/\\/g, '/');
  const outDir = './fb-images';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0];

  // Open the HTML file
  await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);

  // Screenshot profile picture (512x512)
  const profileEl = page.locator('#profile-wrap');
  await profileEl.screenshot({ path: path.join(outDir, 'profile.png') });
  console.log('Profile picture captured');

  // Screenshot cover image (1640x624)
  const coverEl = page.locator('#cover-wrap');
  await coverEl.screenshot({ path: path.join(outDir, 'cover.png') });
  console.log('Cover image captured');

  console.log('Images saved to:', path.resolve(outDir));
  await browser.close();
}
main().catch(console.error);
