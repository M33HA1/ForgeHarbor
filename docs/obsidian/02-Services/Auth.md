---
type: service
status: build-fixed
priority: P0
language: rust
updated: 2026-11-03
tags: [service/auth, status/p0, area/security, language/rust]
---

# Auth

Protected gateway requests use the shared Auth ForwardAuth gate; service JWT and ownership checks remain active. Exact GET health paths and CORS preflights remain public. See [[ADR-0005-shared-edge-auth]] and [[2026-11-03-shared-edge-auth]].

## Runtime hardening

The runtime container runs as UID 65532; the MongoDB driver is pinned to 3.9.1 to remove vulnerable legacy DNS/TLS transitive crates. Hosted integration gives the generated ephemeral Auth key group 65532 read-only access (mode 0640), retaining runner ownership and private-key restrictions.

## Responsibility

Registration, login, JWT issuance, JWKS exposure, and current-user lookup. This is the trust anchor for every protected service.

## Ownership

| Field | Value |
|---|---|
| Language | Rust, Actix Web |
| Direct port | 8080 |
| Public route | `/auth` through Traefik |
| Data stores | MongoDB (`forgeharbor.users`), Redis (login throttling and session revocation) |
| Key material | `apps/auth-rs/config/jwt-private.pem`, `jwt-public.pem` |
| Downstream consumers | Web, Phishing, Malware, and any service that verifies JWTs |

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/auth/health` | None | Returns `Service is Healthy!` |
| POST | `/auth/signup` | None | Validates a 15–128 Unicode-character password and ASCII mailbox; lowercases the mailbox and stores only an Argon2id hash |
| POST | `/auth/login` | None | Uses case-insensitive email matching and accepts legacy shorter passwords; sets an HttpOnly `fh_access` cookie with an RS256 JWT carrying the published JWKS `kid`; returns `expires_in: 3600` |
| POST | `/auth/logout` | None | Revokes the current token ID in Redis until expiry and clears the browser session cookie |
| GET | `/auth/jwks` | None | Publishes the RS256 public key as an RFC 7517 RSA JWK with a stable RFC 7638 thumbprint `kid` |
| GET | `/auth/me` | HttpOnly session cookie or Bearer RS256 | Returns the current user |

## Configuration

| Variable or file | Required | Purpose |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `REDIS_URL` | Yes | Redis connection for distributed login throttling and session revocation; Auth fails startup if unavailable |
| Compromised-password screening | Yes | Auth performs an HTTPS k-anonymity range lookup through Have I Been Pwned before hashing; outbound access to `api.pwnedpasswords.com` is required, and signup fails closed if screening is unavailable |
| MongoDB `users.email` index | Yes | Unique English secondary-strength collation prevents duplicate mailbox identities that differ only by ASCII case |
| Request body | Yes | Auth JSON endpoints reject bodies over 8 KiB |
| `JWT_ISSUER` | Recommended | Expected issuer; default `forgeharbor` |
| `JWT_AUDIENCE` | Recommended | Expected audience; default `forgeharbor-users` |
| `./config/jwt-private.pem` | Yes | RS256 signing key |
| `./config/jwt-public.pem` | Yes | RS256 verification key |
| `AUTH_PORT` | No | Documented as 8080; the code binds 8080 directly |
| `AUTH_TRUSTED_PROXY_IPS` | No | Exact peer-IP allowlist for `X-Forwarded-For`; unset means no proxy is trusted. Dev Compose defaults to the fixed Traefik edge IP and the integration-only test proxy IP. |
| `AUTH_COOKIE_SECURE` | No | Defaults to true; dev Compose explicitly sets false for its loopback HTTP gateway. Production must keep this enabled and use HTTPS. |

## Build and test

```powershell
docker compose -f deploy/compose/docker-compose.dev.yml build fh-auth
docker compose -f deploy/compose/docker-compose.dev.yml up -d fh-auth
Invoke-WebRequest http://localhost:8080/auth/health -UseBasicParsing
python scripts/check-auth-flow.py
```

The image builds on pinned stable Rust 1.90.0. The nightly toolchain triggered an async-drop cycle in `mongodb` 3.2.5; the Dockerfile no longer uses nightly and builds with `--locked`.

Local Rust check:

```powershell
Push-Location apps/auth-rs
cargo test
Pop-Location
```

## Known issues

| Severity | Issue | Impact |
|---|---|---|
| P1 | Production CORS origin still needs deployment configuration | Browser requests from the deployed web origin will be denied until `CORS_ALLOWED_ORIGINS` is set |
| P1 | Production proxy trust is deployment-specific | Dev Auth trusts only the fixed Traefik peer; production must set exact proxy peer IPs and keep Auth unreachable from untrusted clients |
| P2 | No refresh-token flow | Session-management gap |
| P2 | Signup depends on the Have I Been Pwned range API | Screening fails closed with a retryable 503 when the API is unavailable; production must allow outbound HTTPS and monitor this dependency |

## Security notes

- Passwords use Argon2.
- Browser sessions use an HttpOnly, SameSite=Strict cookie with a one-hour lifetime; the Secure attribute defaults on and is disabled only by the development Compose override. Non-browser clients can still use RS256 bearer tokens.
- Tokens use RS256, include the matching public JWKS `kid` and a unique `jti`, and expire after one hour.
- Logout revokes issued `jti` values in Redis through their remaining lifetime. `/auth/me` checks the revocation record and fails closed with 503 if Redis is unavailable. Tokens minted before `jti` issuance remain accepted until their one-hour expiry.
- Immediate revocation is enforced at Auth and the shared ForwardAuth gate. Production service ports must remain private so client traffic cannot bypass that check; service handlers still independently verify signature and ownership.
- The auth middleware validates issuer and audience in the Rust services.
- Auth logs record event names without email addresses, JWTs, or MongoDB connection strings.
- Auth creates a unique MongoDB index on `users.email` at startup and returns 409 on duplicate-key races; startup fails if legacy duplicates prevent index creation.
- New email identities are stored in lowercase. A case-insensitive unique MongoDB index and collation-backed login lookup also protect existing mixed-case records. Startup fails with an explicit remediation message if legacy case variants collide; production data needs the same preflight before rollout.
- Signup attempts use an atomic Redis counter: 20 valid requests per client IP in a 15-minute window. Login attempts use atomic Redis counters: 5 per normalized account and 60 per client IP in the same window. Redis failure returns 503; throttling returns 429 with `Retry-After`. Auth uses the socket peer unless its address is in `AUTH_TRUSTED_PROXY_IPS`; forwarded chains are considered only from those peers. Dev Traefik/Auth use a dedicated fixed-address bridge. Production must configure the actual trusted proxy peer addresses and keep Auth private.
- Argon2 hashing and verification use a two-slot blocking thread pool. Saturation fails quickly with 503 and `Retry-After: 1`; the permit remains held if the caller disconnects while password work is running.
- New-account credentials are validated before database writes; the 8 KiB JSON cap limits request memory, and input errors never include request content. Password minimum follows current NIST single-factor guidance. Before Argon2 hashing, Auth sends only the first five characters of the password's SHA-1 digest to the HIBP range API with padding enabled; it never sends the password or full digest. Known breached passwords are rejected, and API failure returns 503 with `Retry-After`.
- Do not print token values or key material in logs or notes.

## Recent changes

- [[2026-11-03-auth-breached-password-screening]]: signup rejects passwords present in the HIBP corpus using a five-character SHA-1 prefix query; checker outages fail closed.

- [[2026-11-03-auth-session-revocation]]: logout revokes token IDs in Redis through expiry; Auth/ForwardAuth rejects revoked tokens and fails closed on Redis errors.

- [[2026-11-03-auth-case-insensitive-email]]: new emails normalize to lowercase; an English secondary-strength unique index and collation-backed login reject case-only duplicates.

- [[2026-11-03-auth-standard-jwks]]: `/auth/jwks` now publishes standard RSA modulus/exponent fields and a stable thumbprint key ID.

- [[2026-11-03-auth-signup-ip-limit]]: Redis-backed 20/IP/15-minute signup limit uses the trusted socket-peer boundary and returns a retryable 429.

- [[2026-11-03-auth-trusted-proxy-ip-boundary]]: only allowlisted peers can supply the forwarded login IP; direct spoofing and the trusted proxy's live Redis threshold are covered.

- [[2026-11-03-http-only-browser-sessions]]: browser login/logout uses an HttpOnly cookie through the edge and all protected services, with real reload and owner-isolation coverage.

- [[2026-11-03-auth-credential-boundaries-and-password-capacity]]: server-side credential policy, request limits, bounded Argon2 execution, and focused regression checks.

- [[2026-11-03-live-browser-service-journey]]: UI signup/login, issued sessions, refresh, and cross-service public user identity verified.

- [[2026-11-03-edge-auth-outage-and-recovery]]: Auth outage rejects protected gateway traffic; automatic restoration and recovery verified.

- [[2026-11-03-configured-cors-origins]]
- [[2026-11-03-auth-flow-regression-and-log-redaction]]
- [[2026-11-03-auth-login-rate-limit]]
- [[2026-11-03-scanner-and-owner-regression-coverage]]

## Related notes

- [[Architecture-Review]]
- [[Service-Map]]
- [[Build]]
- [[Debug]]
- [[Security-Review]]
- [[ADR-0001-polyglot-boundaries]]
