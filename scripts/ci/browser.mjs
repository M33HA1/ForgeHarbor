// Headless entry point for the same suites used through Playwright MCP.
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const execute = promisify(execFile);
const python = process.env.PYTHON || 'python3';
const playwright = process.env.PLAYWRIGHT_MODULE
  ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href)
  : await import('playwright');
const browser = await playwright.chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
});
let runId;
async function fixture(action) {
  const args = ['scripts/web-live-fixture.py', action, ...(runId ? [runId] : [])];
  const { stdout } = await execute(python, args, { cwd: root, timeout: 120000, maxBuffer: 1024 * 1024 });
  return JSON.parse(stdout);
}
// Source is repository-owned test code, never response data or user input.
function testFunction(source) { return new Function(`return (${source})`)(); }
try {
  const host = await browser.newPage();
  const mock = testFunction(await readFile(new URL('../check-web-ui.js', import.meta.url), 'utf8'));
  console.log(JSON.stringify(await mock(host)));
  runId = (await fixture('init')).runId;
  try {
    const create = testFunction((await fixture('render-create')).code);
    console.log(JSON.stringify(await create(host)));
    await fixture('seed');
    const verify = testFunction((await fixture('render-verify')).code);
    console.log(JSON.stringify(await verify(host)));
  } finally {
    console.log(JSON.stringify(await fixture('cleanup')));
  }
} finally {
  await browser.close();
}
