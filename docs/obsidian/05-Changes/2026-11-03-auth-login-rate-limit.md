---
date: 2026-11-03
type: change
area: [auth, security]
status: verified
related: [[Auth]], [[Security-Review]], [[Backlog]]
tags: [change, auth, security, rate-limit]
---

# Auth login rate limiting

## What changed

- Added atomic Redis counters for normalized account and client IP keys, with a 15-minute window and thresholds of 5/account and 60/IP.
- Auth fails closed with HTTP 503 when the limiter cannot be reached; excess attempts receive HTTP 429 and `Retry-After`.
- Added Rust unit coverage for key hashing, thresholds, and rightmost valid forwarded IP parsing; the integration fixture clears and removes only its hashed test IP key on every run.

## Why

- Login previously had no distributed protection against repeated password guesses.

## Verification

| Check | Command | Result |
|---|---|---|
| Auth unit tests | `cargo test --offline` in `apps/auth-rs` | Passed |
| Auth image build | `docker compose -f deploy/compose/docker-compose.dev.yml build fh-auth` | Passed |
| Full image build and restart | `powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 build` then `docker compose -f deploy/compose/docker-compose.dev.yml up -d` | All seven application images built; full stack started |
| Live Auth integration | `python scripts/check-auth-flow.py` | Passed after rebuilt Auth restart: signup/login/JWT checks and both Redis thresholds; disposable user and counters removed |
| Stack health | `powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 health` | All eight probes returned HTTP 200 |
| Gateway and CORS contracts | `powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 test` | Passed |

## Follow-ups

- Verify that production Traefik sanitizes client-supplied forwarded headers and keep Auth unreachable except through the trusted edge.
- Continue the remaining ownership, schema, provider-key rotation, and deployment security gates before calling the SaaS release ready.

## Related notes

- [[Change-Log]]
- [[Roadmap]]
