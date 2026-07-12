import http from 'http';
import https from 'https';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env');
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (val) process.env[key] = val;
    }
  }
}
loadEnv();

const USE_COPILOT_FIRST = process.env.USE_COPILOT_FIRST === 'true' || process.env.GITHUB_COPILOT_ENABLED === 'true';
const COPILOT_MODEL = process.env.COPILOT_MODEL || 'gpt-4o';
const OPENCODE_PORT = parseInt(process.env.OPENCODE_INTERNAL_PORT || '21294');

function ocRequest(path, method, body, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: 'localhost', port: OPENCODE_PORT, path, method,
      headers: { 'Content-Type': 'application/json', ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode || 0, data }));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

async function sendToOpenCode(textContent, model = 'opencode/deepseek-v4-flash-free') {
  if (USE_COPILOT_FIRST) {
    const copilotResult = await callCopilot(textContent, COPILOT_MODEL);
    if (copilotResult) return copilotResult;
  }
  try {
    const sessRes = await ocRequest('/session', 'POST', {});
    if (sessRes.status !== 200 && sessRes.status !== 201) return null;
    const sessionId = JSON.parse(sessRes.data).id;
    const [providerID, modelID] = model.includes('/') ? model.split('/') : ['opencode', model];
    const res = await ocRequest(`/session/${sessionId}/message`, 'POST', {
      parts: [{ type: 'text', text: textContent }],
      model: { providerID, modelID },
    }, 180000);
    if (res.status !== 200) return null;
    const result = JSON.parse(res.data);
    let fullContent = '';
    if (result.parts && Array.isArray(result.parts)) {
      for (const part of result.parts) { if (part.type === 'text' && part.text) fullContent += part.text; }
    }
    return fullContent || null;
  } catch (e) { console.error(`  [AI] OpenCode error: ${e.message}`); }
  if (!USE_COPILOT_FIRST) return await callCopilot(textContent, COPILOT_MODEL);
  return null;
}

async function callCopilot(textContent, model = 'gpt-4o') {
  const copilotToken = await getCopilotToken();
  if (!copilotToken) return null;
  try {
    const resp = await fetch('https://api.githubcopilot.com/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${copilotToken}`, 'Content-Type': 'application/json', 'Editor-Version': 'vscode/1.96.0', 'Editor-Plugin-Version': 'copilot/1.250.0', 'Openai-Organization': 'github-copilot', 'Copilot-Integration-Id': 'vscode-chat' },
      body: JSON.stringify({ model, max_tokens: 4096, temperature: 0.1, messages: [{ role: 'user', content: textContent }], stream: false }),
      signal: AbortSignal.timeout(60000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || null;
  } catch { return null; }
}

async function callCopilotVision(base64, question, model = 'gpt-4o') {
  const copilotToken = await getCopilotToken();
  if (!copilotToken) return null;
  try {
    const resp = await fetch('https://api.githubcopilot.com/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${copilotToken}`, 'Content-Type': 'application/json', 'Editor-Version': 'vscode/1.96.0', 'Editor-Plugin-Version': 'copilot/1.250.0', 'Openai-Organization': 'github-copilot', 'Copilot-Integration-Id': 'vscode-chat' },
      body: JSON.stringify({ model, max_tokens: 4096, messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: `data:image/png;base64,${base64}`, detail: 'high' } }, { type: 'text', text: question }] }], stream: false }),
      signal: AbortSignal.timeout(60000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || null;
  } catch { return null; }
}

let copilotTokenCache = null;
let copilotTokenExpiry = 0;

async function getCopilotSessionToken(githubPat) {
  if (!githubPat) return null;
  if (githubPat.startsWith("tid_") || githubPat.startsWith("tid=")) {
    return { token: githubPat, expires_at: Date.now() + 1800 * 1000, refresh_in: 1800 };
  }
  try {
    const resp = await fetch("https://api.github.com/copilot_internal/v2/token", {
      method: "GET",
      headers: { "Authorization": `token ${githubPat}`, "Accept": "application/json", "User-Agent": "OpenCode-Evolved/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.token) return { token: data.token, expires_at: data.expires_at * 1000, refresh_in: data.refresh_in || 1800 };
    }
  } catch {}
  return null;
}

async function getCopilotToken() {
  if (copilotTokenCache && Date.now() < copilotTokenExpiry) return copilotTokenCache;
  const rawToken = process.env.GITHUB_COPILOT_TOKEN || process.env.GITHUB_TOKEN;
  if (!rawToken) return null;
  const session = await getCopilotSessionToken(rawToken);
  if (session) { copilotTokenCache = session.token; copilotTokenExpiry = session.expires_at - 60000; return session.token; }
  return null;
}

async function callVisionAPIs(base64, question) {
  if (USE_COPILOT_FIRST) {
    const copilotResult = await callCopilotVision(base64, question, COPILOT_MODEL);
    if (copilotResult) return copilotResult;
  }
  const key = process.env.FREEMODEL_API_KEY;
  const baseUrl = process.env.FREEMODEL_BASE_URL || 'https://api.freemodel.dev/v1';
  if (key) {
    try {
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: 'gpt-4o', max_tokens: 4096, messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: `data:image/png;base64,${base64}`, detail: 'high' } }, { type: 'text', text: question }] }] }),
        signal: AbortSignal.timeout(90000),
      });
      const data = await resp.json();
      const result = data.choices?.[0]?.message?.content;
      if (result) return result;
    } catch {}
  }
  if (!USE_COPILOT_FIRST) return await callCopilotVision(base64, question, COPILOT_MODEL);
  return null;
}

export async function callBestModel(taskType, messages, maxTokens = 4096) {
  const hasImages = messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image_url'));
  if (hasImages) {
    let base64 = '', question = '';
    for (const m of messages) {
      if (Array.isArray(m.content)) { for (const c of m.content) { if (c.type === 'image_url' && c.image_url?.url) base64 = c.image_url.url.split(',')[1] || ''; if (c.type === 'text') question += c.text + '\n'; } }
      else if (typeof m.content === 'string') question = m.content;
    }
    if (!base64) return await callCopilotVision(base64, question);
    return await callVisionAPIs(base64, question);
  }
  let textContent = '';
  const systemMsg = messages.find(m => m.role === 'system');
  const lastUserMsg = messages.filter(m => m.role === 'user').pop();
  if (systemMsg) textContent = systemMsg.content + '\n\n';
  if (lastUserMsg) {
    if (typeof lastUserMsg.content === 'string') textContent += lastUserMsg.content;
    else if (Array.isArray(lastUserMsg.content)) { for (const c of lastUserMsg.content) { if (c.type === 'text') textContent += c.text + '\n'; } }
  }
  const modelMap = { planning: 'opencode/deepseek-v4-flash-free', reasoning: 'opencode/deepseek-v4-flash-free', fast: 'opencode/deepseek-v4-flash-free', multitool: 'opencode/mimo-v2.5-free', vision: 'opencode/mimo-v2.5-free' };
  const model = modelMap[taskType] || 'opencode/deepseek-v4-flash-free';
  let result = await sendToOpenCode(textContent, model);
  if (!result) {
    const fallbackChain = { planning: ['opencode/big-pickle', 'opencode/nemotron-3-ultra-free'], reasoning: ['opencode/big-pickle', 'opencode/hy3-free'], fast: ['opencode/north-mini-code-free', 'opencode/big-pickle'] };
    if (fallbackChain[taskType]) { for (const fb of fallbackChain[taskType]) { if (fb === model) continue; result = await sendToOpenCode(textContent, fb); if (result) break; } }
  }
  if (!result) result = await callCopilot(textContent);
  return result;
}

export async function analyzeScreenshot(screenshotBase64, task, pageInfo) {
  return await callBestModel('vision', [
    { role: 'system', content: 'Eres un agente de automatización. ACCIONES: CLICK "texto", TYPE "texto" INTO "campo", SCROLL_DOWN, TASK_COMPLETE. Responde con SOLO UNA acción.' },
    { role: 'user', content: [{ type: 'text', text: `TAREA: ${task}\nURL: ${pageInfo.url}\n¿Qué hacer?` }, { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshotBase64}`, detail: 'high' } }] }
  ], 2048);
}

export async function analyzeWithContext(screenshotBase64, task, context, pageInfo) {
  return await callBestModel('vision', [
    { role: 'system', content: 'Eres un agente de automatización. Responde con una acción.' },
    { role: 'user', content: [{ type: 'text', text: `TAREA: ${task}\nCONTEXTO: ${context}\nURL: ${pageInfo.url}\n¿Qué hacer?` }, { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshotBase64}`, detail: 'high' } }] }
  ], 2048);
}

export async function extractPageContent(screenshotBase64, extractionDesc) {
  return await callBestModel('vision', [
    { role: 'user', content: [{ type: 'text', text: `Extrae: ${extractionDesc}` }, { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshotBase64}`, detail: 'high' } }] }
  ], 4096);
}

export async function solveCaptchaVision(screenshotBase64) {
  return await callBestModel('captcha', [
    { role: 'user', content: [{ type: 'text', text: 'Analiza este captcha. ¿Qué debo hacer?' }, { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshotBase64}`, detail: 'high' } }] }
  ], 1024);
}
