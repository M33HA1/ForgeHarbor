---
date: 2026-11-03
type: change
area: [auth, security, sessions]
status: verified
related: [[Auth]], [[Security-Review]], [[ADR-0005-shared-edge-auth]]
tags: [change, auth, security]
---

# Auth session revocation

## What changed

- Auth issues a unique `jti` for each new RS256 token. Logout stores a SHA-256-derived revocation key in Redis with a TTL equal to the token's remaining lifetime and clears the browser cookie.
- `/auth/me`, also used by shared ForwardAuth, rejects revoked tokens. Redis errors fail closed with 503. Tokens minted before `jti` support continue to work until their one-hour expiry.
- The live flow checks that cookie and bearer tokens fail at Auth and a protected gateway route after logout, and cleans up only its generated Redis key.

## Why

- Clearing a browser cookie did not invalidate copied bearer tokens. Revocation closes that gap for requests checked by Auth/ForwardAuth while preserving bounded compatibility for already-issued tokens.

## Verification

| Check | Command | Result |
|---|---|---|
| Auth release tests and image build | `docker compose -f deploy/compose/docker-compose.dev.yml build fh-auth` | Passed; 21 Auth release tests |
| Full local service integration | `scripts/ci/integration.sh` | Passed; Auth, gateway, History, Reports, Notify, and delivery regressions, including post-logout cookie/Bearer/gateway denial |

## Follow-ups

- Keep production service ports private, configure exact production proxy peers, and require HTTPS.
- Add a refresh-token flow and allow pre-`jti` tokens to expire before relying on immediate revocation for every session.

## Related notes

- [[Change-Log]]
- [[Auth]]
- [[Security-Review]]
- [[ADR-0005-shared-edge-auth]]
