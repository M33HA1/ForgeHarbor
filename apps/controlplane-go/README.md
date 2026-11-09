# Go control plane

One Go module builds independent Auth, History, and Notify processes. Each process keeps its existing public route and database/event contract. Rust Phishing/Malware and Go Reports remain separate services. The existing React frontend remains unchanged in this backend PR.

```powershell
go test ./...
go vet ./...
go mod tidy -diff
go build -mod=readonly ./cmd/forgeharbor
# From the repository root, with Docker Desktop running:
.\scripts\check-go-parity.ps1
```

Use Go 1.27.3. Run the binary with exactly one argument: `auth`, `history`, or `notify`. No command loads a local environment file implicitly.

| Setting | Services | Behavior |
|---|---|---|
| `MONGO_URI` | All | Required; startup pings MongoDB |
| `MONGO_DB` | All | Defaults to `forgeharbor`; Auth rejects other values until its legacy user database is explicitly migrated |
| `JWT_PUBLIC_KEY_PATH` | All | Defaults to `/app/config/jwt-public.pem`; valid RSA key of at least 2048 bits required |
| `JWT_PRIVATE_KEY_PATH` | Auth | Defaults to `/app/config/jwt-private.pem`; must match the public key |
| `JWT_ISSUER`, `JWT_AUDIENCE` | All | Defaults remain `forgeharbor`, `forgeharbor-users` |
| `MFA_ENCRYPTION_KEY_PATH` | Auth | Defaults to `/app/config/mfa-encryption.key`; 32-byte key needed for MFA; missing key rejects enrolled login |
| `REDIS_URL` | Auth | Required; unavailable Redis prevents startup/authentication |
| `AUTH_TRUSTED_PROXY_IPS` | Auth | Comma-separated exact IPs; no peers trusted when unset |
| `AUTH_COOKIE_SECURE` | Auth | True unless explicitly `false`; disable only for loopback HTTP development |
| `CORS_ALLOWED_ORIGINS` | Auth | Exact origin allowlist, matching existing local defaults |
| `RABBITMQ_URL` | Notify | Required; reconnects with bounded backoff |
| `NOTIFY_QUEUE` | Notify | Defaults to `notifications`; existing queue plus `.retry` and `.dead` |
| `AUTH_PORT`, `HISTORY_PORT`, `NOTIFY_PORT` | Respective process | Defaults remain 8080, 8083, 8085 |

Auth retains Rust-compatible Argon2id PHC hashes, UUID user IDs, a case-insensitive unique mailbox index, Redis key namespaces, RS256/JWKS, and HttpOnly Strict cookies. Issued JWT audiences remain strings for Rust consumers. Revocations cover the JWT clock-skew allowance. Password screening always uses the fixed HTTPS HIBP endpoint; tests inject a synthetic checker through code, never an environment bypass.

History retains owner scoping, type/risk filters, legacy result flags, descending ObjectId cursors, and ordinary JSON ObjectId/date strings. Notify retains insert-only delivery identity, legacy event normalization, owner-scoped reads, confirmed mandatory handoff before ACK, three five-second retries, and dead storage. Broker work deadlines close blocked transports.

The parity Compose project creates fresh dependency containers with no published ports or production settings. It generates disposable keys in memory and removes its own containers/volumes. Tests include real MongoDB/Redis/RabbitMQ, race detection, poison delivery, identity collisions, and retry exhaustion. Development Compose selects Go by default. Use `deploy/compose/docker-compose.language-rollback.yml` for the legacy implementations. Full gateway and rollback evidence is recorded in `docs/obsidian/05-Changes/2026-11-09-backend-control-plane-pr.md`.
