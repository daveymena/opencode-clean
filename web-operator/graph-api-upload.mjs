import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

const IMG_DIR = path.resolve('./fb-images');
const PAGE_ID = '61591838792522';

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // Get access token from Facebook's JS environment
  console.log('Extracting access token...');
  await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(3000);

  const token = await page.evaluate(() => {
    try {
      // Try to get the access token from the page's JS
      // This is usually stored in the page's __DEV__ or in the cookie
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        const text = s.textContent || '';
        // Look for access token pattern
        const match = text.match(/EAAG\w+/);
        if (match) return match[0];
        const match2 = text.match(/EAA\w+/);
        if (match2) return match2[0];
      }
      return null;
    } catch (e) {
      return 'error: ' + e.message;
    }
  });
  console.log('Token from DOM:', token ? token.substring(0, 20) + '...' : 'Not found');

  // Extract from cookie
  const cookies = await page.context().cookies();
  const fbCookie = cookies.find(c => c.name.includes('c_user') || c.name.includes('xs'));
  if (fbCookie) {
    console.log('Facebook user cookie found:', fbCookie.name, '=', fbCookie.value.substring(0, 10) + '...');
  }

  // Try to use the Facebook Graph API Access Token tool
  // Navigate to the access token page
  console.log('\nGetting access token from developer tool...');
  await page.goto('https://developers.facebook.com/tools/debug/accesstoken/', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(5000);
  console.log('Access token page:', page.url());

  // Alternative: Get the access token from Business Suite
  await page.goto('https://business.facebook.com/latest/settings?asset_id=1278583508663384', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(5000);

  // Try to extract from business.facebook.com scripts
  const bsToken = await page.evaluate(() => {
    try {
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        const text = s.textContent || '';
        const match = text.match(/EAAG\w+/);
        if (match) return match[0];
      }
      return null;
    } catch (e) {
      return null;
    }
  });
  console.log('Token from BS:', bsToken ? bsToken.substring(0, 20) + '...' : 'Not found');

  // Alternative approach: Navigate to Facebook page and upload directly
  // using the page's photo upload mechanism
  console.log('\nTrying direct Facebook upload mechanism...');
  await page.goto(`https://www.facebook.com/profile.php?id=${PAGE_ID}`, {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(4000);

  // Use page.evaluate to programmatically upload the profile picture
  // by intercepting the network request
  const uploadResult = await page.evaluate(async ({ pageId, profilePicPath, coverPicPath }) => {
    // Try to find the profile picture upload by dispatching a click event
    // on the correct element
    const cambiarBtn = document.querySelector('div[aria-label="Cambiar"]');
    if (cambiarBtn) {
      cambiarBtn.click();
      await new Promise(r => setTimeout(r, 2000));
      
      // Look for "Subir foto" in the dropdown
      const menuItems = document.querySelectorAll('[role="menuitem"]');
      for (const item of menuItems) {
        if (item.textContent.includes('Subir foto') || item.textContent.includes('Upload photo')) {
          item.click();
          return 'Subir foto clicked via DOM';
        }
      }
      return 'Cambiar clicked but no Subir foto found';
    }
    return 'Cambiar button not found';
  }, { pageId: PAGE_ID, profilePicPath: path.join(IMG_DIR, 'profile.png'), coverPicPath: path.join(IMG_DIR, 'cover.png') });
  console.log('Upload result:', uploadResult);

  await delay(4000);

  // Take screenshot
  await page.screenshot({ path: 'upload-result.png' });
  await browser.close();
}
main().catch(console.error);
