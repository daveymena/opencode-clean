import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { callBestModel, analyzeScreenshot } from './ai-client.js';

function loadEnv() {
  const paths = [
    'C:\\Users\\ADMIN\\Downloads\\OpenCode-Limpio\\.env',
    '/mnt/c/Users/ADMIN/Downloads/OpenCode-Limpio/.env',
    path.join(process.cwd(), '.env')
  ];
  for (const envPath of paths) {
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [key, ...valueParts] = trimmed.split('=');
            const value = valueParts.join('=').trim();
            if (value && !process.env[key]) {
              process.env[key] = value;
            }
          }
        });
        console.log('[env] .env loaded from:', envPath);
        return;
      }
    } catch {}
  }
  console.log('[env] .env not found');
}

// AI vision se provee a través de ./ai-client.js (modelos OpenCode / Copilot / FreeModel)

class HeuristicVerifier {
  async verify(action, beforeState, afterState) {
    const changes = {
      urlChanged: beforeState.url !== afterState.url,
      titleChanged: beforeState.title !== afterState.title,
      domChanged: Math.abs(beforeState.nodeCount - afterState.nodeCount) > 5,
      newElements: afterState.visibleElements > beforeState.visibleElements,
    };
    switch (action.type) {
      case 'click':
        if (changes.urlChanged || changes.newElements) {
          return { success: true, confidence: 'high' };
        }
        return { success: false, confidence: 'medium', ambiguous: true };
      case 'type':
        return { success: true, confidence: 'high' };
      case 'navigate':
        if (afterState.url.includes(action.url || '')) {
          return { success: true, confidence: 'high' };
        }
        return { success: false, confidence: 'high' };
      default:
        return { success: true, confidence: 'medium' };
    }
  }
}

class SiteMemory {
  constructor() {
    this.patterns = new Map();
    this.dataDir = path.join(process.env.HOME || process.env.USERPROFILE, '.operator-memory');
    fs.mkdirSync(this.dataDir, { recursive: true });
  }
  getPatterns(domain) {
    const file = path.join(this.dataDir, `${domain}.json`);
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    return [];
  }
  savePattern(domain, pattern) {
    const patterns = this.getPatterns(domain);
    patterns.push({ ...pattern, timestamp: Date.now() });
    const file = path.join(this.dataDir, `${domain}.json`);
    fs.writeFileSync(file, JSON.stringify(patterns, null, 2));
  }
}

class ScreenshotCache {
  constructor() {
    this.cache = new Map();
  }
  hash(screenshot) {
    return crypto.createHash('md5').update(screenshot).digest('hex');
  }
  get(hash, domain) {
    const key = `${domain}:${hash}`;
    return this.cache.get(key);
  }
  set(hash, action, domain) {
    const key = `${domain}:${hash}`;
    this.cache.set(key, { action, timestamp: Date.now() });
  }
}

export class OperatorEngine {
  constructor(config = {}) {
    this.config = {
      maxIterations: 30,
      aiTimeout: 8000,
      screenshotDir: config.screenshotDir || path.join(process.env.HOME || process.env.USERPROFILE, 'Downloads'),
      ...config
    };
    this.browser = null;
    this.page = null;
    this.heuristicVerifier = new HeuristicVerifier();
    this.siteMemory = new SiteMemory();
    this.screenshotCache = new ScreenshotCache();
    this.iterationCount = 0;
    this.aiCallCount = 0;
    this._elements = [];
  }

  async launch(options = {}) {
    try {
      // En Docker siempre headless; en local se puede forzar con options.headless
      const isDocker = fs.existsSync('/.dockerenv') || process.env.DOCKER_ENV === 'true';
      const headless = options.headless !== undefined ? options.headless : (isDocker ? true : false);

      const chromePaths = [
        process.env.PLAYWRIGHT_CHROMIUM_PATH,
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome'
      ].filter(Boolean);

      let launchOptions = {
        headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-blink-features=AutomationControlled'
        ]
      };

      let chromePath = null;
      for (const p of chromePaths) {
        if (fs.existsSync(p)) {
          chromePath = p;
          break;
        }
      }
      if (chromePath) launchOptions.executablePath = chromePath;

      this.browser = await chromium.launch(launchOptions);
      const context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        locale: 'es-CO',
        timezoneId: 'America/Bogota'
      });
      this.page = await context.newPage();
      console.log(`[OperatorEngine] Browser launched (headless: ${headless}, chrome: ${chromePath || 'playwright bundled'})`);
      return this;
    } catch (e) {
      console.error('Failed to launch browser:', e.message);
      throw e;
    }
  }

  async connectToExisting(cdpUrl = 'http://localhost:9222') {
    try {
      console.log(`[OperatorEngine] Conectando a Chrome existente via CDP: ${cdpUrl}`);
      this.browser = await chromium.connectOverCDP(cdpUrl);
      const contexts = this.browser.contexts();
      if (!contexts.length) throw new Error('No hay contextos de navegador disponibles en CDP');
      const context = contexts[0];
      const pages = context.pages();
      this.page = pages.find(p => p.url().includes('facebook.com')) || pages[0] || await context.newPage();
      await this.page.bringToFront();
      console.log(`[OperatorEngine] Conectado. Pagina actual: ${this.page.url()}`);
      return this;
    } catch (e) {
      console.error('Failed to connect to existing browser:', e.message);
      throw e;
    }
  }

  async getState() {
    return {
      url: this.page.url(),
      title: await this.page.title(),
      nodeCount: await this.page.evaluate(() => document.querySelectorAll('*').length),
      visibleElements: await this.page.evaluate(() => {
        return [...document.querySelectorAll('*')].filter(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden';
        }).length;
      }),
      scrollY: await this.page.evaluate(() => window.scrollY),
      hasModal: await this.page.evaluate(() => !!document.querySelector('[role="dialog"], .modal, [data-testid="modal"]'))
    };
  }

  async screenshot(name) {
    const filepath = path.join(this.config.screenshotDir, `op_${name}_${Date.now()}.png`);
    await this.page.screenshot({ path: filepath });
    return filepath;
  }

  // ─── Annotated screenshot (CUA-style) ────────────────────────────────

  async getInteractiveElements() {
    if (!this.page) return [];
    try {
      return await this.page.evaluate(() => {
        const selectors = 'button, a, input, textarea, select, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="radio"], [role="menuitem"], [tabindex]:not([tabindex="-1"]), label, [onclick], [contenteditable="true"]';
        const raw = document.querySelectorAll(selectors);
        const seen = new Set();
        const results = [];
        let id = 1;
        for (const el of raw) {
          if (seen.has(el)) continue;
          seen.add(el);
          const rect = el.getBoundingClientRect();
          if (rect.width < 5 || rect.height < 5) continue;
          if (rect.x + rect.width < 0 || rect.y + rect.height < 0) continue;
          if (rect.x > window.innerWidth || rect.y > window.innerHeight) continue;
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.1) continue;
          let tag = el.tagName.toLowerCase();
          let type = el.type || '';
          let text = '';
          if (tag === 'input' || tag === 'textarea') {
            text = el.placeholder || el.name || el.id || el.value || '';
          } else {
            text = (el.textContent || el.innerText || '').trim().slice(0, 40);
          }
          let ariaLabel = el.getAttribute('aria-label') || el.getAttribute('title') || '';
          let elType = 'clickable';
          if (tag === 'input' && ['text', 'email', 'password', 'search', 'url', 'tel', 'number'].includes(type)) elType = 'input';
          else if (tag === 'textarea') elType = 'input';
          else if (tag === 'select') elType = 'select';
          results.push({
            id: id++,
            tag, type, text: ariaLabel || text,
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
            center: { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) },
            elType
          });
        }
        return results;
      });
    } catch { return []; }
  }

  async drawOverlay(elements) {
    this._elements = elements;
    await this.page.evaluate((els) => {
      const existing = document.getElementById('__cua_overlay');
      if (existing) existing.remove();
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('id', '__cua_overlay');
      svg.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;pointer-events:none;';
      for (const el of els) {
        const r = el.rect;
        const box = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        box.setAttribute('x', r.x); box.setAttribute('y', r.y);
        box.setAttribute('width', r.width); box.setAttribute('height', r.height);
        box.setAttribute('stroke', '#FF4444'); box.setAttribute('stroke-width', '2.5');
        box.setAttribute('fill', 'rgba(255,68,68,0.1)'); box.setAttribute('rx', '3');
        svg.appendChild(box);
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', Math.max(r.x, 2)); label.setAttribute('y', Math.max(r.y - 6, 14));
        label.setAttribute('fill', '#FF4444'); label.setAttribute('font-size', '14');
        label.setAttribute('font-weight', 'bold'); label.setAttribute('font-family', 'monospace');
        label.setAttribute('stroke', 'white'); label.setAttribute('stroke-width', '0.5');
        label.textContent = String(el.id);
        svg.appendChild(label);
      }
      document.documentElement.appendChild(svg);
    }, elements);
  }

  async removeOverlay() {
    try { await this.page.evaluate(() => { const el = document.getElementById('__cua_overlay'); if (el) el.remove(); }); } catch {}
  }

  async getAnnotatedScreenshot(name) {
    const elements = await this.getInteractiveElements();
    await this.drawOverlay(elements);
    await this.page.waitForTimeout(100);
    const buf = await this.page.screenshot({ type: 'png' });
    const filepath = path.join(this.config.screenshotDir, `op_${name}_${Date.now()}.png`);
    fs.writeFileSync(filepath, buf);
    await this.removeOverlay();
    return { base64: buf.toString('base64'), filepath, elements };
  }

  // ─── Coordinate-based actions ────────────────────────────────────────

  async executeAction(action) {
    try {
      switch (action.type) {
        case 'click':
          if (action.elementId != null) {
            const el = this._elements.find(e => e.id === action.elementId);
            if (!el) return { done: false, success: false, error: `Elemento ${action.elementId} no encontrado` };
            await this.page.mouse.move(el.center.x, el.center.y, { steps: 8 });
            await this.page.waitForTimeout(50);
            await this.page.mouse.click(el.center.x, el.center.y);
          } else if (action.x != null && action.y != null) {
            await this.page.mouse.move(action.x, action.y, { steps: 8 });
            await this.page.waitForTimeout(50);
            await this.page.mouse.click(action.x, action.y);
          } else if (action.selector) {
            await this.page.click(action.selector, { timeout: 5000 });
          } else if (action.text) {
            await this.page.click(`text=${action.text}`, { timeout: 5000 });
          }
          break;

        case 'type':
          if (action.elementId != null) {
            const el = this._elements.find(e => e.id === action.elementId);
            if (!el) return { done: false, success: false, error: `Elemento ${action.elementId} no encontrado` };
            await this.page.mouse.click(el.center.x, el.center.y);
            await this.page.waitForTimeout(100);
            await this.page.keyboard.selectAll();
            await this.page.keyboard.press('Delete');
          } else if (action.x != null && action.y != null) {
            await this.page.mouse.click(action.x, action.y);
            await this.page.waitForTimeout(100);
            await this.page.keyboard.selectAll();
            await this.page.keyboard.press('Delete');
          } else if (action.selector) {
            await this.page.fill(action.selector, action.value);
            break;
          }
          for (const char of action.value) {
            await this.page.keyboard.type(char, { delay: 15 + Math.random() * 40 });
          }
          break;

        case 'navigate':
          await this.page.goto(action.url, { waitUntil: 'domcontentloaded' });
          break;

        case 'press':
          await this.page.keyboard.press(action.key);
          break;

        case 'scroll':
          await this.page.evaluate((dir) => {
            window.scrollBy(0, dir === 'down' ? 500 : -500);
          }, action.direction || 'down');
          break;

        case 'wait':
          await this.page.waitForTimeout(action.ms || 1000);
          break;

        case 'done':
          return { done: true, success: true };
      }
      await this.page.waitForTimeout(300);
      return { done: false, success: true };
    } catch (e) {
      return { done: false, success: false, error: e.message };
    }
  }

  // ─── CUA-style: Inner monologue + bounding box reasoning ─────────────

  async thinkBeforeAct(screenshotBase64, elements, task, history) {
    const url = this.page.url();
    const title = await this.page.title();
    const actionCount = history.length;

    const elementsDesc = elements.slice(0, 40).map(e =>
      `[${e.id}] <${e.tag}${e.type ? ` type="${e.type}"` : ''}> "${e.text}" at (${e.center.x},${e.center.y}) rect=[${e.rect.x},${e.rect.y},${e.rect.width}x${e.rect.height}] type=${e.elType}`
    ).join('\n');

    const recentHistory = history.slice(-5).map(h =>
      `${h.action} → ${h.success ? '✓' : '✗'}`
    ).join('\n');

    const question = `Eres CUA (Computer-Using Agent). Ves una captura de pantalla con elementos numerados.

TAREA: ${task}
URL: ${url}
TÍTULO: ${title}
ELEMENTOS DISPONIBLES:
${elementsDesc}

HISTORIAL RECIENTE:
${recentHistory || '(ninguno)'}

INNER MONOLOGUE (piensa paso a paso):
1. ¿Qué página es y en qué estado está?
2. ¿Qué elementos numerados son relevantes para la tarea?
3. ¿Cuál es el siguiente paso lógico?
4. ¿Qué acción específica tomar?

Responde EXACTAMENTE con UNA de estas acciones:
- CLICK [número] — hacer clic en el elemento numerado
- TYPE "texto" INTO [número] — escribir en el elemento numerado
- NAVIGATE "url" — navegar a una URL
- SCROLL DOWN / SCROLL UP — desplazar
- PRESS "tecla" — presionar tecla
- WAIT — esperar 2 segundos
- DONE — tarea completada
- FAIL "razón" — no se puede completar`;

    try {
      const aiResponse = await analyzeScreenshot(screenshotBase64, task, { url, title });
      this.aiCallCount++;
      if (aiResponse) {
        console.log(`[AI] ${aiResponse.split('\n')[0].slice(0, 120)}...`);
        const action = this._parseAIResponse(aiResponse);
        if (action) return action;
      }
    } catch (e) {
      console.log(`[AI Error] ${e.message}`);
    }
    return this._heuristicAction(actionCount);
  }

  _parseAIResponse(response) {
    if (!response) return null;
    const lines = response.split('\n');
    for (const line of lines) {
      const trimmed = line.trim().toUpperCase();
      if (trimmed.startsWith('DONE')) return { type: 'done' };
      if (trimmed.startsWith('WAIT')) return { type: 'wait', ms: 2000 };

      const failMatch = line.match(/FAIL\s+"([^"]+)"/i);
      if (failMatch) return { type: 'done', reason: failMatch[1] };

      const clickMatch = line.match(/CLICK\s+\[?(\d+)\]?/i);
      if (clickMatch) return { type: 'click', elementId: parseInt(clickMatch[1]) };

      const clickCoord = line.match(/CLICK\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/i);
      if (clickCoord) return { type: 'click', x: parseInt(clickCoord[1]), y: parseInt(clickCoord[2]) };

      const typeMatch = line.match(/TYPE\s+"([^"]*)"\s+INTO\s+\[?(\d+)\]?/i);
      if (typeMatch) return { type: 'type', elementId: parseInt(typeMatch[2]), value: typeMatch[1] };

      const navigateMatch = line.match(/NAVIGATE\s+"([^"]+)"/i);
      if (navigateMatch) return { type: 'navigate', url: navigateMatch[1] };

      const scrollMatch = line.match(/SCROLL\s+(UP|DOWN)/i);
      if (scrollMatch) return { type: 'scroll', direction: scrollMatch[1].toLowerCase() };

      const pressMatch = line.match(/PRESS\s+"([^"]+)"/i);
      if (pressMatch) return { type: 'press', key: pressMatch[1] };
    }
    return null;
  }

  _heuristicAction(actionCount) {
    if (actionCount > 15) return { type: 'done' };
    return { type: 'wait', ms: 1000 };
  }

  // ─── Main task loop (CUA-style) ──────────────────────────────────────

  async runTask(task, startUrl, options = {}) {
    console.log(`\n=== CUA ENGINE ===`);
    console.log(`Task: ${task}`);
    console.log(`URL: ${startUrl}`);

    if (!this.page) await this.launch(options);

    if (startUrl) {
      await this.page.goto(startUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(2000);
    }

    const history = [];
    let completed = false;
    let reason = 'max iterations reached';

    for (let i = 0; i < this.config.maxIterations; i++) {
      this.iterationCount++;
      const iterationStart = Date.now();

      try {
        // 1. Get annotated screenshot with bounding boxes
        const { base64: screenshotBase64, elements } = await this.getAnnotatedScreenshot(`iter_${i}`);

        // 2. Get page state
        const beforeState = await this.getState();

        // 3. Think: AI analyzes annotated screenshot
        const action = await this.thinkBeforeAct(screenshotBase64, elements, task, history);

        if (!action) {
          console.log(`[${i}] No action, waiting...`);
          await this.page.waitForTimeout(1000);
          continue;
        }

        if (action.type === 'done') {
          completed = true;
          reason = action.reason || 'task completed';
          console.log(`✓ Task completed in ${i} iterations`);
          break;
        }

        // 4. Execute action
        const result = await this.executeAction(action);

        // 5. Verify
        await this.page.waitForTimeout(500);
        const afterState = await this.getState();
        const verification = await this.heuristicVerifier.verify(action, beforeState, afterState);

        history.push({
          iteration: i,
          action: `${action.type}${action.elementId != null ? `[${action.elementId}]` : ''}`,
          success: verification.success,
          url: afterState.url,
          time: Date.now() - iterationStart
        });

        console.log(`[${i}] ${history[history.length - 1].action} → ${verification.success ? '✓' : '✗'} (${Date.now() - iterationStart}ms)`);
      } catch (err) {
        console.error(`[${i}] Iteration error:`, err.message);
        history.push({ iteration: i, error: err.message, time: Date.now() - iterationStart });
        if (err.message && err.message.includes('Target page, context or browser has been closed')) {
          reason = 'browser closed';
          break;
        }
      }
    }

    // Final screenshot
    let finalScreenshot = null;
    try {
      const final = await this.getAnnotatedScreenshot('final');
      finalScreenshot = final.base64;
    } catch {}

    console.log(`\nIterations: ${this.iterationCount}`);
    console.log(`AI Calls: ${this.aiCallCount}`);
    return {
      success: completed,
      completed,
      reason,
      iterations: this.iterationCount,
      aiCalls: this.aiCallCount,
      history,
      screenshot: finalScreenshot,
      url: this.page?.url() || null
    };
  }

  async close() {
    try { await this.browser?.close(); } catch {}
    this.browser = null;
    this.page = null;
  }
}
