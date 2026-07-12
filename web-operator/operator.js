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
    this.op.log('  [Razonamiento] Analizando tarea...');
    const messages = [{ role: 'system', content: `Eres un agente de automatización inteligente. Analiza la tarea y crea un plan paso a paso.
FORMATO JSON: { "analysis": "...", "strategy": "browser", "risks": [], "plan": [{"step":1,"action":"...","fallback":"..."}], "humanIntervention": false }` },
      { role: 'user', content: `TAREA: ${task}\nURL: ${startUrl || 'ninguna'}\nAnaliza y planifica.` }];
    const response = await callBestModel('planning', messages, 2048);
    if (!response) return null;
    try { const jsonMatch = response.match(/\{[\s\S]*\}/); if (jsonMatch) { this.plan = JSON.parse(jsonMatch[0]); return this.plan; } } catch {}
    return null;
  }

  async thinkBeforeAct(screenshot, task, pageInfo, history) {
    const recentHistory = history.slice(-8).map(h => `${h.action.type}("${h.action.target || ''}") → ${h.result.success ? 'OK' : 'FAIL'}`).join('\n');
    return await callBestModel('reasoning', [
      { role: 'system', content: `Eres un agente de automatización. Ves una captura de pantalla. Decide la MEJOR acción siguiente.
ACCIONES: CLICK "texto", TYPE "texto" INTO "campo", SELECT "opción" FROM "dropdown", SCROLL_DOWN, SCROLL_UP, WAIT, NAVIGATE "url", TASK_COMPLETE, TASK_FAILED "razón"
Responde: ANALISIS: ... DECISIÓN: ... ACCIÓN: ...` },
      { role: 'user', content: `TAREA: ${task}\nURL: ${pageInfo.url}\nTÍTULO: ${pageInfo.title}\nHistorial:\n${recentHistory}` },
      { role: 'user', content: [{ type: 'text', text: 'Captura de pantalla:' }, { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshot}`, detail: 'high' } }] }
    ], 2048);
  }

  async verifyActionResult(action, screenshotBefore, screenshotAfter, task, pageInfo) {
    const response = await callBestModel('reasoning', [
      { role: 'system', content: `Eres un verificador de acciones. Determina si la acción tuvo éxito. RESPONDE JSON: { "success": true/false, "progressMade": true/false, "whatChanged": "...", "pageState": "...", "suggestion": "..." }` },
      { role: 'user', content: [{ type: 'text', text: `Acción: ${action.type} ${action.target || ''}\nURL: ${pageInfo.url}\n¿Tuvo éxito?` }, { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshotAfter}`, detail: 'high' } }] }
    ], 1024);
    if (!response) return { success: false, progressMade: false };
    try { const jsonMatch = response.match(/\{[\s\S]*\}/); if (jsonMatch) return JSON.parse(jsonMatch[0]); } catch {}
    return { success: true, progressMade: true };
  }

  async replan(task, pageInfo, history, reason) {
    this.replanCount++;
    if (this.replanCount > this.maxReplans) { this.op.log('  Máximo de replanificaciones alcanzado'); return null; }
    const failureHistory = history.slice(-10).map(h => `${h.action.type}("${h.action.target || ''}") → ${h.result.success ? 'OK' : 'FAIL'}`).join('\n');
    const response = await callBestModel('reasoning', [
      { role: 'system', content: `Estás ATASCADO. Crea un plan NUEVO. RESPONDE JSON: { "newStrategy": "...", "giveUp": false, "alternativeActions": [], "askUser": null }` },
      { role: 'user', content: `TAREA: ${task}\nURL: ${pageInfo.url}\nRAZÓN: ${reason}\nFallos:\n${failureHistory}\nNuevo plan:` }
    ], 1500);
    if (!response) return null;
    try { const jsonMatch = response.match(/\{[\s\S]*\}/); if (jsonMatch) return JSON.parse(jsonMatch[0]); } catch {}
    return null;
  }
}

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

  parseAction(response) {
    if (!response) return null;
    const actionMatch = response.match(/ACCIÓN:\s*(.+)/i);
    const trimmed = (actionMatch ? actionMatch[1] : response).trim();
    if (trimmed.startsWith('TASK_COMPLETE')) return { type: 'TASK_COMPLETE' };
    if (trimmed.startsWith('TASK_FAILED')) return { type: 'TASK_FAILED', reason: trimmed.replace('TASK_FAILED', '').replace(/^["\s]+|["\s]+$/g, '') };
    const clickMatch = trimmed.match(/^CLICK\s+"([^"]+)"(?:\s+"([^"]+)")?/i);
    if (clickMatch) return { type: 'CLICK', target: clickMatch[1], context: clickMatch[2] || null };
    const typeMatch = trimmed.match(/^TYPE\s+"([^"]*)"\s+INTO\s+"([^"]+)"/i);
    if (typeMatch) return { type: 'TYPE', value: typeMatch[1], target: typeMatch[2] };
    const selectMatch = trimmed.match(/^SELECT\s+"([^"]+)"\s+FROM\s+"([^"]+)"/i);
    if (selectMatch) return { type: 'SELECT', value: selectMatch[1], target: selectMatch[2] };
    if (/^SCROLL_DOWN/i.test(trimmed)) return { type: 'SCROLL', direction: 'down' };
    if (/^SCROLL_UP/i.test(trimmed)) return { type: 'SCROLL', direction: 'up' };
    if (/^WAIT/i.test(trimmed)) return { type: 'WAIT' };
    const navMatch = trimmed.match(/^NAVIGATE\s+"([^"]+)"/i);
    if (navMatch) return { type: 'NAVIGATE', url: navMatch[1] };
    const extractMatch = trimmed.match(/^EXTRACT\s+"([^"]+)"/i);
    if (extractMatch) return { type: 'EXTRACT', description: extractMatch[1] };
    if (/^REFRESH|^RELOAD/i.test(trimmed)) return { type: 'NAVIGATE', url: this.lastUrl || '' };
    if (trimmed.toLowerCase().includes('click')) {
      const match = trimmed.match(/click\s+(?:on\s+)?["']?([^"'.]+)["']?/i);
      if (match) return { type: 'CLICK', target: match[1].trim() };
    }
    if (trimmed.toLowerCase().includes('scroll')) return { type: 'SCROLL', direction: trimmed.toLowerCase().includes('up') ? 'up' : 'down' };
    return { type: 'UNKNOWN', raw: trimmed };
  }

  async executeAction(action) {
    if (!action) return { success: false, message: 'No action' };
    this.log(`  [Operator] Ejecutando: ${action.type} ${JSON.stringify(action)}`);
    try {
      switch (action.type) {
        case 'CLICK': return { success: await this.browser.clickElement(action.target), message: `Click "${action.target}"` };
        case 'TYPE': return { success: await this.browser.typeText(action.value, action.target), message: `Type into "${action.target}"` };
        case 'SELECT': return { success: await this.browser.selectOption(action.value, action.target), message: `Select "${action.value}"` };
        case 'SCROLL': await this.browser.scroll(action.direction); return { success: true, message: `Scrolled ${action.direction}` };
        case 'WAIT': await this.browser.delay(3000); return { success: true, message: 'Waited 3s' };
        case 'NAVIGATE': await this.browser.navigate(action.url); this.lastUrl = action.url; return { success: true, message: `Navigated to ${action.url}` };
        case 'EXTRACT': {
          const screenshot = await this.browser.takeScreenshot();
          const extracted = await extractPageContent(screenshot, action.description);
          this.lastExtracted = extracted;
          return { success: true, message: 'Extracted data', data: extracted };
        }
        case 'TASK_COMPLETE': case 'TASK_FAILED': return { success: true, message: action.reason || action.type };
        default: return { success: false, message: 'Unknown action type' };
      }
    } catch (e) { this.log(`  [Operator] Error: ${e.message}`); return { success: false, message: e.message }; }
  }

  async run(task, startUrl = null) {
    this.task = task;
    this.actionHistory = [];
    this.log('  Web Operator iniciado');
    this.log(`  Tarea: ${task}`);
    this.log(`  Iniciando navegador...`);
    await this.browser.launch();
    if (startUrl) {
      await this.browser.navigate(startUrl);
      this.lastUrl = startUrl;
      try { this.currentDomain = new URL(startUrl).hostname; } catch {}
    }
    const plan = await this.reasoning.analyzeAndPlan(task, startUrl);
    let consecutiveFails = 0, noProgressCount = 0;

    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      this.log(`\n--- Iteración ${iteration + 1} ---`);
      const pageInfo = await this.browser.getPageInfo();
      const screenshot = await this.browser.takeScreenshot();
      if (!screenshot) { this.log('  Error: No screenshot'); break; }
      this.onMessage?.({ type: 'screenshot', data: screenshot, url: pageInfo.url, title: pageInfo.title, iteration: iteration + 1, maxIterations: this.maxIterations });

      if (await this.detectLoginPage()) this.log('  Login detectado');
      if (await this.detectCaptcha()) this.log('  CAPTCHA detectado');

      const thinkingResponse = await this.reasoning.thinkBeforeAct(screenshot, task, pageInfo, this.actionHistory);
      if (!thinkingResponse) { consecutiveFails++; if (consecutiveFails >= 3) break; continue; }
      consecutiveFails = 0;

      const analysisMatch = thinkingResponse.match(/ANÁLISIS:\s*(.+)/i);
      const decisionMatch = thinkingResponse.match(/DECISIÓN:\s*(.+)/i);
      if (analysisMatch) this.log(`  [Análisis] ${analysisMatch[1].trim().slice(0, 200)}`);
      if (decisionMatch) this.log(`  [Decisión] ${decisionMatch[1].trim().slice(0, 200)}`);

      const action = this.parseAction(thinkingResponse);
      if (!action) { noProgressCount++; if (noProgressCount > 5) { const replan = await this.reasoning.replan(task, pageInfo, this.actionHistory, 'Parsing failures'); if (replan?.giveUp) break; noProgressCount = 0; } continue; }

      if (action.type === 'TASK_COMPLETE') {
        const finalContent = await this.browser.extractText();
        const finalScreenshot = await this.browser.takeScreenshot();
        await this.browser.close();
        return { success: true, message: 'Task completed', iterations: iteration + 1, extractedData: this.lastExtracted, pageContent: finalContent.slice(0, 5000), screenshot: finalScreenshot, history: this.actionHistory };
      }
      if (action.type === 'TASK_FAILED') {
        await this.browser.close();
        return { success: false, message: action.reason, iterations: iteration + 1, history: this.actionHistory };
      }

      const result = await this.executeAction(action);
      this.logAction(action, result);
      const screenshotAfter = await this.browser.takeScreenshot();
      if (screenshotAfter) {
        const verification = await this.reasoning.verifyActionResult(action, screenshot, screenshotAfter, task, pageInfo);
        this.log(`  [Verificación] Éxito: ${verification.success}, Progreso: ${verification.progressMade}`);
        if (verification.success && verification.progressMade) noProgressCount = 0;
        else { noProgressCount++; if (noProgressCount >= 3) { const replan = await this.reasoning.replan(task, pageInfo, this.actionHistory, verification.suggestion || 'Sin progreso'); if (replan?.giveUp) break; noProgressCount = 0; } }
      }
    }
    const finalExtracted = await this.browser.extractText();
    await this.browser.close();
    return { success: false, message: `Max iterations (${this.maxIterations}) reached`, partialData: finalExtracted.slice(0, 5000), history: this.actionHistory };
  }

  async runTask(task, startUrl = null) { return await this.run(task, startUrl); }
}
