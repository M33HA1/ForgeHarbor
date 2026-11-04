#!/usr/bin/env node
// Exercise the RS256 gates without invoking Gemini or VirusTotal.
import { createPrivateKey, sign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gateway = (process.env.GATEWAY_URL || 'http://localhost:8088').replace(/\/$/, '');
const privateKeyPath = path.join(repoRoot, 'apps', 'auth-rs', 'config', 'jwt-private.pem');
const envPath = path.join(repoRoot, 'config', '.env');
let requestCount = 0;

function configuredValue(name, fallback) {
  if (process.env[name]) return process.env[name];
  if (!existsSync(envPath)) return fallback;
  const prefix = `${name}=`;
  const line = readFileSync(envPath, 'utf8').split(/\r?\n/).find((item) => item.trimStart().startsWith(prefix));
  if (!line) return fallback;
  return line.slice(line.indexOf('=') + 1).trim().replace(/^(['"])(.*)\1$/, '$2') || fallback;
}

function createTestToken() {
  if (!existsSync(privateKeyPath)) throw new Error('Auth private key is missing; run scripts/setup-jwt-keys.mjs first.');
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: `scanner-auth-check-${process.pid}`,
    email: 'scanner-auth-check@example.invalid',
    iss: configuredValue('JWT_ISSUER', 'forgeharbor'),
    aud: configuredValue('JWT_AUDIENCE', 'forgeharbor-users'),
    iat: now,
    exp: now + 300,
  };
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${header}.${claims}`;
  const signature = sign('RSA-SHA256', Buffer.from(signingInput), createPrivateKey(readFileSync(privateKeyPath)));
  return `${signingInput}.${signature.toString('base64url')}`;
}

async function post(pathname, { token, cookie, body, contentType }) {
  requestCount += 1;
  console.log(`  scanner auth request ${requestCount}: ${pathname} (${token || cookie ? 'credential supplied' : 'no credential'})`);
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (cookie) headers.cookie = `fh_access=${cookie}`;
  if (contentType) headers['content-type'] = contentType;
  const url = new URL(`${gateway}${pathname}`);
  if (body !== undefined) headers['content-length'] = Buffer.byteLength(body);
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method: 'POST', headers, agent: false }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode || 0));
    });
    request.setTimeout(8000, () => request.destroy(new Error('request timed out')));
    request.on('error', reject);
    request.end(body);
  });
}

async function expectStatus(name, status, expected) {
  console.log(`  ${name}: HTTP ${status}`);
  if (status !== expected) throw new Error(`${name} returned HTTP ${status}; expected ${expected}.`);
}

async function main() {
  const token = createTestToken();
  const phishingPath = '/phishing/v1/url/check';
  const malwarePath = '/malware/v1/file/analyze';
  const forged = 'forged.token.value';

  await expectStatus('Phishing missing-token request', await post(phishingPath, {
    body: undefined,
  }), 401);
  await expectStatus('Phishing forged-token request', await post(phishingPath, {
    token: forged, body: undefined,
  }), 401);
  await expectStatus('Phishing valid-token malformed request', await post(phishingPath, {
    cookie: token, body: JSON.stringify({}), contentType: 'application/json',
  }), 400);

  const boundary = 'forgeharbor-test-boundary';
  const emptyUpload = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="empty.bin"\r\nContent-Type: application/octet-stream\r\n\r\n\r\n--${boundary}--\r\n`;
  const multipart = `multipart/form-data; boundary=${boundary}`;
  await expectStatus('Malware missing-token request', await post(malwarePath, {
    body: undefined,
  }), 401);
  await expectStatus('Malware forged-token request', await post(malwarePath, {
    token: forged, body: undefined,
  }), 401);
  await expectStatus('Malware valid-token empty upload', await post(malwarePath, {
    cookie: token, body: emptyUpload, contentType: multipart,
  }), 400);

  console.log('Scanner auth integration check passed (missing/forged tokens denied; valid RS256 reaches input validation without provider calls).');
}

main().catch((error) => {
  console.error(`Scanner auth integration check failed: ${error.message || 'unexpected error'}`);
  process.exitCode = 1;
});
