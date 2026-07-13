import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import https from 'https';
import http from 'http';

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

class AIVisionClient {
  constructor(config = {}) {
    loadEnv();
    this.copilotToken = this._loadCopilotToken();
    this.freemodelKey = process.env.FREEMODEL_API_KEY || null;
    this.freemodelUrl = process.env.FREEMODEL_BASE_URL || 'https://api.freemodel.dev/v1';
    this.freemodelModel = process.env.FREEMODEL_MODEL || 'gpt-4o';
    console.log(`[AI] FreeModel: ${this.freemodelKey ? 'CONFIGURED' : 'NOT SET'}`);
    console.log(`[AI] Copilot: ${this.copilotToken ? 'CONFIGURED' : 'NOT SET'}`);
  }

  _loadCopilotToken() {
    try {
      const tokenFile = path.join(
        process.env.USERPROFILE || process.env.HOME,
        'Downloads', 'OpenCode-Limpio', '.env.copilot'
      );
      const content = fs.readFileSync(tokenFile, 'utf8');
      const match = content.match(/GITHUB_COPILOT_TOKEN=(.+)/);
      if (match) return match[1].trim();
    } catch {}
    return process.env.GITHUB_COPILOT_TOKEN || null;
  }

  async analyzeScreenshot(base64Image, question) {
    if (this.copilotToken) {
      try {
        const result = await this._callCopilot(base64Image, question);
        console.log(`[AI] Copilot respondió (${result.length} chars)`);
        return result;
      } catch (e) {
        console.log(`[AI] Copilot falló: ${e.message}`);
      }
    }
    if (this.freemodelKey) {
      try {
        const result = await this._callFreeModel(base64Image, question);
        console.log(`[AI] FreeModel respondió (${result.length} chars)`);
        return result;
      } catch (e) {
        console.log(`[AI] FreeModel falló: ${e.message}`);
      }
    }
    return null;
  }

  async _callCopilot(base64Image, question) {
    const body = JSON.stringify({
      model: "gpt-4o",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } },
          { type: "text", text: question }
        ]
      }]
    });
    return this._httpsPost(
      "https://api.githubcopilot.com/chat/completions",
      {
        "Authorization": `Bearer ${this.copilotToken}`,
        "Editor-Version": "vscode/1.96.0",
        "Content-Type": "application/json"
      },
      body
    );
  }

  async _callFreeModel(base64Image, question) {
    const body = JSON.stringify({
      model: this.freemodelModel,
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } },
          { type: "text", text: question }
        ]
      }]
    });
    const url = this.freemodelUrl.endsWith("/v1")
      ? `${this.freemodelUrl}/chat/completions`
      : `${this.freemodelUrl}/v1/chat/completions`;
    return this._httpsPost(url, {
      "Authorization": `Bearer ${this.freemodelKey}`,
      "Content-Type": "application/json"
    }, body);
  }

  _httpsPost(urlStr, headers, bodyStr) {
    return new Promise((resolve, reject) => {
      const u = new URL(urlStr);
      const opts = {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: "POST",
        headers: { ...headers, "Content-Length": Buffer.byteLength(bodyStr) }
      };
      const mod = u.protocol === "https:" ? https : http;
      let data = "";
      const req = mod.request(opts, r => {
        r.on("data", c => data += c);
        r.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
            resolve(json.choices?.[0]?.message?.content || JSON.stringify(json));
          } catch { resolve(data); }
        });
      });
      req.on("error", reject);
      req.setTimeout(8000, () => { req.destroy(); reject(new Error("Timeout")); });
      req.write(bodyStr);
      req.end();
    });
  }
}

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
    this.aiVision = new AIVisionClient();
    this.iterationCount = 0;
    this.aiCallCount = 0;
    this._elements = [];
  }

  async launch() {
    try {
      const chromePaths = [
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe'
      ];
      let chromePath = null;
      for (const p of chromePaths) {
        if (fs.existsSync(p)) {
          chromePath = p;
          break;
        }
      }
      if (chromePath) {
        this.browser = await chromium.launch({
          headless: false,
          executablePath: chromePath
        });
      } else {
        this.browser = await chromium.launch({ headless: false });
      }
      const context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 }
      });
      this.page = await context.newPage();
      return this;
    } catch (e) {
      console.error('Failed to launch browser:', e.message);
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
      const aiResponse = await this.aiVision.analyzeScreenshot(screenshotBase64, question);
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

  async runTask(task, startUrl) {
    console.log(`\n=== CUA ENGINE ===`);
    console.log(`Task: ${task}`);
    console.log(`URL: ${startUrl}`);

    await this.page.goto(startUrl, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(2000);

    const history = [];

    for (let i = 0; i < this.config.maxIterations; i++) {
      this.iterationCount++;
      const iterationStart = Date.now();

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
    }

    console.log(`\nIterations: ${this.iterationCount}`);
    console.log(`AI Calls: ${this.aiCallCount}`);
    return { iterations: this.iterationCount, aiCalls: this.aiCallCount };
  }
}
