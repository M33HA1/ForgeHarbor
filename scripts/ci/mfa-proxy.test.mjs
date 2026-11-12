import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { startMFAProxy } from './mfa-proxy.mjs';

test('fixture gateway preserves cookies and recovers after a cancelled request', { timeout: 10000 }, async () => {
  let notifyRequest;
  const requestArrived = new Promise(resolve => { notifyRequest = resolve; });
  const cookies = ['fh_access=fixture-only; Path=/; HttpOnly; SameSite=Strict', 'old_session=; Max-Age=0; Path=/'];
  const backend = createServer((req, res) => {
    if (req.url === '/auth/cancelled') { notifyRequest(); return; }
    if (req.url.startsWith('/auth/')) {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': cookies })
        .end(JSON.stringify({ path: req.url, cookie: req.headers.cookie, body })));
    } else res.writeHead(200, { 'Content-Type': 'text/html' }).end('<h1>Local Web fixture</h1>');
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  const targetPort = backend.address().port;
  let proxy;
  try {
    proxy = await startMFAProxy({ port: 0, authPort: targetPort, legacyPort: targetPort, webPort: targetPort });
    const base = `http://127.0.0.1:${proxy.address().port}`;
    const aborter = new AbortController();
    const cancelled = fetch(base + '/auth/cancelled', { signal: aborter.signal });
    const rejection = assert.rejects(cancelled, { name: 'AbortError' });
    await requestArrived;
    aborter.abort();
    await rejection;
    const response = await fetch(base + '/auth/me', { headers: { Cookie: 'fh_access=fixture-only' } });
    assert.deepEqual(response.headers.getSetCookie(), cookies);
    assert.equal((await response.json()).cookie, 'fh_access=fixture-only');
    const rollback = await fetch(base + '/__mfa_rollback/login', { method: 'POST', body: '{"fixture":true}' });
    assert.deepEqual(await rollback.json(), { path: '/auth/login', body: '{"fixture":true}' });
    assert.equal((await fetch(base + '/__mfa_rollback/other')).status, 404);
    assert.deepEqual(await (await fetch(base + '/history?limit=25')).json(), []);
    assert.match(await (await fetch(base + '/app/profile')).text(), /Local Web fixture/);
  } finally {
    for (const server of [proxy, backend]) {
      if (server) {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
      }
    }
  }
});
