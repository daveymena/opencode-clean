import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PAGE_ID = '61591838792522';
const IMG_DIR = path.resolve('./fb-images');

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // STEP 1: Get Facebook session info
  console.log('[1] Obteniendo info de sesión...');
  const sessionInfo = await page.evaluate(() => {
    // Try to get the Facebook User ID and access token from the page
    try {
      // Method 1: Check cookies
      const cookies = document.cookie.split(';').reduce((acc, c) => {
        const [k, v] = c.trim().split('=');
        acc[k] = v;
        return acc;
      }, {});
      
      // Method 2: Try to get from __DEV__ or similar
      const fbData = window.__DEV__ || window.__debug || {};
      
      return {
        c_user: cookies.c_user || 'not found',
        xs: cookies.xs ? cookies.xs.substring(0, 10) + '...' : 'not found',
        hasFbData: Object.keys(fbData).length > 0
      };
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log('Session:', JSON.stringify(sessionInfo));

  // STEP 2: Call Facebook's internal API to upload profile photo
  console.log('\n[2] Subiendo foto de perfil via API...');
  
  // Read profile image
  const profileBuffer = fs.readFileSync(path.join(IMG_DIR, 'profile.png'));
  const profileBase64 = profileBuffer.toString('base64');

  // Use Playwright's APIRequestContext (preserves cookies)
  const apiContext = page.request;

  // Try Facebook's internal graph upload endpoint
  // This mimics what the browser does when uploading a profile picture
  const uploadResult = await apiContext.post(
    `https://www.facebook.com/profile/picture/upload/${PAGE_ID}/`,
    {
      multipart: {
        profile_pic: {
          name: 'profile.png',
          mimeType: 'image/png',
          buffer: profileBuffer
        }
      },
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Origin': 'https://www.facebook.com',
        'Referer': `https://www.facebook.com/profile.php?id=${PAGE_ID}`
      }
    }
  );
  console.log('Upload status:', uploadResult.status());
  const uploadBody = await uploadResult.text().catch(() => 'no response');
  console.log('Upload response:', uploadBody.substring(0, 300));

  // STEP 3: Try Graph API approach  
  console.log('\n[3] Intentando vía Graph API...');
  
  // First navigate to the Graph API explorer to get a token
  await page.goto('https://developers.facebook.com/tools/explorer/', {
    waitUntil: 'domcontentloaded', timeout: 20000
  });
  await delay(5000);

  // Click "Get Token" or similar
  const getTokenBtn = page.locator('span:has-text("Obtener token"), span:has-text("Get Token")').first();
  if (await getTokenBtn.isVisible().catch(() => false)) {
    await getTokenBtn.click();
    await delay(3000);
    
    // Get permissions
    const permsBtn = page.locator('span:has-text("pages_manage_posts"), span:has-text("pages_manage_photos")').first();
    // ...
  }

  console.log('\nGraph Explorer URL:', page.url());
  await page.screenshot({ path: 'graph-explorer.png' });

  await browser.close();
}
main().catch(console.error);
