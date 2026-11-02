---
type: service
status: broken
priority: P0
language: rust
updated: 2026-11-02
tags: [service/auth, status/p0, area/security, language/rust]
---

# Auth

## Responsibility

Registration, login, JWT issuance, JWKS exposure, and current-user lookup. This is the trust anchor for every protected service.

## Ownership

| Field | Value |
|---|---|
| Language | Rust, Actix Web |
| Direct port | 8080 |
| Public route | `/auth` through Traefik |
| Data stores | MongoDB (`forgeharbor.users`) |
| Key material | `apps/auth-rs/config/jwt-private.pem`, `jwt-public.pem` |
| Downstream consumers | Web, Phishing, Malware, and any service that verifies JWTs |

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | None | Returns `Service is Healthy!` |
| POST | `/signup` | None | Creates a user; Argon2 password hash |
| POST | `/login` | None | Returns `access_token` and `expires_in: 3600` |
| GET | `/jwks` | None | Publishes the RSA public key |
| GET | `/me` | Bearer RS256 | Returns the current user |

## Configuration

| Variable or file | Required | Purpose |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_ISSUER` | Recommended | Expected issuer; default `forgeharbor` |
| `JWT_AUDIENCE` | Recommended | Expected audience; default `forgeharbor-users` |
| `./config/jwt-private.pem` | Yes | RS256 signing key |
| `./config/jwt-public.pem` | Yes | RS256 verification key |
| `AUTH_PORT` | No | Documented as 8080; the code binds 8080 directly |

## Build and test

```powershell
docker compose -f deploy/compose/docker-compose.dev.yml build fh-auth
docker compose -f deploy/compose/docker-compose.dev.yml up -d fh-auth
Invoke-WebRequest http://localhost:8080/health -UseBasicParsing
```

Local Rust test command, once the build is fixed:

```powershell
Push-Location apps/auth-rs
cargo test
Pop-Location
```

## Known issues

| Severity | Issue | Impact |
|---|---|---|
| P0 | `mongodb-3.2.5` fails with `error[E0391]: cycle detected when computing when error::GridFsErrorKind needs async drop` | Image does not build; login is unavailable |
| P0 | Dockerfile copies `Cargo.toml` but the tracked file is `cargo.toml` | Case-sensitive Linux builds fail before compilation |
| P0 | JWT key files are ignored by git and absent from a clean clone | Service exits at startup if keys are missing |
| P1 | Dockerfile uses `rustlang/rust:nightly` and wildcard dependency versions | Non-reproducible builds |
| P1 | CORS allows any origin, method, and header | Broad browser exposure |
| P2 | No login rate limiting or refresh-token flow | Brute-force and session-management gaps |

## Security notes

- Passwords use Argon2.
- Tokens use RS256 and expire after one hour.
- The auth middleware validates issuer and audience in the Rust services.
- Do not print token values or key material in logs or notes.

## Related notes

- [[Service-Map]]
- [[Build]]
- [[Debug]]
- [[Security-Review]]
- [[ADR-0001-polyglot-boundaries]]
