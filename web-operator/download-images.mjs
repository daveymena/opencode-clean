import https from 'https';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = 'C:\\Users\\ADMIN\\Downloads\\OpenCode-Limpio\\web-operator\\fb-images\\products-correct';

// Unsplash: direct download URLs for relevant high-quality images per category
// These are from Unsplash's free-to-use library (no attribution required)
const IMAGES = [
  {
    name: 'diseno-grafico',
    url: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=800', // graphic design tools
    product: '🎨 Diseño Gráfico'
  },
  {
    name: 'office',
    url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800', // office/work desk
    product: '📊 Microsoft Office'
  },
  {
    name: 'ingles',
    url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800', // learning/education
    product: '🇬🇧 Inglés Completo'
  },
  {
    name: 'excel',
    url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800', // data/charts
    product: '📈 Excel Avanzado'
  },
  {
    name: 'hacking',
    url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800', // cybersecurity
    product: '🔒 Hacking Ético'
  }
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        const size = fs.statSync(dest).size;
        resolve(size);
      });
      file.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log('Downloading product images from Unsplash...\n');
  for (const img of IMAGES) {
    const ext = path.extname(new URL(img.url).pathname) || '.jpg';
    const filename = `${img.name}${ext}`;
    const dest = path.join(OUTPUT_DIR, filename);
    console.log(`[${img.product}] Downloading ${img.url}...`);
    try {
      const size = await download(img.url, dest);
      console.log(`  ✅ Saved: ${filename} (${(size/1024).toFixed(0)}KB)`);
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
    }
  }
  console.log('\nDone!');
}
main();
