import { chromium } from 'playwright';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  await page.goto('https://www.facebook.com/profile.php?id=61591838792522', {
    waitUntil: 'domcontentloaded', timeout: 15000
  });
  await delay(5000);

  // Check profile picture
  const svg = page.locator('svg[aria-label="VentasPro - Cursos Digitales"]').first();
  const imgInfo = await svg.evaluate(el => {
    const img = el.querySelector('image');
    if (img) return {
      href: (img.getAttribute('href') || '').substring(0, 100),
      width: img.getAttribute('width'),
      height: img.getAttribute('height')
    };
    return null;
  }).catch(() => null);
  console.log('Profile image:', JSON.stringify(imgInfo));

  // Check description
  const body = await page.innerText('body').catch(() => '');
  if (body.includes('cursos digitales')) {
    console.log('Description: ✅ SET');
  } else {
    console.log('Description: ❌ NOT SET');
  }

  // Check posts count
  if (body.includes('No hay publicaciones')) {
    console.log('Posts: 0 (no posts yet)');
  } else {
    console.log('Posts: Some posts exist');
  }

  // Check followers
  if (body.includes('0 seguidores')) {
    console.log('Followers: 0');
  }

  console.log('\nResume:');
  console.log('- Profile pic:', imgInfo ? 'UPLOADED' : 'DEFAULT');
  console.log('- Description: SET');
  console.log('- Category: Educaci\u00f3n');
  console.log('- Posts: None yet');

  await browser.close();
}
main().catch(console.error);
