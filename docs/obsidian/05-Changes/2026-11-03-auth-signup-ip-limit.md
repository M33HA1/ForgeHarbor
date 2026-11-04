---
date: 2026-11-03
updated: 2026-11-03
type: change
status: verified
area: [auth, security, redis]
related: [[Auth]], [[Security-Review]], [[Test-Matrix]], [[Backlog]]
tags: [change, auth, rate-limit, signup]
---

# Limit Auth signups per trusted client IP

## What changed

- Auth atomically counts valid signup requests in Redis, allowing 20 per client IP in a 15-minute window.
- Client IP selection uses the socket peer unless its IP is in `AUTH_TRUSTED_PROXY_IPS`; forged forwarded headers from direct peers cannot rotate signup buckets.
- The 21st attempt returns HTTP 429 with `Retry-After`. If Redis is unavailable, signup fails closed with HTTP 503 before database lookup or password hashing.
- Integration coverage sends 20 duplicate-email requests through the trusted loopback proxy, expects 409 for each, then verifies the 21st returns 429. Cleanup removes only the hashed test key.

## Why

Credential validation and the two-slot Argon2 pool bound the cost of each request, but valid signup floods could still drive repeated database lookups and consume password-hashing capacity. The IP window limits that work and shares the verified proxy trust boundary used by login throttling.

## Verification

| Check | Result |
|---|---|
| Auth release image build | Passed; 16 Rust unit tests |
| `python scripts/check-auth-flow.py` | Passed signup 20+1 threshold, cookie/Bearer Auth, login account/IP thresholds, and scoped Redis/user cleanup |
| Full `scripts/ci/integration.sh` | Passed health, routes, CORS, edge/scanner auth, Auth, History, Reports, and Notify checks |
| Compose runtime | All eight health probes returned HTTP 200 |

## Follow-ups

- Add a breached-password blocklist and hosted regression coverage.
- Production must set exact `AUTH_TRUSTED_PROXY_IPS` values and keep Auth private.

## Related notes

- [[Change-Log]]
- [[00-Home]]
- [[Auth]]
- [[Security-Review]]
- [[Test-Matrix]]
- [[Backlog]]
