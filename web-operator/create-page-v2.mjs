import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function humanDelay(min=600, max=1800) {
  await delay(Math.floor(Math.random() * (max - min + 1) + min));
}

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];

  // Go to create page
  console.log('Navigating to create page...');
  await page.goto('https://www.facebook.com/pages/create', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await delay(4000);
  
  // Take initial screenshot
  await page.screenshot({ path: 'step-1.png' });

  // Get page structure
  const buttons = await page.$$eval('button', els => els.slice(0,25).map(e => ({
    text: e.innerText?.trim()?.substring(0,50) || '',
    'aria-label': e.getAttribute('aria-label') || '',
    type: e.type || '',
    disabled: e.disabled
  })).filter(b => b.text || b['aria-label']));
  console.log('BUTTONS:', JSON.stringify(buttons, null, 2));

  const inputs = await page.$$eval('input, textarea', els => els.slice(0,10).map(e => ({
    placeholder: e.placeholder || '',
    'aria-label': e.getAttribute('aria-label') || '',
    name: e.name || '',
    id: e.id || ''
  })).filter(i => i.placeholder || i['aria-label']));
  console.log('INPUTS:', JSON.stringify(inputs, null, 2));

  await browser.close();
}
main().catch(console.error);
