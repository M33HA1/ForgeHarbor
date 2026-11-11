import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const playwright = process.env.PLAYWRIGHT_MODULE
  ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
  : await import('playwright');
const browser = await playwright.chromium.launch({ headless: true,
  ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
try {
  const source = await readFile(new URL('../check-web-mfa.js', import.meta.url), 'utf8');
  // Repository-owned test code, never response data or user input.
  const test = new Function(`return (${source})`)();
  console.log(JSON.stringify(await test(await browser.newPage())));
} finally { await browser.close(); }
