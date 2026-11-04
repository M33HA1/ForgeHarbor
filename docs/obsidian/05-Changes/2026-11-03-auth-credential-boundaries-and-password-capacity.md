---
date: 2026-11-03
updated: 2026-11-03
type: change
status: verified
area: [auth, security, web]
related: [[Auth]], [[Security-Review]], [[Test-Matrix]], [[Backlog]]
tags: [change, auth, credentials, denial-of-service]
---

# Bound Auth credential input and password work

## What changed

- Auth rejects malformed new-account mailboxes, requires 15–128 Unicode characters for new passwords, and bounds login input without changing the minimum for existing shorter-password accounts.
- All Auth JSON routes now cap request bodies at 8 KiB and return a fixed error message without echoing malformed request content.
- Argon2 hashing and verification run on Actix's blocking pool with at most two jobs in flight. When capacity is full, Auth returns HTTP 503 with `Retry-After: 1`. A canceled request keeps its permit until the underlying blocking work finishes.
- The Web signup form explains the password limits and validates Unicode code points before sending the request.
- Added Rust unit tests and `scripts/check-auth-inputs.py` to cover credential limits, Unicode boundaries, request size, error redaction, hash storage, and login compatibility.
- The Auth image runs release-mode tests before building the service binary.

The password minimum follows NIST SP 800-63B-4 guidance for passwords used as a single factor; see the [NIST Digital Identity Guidelines](https://pages.nist.gov/800-63-4/sp800-63b.html). The policy accepts spaces and Unicode and does not yet check a breached-password list.

## Why

A disposable baseline probe proved the Auth API accepted a five-character signup password with HTTP 201. Password hashing also ran synchronously in async handlers, allowing concurrent requests to occupy HTTP workers and memory without a bound. The new server policy and fixed-size worker pool constrain these paths.

## Verification

| Check | Result |
|---|---|
| Baseline short-password probe | Reproduced HTTP 201; temporary probe account removed |
| Auth image build | Passed; release Rust tests passed before binary compilation |
| Auth unit tests | 11 passed: input validation, Argon2 round trip, overload response, cancellation-safe slot retention, and rate-limit behavior |
| `python scripts/check-auth-inputs.py` | Passed malformed and accepted input cases, JSON overflow/redaction, Argon2id storage, valid long-password login, legacy-short login input, and scoped cleanup |
| `python scripts/check-auth-flow.py` | Passed signup race, hash-only storage, valid/forged token behavior, account rate limit, and all 60+1 IP limit checks; scoped accounts and Redis keys cleaned |
| Headless `node scripts/ci/browser.mjs` | Seven mocked UI scenarios passed; weak ASCII and short Unicode password submissions did not reach the API; real local browser journey passed with verified fixture cleanup |
| Gateway and runtime | Eight service health probes returned HTTP 200; edge JWT router checks passed |
| Interrupted test recovery | Removed exactly seven `codex-auth-check`/`codex-auth-race` `example.invalid` fixtures; the exact prefix query then returned zero |

## Follow-ups

- Add signup throttling and a breached-password blocklist.
- The per-IP login bucket still trusts forwarded headers without a peer allowlist; verify proxy trust before production.
- Verify GitHub-hosted Linux CI, including the security scan; this local evidence is not a hosted result.
- Add refresh/revocation controls and set production TLS/service-port policy.

## Related notes

- [[Change-Log]]
- [[00-Home]]
- [[Auth]]
- [[Security-Review]]
- [[Test-Matrix]]
- [[Backlog]]
