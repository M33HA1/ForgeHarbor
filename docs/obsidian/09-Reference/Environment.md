---
type: reference
status: active
updated: 2026-11-09
tags: [reference, environment, secrets]
---

# Environment

## Application configuration

The Compose stack reads `config/.env`. A clean clone should start from `config/.env.example`, which contains placeholders only.

| Variable | Used by | Notes |
|---|---|---|
| `MONGO_URI` | Auth, Phishing, Malware, History, Reports, Notify | Internal Compose value is usually `mongodb://fh-mongo:27017` |
| `MONGO_DB` | History, Reports, Notify | Defaults to `forgeharbor` |
| `REDIS_URL` | Auth | Required for distributed login throttling, session revocation, and signup throttling; default example points to `fh-redis` |
| `AUTH_TRUSTED_PROXY_IPS` | Auth | Comma-separated exact socket peer IPs permitted to provide `X-Forwarded-For`; defaults in dev Compose to Traefik on `172.31.240.2` and the profile-only test proxy on `172.31.240.4`. Unset/empty trusts no proxy. Production must use its real proxy peer addresses. |
| `AUTH_COOKIE_SECURE` | Auth | Defaults to enabled. Dev Compose sets `false` only for the loopback HTTP gateway; production must leave it enabled and serve the app over HTTPS. |
| `RABBITMQ_URL` | Reports, Notify | `amqp://guest:guest@fh-rabbit:5672/` in dev |
| `JWT_SECRET` | Documented | The current services use RSA keys, not this value |
| `JWT_ISSUER` | Auth, Phishing, Malware | Default `forgeharbor` |
| `JWT_AUDIENCE` | Auth, Phishing, Malware | Default `forgeharbor-users` |
| `CORS_ALLOWED_ORIGINS` | Auth, Phishing, Malware | Comma-separated exact origins; defaults to local dev origins |
| `GEMINI_API_KEY` | Phishing | Required for URL analysis |
| `VIRUSTOTAL_API_KEY` | Malware | Required for file analysis |
| Outbound HTTPS to `api.pwnedpasswords.com` | Auth | Required for privacy-preserving compromised-password checks; no API key is required; signup fails closed if the service is unavailable |
| `S3_ENDPOINT` | Reports | RustFS S3-compatible endpoint |
| `S3_REGION` | Reports | Default `us-east-1` |
| `S3_BUCKET` | Reports | Must be non-empty |
| `S3_ACCESS_KEY` | Reports | S3-compatible storage credential |
| `S3_SECRET_KEY` | Reports | S3-compatible storage credential |
| `NOTIFY_QUEUE` | Notify | Default `notifications`; Reports publishes to the same configured queue |
| `AUTH_PORT` | Auth | Go Auth defaults to 8080 |
| `PHISHING_PORT` | Phishing | Documented 8081; code binds 8081 |
| `MALWARE_PORT` | Malware | Documented 8082; code binds 8082 |
| `HISTORY_PORT` | History | Default 8083 |
| `REPORT_PORT` | Reports | Default 8084 |
| `NOTIFY_PORT` | Notify | Default 8085 |

### Compose precedence

`config/.env` supplies service settings through `env_file`. The Auth service explicitly overrides only its development trusted-proxy and cookie-security settings; provider keys are not overridden with blank host-shell values. See the current `deploy/compose/docker-compose.dev.yml` before changing precedence.

### Image build

Every application build context has a `.dockerignore`. Auth copies only its binary into the runtime image and mounts key material at runtime; Notify's source context excludes local credential files. Keep secrets out of Docker build contexts and check SEC-015 in [[Security-Review]] before changing image inputs.

The dev Compose file assigns Traefik and Auth fixed addresses on the dedicated `forgeharbor-auth-edge` network. The integration-only `fh-auth-test-proxy` binds to loopback port 8086 and starts with `docker compose -f deploy/compose/docker-compose.dev.yml --profile integration up -d fh-auth-test-proxy`; it is stopped by `scripts/ci/integration.sh` cleanup. Do not expose this test proxy outside the local machine.

## JWT key files

| File | Purpose | Committed? |
|---|---|---|
| `apps/auth-rs/config/mfa-encryption.key` | 32-byte binary AES-256-GCM key for MFA seed encryption; retain independently of JWT rotation | No |
| `apps/auth-rs/config/jwt-private.pem` | RS256 signing | No |
| `apps/auth-rs/config/jwt-public.pem` | RS256 verification | No |
| `apps/phishing-rs/config/jwt-public.pem` | Verification copy | No |
| `apps/malware-rs/config/jwt-public.pem` | Verification copy | No |

Generate them once and copy the public key to Phishing and Malware. See [[Build]].

For a clean clone, run `node scripts/setup-jwt-keys.mjs` before building or starting Compose. It creates an RSA key pair only when both Auth files are absent, verifies existing pairs, and copies only the matching public key to Phishing and Malware without overwriting files. It also creates or validates the MFA encryption key; never replace that key without a seed re-encryption migration. `MFA_ENCRYPTION_KEY_PATH` defaults to `/app/config/mfa-encryption.key` in Go Auth. See [[Auth]].

## MCP configuration

See [[MCP]] for server configuration, setup, health checks, and troubleshooting.

| Variable | Used by | Value |
|---|---|---|
| `MDB_MCP_CONNECTION_STRING` | MongoDB MCP | `mongodb://localhost:27017/forgeharbor` for the local Compose database |
| `CONTEXT7_API_KEY` | Context7 MCP | Optional; Codex OAuth or anonymous remote access may be used |

### Set MCP variables on Windows

Use the Windows Environment Variables UI or a password manager. Avoid putting secrets in shell history. MongoDB MCP inherits this variable through Codex `env_vars`:

```powershell
$env:MDB_MCP_CONNECTION_STRING = 'mongodb://localhost:27017/forgeharbor'
```

Restart Codex after changing persistent user variables. GitHub authentication is managed by Codex OAuth; no token is stored in project config.

## Secret rules

- Never commit `config/.env`, JWT keys, API keys, tokens, or connection strings with credentials.
- Never paste secrets into an Obsidian note, an issue, a PR, or a chat transcript.
- Rotate any key that has been exposed.
- The local `config/.env` contains live-looking keys; rotate them before publishing the repository.
- Use read-only MCP access for MongoDB unless a task explicitly requires a write.

## Related notes

- [[Architecture-Review]]
- [[Build]]
- [[Run]]
- [[Security-Review]]
- [[Glossary]]
