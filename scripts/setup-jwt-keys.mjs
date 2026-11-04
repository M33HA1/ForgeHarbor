#!/usr/bin/env node

import { createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const authConfig = path.join(repoRoot, 'apps', 'auth-rs', 'config');
const privatePath = path.join(authConfig, 'jwt-private.pem');
const authPublicPath = path.join(authConfig, 'jwt-public.pem');
const replicaPaths = [
  path.join(repoRoot, 'apps', 'phishing-rs', 'config', 'jwt-public.pem'),
  path.join(repoRoot, 'apps', 'malware-rs', 'config', 'jwt-public.pem'),
];

function writeNewFile(filePath, contents, mode) {
  const descriptor = openSync(filePath, 'wx', mode);
  try {
    writeFileSync(descriptor, contents);
  } finally {
    closeSync(descriptor);
  }
}

function publicKeyFingerprint(filePath) {
  const key = createPublicKey(readFileSync(filePath));
  return key.export({ type: 'spki', format: 'der' }).toString('base64');
}

function privateKeyPublicFingerprint(filePath) {
  const key = createPrivateKey(readFileSync(filePath));
  return createPublicKey(key).export({ type: 'spki', format: 'der' }).toString('base64');
}

function ensureAuthKeyPair() {
  const hasPrivate = existsSync(privatePath);
  const hasPublic = existsSync(authPublicPath);

  if (hasPrivate !== hasPublic) {
    throw new Error(
      'The Auth key pair is incomplete. Existing key files were left untouched; restore the matching pair or move the incomplete files aside, then run this command again.',
    );
  }

  if (!hasPrivate) {
    const pair = generateKeyPairSync('rsa', {
      modulusLength: 3072,
      publicExponent: 0x10001,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });

    mkdirSync(authConfig, { recursive: true });
    writeNewFile(privatePath, pair.privateKey, 0o600);
    writeNewFile(authPublicPath, pair.publicKey, 0o644);
    console.log('Generated a new local RS256 key pair for Auth.');
  } else {
    const privateFingerprint = privateKeyPublicFingerprint(privatePath);
    const publicFingerprint = publicKeyFingerprint(authPublicPath);
    if (privateFingerprint !== publicFingerprint) {
      throw new Error('The Auth private and public keys do not match. Existing files were left untouched.');
    }
    console.log('The existing Auth RS256 key pair is valid and was left unchanged.');
  }
}

function ensurePublicReplica(filePath) {
  const parent = path.dirname(filePath);
  mkdirSync(parent, { recursive: true });

  if (!existsSync(filePath)) {
    writeNewFile(filePath, readFileSync(authPublicPath), 0o644);
    console.log(`Created the verifier public key at ${path.relative(repoRoot, filePath)}.`);
    return;
  }

  if (publicKeyFingerprint(filePath) !== publicKeyFingerprint(authPublicPath)) {
    throw new Error(
      `The verifier key at ${path.relative(repoRoot, filePath)} does not match Auth. Existing files were left untouched.`,
    );
  }
  console.log(`The verifier public key at ${path.relative(repoRoot, filePath)} already matches Auth.`);
}

try {
  ensureAuthKeyPair();
  for (const replicaPath of replicaPaths) ensurePublicReplica(replicaPath);
  console.log('JWT key setup is ready. Keep the Auth private key local and out of version control.');
} catch (error) {
  console.error(`JWT key setup stopped: ${error.message}`);
  process.exitCode = 1;
}
