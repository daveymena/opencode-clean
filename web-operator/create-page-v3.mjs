import { chromium } from 'playwright';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1) + min); }

async function human() {
  await delay(rnd(600, 2000));
}

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // STEP 1: Navigate to create page
  console.log('[1/5] Navegando a creación de página...');
  await page.goto('https://www.facebook.com/pages/create', { 
    waitUntil: 'domcontentloaded', timeout: 15000 
  });
  await delay(5000);

  // STEP 2: Fill page name
  console.log('[2/5] Llenando nombre de página...');
  // Find by label text "Nombre de la página"
  const nameLabel = page.locator('span:has-text("Nombre de la página")').first();
  const nameInput = nameLabel.locator('..').locator('input').first();
  await nameInput.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  await nameInput.click();
  await human();
  await nameInput.fill('VentasPro - Cursos Digitales');
  await human();
  console.log('  -> Nombre: VentasPro - Cursos Digitales');

  // STEP 3: Fill category
  console.log('[3/5] Seleccionando categoría...');
  const catInput = page.locator('input[aria-label="Categoría (obligatorio)"]');
  await catInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await catInput.click();
  await human();
  await catInput.fill('Educación');
  await delay(1500);

  // Select first suggestion from dropdown
  const suggestion = page.locator('[role="listbox"] [role="option"]').first();
  const sugVisible = await suggestion.isVisible().catch(() => false);
  if (sugVisible) {
    await suggestion.click();
    console.log('  -> Categoría seleccionada');
  } else {
    console.log('  -> No aparecieron sugerencias, presionando Enter');
    await page.keyboard.press('Enter');
  }
  await human();

  // STEP 4: Fill description
  console.log('[4/5] Llenando descripción...');
  const descField = page.locator('textarea').first();
  const descVisible = await descField.isVisible().catch(() => false);
  if (descVisible) {
    await descField.click();
    await human();
    await descField.fill('Los mejores cursos digitales: Diseño Gráfico, Office, Inglés, Excel, Hacking Ético, Infografías y más. Aprende desde casa con acceso vitalicio vía Google Drive. Contenido descargable MP4/PDF. Calidad premium, precios accesibles.');
    console.log('  -> Descripción escrita');
  } else {
    console.log('  -> No hay campo de descripción visible');
  }
  await human();

  // STEP 5: Click Create Page button
  console.log('[5/5] Creando página...');
  const createBtn = page.locator('[role="button"][aria-label="Crear página"]');
  const btnVisible = await createBtn.isVisible().catch(() => false);
  if (btnVisible) {
    await createBtn.click();
    console.log('  -> Botón Crear página clickeado');
    await delay(5000);
  } else {
    console.log('  -> Botón no encontrado, buscando alternativas...');
    const altBtn = page.locator('text=Crear página').last();
    if (await altBtn.isVisible().catch(() => false)) {
      await altBtn.click();
      await delay(5000);
    }
  }

  // Check result
  const url = page.url();
  const title = await page.title().catch(() => '');
  console.log(`\nURL final: ${url}`);
  console.log(`Title: ${title}`);
  
  if (url.includes('pages/create') || title.includes('Crear una página')) {
    console.log('RESULT: No se creó - todavía en página de creación');
    await page.screenshot({ path: 'create-failed.png' });
  } else {
    console.log('RESULT: Página creada exitosamente!');
    await page.screenshot({ path: 'page-success.png' });
  }

  await browser.close();
}
main().catch(console.error);
