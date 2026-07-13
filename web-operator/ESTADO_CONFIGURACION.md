# Configuración VentasPro - Facebook

## Estado Actual
- Página: **VentasPro - Cursos Digitales** (ID: 61591838792522)
- Categoría: **Educación**
- Descripción actual: "Los mejores cursos digitales: Diseño Gráfico, Office, Inglés, Excel, Hacking Ético, Infografías y más..."
- Seguidores: 0
- Posts existentes: 0 (los intentos de post automatizado no funcionaron)
- Foto de perfil: Configurada por el usuario
- Foto de portada: Configurada por el usuario
- Commerce Manager: NO configurado aún

## Credenciales
- Email: daveymena162@gmail.com
- Chrome Profile: Profile 3 (davey)
  - Path: `C:\Users\ADMIN\AppData\Local\Google\Chrome\User Data\Profile 3\`
- CDP Port: 9222
- User-data-dir (funcional): `C:\Users\ADMIN\AppData\Local\Temp\chrome-debug-session-profile-3`

## Requisitos Técnicos para Chrome 150+
- `--remote-debugging-port=9222` + `--remote-allow-origins=*`
- **OBLIGATORIO**: usar `--user-data-dir` NO DEFAULT
  - `--user-data-dir="C:\Users\ADMIN\AppData\Local\Temp\chrome-debug-session-profile-3"`
- `--profile-directory="Profile 3"` → perfil davey (con sesión Facebook guardada)

### Comando para abrir Chrome
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --remote-allow-origins=* `
  --user-data-dir="C:\Users\ADMIN\AppData\Local\Temp\chrome-debug-session-profile-3" `
  --profile-directory="Profile 3"
```

## Conexión Playwright
```js
const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => p.url().includes('facebook.com')) || ctx.pages()[0];
```

## URLs Importantes
| Propósito | URL |
|-----------|-----|
| Perfil página | `https://www.facebook.com/profile.php?id=61591838792522` |
| Fotos álbum | `?sk=photos` |
| Meta Business Suite | `https://business.facebook.com/latest/home?business_id=...` |
| Commerce Manager | `https://commerce.facebook.com/` |
| Creator Studio | `https://business.facebook.com/latest/creator_studio/` |
| Configuración página | `https://www.facebook.com/profile.php?id=61591838792522&sk=settings` |

## Mapeo de Elementos UI (Facebook Page Profile)

### Composer (Crear Post)
```js
// EL BOTÓN NO tiene aria-label, solo texto visible
const btn = page.locator('div[role="button"]:has-text("¿Qué estás pensando?")').first();
// Alternativa
const btn2 = page.locator('div[role="button"]:has-text("Comparte una idea")').first();

// Textbox del composer
const textbox = page.locator('[contenteditable="true"]').first();
// Click con force:true para evitar overlay intercept
await textbox.click({ force: true }).catch(() => textbox.evaluate(el => el.focus()));
await textbox.fill('text here');

// Botón Foto/vídeo (SÍ tiene aria-label)
const fotoBtn = page.locator('div[aria-label="Foto/vídeo"]').first();

// Filechooser para upload
const fcPromise = page.waitForEvent('filechooser', { timeout: 10000 });
await fotoBtn.click({ force: true });
const fc = await fcPromise;
await fc.setFiles(['path/to/image.jpg']);
// Esperar 10-12s para procesamiento

// Botón Siguiente (aparece después de upload en algunos casos)
const sigBtn = page.locator('div[aria-label="Siguiente"]').first();
```

### PROBLEMA: El botón "Publicar" nunca aparece
- Después de escribir texto y subir imagen, el "Publicar" no aparece en el DOM
- `[aria-label="Publicar"]` nunca existe como elemento visible
- `:has-text("Publicar")` solo encuentra "Publicar comentario" (para comentar en posts existentes)
- Posibles causas:
  1. Facebook requiere que el post tenga cierta longitud mínima
  2. El filechooser cierra el composer al abrir el diálogo nativo
  3. La sesión como "VentasPro" no tiene permisos completos de publicación
  4. Facebook detecta automatización y bloquea

### Botones que SÍ son visibles en la página
- "¿Qué estás pensando?" - abre composer
- "Foto/vídeo", "Vídeo en directo", "Reel" - botones de medios
- "Publicar comentario" - para comentar posts existentes (NO confundir)
- "Editar foto de portada"
- "Anunciarte"
- "Siguiente" - a veces aparece después de upload

## Catálogo de Productos (Agent-Sales-Bot)
- 81 productos digitales en `CATALOGO_FINAL_81_ULTIMATE.json`
- Precios: Diseño Gráfico = $60,000 COP, demás = $20,000 COP
- Categorías: DISEÑO, OFFICE, IDIOMAS, EXCEL, TECH, MARKETING, etc.
- Imágenes de producto: `artifacts/ventas-pro/public/images/products/` (78 JPGs, 41.jpg-122.jpg)
  - **NO hay mapeo directo** entre nombre de producto y archivo numérico
  - JSON referencia `assets/images/*_megapack.png` que **NO existen en disco**
- Imágenes correctas (Unsplash): `fb-images/products-correct/` (5 imágenes)

## Flujo para Publicar Posts (NO FUNCIONAL)
1. Abrir Chrome con CDP ✓
2. Conectar Playwright ✓
3. Navegar a página ✓
4. Click composer ✓
5. Escribir texto ✓
6. Click Foto/vídeo + filechooser ✓
7. Subir imagen ✓
8. Click Siguiente (si aparece) ✓
9. **Click Publicar ❌ NUNCA FUNCIONA**

## Alternativas Probadas (Fallaron)
- ❌ Inyección de input file falsa → Facebook no procesa
- ❌ Graph API v21.0 desde browser → CORS bloquea fetch a graph.facebook.com
- ❌ FB.api() → SDK no disponible en página
- ❌ `/ajax/updatestatus/` → endpoint no existe
- ❌ Business Suite Creator Studio → interfaz diferente
- ❌ Ctrl+Enter → sin efecto
- ❌ dispatchEvent click → React no lo captura

## Próximos Pasos Recomendados
1. **Commerce Manager** → Configurar catálogo de productos
2. **Publicación manual** → Usar el browser abierto para publicar posts manualmente
3. **Anuncios** → Configurar campañas publicitarias desde Ads Manager

## Archivos Relevantes
- Scripts: `C:\Users\ADMIN\Downloads\OpenCode-Limpio\web-operator\*.mjs`
- Imágenes productos correctas: `...\fb-images\products-correct\`
- Catálogo: `C:\Users\ADMIN\Videos\Agent-Sales-Bot\CATALOGO_FINAL_81_ULTIMATE.json`
- Imágenes originales: `...\artifacts\ventas-pro\public\images\products\`
- Chrome profile: `C:\Users\ADMIN\AppData\Local\Google\Chrome\User Data\Profile 3\`
- Chrome session temp: `C:\Users\ADMIN\AppData\Local\Temp\chrome-debug-session-profile-3\`
