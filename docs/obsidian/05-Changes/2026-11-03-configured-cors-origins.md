---
date: 2026-11-03
type: change
area: [auth, phishing, malware, security, testing]
status: complete
related: [[00-Home]], [[Auth]], [[Phishing]], [[Malware]], [[Environment]], [[Security-Review]], [[Test-Matrix]], [[Backlog]]
tags: [change, security, cors]
---

# Restrict Rust service CORS origins

## What changed

- Auth, Phishing, and Malware now allow only the exact origins listed in `CORS_ALLOWED_ORIGINS`.
- Allowed methods are limited to GET, POST, and OPTIONS; allowed headers are Authorization and Content-Type.
- Local defaults cover the Web dev port and Traefik gateway. The example config documents setting the deployed Web origin explicitly.
- Added `scripts/check-cors.mjs` and included it in `scripts/dev.ps1 test`.

## Why

The three Rust services previously allowed requests from every browser origin with any method and header.

## Verification

| Check | Command | Result |
|---|---|---|
| Rust tests | `cargo test --offline` in Auth, Phishing, and Malware | Pass; Malware has 2 upload-boundary tests |
| Release image builds | `docker compose -f deploy/compose/docker-compose.dev.yml build fh-auth fh-phishing fh-malware` | Pass |
| Allowed and hostile origin checks | `node scripts/check-cors.mjs` | Pass; both configured local origins allowed, unconfigured origin denied on all three services |
| Runtime health and gateway routes | `scripts/dev.ps1 health` and `scripts/dev.ps1 test` | Pass; all eight health endpoints, route/auth checks, and CORS contract |

## Follow-ups

- Set and verify the real web origin in deployment configuration before production.
- Production TLS, edge authentication, and service-port exposure policy remain open.

## Related notes

- [[Change-Log]]
- [[Security-Review]]
- [[Environment]]
- [[Test-Matrix]]
- [[Backlog]]
