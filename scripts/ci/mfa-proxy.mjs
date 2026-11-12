// Disposable loopback-only test gateway. Never use as a deployment proxy.
import { createServer, request } from 'node:http';

export async function startMFAProxy({ port = 8088, authPort = 8180, legacyPort = 8181, webPort = 8182 } = {}) {
  const server = createServer((incoming, outgoing) => {
    const path = incoming.url || '/';
    let upstreamPort = webPort;
    let upstreamPath = path;
    if (path.startsWith('/auth/')) upstreamPort = authPort;
    else if (path.startsWith('/__mfa_rollback/')) {
      if (!['/__mfa_rollback/me', '/__mfa_rollback/login'].includes(path)) {
        outgoing.writeHead(404).end();
        return;
      }
      upstreamPort = legacyPort;
      upstreamPath = '/auth/' + path.split('/').pop();
    } else if (/^\/(history|reports|notify|phishing|malware)(\/|\?|$)/.test(path)) {
      outgoing.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      outgoing.end(JSON.stringify(path.split('?')[0].endsWith('/health') ? { status: 'ok' } : []));
      return;
    }
    const upstream = request({ hostname: '127.0.0.1', port: upstreamPort, path: upstreamPath,
      method: incoming.method, headers: { ...incoming.headers, host: `localhost:${upstreamPort}` } }, response => {
      if (outgoing.destroyed) { response.destroy(); return; }
      // Preserve Set-Cookie as separate headers, including deletion and rotation.
      outgoing.writeHead(response.statusCode || 502, response.headers);
      response.on('error', () => outgoing.destroy());
      response.pipe(outgoing);
    });
    upstream.setTimeout(20000, () => upstream.destroy(new Error('Fixture upstream timed out')));
    upstream.on('error', () => {
      if (outgoing.destroyed) return;
      if (outgoing.headersSent) outgoing.destroy();
      else outgoing.writeHead(502, { 'Content-Type': 'application/json' }).end('{"error":"Fixture upstream unavailable"}');
    });
    incoming.on('aborted', () => upstream.destroy());
    incoming.on('error', () => upstream.destroy());
    outgoing.on('close', () => { if (!outgoing.writableEnded) upstream.destroy(); });
    incoming.pipe(upstream);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return server;
}
