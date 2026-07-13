// Generate profile and cover images for VentasPro Facebook page
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage, registerFont } from 'canvas';

async function main() {
  const outputDir = 'C:\\Users\\ADMIN\\Downloads\\OpenCode-Limpio\\web-operator\\fb-images';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  // --- PROFILE PICTURE: 512x512 ---
  const pSize = 512;
  const pCanvas = createCanvas(pSize, pSize);
  const pCtx = pCanvas.getContext('2d');

  // Gradient background (purple)
  const grad = pCtx.createLinearGradient(0, 0, pSize, pSize);
  grad.addColorStop(0, '#6366f1');
  grad.addColorStop(1, '#8b5cf6');
  pCtx.fillStyle = grad;
  pCtx.fillRect(0, 0, pSize, pSize);

  // White rounded square for icon background
  pCtx.fillStyle = 'white';
  const margin = 56;
  const r = 40;
  pCtx.beginPath();
  pCtx.roundRect(margin, margin, pSize - 2 * margin, pSize - 2 * margin, r);
  pCtx.fill();

  // Chat bubble icon
  pCtx.fillStyle = '#6366f1';
  const bx = 140, by = 130, bw = 232, bh = 170;
  pCtx.beginPath();
  pCtx.roundRect(bx, by, bw, bh, 20);
  pCtx.fill();

  // Chat tail
  pCtx.beginPath();
  pCtx.moveTo(bx + 30, by + bh);
  pCtx.lineTo(bx + 10, by + bh + 40);
  pCtx.lineTo(bx + 60, by + bh);
  pCtx.fill();

  // Checkmark inside bubble (white)
  pCtx.strokeStyle = 'white';
  pCtx.lineWidth = 8;
  pCtx.lineCap = 'round';
  pCtx.lineJoin = 'round';
  pCtx.beginPath();
  pCtx.moveTo(bx + 45, by + 85);
  pCtx.lineTo(bx + 85, by + 125);
  pCtx.lineTo(bx + 160, by + 50);
  pCtx.stroke();

  // Text "VentasPro" below icon
  pCtx.fillStyle = 'white';
  pCtx.font = 'bold 34px "Inter", Arial, sans-serif';
  pCtx.textAlign = 'center';
  pCtx.fillText('VentasPro', pSize/2, pSize - 55);

  // Subtitle
  pCtx.font = '20px Arial, sans-serif';
  pCtx.fillStyle = 'rgba(255,255,255,0.85)';
  pCtx.fillText('Cursos Digitales', pSize/2, pSize - 22);

  const profilePic = pCanvas.toBuffer('image/png');
  fs.writeFileSync(path.join(outputDir, 'profile.png'), profilePic);
  console.log('Profile picture generated: 512x512');

  // --- COVER IMAGE: 1640x624 (Facebook cover ratio) ---
  const cW = 1640, cH = 624;
  const cCanvas = createCanvas(cW, cH);
  const cCtx = cCanvas.getContext('2d');

  // Gradient background
  const cGrad = cCtx.createLinearGradient(0, 0, cW, cH);
  cGrad.addColorStop(0, '#6366f1');
  cGrad.addColorStop(0.5, '#7c3aed');
  cGrad.addColorStop(1, '#4f46e5');
  cCtx.fillStyle = cGrad;
  cCtx.fillRect(0, 0, cW, cH);

  // Decorative circles
  cCtx.fillStyle = 'rgba(255,255,255,0.06)';
  cCtx.beginPath();
  cCtx.arc(1400, 100, 300, 0, Math.PI * 2);
  cCtx.fill();
  cCtx.beginPath();
  cCtx.arc(200, 500, 200, 0, Math.PI * 2);
  cCtx.fill();
  cCtx.beginPath();
  cCtx.arc(800, -50, 180, 0, Math.PI * 2);
  cCtx.fill();

  // Dot grid pattern
  cCtx.fillStyle = 'rgba(255,255,255,0.1)';
  for (let x = 0; x < cW; x += 60) {
    for (let y = 0; y < cH; y += 60) {
      cCtx.beginPath();
      cCtx.arc(x, y, 2, 0, Math.PI * 2);
      cCtx.fill();
    }
  }

  // Main title
  cCtx.fillStyle = 'white';
  cCtx.font = 'bold 56px Arial, sans-serif';
  cCtx.textAlign = 'left';
  cCtx.fillText('VentasPro', 80, 230);

  cCtx.fillStyle = 'rgba(255,255,255,0.9)';
  cCtx.font = '28px Arial, sans-serif';
  cCtx.fillText('Cursos Digitales Premium', 80, 280);

  // Tagline
  cCtx.font = '20px Arial, sans-serif';
  cCtx.fillStyle = 'rgba(255,255,255,0.8)';
  cCtx.fillText('Diseño Gráfico  ·  Office  ·  Inglés  ·  Excel  ·  Hacking Ético', 80, 340);
  cCtx.fillText('y más de 80 cursos con acceso vitalicio vía Google Drive', 80, 375);

  // CTA badge
  cCtx.fillStyle = 'white';
  cCtx.font = 'bold 18px Arial, sans-serif';
  const badgeX = 80, badgeY = 430, badgeW = 280, badgeH = 50;
  cCtx.fillStyle = 'rgba(255,255,255,0.2)';
  cCtx.beginPath();
  cCtx.roundRect(badgeX, badgeY, badgeW, badgeH, 25);
  cCtx.fill();
  cCtx.fillStyle = 'white';
  cCtx.font = 'bold 18px Arial, sans-serif';
  cCtx.fillText('Comprar Ahora  →', badgeX + 55, badgeY + 32);

  const coverPic = cCanvas.toBuffer('image/png');
  fs.writeFileSync(path.join(outputDir, 'cover.png'), coverPic);
  console.log('Cover image generated: 1640x624');

  console.log('\nImages saved to:', outputDir);
}
main().catch(console.error);
