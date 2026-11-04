---
type: security
status: open
priority: P0
updated: 2026-11-05
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
| SEC-001 | P0 | History returns all users' scans when no token is present | History | Require a valid JWT and apply the user filter unconditionally | Fixed; anonymous route returns 401 |
| SEC-002 | P0 | History accepts a forged unsigned JWT when `JWT_PUBLIC_KEY` is absent | History | Require `jwt.verify` with an RS256 public key; fail closed | Fixed; missing key prevents startup; forged token returns 401 |
| SEC-003 | P0 | History detail route has no ownership check | History | Query by `_id` and `user_id`; return 404 for another user's record | Fixed and verified by the RS256 History integration fixture |
| SEC-004 | P0 | Reports routes have no authentication | Reports | Add JWT middleware and ownership checks | Fixed; RS256 required; owner filters applied |
| SEC-005 | P0 | Notify returns every notification without authentication | Notify | Add JWT middleware and scope by user | Fixed and verified by RS256 owner-isolation integration; legacy ownership backfill remains |
| SEC-006 | P1 | Local `config/.env` contains live-looking provider keys | Config | Rotate keys; replace with placeholders in the example file | Open |
| SEC-007 | P1 | JWT keys are ignored and absent from a clean clone | Auth, Phishing, Malware | Generate or validate local RSA keys before Compose build/start | Fixed by `scripts/setup-jwt-keys.mjs`; keys remain uncommitted |
| SEC-008 | P1 | Rust services allow any CORS origin | Auth, Phishing, Malware | Restrict origins per environment | Fixed — exact configured origins only; local defaults are `localhost`; deployed origin must be set in `CORS_ALLOWED_ORIGINS` |
| SEC-009 | P1 | Login rate limiting depends on trusted proxy IP headers in production | Auth | Add Redis-backed per-IP and per-account limits; trust forwarded headers only from the edge | Partial — Auth now trusts forwarded IPs only from `AUTH_TRUSTED_PROXY_IPS`; direct spoof and trusted-proxy IP threshold pass live tests. Production peer IPs and network exposure still require deployment-specific configuration |
| SEC-010 | P1 | File uploads are held in memory without size limits | Malware | Enforce a strict size cap, stream to disk, and inspect archives | Partial — 32 MiB per-file cap and two concurrent scan slots are covered by tests; disk streaming, archive inspection, and provider timeout remain |
| SEC-011 | P1 | No audit trail for logins, scans, reports, or admin actions | Platform | Add an append-only audit service | Open |
| SEC-012 | P1 | Client report content is syntax-checked but not derived from trusted scan data | Reports | Generate reports server-side from trusted scan data | New downloads require `stored-scan-v1`; missing or unknown provenance returns 410. Legacy artifact retention/regeneration remains open |
| SEC-013 | P1 | Published dev ports bypass the gateway for local callers | Platform | Bind dev ports to loopback; keep production services internal-only | Fixed in dev Compose; production deployment policy remains |
| SEC-014 | P2 | `pyyaml==5.3.1` is pinned despite being old | Notify | Upgrade or remove if unused | Fixed; unused dependency removed |
| SEC-015 | P1 | The Auth runtime image copies `.env` and `jwt-private.pem`; no `.dockerignore` exists | Auth, Notify, all builds | Add `.dockerignore`; copy only the public key; mount secrets at runtime | Fixed for all application build contexts |
| SEC-016 | P1 | The Gemini API key is sent in the URL query string | Phishing | Send the key in a header; rotate it if logs captured the URL | Fixed in code; `x-goog-api-key` header verified and query removed; rotate key if prior URLs were logged |
| SEC-017 | P1 | Compose `environment:` overrides `env_file` and passes blank provider keys | Phishing, Malware | Remove the blank overrides or require the variables at startup | Fixed; Compose now takes values from `env_file`; credential validity remains unverified |
| SEC-018 | P2 | The JWT was stored in `localStorage` | Web | Use an HttpOnly cookie, keep JWTs out of Web storage, and revoke sessions on logout | Fixed for browser sessions: Auth sets `fh_access` as HttpOnly, SameSite=Strict, Secure by default, clears it on logout, and revokes its `jti` in Redis. `/auth/me` checks revocation for Auth and ForwardAuth requests; outages fail closed. Dev Compose disables Secure only for its loopback HTTP gateway. Bearer API clients remain supported; refresh remains separate and legacy tokens without `jti` expire within one hour |
| SEC-019 | P1 | Auth logs included user emails and the MongoDB connection string | Auth | Log event names only and never emit connection strings or credentials | Fixed; Auth logs no longer include user identifiers or connection strings |
| SEC-020 | P2 | Concurrent signup requests could create duplicate email accounts | Auth | Enforce a unique MongoDB email index and map duplicate-key races to 409 | Fixed; index is ensured at startup and duplicate-key responses return 409 |
| SEC-021 | P1 | Signup abuse and unbounded credentials/Argon2 work can consume Auth and database capacity | Auth | Validate credentials, cap bodies, rate-limit signup, bound password hashing, and reject known compromised passwords | Partial — validated input, 8 KiB JSON cap, two Argon2 jobs, retryable saturation, 20 valid signup attempts per trusted IP/15 minutes, and HIBP k-anonymity screening are verified locally. Production proxy configuration, outbound HIBP availability, and hosted CI coverage remain open |

## Positive controls

- Shared ForwardAuth validates JWTs through Auth before dispatch to protected service routers; blank subjects are rejected and service ownership checks remain active. See [[ADR-0005-shared-edge-auth]] and [[2026-11-03-shared-edge-auth]]. Auth outage rejection/recovery are verified in [[2026-11-03-edge-auth-outage-and-recovery]]; production exposure and failure-latency review remain open.

- Passwords use Argon2.
- Browser sessions use an HttpOnly, SameSite=Strict cookie; the Secure flag is on by default and local HTTP Compose explicitly disables it. Protected service handlers continue to verify RS256 claims and ownership after the edge check.
- Auth issues unique token IDs and stores logout revocations in Redis through token expiry; the shared ForwardAuth check rejects revoked sessions and returns 503 if Redis is unavailable. Production service ports must stay private so clients cannot bypass the gate.
- Signup checks new passwords against the HIBP Pwned Passwords corpus using its five-character SHA-1 k-anonymity range request with padding. The password and full digest stay in Auth; a known match is rejected and API failure prevents signup. The production runtime must allow the documented outbound HTTPS dependency.
- New accounts require a well-formed ASCII email address and a 15–128 Unicode-character password; login keeps accepting legacy shorter passwords. Argon2 work is offloaded from HTTP workers and limited to two active jobs per Auth process. HTTP JSON bodies are capped at 8 KiB.
- JWTs use RS256 with issuer and audience validation in the Rust services.
- MongoDB MCP access is configured read-only.
- Auth lowercases new mailbox identities and uses a case-insensitive unique index and login collation; legacy case-variant collisions fail startup and require an explicit data cleanup before production rollout.
- GitHub MCP uses the read-only endpoint and a limited toolset.
- Secrets are referenced through environment variables, not stored in the Codex or legacy OpenCode MCP config.

## Remaining regression tests

The gateway contract now checks missing and forged tokens. Add data-backed tests for the remaining authorization behavior:

```powershell
# Anonymous history must fail
Invoke-WebRequest http://localhost:8088/history -UseBasicParsing

# Forged token must fail
# Use a token with sub=user-a and an invalid signature; expect 401.

# Cross-user detail must fail
# Create two users and request user B's scan with user A's token; expect 403/404.
```

Expected: 401 for missing or invalid auth, 404 for cross-user access, and 400 for malformed IDs after authentication.

## Remediation order

1. Add valid-token and cross-user regression fixtures for all protected services.
2. Keep production service/infrastructure ports internal-only and evaluate observed Auth failure latency against the production availability target; controlled outage rejection and recovery are verified.
3. Rotate local credentials before publishing and verify provider credentials without displaying them.
4. Set and verify production `AUTH_TRUSTED_PROXY_IPS` and HIBP outbound reachability, keep Auth private, and add audit logging.

## Related notes

- [[Threat-Model]]
- [[Test-Matrix]]
- [[History]]
- [[Reports]]
- [[Notify]]
- [[Environment]]
- [[Backlog]]
