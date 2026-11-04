#!/usr/bin/env node
// Local-only JWT fixtures: no accounts, scans, provider calls, or token output.
import assert from 'node:assert/strict';
import { sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const base = process.env.GATEWAY_URL || 'http://localhost:8088';
const admin = process.env.TRAEFIK_API_URL || 'http://localhost:8000';
const authUnavailable = process.argv.includes('--auth-unavailable');
const env = readFileSync(new URL('config/.env', root), 'utf8');
function setting(name, fallback) {
  const line = env.split(/\r?\n/).find(item => item.trimStart().startsWith(`${name}=`));
  return process.env[name] || line?.slice(line.indexOf('=') + 1).trim().replace(/^(['"])(.*)\1$/, '$2') || fallback;
}
const now = Math.floor(Date.now() / 1000);
const claims = {
  sub: 'edge-auth-regression', email: 'edge-auth@example.invalid',
  iss: setting('JWT_ISSUER', 'forgeharbor'), aud: setting('JWT_AUDIENCE', 'forgeharbor-users'),
  iat: now, exp: now + 300,
};
const key = readFileSync(new URL('apps/auth-rs/config/jwt-private.pem', root));
function token(overrides = {}) {
  const head = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ ...claims, ...overrides })).toString('base64url');
  const input = `${head}.${payload}`;
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), key).toString('base64url')}`;
}
async function request(path, options = {}) {
  const response = await fetch(new URL(path, base), { ...options, signal: AbortSignal.timeout(authUnavailable ? 45000 : 8000) });
  await response.arrayBuffer();
  return response;
}

const targets = [
  ['phishing', 'phishing', '/phishing/v1/url/check', 'POST'],
  ['malware', 'malware', '/malware/v1/file/analyze', 'POST'],
  ['history', 'history', '/history', 'GET'],
  ['report', 'reports', '/reports?scan_id=edge-auth-regression', 'GET'],
  ['notify', 'notify', '/notify', 'GET'],
];

try {
  // Inspect loaded configuration, not just source labels: service-level JWT
  // checks alone would also reject invalid tokens if the edge gate disappeared.
  const rawResponse = await fetch(new URL('/api/rawdata', admin), { signal: AbortSignal.timeout(8000) });
  assert.equal(rawResponse.status, 200, 'Traefik API must be reachable for attachment verification');
  const raw = await rawResponse.json();
  const middleware = raw.middlewares['fh-jwt@file'];
  assert.equal(middleware?.status, 'enabled', 'shared edge gate must be enabled');
  assert.equal(middleware.forwardAuth.address, 'http://fh-auth:8080/auth/me');
  assert.ok(middleware.forwardAuth.authRequestHeaders.includes('Cookie'), 'the edge gate must forward the browser session cookie');
  const rejected = [
    ['missing', undefined], ['forged', 'forged.token.value'],
    ['expired', token({ exp: now - 600 })],
    ['wrong issuer', token({ iss: 'untrusted-issuer' })],
    ['wrong audience', token({ aud: 'untrusted-audience' })],
    ['empty subject', token({ sub: '' })],
  ];
  if (authUnavailable) {
    await Promise.all(targets.map(async ([router, prefix, path, method]) => {
      assert.ok(raw.routers[`fh-${router}@docker`]?.middlewares?.includes('fh-jwt@file'), `${prefix} must keep edge gate during outage`);
      const start = Date.now();
      const response = await request(path, { method, headers: { Authorization: `Bearer ${token()}` } });
      assert.ok([500, 502, 503, 504].includes(response.status), `${prefix}: Auth outage must produce a gateway failure, got ${response.status}`);
      assert.equal((await request(`/${prefix}/health`)).status, 200, `${prefix}: health must survive Auth outage`);
      console.log(`  ${prefix}: valid token denied with HTTP ${response.status} in ${Date.now() - start} ms; public health remains available`);
    }));
  }
  for (const [router, prefix, path, method] of authUnavailable ? [] : targets) {
    assert.ok(raw.routers[`fh-${router}@docker`]?.middlewares?.includes('fh-jwt@file'), `${prefix} must use edge gate`);
    for (const [name, jwt] of rejected) {
      const headers = { 'X-Forwarded-User': 'spoofed', 'X-Forwarded-Uri': '/auth/health' };
      if (jwt) headers.Authorization = `Bearer ${jwt}`;
      assert.equal((await request(path, { method, headers })).status, 401, `${prefix}: ${name} token must be denied`);
    }
    assert.equal((await request(`/${prefix}/health`)).status, 200, `${prefix}: health must be public`);
    assert.equal((await request(`/${prefix}/health`, { method: 'POST' })).status, 401, `${prefix}: only GET health is exempt`);
    assert.equal((await request(`/${prefix}/health/extra`)).status, 401, `${prefix}: health exemption must be exact`);
    if (method === 'GET') {
      assert.equal((await request(path, { headers: { Cookie: `fh_access=${token()}` } })).status, 200, `${prefix}: valid HttpOnly session cookie must reach service`);
    } else {
      const preflight = await request(path, { method: 'OPTIONS', headers: {
        Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type',
      } });
      assert.equal(preflight.status, 200, `${prefix}: CORS preflight must succeed`);
      assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:3000');
    }
    console.log(`  ${prefix}: loaded edge gate, token rejection, health boundary, and allowed request checks passed`);
  }
  console.log('Edge authentication regression check passed.');
} catch (error) {
  console.error(`Edge authentication regression check failed: ${error.message}`);
  process.exitCode = 1;
}
