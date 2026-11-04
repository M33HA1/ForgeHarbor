import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const envPath = path.join(repoRoot, 'config', '.env');
const localEnv = existsSync(envPath) ? dotenv.parse(readFileSync(envPath)) : {};
const env = (name, fallback) => process.env[name] ?? localEnv[name] ?? fallback;
const configuredMongoUri = env('MONGO_URI', 'mongodb://localhost:27017');
const mongoUrl = new URL(configuredMongoUri);
if (mongoUrl.hostname === 'fh-mongo') mongoUrl.hostname = 'localhost';
const mongoUri = mongoUrl.toString();
const dbName = env('MONGO_DB', 'forgeharbor');
const issuer = env('JWT_ISSUER', 'forgeharbor');
const audience = env('JWT_AUDIENCE', 'forgeharbor-users');
const gateway = (process.env.GATEWAY_URL || 'http://localhost:8088').replace(/\/$/, '');
const privateKeyPath = path.join(repoRoot, 'apps', 'auth-rs', 'config', 'jwt-private.pem');
const userId = `risk-filter-check-${randomUUID()}`;
const otherUserId = `risk-filter-other-${randomUUID()}`;
const runId = randomUUID();
const fixtureTag = 'history-risk-filter-check';
const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
let connected = false;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function requestHistory(token, params) {
  const query = new URLSearchParams(params);
  const response = await fetch(`${gateway}/history?${query}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),
  });
  return { status: response.status, body: await response.json() };
}

async function requestDetail(token, scanId) {
  const response = await fetch(`${gateway}/history/${scanId}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),
  });
  return { status: response.status, body: await response.json() };
}

async function run() {
  assert(existsSync(privateKeyPath), 'Auth private key is missing; run scripts/setup-jwt-keys.mjs first.');
  const privateKey = readFileSync(privateKeyPath);
  const token = jwt.sign(
    { sub: userId, email: `${userId}@example.invalid` },
    privateKey,
    { algorithm: 'RS256', issuer, audience, expiresIn: '5m' },
  );
  const otherUserToken = jwt.sign(
    { sub: otherUserId, email: `${otherUserId}@example.invalid` },
    privateKey,
    { algorithm: 'RS256', issuer, audience, expiresIn: '5m' },
  );

  await client.connect();
  connected = true;
  const scans = client.db(dbName).collection('scans');
  const now = new Date();
  const fixtures = [
    { scan_type: 'url', input: 'fixture-canonical-high-url', result: { phishing: true, risk_level: 'high' } },
    { scan_type: 'file', input: 'fixture-canonical-low-file', result: { malicious: false, risk_level: 'low' } },
    { scan_type: 'url', input: 'fixture-legacy-high-url', result: { phishing: true, confidence: 0.99 } },
    { scan_type: 'file', input: 'fixture-legacy-low-file', result: { malicious: false, vendor_positives: 0 } },
  ].map((fixture) => ({
    _id: new ObjectId(),
    user_id: userId,
    ...fixture,
    created_at: now,
    test_fixture: fixtureTag,
    test_run_id: runId,
  }));
  const foreignFixture = fixtures[0];
  const otherOwnedFixture = {
    ...foreignFixture,
    _id: new ObjectId(),
    user_id: otherUserId,
    input: 'fixture-other-users-own-url',
  };

  try {
    await scans.insertMany([...fixtures, otherOwnedFixture]);

    const high = await requestHistory(token, { risk: 'high' });
    assert(high.status === 200, `High-risk query returned HTTP ${high.status}.`);
    assert(high.body.items.length === 2, `Expected 2 high-risk fixtures; received ${high.body.items.length}.`);

    const low = await requestHistory(token, { risk: 'low' });
    assert(low.status === 200, `Low-risk query returned HTTP ${low.status}.`);
    assert(low.body.items.length === 2, `Expected 2 low-risk fixtures; received ${low.body.items.length}.`);

    const filtered = await requestHistory(token, { type: 'url', risk: 'high' });
    assert(filtered.status === 200, `Combined query returned HTTP ${filtered.status}.`);
    assert(filtered.body.items.length === 2, `Expected 2 matching URL fixtures; received ${filtered.body.items.length}.`);
    assert(filtered.body.items.every((item) => item.scan_type === 'url' && item.user_id === userId), 'Combined query returned an out-of-scope record.');

    const invalid = await requestHistory(token, { risk: 'medium' });
    assert(invalid.status === 400, `Unsupported risk value returned HTTP ${invalid.status}.`);
    const malformedDetail = await requestDetail(token, 'not-an-object-id');
    assert(malformedDetail.status === 400, `Malformed scan ID returned HTTP ${malformedDetail.status}; expected 400.`);
    const foreignDetail = await requestDetail(otherUserToken, foreignFixture._id.toHexString());
    assert(foreignDetail.status === 404, `Cross-user detail returned HTTP ${foreignDetail.status}; expected 404.`);
    const foreignList = await requestHistory(otherUserToken, { risk: 'high' });
    assert(foreignList.status === 200, `Other-user history returned HTTP ${foreignList.status}.`);
    assert(foreignList.body.items.every((item) => item.user_id !== userId), 'Other-user history exposed a foreign fixture.');
    console.log('History integration check passed (risk filters, legacy records, invalid values, and cross-user isolation).');
  } finally {
    try {
      if (connected) {
        await scans.deleteMany({ test_fixture: fixtureTag, test_run_id: runId });
        const remaining = await scans.countDocuments({ test_fixture: fixtureTag, test_run_id: runId });
        assert(remaining === 0, 'Test fixtures were not all removed.');
      }
    } finally {
      await client.close();
    }
  }
}

run().catch((error) => {
  const safeMessage = String(error?.message || 'unknown error').replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, 'mongodb://<redacted>');
  console.error(`History risk-filter integration check failed: ${safeMessage}`);
  process.exitCode = 1;
});
