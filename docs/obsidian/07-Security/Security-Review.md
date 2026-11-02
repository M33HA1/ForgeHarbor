---
type: security
status: open
priority: P0
updated: 2026-11-02
tags: [security, review, p0]
---

# Security Review

## Scope

Auth, History, Reports, Notify, the Traefik edge, local configuration, and the frontend's handling of tokens and results.

## Method

Manual review of the service code and live API probes against the local Compose stack. Tests used disposable users and records. No secret values are reproduced here.

## Findings

| ID | Severity | Finding | Affected | Remediation | Status |
|---|---|---|---|---|---|
| SEC-001 | P0 | History returns all users' scans when no token is present | History | Require a valid JWT and apply the user filter unconditionally | Open |
| SEC-002 | P0 | History accepts a forged unsigned JWT when `JWT_PUBLIC_KEY` is absent | History | Require `jwt.verify` with an RS256 public key; fail closed | Open |
| SEC-003 | P0 | History detail route has no ownership check | History | Query by `_id` and `user_id`; return 404 for another user's record | Open |
| SEC-004 | P0 | Reports routes have no authentication | Reports | Add JWT middleware and ownership checks | Open |
| SEC-005 | P0 | Notify returns every notification without authentication | Notify | Add JWT middleware and scope by user | Open |
| SEC-006 | P1 | Local `config/.env` contains live-looking provider keys | Config | Rotate keys; replace with placeholders in the example file | Open |
| SEC-007 | P1 | JWT keys are ignored and absent from a clean clone | Auth, Phishing, Malware | Document generation and mount keys safely | Open |
| SEC-008 | P1 | Rust services allow any CORS origin | Auth, Phishing, Malware | Restrict origins per environment | Open |
| SEC-009 | P1 | No login rate limiting | Auth | Add per-IP and per-account throttling | Open |
| SEC-010 | P1 | File uploads are held in memory without size limits | Malware | Stream to disk, enforce limits, inspect archives | Open |
| SEC-011 | P1 | No audit trail for logins, scans, reports, or admin actions | Platform | Add an append-only audit service | Open |
| SEC-012 | P1 | Report content is accepted from the client without validation | Reports | Generate reports server-side from trusted scan data | Open |
| SEC-013 | P1 | Direct host ports bypass the gateway | Platform | Bind services to the internal network in production | Open |
| SEC-014 | P2 | `pyyaml==5.3.1` is pinned despite being old | Notify | Upgrade or remove if unused | Open |

## Positive controls

- Passwords use Argon2.
- JWTs use RS256 with issuer and audience validation in the Rust services.
- MongoDB MCP access is configured read-only.
- GitHub MCP uses the read-only endpoint and a limited toolset.
- Secrets are referenced through environment variables in the OpenCode config.

## Verification tests

These should become automated regression tests:

```powershell
# Anonymous history must fail
Invoke-WebRequest http://localhost:8088/history -UseBasicParsing

# Forged token must fail
# Use a token with sub=user-a and an invalid signature; expect 401.

# Cross-user detail must fail
# Create two users and request user B's scan with user A's token; expect 403/404.
```

Expected after remediation: 401 for missing or invalid auth, 403/404 for cross-user access, 400 for malformed IDs.

## Remediation order

1. Fix History auth and ownership.
2. Fix Reports auth and ownership.
3. Fix Notify auth and ownership.
4. Rotate keys and clean test data.
5. Add regression tests.
6. Add rate limiting, CORS restrictions, upload limits, and audit logging.

## Related notes

- [[Threat-Model]]
- [[Test-Matrix]]
- [[History]]
- [[Reports]]
- [[Notify]]
- [[Environment]]
- [[Backlog]]
