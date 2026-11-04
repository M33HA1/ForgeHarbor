---
date: 2026-11-03
updated: 2026-11-03
type: change
status: verified
area: [auth, security, mongodb]
related: [[Auth]], [[Security-Review]], [[Test-Matrix]], [[API-Contracts]]
tags: [change, auth, email, identity]
---

# Make email identity case-insensitive

## What changed

- New registrations store mailbox identities in lowercase after the existing ASCII address validation.
- Auth creates a unique MongoDB email index with English secondary-strength collation and uses the same collation for duplicate lookup and login, including existing mixed-case records.
- Duplicate-key races still return 409. If legacy case variants collide, Auth fails startup with an actionable message instead of serving an ambiguous identity store.
- The Auth flow integration fixture verifies the index options, mixed-case signup rejection, concurrent case-variant signup uniqueness, lowercase storage, and mixed-case login.

## Why

The prior case-sensitive identity lookup allowed the same mailbox spelling with different ASCII casing to register more than once. A shared case-insensitive rule is needed at validation, storage, lookup, and database uniqueness boundaries.

## Verification

| Check | Command | Result |
|---|---|---|
| Local identity collision preflight | Read-only MongoDB aggregation grouping `users.email` after lowercase conversion | Zero collision groups; no existing local users required rewriting |
| Auth image build and unit suite | `docker compose -f deploy/compose/docker-compose.dev.yml build fh-auth` | Passed; 19 release-mode tests |
| Live case-variant regression | `scripts/ci/integration.sh` → `scripts/check-auth-flow.py` | Passed mixed-case signup/login, concurrent duplicate prevention, unique index settings, and Auth cleanup |
| Gateway and service suite | `scripts/ci/integration.sh` | Passed eight health probes, route/CORS, edge/scanner auth, Auth, History, Reports, and Notify checks |

## Follow-ups

- Run a case-folded duplicate preflight on production data and resolve any collisions before deploying the new unique index.
- Keep email normalization aligned across future Auth implementations and migration work.

## Related notes

- [[Change-Log]]
- [[00-Home]]
- [[Auth]]
- [[Security-Review]]
- [[Test-Matrix]]
- [[API-Contracts]]
