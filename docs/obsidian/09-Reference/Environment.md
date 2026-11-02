---
type: reference
status: active
updated: 2026-11-02
tags: [reference, environment, secrets]
---

# Environment

## Application configuration

The Compose stack reads `config/.env`. A clean clone should start from `config/.env.example`, which contains placeholders only.

| Variable | Used by | Notes |
|---|---|---|
| `MONGO_URI` | Auth, Phishing, Malware, History, Reports, Notify | Internal Compose value is usually `mongodb://fh-mongo:27017` |
| `MONGO_DB` | History, Reports, Notify | Defaults to `forgeharbor` |
| `REDIS_URL` | Reserved | Provisioned but not used by current service code |
| `RABBITMQ_URL` | Reports, Notify | `amqp://guest:guest@fh-rabbit:5672/` in dev |
| `JWT_SECRET` | Documented | The current Rust services use RSA keys, not this value |
| `JWT_ISSUER` | Auth, Phishing, Malware | Default `forgeharbor` |
| `JWT_AUDIENCE` | Auth, Phishing, Malware | Default `forgeharbor-users` |
| `GEMINI_API_KEY` | Phishing | Required for URL analysis |
| `VIRUSTOTAL_API_KEY` | Malware | Required for file analysis |
| `S3_ENDPOINT` | Reports | MinIO endpoint |
| `S3_REGION` | Reports | Default `us-east-1` |
| `S3_BUCKET` | Reports | Must be non-empty |
| `S3_ACCESS_KEY` | Reports | MinIO credential |
| `S3_SECRET_KEY` | Reports | MinIO credential |
| `NOTIFY_QUEUE` | Notify | Default `notifications`; Reports publishes `report_events` |
| `AUTH_PORT` | Auth | Documented 8080; code binds 8080 |
| `PHISHING_PORT` | Phishing | Documented 8081; code binds 8081 |
| `MALWARE_PORT` | Malware | Documented 8082; code binds 8082 |
| `HISTORY_PORT` | History | Default 8083 |
| `REPORT_PORT` | Reports | Default 8084 |
| `NOTIFY_PORT` | Notify | Default 8085 |

### Compose precedence

`environment:` values override `env_file`. Compose currently sets `GEMINI_API_KEY=${GEMINI_API_KEY}` and `VIRUSTOTAL_API_KEY=${VIRUSTOTAL_API_KEY}` from the host shell, so an unset host variable becomes a blank string even when `config/.env` has a value. Remove the overrides or export the variables before `docker compose up`.

### Image build

No `.dockerignore` exists. The Auth Dockerfile copies `./config` into the runtime image, including `.env` and `jwt-private.pem`; Notify's `COPY . .` copies `aws_creds.txt` and `config.txt`. See SEC-015 in [[Security-Review]].

## JWT key files

| File | Purpose | Committed? |
|---|---|---|
| `apps/auth-rs/config/jwt-private.pem` | RS256 signing | No |
| `apps/auth-rs/config/jwt-public.pem` | RS256 verification | No |
| `apps/phishing-rs/config/jwt-public.pem` | Verification copy | No |
| `apps/malware-rs/config/jwt-public.pem` | Verification copy | No |

Generate them once and copy the public key to Phishing and Malware. See [[Build]].

## MCP configuration

See [[MCP]] for server configuration, setup, health checks, and troubleshooting.

| Variable | Used by | Value |
|---|---|---|
| `OBSIDIAN_API_KEY` | Obsidian MCP | API key from the Local REST API with MCP plugin |
| `MDB_MCP_CONNECTION_STRING` | MongoDB MCP | `mongodb://localhost:27017/forgeharbor` for the local Compose database |
| `CONTEXT7_API_KEY` | Context7 MCP | Optional; only needed if the public endpoint rate-limits you |
| `GITHUB_TOKEN` | GitHub MCP fallback | Optional; OAuth through `/mcps` is preferred |

### Set MCP variables on Windows

Use the Windows Environment Variables UI or a password manager. Avoid putting secrets in shell history. For a temporary session:

```powershell
$env:OBSIDIAN_API_KEY = '<from the Obsidian plugin>'
$env:MDB_MCP_CONNECTION_STRING = 'mongodb://localhost:27017/forgeharbor'
```

Restart OpenCode after setting persistent user variables.

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
