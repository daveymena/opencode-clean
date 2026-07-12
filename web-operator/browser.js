import { chromium } from 'playwright';
import { resolve } from 'path';

export class BrowserManager {
  constructor(options = {}) {
    this.headless = options.headless !== false;
    this.viewport = options.viewport || { width: 1280, height: 800 };
    this.context = null;
    this.page = null;
  }

  async launch() {
    const userDataDir = resolve(process.cwd(), '.chrome-session');
    this.context = await chromium.launchPersistentContext(userDataDir, {
      headless: this.headless,
      viewport: this.viewport,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'es-CO',
      timezoneId: 'America/Bogota',
      geolocation: { latitude: 4.711, longitude: -74.0721 },
      permissions: ['geolocation'],
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled', '--disable-infobars', '--start-maximized'],
    });
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5].map(() => ({ length: 1 })) });
      Object.defineProperty(navigator, 'languages', { get: () => ['es-CO', 'es', 'en-US', 'en'] });
      window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {} };
    });
    this.page = this.context.pages()[0] || await this.context.newPage();
    console.log(`  [Browser] Chrome lanzado (headless: ${this.headless})`);
    return { browser: this.context, page: this.page };
  }

  async navigate(url) {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.delay(1000);
  }

  async getPageInfo() {
    if (!this.page) return { url: '', title: '' };
    try { return { url: this.page.url(), title: await this.page.title() }; } catch { return { url: '', title: '' }; }
  }

  async takeScreenshot() {
    if (!this.page) return null;
    const buf = await this.page.screenshot({ type: 'png' });
    return buf.toString('base64');
  }

  async clickElement(text) {
    if (!this.page) return false;
    try {
      const selectors = [`text="${text}"`, `button:has-text("${text}")`, `a:has-text("${text}")`, `[role="button"]:has-text("${text}")`, `[aria-label="${text}"]`];
      for (const sel of selectors) {
        try {
          const el = this.page.locator(sel).first();
          if (await el.isVisible({ timeout: 1000 })) {
            await el.hover({ timeout: 2000 });
            await this.delay(100 + Math.random() * 200);
            await el.click();
            await this.delay(300 + Math.random() * 400);
            return true;
          }
        } catch {}
      }
      const clicked = await this.page.evaluate((txt) => {
        const els = document.querySelectorAll('button, a, input[type="submit"], [role="button"], span, label');
        for (const el of els) { if ((el.innerText || el.textContent || '').toLowerCase().includes(txt.toLowerCase())) { if (el.offsetParent !== null) { el.click(); return true; } } }
        return false;
      }, text);
      if (clicked) { await this.delay(300 + Math.random() * 400); return true; }
    } catch {}
    return false;
  }

  async typeText(text, fieldIdentifier) {
    if (!this.page) return false;
    try {
      const selectors = [`input[placeholder*="${fieldIdentifier}" i]`, `input[name*="${fieldIdentifier}" i]`, `input[aria-label*="${fieldIdentifier}" i]`, `textarea[placeholder*="${fieldIdentifier}" i]`, `input[type="text"]`, `input[type="email"]`, `textarea`];
      for (const sel of selectors) {
        try {
          const el = this.page.locator(sel).first();
          if (await el.isVisible({ timeout: 1000 })) {
            await el.click();
            await this.delay(200 + Math.random() * 300);
            for (const char of text) { await this.page.keyboard.type(char, { delay: 30 + Math.random() * 80 }); }
            await this.delay(300);
            return true;
          }
        } catch {}
      }
      for (const char of text) { await this.page.keyboard.type(char, { delay: 30 + Math.random() * 80 }); }
      return true;
    } catch { return false; }
  }

  async selectOption(optionText, dropdownIdentifier) {
    if (!this.page) return false;
    try {
      const selectors = [`select[name*="${dropdownIdentifier}" i]`, `select[id*="${dropdownIdentifier}" i]`, 'select'];
      for (const sel of selectors) {
        try { const el = this.page.locator(sel).first(); if (await el.isVisible({ timeout: 1000 })) { await el.selectOption({ label: optionText }); await this.delay(300); return true; } } catch {}
      }
    } catch {}
    return false;
  }

  async scroll(direction = 'down') {
    if (!this.page) return;
    await this.page.evaluate((amt) => window.scrollBy(0, amt), direction === 'down' ? 500 : -500);
    await this.delay(500);
  }

  async extractText() {
    if (!this.page) return '';
    try { return await this.page.evaluate(() => document.body.innerText); } catch { return ''; }
  }

  async close() {
    if (this.context) { try { await this.context.close(); } catch {} this.context = null; this.page = null; }
  }

  delay(ms) { return new Promise(r => setTimeout(r, ms + Math.random() * 50)); }
}
