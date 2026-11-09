#!/usr/bin/env node

// Check exact-origin CORS behavior on the three Rust services that expose
// browser-facing endpoints. Skip only when none of the services is running.
import { existsSync, readFileSync } from 'node:fs';

const services = [
  { name: 'auth', base: process.env.AUTH_URL || 'http://localhost:8080', path: '/auth/health' },
  { name: 'phishing', base: process.env.PHISHING_URL || 'http://localhost:8081', path: '/phishing/health' },
  { name: 'malware', base: process.env.MALWARE_URL || 'http://localhost:8082', path: '/malware/health' },
];
const timeout = 3000;
const envPath = new URL('../config/.env', import.meta.url);
let localAllowedOrigins;
if (existsSync(envPath)) {
  const line = readFileSync(envPath, 'utf8').split(/\r?\n/).find((entry) => /^\s*CORS_ALLOWED_ORIGINS\s*=/.test(entry));
  if (line) localAllowedOrigins = line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
}
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || localAllowedOrigins || 'http://localhost:8088,http://localhost:3000')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
const hostileOrigin = 'https://cors-check.invalid';

async function requestOrigin(service, origin) {
  return fetch(`${service.base}${service.path}`, {
    headers: { Origin: origin },
    signal: AbortSignal.timeout(timeout),
  });
}

const health = await Promise.all(services.map(async (service) => {
  try {
    const response = await fetch(`${service.base}${service.path}`, { signal: AbortSignal.timeout(timeout) });
    return response.status < 500;
  } catch {
    return false;
  }
}));
if (health.every((up) => !up)) {
  if (process.env.FH_REQUIRE_RUNNING === '1' || process.env.CI === 'true') {
    console.error('CORS contract failed: Rust services are not reachable.');
    process.exit(1);
  }
  console.log('CORS contract: skipped (Rust services are not reachable).');
  process.exit(0);
}

let failures = 0;
console.log('Configured service CORS contract');
for (const [index, service] of services.entries()) {
  if (!health[index]) {
    console.log(`  FAIL ${service.name}: health endpoint is not reachable`);
    failures += 1;
    continue;
  }
  for (const origin of allowedOrigins) {
    try {
      const response = await requestOrigin(service, origin);
      const actual = response.headers.get('access-control-allow-origin');
      const ok = actual === origin;
      if (!ok) failures += 1;
      console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${service.name} allows configured origin ${origin}`);
    } catch (error) {
      console.log(`  FAIL ${service.name} allowed-origin probe: ${error.message}`);
      failures += 1;
    }
  }
  try {
    const response = await requestOrigin(service, hostileOrigin);
    const actual = response.headers.get('access-control-allow-origin');
    const ok = actual === null;
    if (!ok) failures += 1;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${service.name} rejects unconfigured origin`);
  } catch (error) {
    console.log(`  FAIL ${service.name} hostile-origin probe: ${error.message}`);
    failures += 1;
  }
}

if (failures) {
  console.error(`CORS contract failed: ${failures} check(s).`);
  process.exit(1);
}
console.log('CORS contract passed.');
