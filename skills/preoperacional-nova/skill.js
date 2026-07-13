// ============================================================
// Skill: Preoperacional Nova
// Integra el preoperacional diario dentro de OpenCode Evolved.
// ============================================================

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const SKILL_DIR = path.dirname(new URL(import.meta.url).pathname);
const SKILL_SRC_DIR = process.env.PREOP_SKILL_SRC || path.join(SKILL_DIR, 'src');
const SKILL_DATA_DIR = process.env.PREOP_SKILL_DATA || path.join(process.cwd(), 'skills-data', 'preoperacional-nova');

fs.mkdirSync(SKILL_DATA_DIR, { recursive: true });

function log(...args) {
  console.log('[preop-skill]', ...args);
}

function runNode(scriptName, args = [], cwd = SKILL_SRC_DIR, env = {}) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(cwd, scriptName);
    if (!fs.existsSync(scriptPath)) {
      return reject(new Error(`Script no encontrado: ${scriptPath}`));
    }
    const child = spawn('node', [scriptPath, ...args], {
      cwd,
      env: { ...process.env, ...env, PREOP_SKILL_DATA: SKILL_DATA_DIR },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); log('stdout:', d.toString().trim()); });
    child.stderr.on('data', (d) => { stderr += d.toString(); log('stderr:', d.toString().trim()); });
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(stderr || `Exit code ${code}`));
      else resolve(stdout.trim());
    });
    child.on('error', reject);
  });
}

export async function runDaily(options = {}) {
  if (!fs.existsSync(SKILL_SRC_DIR)) {
    throw new Error(`Proyecto preoperacional-Nova no montado en ${SKILL_SRC_DIR}`);
  }
  const env = buildEnv(options);
  const output = await runNode('automation.js', ['--now'], SKILL_SRC_DIR, env);
  return {
    success: true,
    message: 'Preoperacional ejecutado',
    output,
    dataDir: SKILL_DATA_DIR
  };
}

export function getStatus() {
  return {
    skillSrc: SKILL_SRC_DIR,
    dataDir: SKILL_DATA_DIR,
    mounted: fs.existsSync(SKILL_SRC_DIR),
    automationJs: fs.existsSync(path.join(SKILL_SRC_DIR, 'automation.js'))
  };
}

function buildEnv(options) {
  return {
    PREOP_URL: options.url || process.env.PREOP_URL || '',
    PREOP_EMAIL: options.email || process.env.PREOP_EMAIL || '',
    PREOP_PASSWORD: options.password || process.env.PREOP_PASSWORD || '',
    PREOP_SUPERVISOR: options.supervisor || process.env.PREOP_SUPERVISOR || '',
    SMTP_HOST: process.env.SMTP_HOST || '',
    SMTP_PORT: process.env.SMTP_PORT || '',
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASS: process.env.SMTP_PASS || '',
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
    PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    PREOP_HEADLESS: 'true',
    PREOP_SKILL_DATA: SKILL_DATA_DIR
  };
}

// CLI mode
if (process.argv[1] === new URL(import.meta.url).pathname) {
  runDaily().then(console.log).catch(err => { console.error(err.message); process.exit(1); });
}
