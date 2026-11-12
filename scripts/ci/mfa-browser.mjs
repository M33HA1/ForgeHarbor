import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { startMFAProxy } from './mfa-proxy.mjs';

const playwright = process.env.PLAYWRIGHT_MODULE
  ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
  : await import('playwright');
const proxy = await startMFAProxy();
let browser;
try {
  // Compose considers containers without a health check ready once started.
  // Probe real listeners before starting the assertions; never retry test failures.
  await Promise.all([
    ['Go Auth', 'http://127.0.0.1:8180/auth/health'],
    ['Rust rollback', 'http://127.0.0.1:8181/auth/health'],
    ['Web gateway', 'http://127.0.0.1:8088/'],
  ].map(async ([name, url]) => {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
        await response.body?.cancel();
        if (response.ok) return;
      } catch { /* Startup only; keep the deadline bounded. */ }
      await delay(250);
    }
    throw new Error(`${name} fixture readiness timed out`);
  }));
  browser = await playwright.chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const source = await readFile(new URL('../check-web-mfa.js', import.meta.url), 'utf8');
  // Repository-owned test code, never response data or user input.
  const test = new Function(`return (${source})`)();
  console.log(JSON.stringify(await test(await browser.newPage())));
} finally {
  try { await browser?.close(); }
  finally {
    proxy.closeAllConnections();
    await new Promise(resolve => proxy.close(resolve));
  }
}
