---
date: 2026-11-03
type: change
area: [auth, security, passwords]
status: verified
related: [[Auth]], [[Security-Review]], [[ADR-0005-shared-edge-auth]]
tags: [change, auth, security]
---

# Auth breached-password screening

## What changed

- Auth checks new passwords against Have I Been Pwned's Pwned Passwords range API before Argon2 hashing or account creation. The request sends only the first five SHA-1 hex characters and enables response padding; the password and full hash remain in Auth.
- Known matches are rejected with a credential-policy error. API, TLS, malformed-response, and timeout failures fail closed with HTTP 503 and `Retry-After: 30`.
- Added parser/request-contract and fail-closed response tests, plus a disposable integration check using the known-compromised `correcthorsebatterystaple` fixture and unique accepted passwords.
- Signup UI explains that it checks a partial hash against known breaches and does not send the password itself.

## Why

- FH-041 and SEC-021 called for preventing new accounts from using passwords already exposed in public breach data.

## Verification

| Check | Command | Result |
|---|---|---|
| Auth release image | `docker compose -f deploy/compose/docker-compose.dev.yml build fh-auth` | Passed; MongoDB 3.2.5 locked; all 25 Auth release tests passed |
| Full local integration | `scripts/ci/integration.sh` | Passed with exit code 0; known breached password rejected, unique signups accepted, and all gateway, ownership, report, and notification regressions passed |
| Mocked browser suite | Playwright MCP `browser_run_code_unsafe`, `scripts/check-web-ui.js` | All seven scenarios passed, including the signup privacy disclosure; zero backend writes or provider calls |
| Known password fixture | HIBP range API for the five-character SHA-1 prefix | Confirmed the public demonstration password is present (4,173 occurrences at check time); the password itself was not sent to the API |

## Follow-ups

- Permit outbound HTTPS to `api.pwnedpasswords.com` in production and monitor availability; Auth deliberately rejects registrations while screening is unavailable.
- Rotate local provider credentials and verify provider auth before publication; hosted CI/security findings remain pending.

## References

- [Have I Been Pwned Pwned Passwords API](https://haveibeenpwned.com/API/v3)
- [Have I Been Pwned k-anonymity and NIST guidance](https://haveibeenpwned.com/NIST)

## Related notes

- [[Change-Log]]
- [[Auth]]
- [[Security-Review]]
- [[ADR-0005-shared-edge-auth]]
