---
date: 2026-11-03
type: change
area: [auth, security, testing]
status: complete
related: [[00-Home]], [[Auth]], [[Security-Review]], [[Test-Matrix]], [[Backlog]]
tags: [change, auth, security]
---

# Verify Auth flows and redact logs

## What changed

- Auth no longer logs email addresses during signup/login, JWT subject/email values, or the MongoDB connection string.
- Auth ensures a unique MongoDB index for account email and maps duplicate-key races to HTTP 409.
- Added `scripts/check-auth-flow.py`. It creates a unique disposable user and verifies signup, duplicate rejection, password hash storage, invalid-password rejection, successful login, authenticated `/auth/me`, and forged-token rejection.
- The script removes the user in `finally` and verifies cleanup. It does not print passwords or token values.

## Why

Auth is the trust anchor. User identifiers and connection strings should not be copied into logs, and the principal signup/login path needed repeatable regression evidence.

## Verification

| Check | Command | Result |
|---|---|---|
| Auth unit/build check | `cargo test --offline` in `apps/auth-rs` | Pass; compiles, but this binary has no Rust unit tests |
| Auth API integration | `python scripts/check-auth-flow.py` | Pass; unique email index confirmed; disposable user removed after signup, duplicate, hash, login, `/me`, invalid-password, and forged-token checks |
| Gateway health and auth contract | `scripts/dev.ps1 health` and `scripts/dev.ps1 test` | Pass after rebuilding and restarting Auth |

## Follow-ups

- Add distributed login rate limiting; FH-024 remains open.
- Normalize email addresses before lookup and indexing; the current unique index is case-sensitive.
- Auth logs still need a structured logging and request-ID standard across services.

## Related notes

- [[Change-Log]]
- [[Auth]]
- [[Security-Review]]
- [[Test-Matrix]]
- [[Backlog]]
