import { chromium } from 'playwright';
import { resolve } from 'path';
import { execSync } from 'child_process';

export class BrowserManager {
  constructor(options = {}) {
    this.headless = options.headless !== false;
    this.viewport = options.viewport || { width: 1280, height: 800 };
    this.context = null;
    this.page = null;
    this._elements = [];
    this._overlayId = null;
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

  async launchWithProfile(profileName) {
    try { execSync('taskkill /f /im chrome.exe 2>nul', { stdio: 'ignore' }); } catch {}
    await this.delay(2000);

    const src = `C:\\Users\\ADMIN\\AppData\\Local\\Google\\Chrome\\User Data\\${profileName}`;
    const dest = resolve(process.cwd(), '.chrome-session');
    try { execSync(`robocopy "${src}" "${dest}" /E /NP /NFL /NDL /NJH /NJS >nul 2>nul`, { stdio: 'ignore' }); } catch {}
    await this.delay(1000);

    this.context = await chromium.launchPersistentContext(dest, {
      headless: false,
      viewport: this.viewport,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'es-CO',
      timezoneId: 'America/Bogota',
      geolocation: { latitude: 4.711, longitude: -74.0721 },
      permissions: ['geolocation'],
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--start-maximized'],
    });
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5].map(() => ({ length: 1 })) });
      Object.defineProperty(navigator, 'languages', { get: () => ['es-CO', 'es', 'en-US', 'en'] });
      window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {} };
    });
    this.page = this.context.pages()[0] || await this.context.newPage();
    console.log(`  [Browser] Chrome lanzado con perfil copiado: ${profileName}`);
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

  // ─── CUA-style: Interactive Elements with bounding boxes ──────────────

  async getInteractiveElements() {
    if (!this.page) return [];
    try {
      return await this.page.evaluate(() => {
        const selectors = 'button, a, input, textarea, select, [role="button"], [role="link"], [role="option"], [role="tab"], [role="checkbox"], [role="radio"], [role="menuitem"], [tabindex]:not([tabindex="-1"]), label, [onclick], [contenteditable="true"]';
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
            tag,
            type,
            text: ariaLabel || text,
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
    if (!this.page) return;
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
        box.setAttribute('x', r.x);
        box.setAttribute('y', r.y);
        box.setAttribute('width', r.width);
        box.setAttribute('height', r.height);
        box.setAttribute('stroke', '#FF4444');
        box.setAttribute('stroke-width', '2.5');
        box.setAttribute('fill', 'rgba(255,68,68,0.1)');
        box.setAttribute('rx', '3');
        svg.appendChild(box);

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', Math.max(r.x, 2));
        label.setAttribute('y', Math.max(r.y - 6, 14));
        label.setAttribute('fill', '#FF4444');
        label.setAttribute('font-size', '14');
        label.setAttribute('font-weight', 'bold');
        label.setAttribute('font-family', 'monospace');
        label.setAttribute('stroke', 'white');
        label.setAttribute('stroke-width', '0.5');
        label.textContent = String(el.id);
        svg.appendChild(label);
      }

      document.documentElement.appendChild(svg);
    }, elements);
  }

  async removeOverlay() {
    if (!this.page) return;
    try {
      await this.page.evaluate(() => {
        const el = document.getElementById('__cua_overlay');
        if (el) el.remove();
      });
    } catch {}
  }

  async getAnnotatedScreenshot() {
    const elements = await this.getInteractiveElements();
    await this.drawOverlay(elements);
    await this.delay(100);
    const base64 = await this.takeScreenshot();
    await this.removeOverlay();
    return { base64, elements };
  }

  // ─── CUA-style: Coordinate-based actions ─────────────────────────────

  async clickAt(x, y) {
    if (!this.page) return false;
    try {
      await this.page.mouse.move(x, y, { steps: 10 });
      await this.delay(50 + Math.random() * 100);
      await this.page.mouse.click(x, y);
      await this.delay(200 + Math.random() * 300);
      return true;
    } catch { return false; }
  }

  async clickElementById(id) {
    const el = this._elements.find(e => e.id === id);
    if (!el) return false;
    return this.clickAt(el.center.x, el.center.y);
  }

  async typeAt(text, x, y) {
    if (!this.page) return false;
    try {
      await this.page.mouse.click(x, y);
      await this.delay(200 + Math.random() * 200);
      await this.page.keyboard.selectAll();
      await this.delay(50);
      await this.page.keyboard.press('Delete');
      await this.delay(50);
      for (const char of text) {
        await this.page.keyboard.type(char, { delay: 20 + Math.random() * 50 });
      }
      await this.delay(100);
      return true;
    } catch { return false; }
  }

  async typeIntoElement(id, text) {
    const el = this._elements.find(e => e.id === id);
    if (!el) return false;
    return this.typeAt(text, el.center.x, el.center.y);
  }

  async selectOptionAt(text, x, y) {
    if (!this.page) return false;
    try {
      await this.page.mouse.click(x, y);
      await this.delay(300);
      const opt = this.page.locator('option', { hasText: text }).first();
      if (await opt.isVisible({ timeout: 2000 })) {
        await opt.click();
        await this.delay(200);
        return true;
      }
      return false;
    } catch { return false; }
  }

  // ─── Legacy DOM-based methods (fallback) ─────────────────────────────

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
            for (const char of text) { await this.page.keyboard.type(char, { delay: 20 + Math.random() * 50 }); }
            await this.delay(300);
            return true;
          }
        } catch {}
      }
      for (const char of text) { await this.page.keyboard.type(char, { delay: 20 + Math.random() * 50 }); }
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
