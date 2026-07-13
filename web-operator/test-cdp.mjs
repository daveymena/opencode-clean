import { chromium } from 'playwright';

async function main() {
  for (const port of [9222, 9229]) {
    try {
      console.log(`Trying port ${port}...`);
      const browser = await chromium.connectOverCDP(`http://localhost:${port}`);
      const contexts = browser.contexts();
      console.log(`Connected on port ${port}! Contexts: ${contexts.length}`);
      for (const ctx of contexts) {
        for (const p of ctx.pages()) {
          console.log(`  Page: "${await p.title()}" ${p.url()}`);
        }
      }
      await browser.close();
      return;
    } catch (e) {
      console.log(`Port ${port}: ${e.message}`);
    }
  }
}
main().catch(console.error);
