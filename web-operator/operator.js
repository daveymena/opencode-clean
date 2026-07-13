import { BrowserManager } from './browser.js';
import { analyzeScreenshot, analyzeWithContext, extractPageContent, solveCaptchaVision, callBestModel } from './ai-client.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEMORY_DIR = resolve(__dirname, '.site-memory');
if (!existsSync(MEMORY_DIR)) mkdirSync(MEMORY_DIR, { recursive: true });

export function loadSiteMemory(domain) {
  const file = resolve(MEMORY_DIR, `${domain.replace(/[^a-z0-9]/gi, '_')}.json`);
  if (existsSync(file)) { try { return JSON.parse(readFileSync(file, 'utf-8')); } catch {} }
  return { domain, instructions: [], preferences: {}, loginSaved: false, visitCount: 0, lastVisit: null };
}

function saveSiteMemory(domain, data) {
  const file = resolve(MEMORY_DIR, `${domain.replace(/[^a-z0-9]/gi, '_')}.json`);
  data.lastVisit = new Date().toISOString();
  data.visitCount = (data.visitCount || 0) + 1;
  writeFileSync(file, JSON.stringify(data, null, 2));
}

export function addSiteInstruction(domain, instruction) {
  const memory = loadSiteMemory(domain);
  memory.instructions.push({ text: instruction, added: new Date().toISOString() });
  saveSiteMemory(domain, memory);
}

// ─── CUA-style Action Parser ─────────────────────────────────────────────

function parseCuaAction(response) {
  if (!response) return null;
  const lines = response.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    if (/^DONE/i.test(trimmed)) return { type: 'DONE' };
    if (/^FAIL\s+/i.test(trimmed)) {
      const reason = trimmed.replace(/^FAIL\s+/i, '').replace(/^["\s]+|["\s]+$/g, '');
      return { type: 'FAIL', reason };
    }
    if (/^WAIT/i.test(trimmed)) return { type: 'WAIT' };

    // CLICK [n]
    const clickIdMatch = trimmed.match(/^CLICK\s+\[?(\d+)\]?/i);
    if (clickIdMatch) return { type: 'CLICK', elementId: parseInt(clickIdMatch[1]) };

    // CLICK(x, y)
    const clickCoordMatch = trimmed.match(/^CLICK\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (clickCoordMatch) return { type: 'CLICK', x: parseInt(clickCoordMatch[1]), y: parseInt(clickCoordMatch[2]) };

    // TYPE "text" INTO [n]
    const typeMatch = trimmed.match(/^TYPE\s+"([^"]*)"\s+INTO\s+\[?(\d+)\]?/i);
    if (typeMatch) return { type: 'TYPE', value: typeMatch[1], elementId: parseInt(typeMatch[2]) };

    // SELECT "text" FROM [n]
    const selectMatch = trimmed.match(/^SELECT\s+"([^"]+)"\s+FROM\s+\[?(\d+)\]?/i);
    if (selectMatch) return { type: 'SELECT', value: selectMatch[1], elementId: parseInt(selectMatch[2]) };

    // SCROLL UP / DOWN
    if (/^SCROLL\s+(UP|DOWN)/i.test(trimmed)) {
      const dir = trimmed.match(/SCROLL\s+(UP|DOWN)/i)[1].toLowerCase();
      return { type: 'SCROLL', direction: dir };
    }

    // PRESS "key"
    const pressMatch = trimmed.match(/^PRESS\s+"([^"]+)"/i);
    if (pressMatch) return { type: 'PRESS', key: pressMatch[1] };

    // NAVIGATE "url"
    const navMatch = trimmed.match(/^NAVIGATE\s+"([^"]+)"/i);
    if (navMatch) return { type: 'NAVIGATE', url: navMatch[1] };

    // EXTRACT "description"
    const extractMatch = trimmed.match(/^EXTRACT\s+"([^"]+)"/i);
    if (extractMatch) return { type: 'EXTRACT', description: extractMatch[1] };
  }

  // Fallback: legacy DOM-based parsing
  const firstLine = lines.find(l => l.trim());
  if (!firstLine) return null;
  const t = firstLine.trim();

  if (/^TASK_COMPLETE/i.test(t)) return { type: 'DONE' };
  if (/^TASK_FAILED/i.test(t)) return { type: 'FAIL', reason: t.replace(/^TASK_FAILED\s*/i, '').replace(/^["\s]+|["\s]+$/g, '') };

  const legacyClick = t.match(/^CLICK\s+"([^"]+)"(?:\s+"([^"]+)")?/i);
  if (legacyClick) return { type: 'CLICK', target: legacyClick[1], context: legacyClick[2] || null };

  const legacyType = t.match(/^TYPE\s+"([^"]*)"\s+INTO\s+"([^"]+)"/i);
  if (legacyType) return { type: 'TYPE', value: legacyType[1], target: legacyType[2] };

  const legacySelect = t.match(/^SELECT\s+"([^"]+)"\s+FROM\s+"([^"]+)"/i);
  if (legacySelect) return { type: 'SELECT', value: legacySelect[1], target: legacySelect[2] };

  if (/^REFRESH|^RELOAD/i.test(t)) return { type: 'NAVIGATE' };

  if (t.toLowerCase().includes('scroll')) return { type: 'SCROLL', direction: t.toLowerCase().includes('up') ? 'up' : 'down' };

  return { type: 'UNKNOWN', raw: t };
}

// ─── CUA-style Reasoning Engine ──────────────────────────────────────────

class ReasoningEngine {
  constructor(operator) {
    this.op = operator;
    this.plan = null;
    this.currentStep = 0;
    this.verificationHistory = [];
    this.replanCount = 0;
    this.maxReplans = 5;
  }

  async analyzeAndPlan(task, startUrl) {
    this.op.log('  [CUA] Analizando tarea...');
    const messages = [{
      role: 'system', content: `Eres CUA (Computer-Using Agent). Planifica la tarea paso a paso.
FORMATO JSON:
{
  "analysis": "qué hay que hacer",
  "strategy": "browser",
  "risks": ["posibles problemas"],
  "plan": [{"step": 1, "action": "descripción"}],
  "humanIntervention": false
}`
    }, {
      role: 'user', content: `TAREA: ${task}\nURL: ${startUrl || 'ninguna'}\nAnaliza y planifica.`
    }];
    const response = await callBestModel('planning', messages, 2048);
    if (!response) return null;
    try { const jsonMatch = response.match(/\{[\s\S]*\}/); if (jsonMatch) { this.plan = JSON.parse(jsonMatch[0]); return this.plan; } } catch {}
    return null;
  }

  async thinkBeforeAct(screenshot, elements, task, pageInfo, history) {
    const elementsDesc = elements.slice(0, 50).map(e =>
      `[${e.id}] <${e.tag}> "${e.text}" at(${e.center.x},${e.center.y}) [${e.elType}]`
    ).join('\n');

    const recentHistory = history.slice(-8).map(h => {
      const a = h.action;
      return `${a.type || '?'}${a.elementId != null ? `[${a.elementId}]` : a.target ? `("${a.target}")` : ''} → ${h.result.success ? 'OK' : 'FAIL'}`;
    }).join('\n');

    return await callBestModel('reasoning', [
      {
        role: 'system',
        content: `Eres CUA (Computer-Using Agent). Ves una captura de pantalla con elementos numerados en ROJO.
Escribe INNER MONOLOGUE (piensa paso a paso), luego responde con EXACTAMENTE UNA acción:

ACCIONES:
- CLICK [número] — clic en elemento numerado
- CLICK(x, y) — clic en coordenada exacta
- TYPE "texto" INTO [número] — escribir texto en elemento
- SELECT "opción" FROM [número] — seleccionar opción en dropdown
- SCROLL DOWN / SCROLL UP — desplazar página
- PRESS "tecla" — presionar tecla (ENTER, TAB, ESC, etc)
- WAIT — esperar
- NAVIGATE "url" — ir a URL
- DONE — tarea completada
- FAIL "razón" — imposible continuar`
      },
      {
        role: 'user',
        content: `TAREA: ${task}
URL: ${pageInfo.url}
TÍTULO: ${pageInfo.title}

ELEMENTOS EN PANTALLA:
${elementsDesc}

HISTORIAL RECIENTE:
${recentHistory || '(ninguno)'}

INNER MONOLOGUE:
1. Analizo la pantalla...
2. Identifico elementos relevantes...
3. Decido siguiente acción...`
      },
      {
        role: 'user',
        content: [{
          type: 'text',
          text: 'Captura con elementos numerados:'
        }, {
          type: 'image_url',
          image_url: { url: `data:image/png;base64,${screenshot}`, detail: 'high' }
        }]
      }
    ], 2048);
  }

  async verifyActionResult(action, screenshotBefore, screenshotAfter, task, pageInfo) {
    const response = await callBestModel('reasoning', [
      {
        role: 'system',
        content: `Eres un verificador visual. Compara las dos capturas y determina si la acción tuvo éxito.
RESPONDE JSON: { "success": true/false, "progressMade": true/false, "whatChanged": "...", "pageState": "...", "suggestion": "..." }`
      },
      {
        role: 'user',
        content: [{
          type: 'text',
          text: `Acción: ${action.type}${action.elementId != null ? ` [${action.elementId}]` : action.target ? ` "${action.target}"` : ''}\nURL: ${pageInfo.url}\n¿Tuvo éxito?`
        }, {
          type: 'image_url',
          image_url: { url: `data:image/png;base64,${screenshotAfter}`, detail: 'high' }
        }]
      }
    ], 1024);
    if (!response) return { success: false, progressMade: false };
    try { const jsonMatch = response.match(/\{[\s\S]*\}/); if (jsonMatch) return JSON.parse(jsonMatch[0]); } catch {}
    return { success: true, progressMade: true };
  }

  async replan(task, pageInfo, history, reason) {
    this.replanCount++;
    if (this.replanCount > this.maxReplans) { this.op.log('  Máximo de replanificaciones alcanzado'); return null; }
    const failureHistory = history.slice(-10).map(h => {
      const a = h.action;
      return `${a.type || '?'} → ${h.result.success ? 'OK' : 'FAIL'}`;
    }).join('\n');
    const response = await callBestModel('reasoning', [
      {
        role: 'system',
        content: `Estás ATASCADO. Crea un plan NUEVO. RESPONDE JSON:
{ "newStrategy": "...", "giveUp": false, "alternativeActions": [], "askUser": null }`
      },
      {
        role: 'user',
        content: `TAREA: ${task}\nURL: ${pageInfo.url}\nRAZÓN: ${reason}\nFallos:\n${failureHistory}\nNuevo plan:`
      }
    ], 1500);
    if (!response) return null;
    try { const jsonMatch = response.match(/\{[\s\S]*\}/); if (jsonMatch) return JSON.parse(jsonMatch[0]); } catch {}
    return null;
  }
}

// ─── CUA-style WebOperator ───────────────────────────────────────────────

export class WebOperator {
  constructor(options = {}) {
    this.browser = new BrowserManager({ headless: options.headless !== false, viewport: options.viewport });
    this.maxIterations = options.maxIterations || 50;
    this.verbose = options.verbose !== false;
    this.actionHistory = [];
    this.task = null;
    this.onMessage = options.onMessage || null;
    this.currentDomain = null;
    this.reasoning = new ReasoningEngine(this);
    this.chromeProfile = options.profile || null;
    this._lastScreenshot = null;
  }

  async detectLoginPage() {
    if (!this.browser.page) return false;
    return await this.browser.page.evaluate(() => {
      const body = (document.body.innerText || '').toLowerCase();
      const html = (document.body.innerHTML || '').toLowerCase();
      const patterns = [/iniciar\s*sesi/i, /log\s*in/i, /sign\s*in/i, /acceder/i];
      const hasPassInput = document.querySelector('input[type="password"], input[name*="pass"]');
      return hasPassInput || patterns.some(p => p.test(body) || p.test(html));
    });
  }

  async detectCaptcha() {
    if (!this.browser.page) return false;
    return await this.browser.page.evaluate(() => {
      const html = (document.body.innerHTML || '').toLowerCase();
      const patterns = [/recaptcha/i, /captcha/i, /verify.*human/i, /are you a robot/i, /turnstile/i];
      const hasFrame = document.querySelector('iframe[src*="recaptcha"], iframe[src*="captcha"]');
      return patterns.some(p => p.test(html)) || !!hasFrame;
    });
  }

  log(msg) { if (this.verbose) console.log(msg); if (this.onMessage) this.onMessage({ type: 'log', text: msg }); }

  logAction(action, result) { this.actionHistory.push({ action, result, timestamp: Date.now() }); if (this.actionHistory.length > 50) this.actionHistory.shift(); }

  // ─── CUA-style action execution ──────────────────────────────────────

  async executeAction(action) {
    if (!action) return { success: false, message: 'No action' };
    this.log(`  [CUA] Ejecutando: ${JSON.stringify(action)}`);

    try {
      switch (action.type) {
        case 'CLICK':
          if (action.elementId != null) {
            const ok = await this.browser.clickElementById(action.elementId);
            return { success: ok, message: `Click elemento [${action.elementId}]` };
          }
          if (action.x != null && action.y != null) {
            const ok = await this.browser.clickAt(action.x, action.y);
            return { success: ok, message: `Click(${action.x},${action.y})` };
          }
          if (action.target) {
            const ok = await this.browser.clickElement(action.target);
            return { success: ok, message: `Click "${action.target}"` };
          }
          return { success: false, message: 'CLICK sin objetivo' };

        case 'TYPE':
          if (action.elementId != null) {
            const ok = await this.browser.typeIntoElement(action.elementId, action.value);
            return { success: ok, message: `Type "${action.value}" en [${action.elementId}]` };
          }
          if (action.target) {
            const ok = await this.browser.typeText(action.value, action.target);
            return { success: ok, message: `Type en "${action.target}"` };
          }
          return { success: false, message: 'TYPE sin objetivo' };

        case 'SELECT':
          if (action.elementId != null) {
            const el = (await this.browser.getInteractiveElements()).find(e => e.id === action.elementId);
            if (el) {
              const ok = await this.browser.selectOptionAt(action.value, el.center.x, el.center.y);
              return { success: ok, message: `Select "${action.value}" en [${action.elementId}]` };
            }
            return { success: false, message: `Elemento [${action.elementId}] no encontrado` };
          }
          if (action.target) {
            const ok = await this.browser.selectOption(action.value, action.target);
            return { success: ok, message: `Select "${action.value}" en "${action.target}"` };
          }
          return { success: false, message: 'SELECT sin objetivo' };

        case 'SCROLL':
          await this.browser.scroll(action.direction || 'down');
          return { success: true, message: `Scroll ${action.direction || 'down'}` };

        case 'PRESS':
          await this.browser.page.keyboard.press(action.key);
          await this.browser.delay(200);
          return { success: true, message: `Press "${action.key}"` };

        case 'WAIT':
          await this.browser.delay(3000);
          return { success: true, message: 'Waited 3s' };

        case 'NAVIGATE':
          await this.browser.navigate(action.url || action.target);
          await this.browser.delay(1000);
          return { success: true, message: `Navigated to ${action.url || action.target}` };

        case 'EXTRACT': {
          const shot = await this.browser.takeScreenshot();
          const extracted = await extractPageContent(shot, action.description);
          this.lastExtracted = extracted;
          return { success: true, message: 'Extracted data', data: extracted };
        }

        case 'DONE':
        case 'TASK_COMPLETE':
          return { success: true, message: 'Tarea completada' };

        case 'FAIL':
        case 'TASK_FAILED':
          return { success: true, message: action.reason || 'Tarea fallida' };

        default:
          return { success: false, message: `Unknown action: ${action.type}` };
      }
    } catch (e) {
      this.log(`  [CUA] Error: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  // ─── CUA-style main loop ────────────────────────────────────────────

  async run(task, startUrl = null) {
    this.task = task;
    this.actionHistory = [];
    this.log('  CUA Web Operator iniciado');
    this.log(`  Tarea: ${task}`);

    if (this.chromeProfile) {
      this.log(`  Iniciando Chrome con perfil: ${this.chromeProfile}...`);
      await this.browser.launchWithProfile(this.chromeProfile);
    } else {
      this.log(`  Iniciando navegador...`);
      await this.browser.launch();
    }

    if (startUrl) {
      await this.browser.navigate(startUrl);
      try { this.currentDomain = new URL(startUrl).hostname; } catch {}
    }

    await this.browser.delay(1500);
    const plan = await this.reasoning.analyzeAndPlan(task, startUrl);
    let consecutiveFails = 0, noProgressCount = 0;

    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      this.log(`\n--- Iteración ${iteration + 1} ---`);
      const pageInfo = await this.browser.getPageInfo();

      // Get annotated screenshot (with bounding boxes)
      const { base64: screenshot, elements } = await this.browser.getAnnotatedScreenshot();
      this._lastScreenshot = screenshot;

      if (!screenshot) { this.log('  Error: No screenshot'); break; }

      this.onMessage?.({
        type: 'screenshot',
        data: screenshot,
        url: pageInfo.url,
        title: pageInfo.title,
        iteration: iteration + 1,
        maxIterations: this.maxIterations,
        elements: elements.slice(0, 30)
      });

      if (await this.detectLoginPage()) this.log('  Login detectado');
      if (await this.detectCaptcha()) this.log('  CAPTCHA detectado');

      // AI reasoning with annotated screenshot
      const thinkingResponse = await this.reasoning.thinkBeforeAct(
        screenshot, elements, task, pageInfo, this.actionHistory
      );

      if (!thinkingResponse) {
        consecutiveFails++;
        if (consecutiveFails >= 3) { this.log('  3 fallos consecutivos, abortando'); break; }
        continue;
      }
      consecutiveFails = 0;

      // Parse inner monologue for logging
      const monologueMatch = thinkingResponse.match(/INNER MONOLOGUE:?([\s\S]*?)(?=ACCIÓN:|CLICK|TYPE|SCROLL|NAVIGATE|PRESS|WAIT|DONE|FAIL)/i);
      if (monologueMatch) {
        const monologue = monologueMatch[1].trim().slice(0, 300);
        this.log(`  [CUA] ${monologue}`);
      }

      // Parse action
      const action = parseCuaAction(thinkingResponse);
      if (!action || action.type === 'UNKNOWN') {
        noProgressCount++;
        if (noProgressCount > 5) {
          const replan = await this.reasoning.replan(task, pageInfo, this.actionHistory, 'Parsing failures');
          if (replan?.giveUp) break;
          noProgressCount = 0;
        }
        continue;
      }

      if (action.type === 'DONE' || action.type === 'TASK_COMPLETE') {
        const finalContent = await this.browser.extractText();
        const finalScreenshot = await this.browser.takeScreenshot();
        await this.browser.close();
        return {
          success: true,
          message: 'Task completed',
          iterations: iteration + 1,
          extractedData: this.lastExtracted,
          pageContent: finalContent.slice(0, 5000),
          screenshot: finalScreenshot,
          history: this.actionHistory
        };
      }

      if (action.type === 'FAIL' || action.type === 'TASK_FAILED') {
        await this.browser.close();
        return { success: false, message: action.reason, iterations: iteration + 1, history: this.actionHistory };
      }

      // Execute action
      const result = await this.executeAction(action);
      this.logAction(action, result);

      // Visual verification
      await this.browser.delay(500);
      const screenshotAfter = await this.browser.takeScreenshot();
      if (screenshotAfter) {
        const verification = await this.reasoning.verifyActionResult(
          action, this._lastScreenshot, screenshotAfter, task, pageInfo
        );
        this.log(`  [Verificación] Éxito: ${verification.success}, Progreso: ${verification.progressMade}`);
        if (verification.success && verification.progressMade) {
          noProgressCount = 0;
        } else {
          noProgressCount++;
          if (noProgressCount >= 3) {
            const replan = await this.reasoning.replan(
              task, pageInfo, this.actionHistory, verification.suggestion || 'Sin progreso'
            );
            if (replan?.giveUp) break;
            noProgressCount = 0;
          }
        }
      }
    }

    const finalExtracted = await this.browser.extractText();
    await this.browser.close();
    return {
      success: false,
      message: `Max iterations (${this.maxIterations}) reached`,
      partialData: finalExtracted.slice(0, 5000),
      history: this.actionHistory
    };
  }

  async runTask(task, startUrl = null) { return await this.run(task, startUrl); }
}
