---
date: 2026-11-03
updated: 2026-11-03
type: change
status: verified
area: [auth, api, security]
related: [[Auth]], [[API-Contracts]], [[Test-Matrix]], [[Security-Review]]
tags: [change, auth, jwks, jwt]
---

# Publish a standard RSA JWKS

## What changed

- `/auth/jwks` builds a standard RSA JWK from the already-loaded public key and returns `kty`, `use`, `alg`, `kid`, `n`, and `e`.
- The key ID is the RFC 7638 SHA-256 thumbprint. The endpoint no longer puts PEM text in a custom `pem` field.
- Issued RS256 tokens carry the matching `kid` in their JOSE header so consumers can select the published key.
- Auth rejects an unsupported or malformed public-key representation during startup rather than serving an invalid JWKS.
- Unit and API regression checks cover JWK parameters, malformed key handling, thumbprint stability, and the public endpoint contract.

## Why

The previous response used a PEM property inside a JWK. Standard JWT clients need RSA modulus and exponent values to select and verify the signing key.

## Verification

| Check | Command | Result |
|---|---|---|
| Auth release build and unit tests | `docker compose -f deploy/compose/docker-compose.dev.yml build fh-auth` | Passed; all 18 release-mode tests |
| API contract | `scripts/ci/integration.sh` → `scripts/check-auth-flow.py` | Passed standard RSA JWK shape, direct/gateway consistency, matching token-header `kid`, and public route contract |
| Gateway and service regressions | `scripts/ci/integration.sh` | Passed all eight health probes, routes, CORS, Auth, History, Reports, and Notify suites |

## Follow-ups

- Keep the published JWK synchronized with key rotation and configure cache headers once a production key-rotation policy is defined.

## Related notes

- [[Change-Log]]
- [[00-Home]]
- [[Auth]]
- [[API-Contracts]]
- [[Test-Matrix]]
- [[Security-Review]]
