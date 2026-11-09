---
type: service
status: protected
priority: P1
language: go
updated: 2026-11-09
tags: [service/history, status/p0, area/security, language/go]
---

# History

## Go language migration

Development Compose now runs History from `apps/controlplane-go` behind the existing API/data contract. Merged in [PR #69](https://github.com/M33HA1/ForgeHarbor/pull/69); hosted build, security, real-store race contracts and full-stack browser checks passed on PR head `9d41051`. A legacy rollback overlay is retained; see [[2026-11-09-backend-control-plane-pr]]. The legacy implementation remains available through the language rollback overlay.

Protected gateway requests use the shared Auth ForwardAuth gate; service JWT and ownership checks remain active. Exact GET health paths and CORS preflights remain public. See [[ADR-0005-shared-edge-auth]] and [[2026-11-03-shared-edge-auth]].

## Runtime hardening

The active Go runtime runs as UID 65532; the legacy rollback image retains the Node.js user.

## Responsibility

Reads scan records from MongoDB and exposes a paginated history API.

## Ownership

| Field | Value |
|---|---|
| Language | Go, net/http |
| Direct port | 8083 |
| Public route | `/history` through Traefik |
| Data store | MongoDB (`forgeharbor.scans`) |
| Auth | Required RS256 JWT; Auth public key mounted read-only |

## Endpoints

| Method | Path | Auth | Ownership | Notes |
|---|---|---|---|---|
| GET | `/history/health` | None | N/A | Includes MongoDB ping status |
| GET | `/history` | Required | Scoped to JWT `sub` | Page size capped at 100; malformed cursors return 400 |
| GET | `/history/:scan_id` | Required | Scoped to JWT `sub` | Invalid IDs return 400; other users' records appear not found |

## Gateway contract

History registers `/history` and `/history/:scan_id`, and the gateway does not rewrite the path (D1=B). The public and direct-port paths match. See [[ADR-0004-gateway-prefix-contract]] and [[Gateway-Routing]].

## Query parameters

| Parameter | Current behavior | Problem |
|---|---|---|
| `limit` | Defaults to 20 and is clamped to 1–100 | None |
| `cursor` | Base64-encoded ObjectId; filters `_id < cursor` | Malformed cursors return 400 |
| `type` | Filters `scan_type` | Matches the stored field |
| `risk` | `high` or `low`; filters canonical `result.risk_level` and falls back to legacy phishing/malware booleans | Other values return 400; scanner writers now persist the canonical field |

## Security findings

Data routes require a valid RS256 JWT with issuer, audience, subject, and expiration claims. List and detail queries always include the authenticated subject as `user_id`; missing or invalid tokens return 401. The public key is mounted from Auth's config, and the service fails to start if it is unavailable. Gateway probes for missing and forged tokens are recorded in [[2026-11-02-phase-0-core-security]].

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `MONGO_DB` | No | Defaults to `forgeharbor` |
| `JWT_PUBLIC_KEY_PATH` | No | Defaults to `/app/config/jwt-public.pem`; Compose mounts the required key read-only |
| `JWT_ISSUER` | No | Defaults to `forgeharbor` |
| `JWT_AUDIENCE` | No | Defaults to `forgeharbor-users` |
| `HISTORY_PORT` | No | Defaults to 8083 |

## Build and test

Run `go test ./...` and `go build ./cmd/forgeharbor` in `apps/controlplane-go`. The retained TypeScript package supplies legacy builds and the shared API fixture; its integration test also passes against Go.

```powershell
Push-Location apps/history-ts
npm ci
npm run build
npm run test:integration
Pop-Location
```

## Recent changes

- [[2026-11-03-live-browser-service-journey]]: real Auth-issued browser sessions verify two-user list/detail isolation and refresh.

- [[2026-11-03-scanner-and-owner-regression-coverage]] — persistent owner, malformed-ID, and scanner-auth checks.

## Related notes

- [[Architecture-Review]]
- [[Data-Flow]]
- [[Gateway-Routing]]
- [[Security-Review]]
- [[Test-Matrix]]
- [[ADR-0003-postgres-for-history]]
