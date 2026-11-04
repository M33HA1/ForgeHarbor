#!/usr/bin/env node
// Gateway route contract.
//
// Verifies that every documented public route is registered by its service.
// Under the D1=B convention the gateway does not strip prefixes, so the public
// path and the service path are identical.
//
// Offline developer checks may skip; CI=true or FH_REQUIRE_RUNNING=1 makes an
// unreachable gateway fail so integration jobs cannot silently skip coverage.

const BASE = (process.env.GATEWAY_URL || 'http://localhost:8088').replace(/\/$/, '');
const TIMEOUT_MS = 5000;

// expected: statuses that prove the route exists. A missing route returns 404,
// so 404 is never accepted for a route in this table.
const routes = [
  { method: 'GET', path: '/app/dashboard', expected: [200], contentType: 'text/html' },
  { method: 'GET', path: '/app/history', expected: [200], contentType: 'text/html' },
  { method: 'GET', path: '/app/profile', expected: [200], contentType: 'text/html' },
  { method: 'GET', path: '/auth/health', expected: [200] },
  { method: 'GET', path: '/auth/jwks', expected: [200] },
  { method: 'POST', path: '/auth/signup', expected: [400, 401, 415, 422] },
  { method: 'POST', path: '/auth/login', expected: [400, 401, 415, 422] },
  { method: 'POST', path: '/auth/logout', expected: [204] },
  { method: 'GET', path: '/auth/me', expected: [401] },
  { method: 'GET', path: '/phishing/health', expected: [200] },
  { method: 'POST', path: '/phishing/v1/url/check', expected: [400, 401, 415, 422] },
  { method: 'POST', path: '/phishing/v1/url/check', headers: { authorization: 'Bearer forged-token' }, expected: [401] },
  { method: 'GET', path: '/malware/health', expected: [200] },
  { method: 'POST', path: '/malware/v1/file/analyze', expected: [400, 401, 415, 422] },
  { method: 'POST', path: '/malware/v1/file/analyze', headers: { authorization: 'Bearer forged-token' }, expected: [401] },
  { method: 'GET', path: '/history/health', expected: [200] },
  { method: 'GET', path: '/history', expected: [401] },
  { method: 'GET', path: '/history', headers: { authorization: 'Bearer forged-token' }, expected: [401] },
  { method: 'GET', path: '/reports/health', expected: [200] },
  { method: 'GET', path: '/reports?scan_id=route-contract', expected: [401] },
  { method: 'POST', path: '/reports', expected: [401] },
  { method: 'GET', path: '/reports/not-an-id', expected: [401] },
  { method: 'GET', path: '/reports/not-an-id', headers: { authorization: 'Bearer forged-token' }, expected: [401] },
  { method: 'GET', path: '/reports/not-an-id/download', expected: [401] },
  { method: 'GET', path: '/notify/health', expected: [200] },
  { method: 'GET', path: '/notify', expected: [401] },
  { method: 'GET', path: '/notify', headers: { authorization: 'Bearer forged-token' }, expected: [401] },
];

async function probe(route) {
  const response = await fetch(`${BASE}${route.path}`, {
    method: route.method,
    headers: route.headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  await response.arrayBuffer();
  if (route.contentType && !response.headers.get('content-type')?.includes(route.contentType)) {
    throw new Error(`expected ${route.contentType} document`);
  }
  return response.status;
}

async function gatewayIsUp() {
  try {
    const response = await fetch(`${BASE}/auth/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.status < 500;
  } catch {
    return false;
  }
}

const up = await gatewayIsUp();
if (!up) {
  if (process.env.FH_REQUIRE_RUNNING === '1' || process.env.CI === 'true') {
    console.error(`Gateway route contract failed: ${BASE} is not reachable.`);
    process.exit(1);
  }
  console.log(`Gateway route contract: skipped (${BASE} is not reachable).`);
  process.exit(0);
}

let failures = 0;
console.log(`Gateway route contract: ${BASE}`);
for (const route of routes) {
  let status;
  try {
    status = await probe(route);
  } catch (error) {
    console.log(`  FAIL ${route.method.padEnd(4)} ${route.path} — ${error.message}`);
    failures += 1;
    continue;
  }
  const ok = route.expected.includes(status);
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'} ${route.method.padEnd(4)} ${route.path.padEnd(32)} HTTP ${status}` +
      (ok ? '' : ` (expected ${route.expected.join('/')})`),
  );
}

if (failures > 0) {
  console.error(`Gateway route contract failed: ${failures} route(s).`);
  process.exit(1);
}
console.log('Gateway route contract passed.');
