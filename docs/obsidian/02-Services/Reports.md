---
type: service
status: protected
priority: P1
language: go
updated: 2026-11-05
tags: [service/reports, status/p0, area/security, language/go]
---

# Reports

Protected gateway requests use the shared Auth ForwardAuth gate; service JWT and ownership checks remain active. Exact GET health paths and CORS preflights remain public. See [[ADR-0005-shared-edge-auth]] and [[2026-11-03-shared-edge-auth]].

## Responsibility

Creates JSON reports, stores them in S3-compatible object storage, records metadata in MongoDB, and publishes report events to RabbitMQ.

## Ownership

| Field | Value |
|---|---|
| Language | Go, Gin |
| Direct port | 8084 |
| Public route | `/reports` through Traefik |
| Data stores | MongoDB (`forgeharbor.reports`), RustFS (S3-compatible API) |
| Message broker | RabbitMQ, queue `notifications` |
| Auth | Required RS256 JWT; Auth public key mounted read-only |

## Endpoints

| Method | Path | Auth | Ownership | Notes |
|---|---|---|---|---|
| GET | `/reports/health` | None | N/A | Checks MongoDB and the RustFS report bucket concurrently; returns 503 when either required dependency is unavailable |
| POST | `/reports` | Required | Sets `user_id` from JWT | Requires owned stored-scan ObjectId; generates stored evidence; caller content is ignored |
| GET | `/reports?scan_id=...` | Required | Filters by JWT `user_id` and requested scan IDs | Returns matching report metadata, newest first; accepts up to 100 IDs |
| GET | `/reports/:id` | Required | `_id` and `user_id` | Returns owned report metadata |
| GET | `/reports/:id/download` | Required | `_id` and `user_id` | Streams only an owned report |

## Gateway contract

Reports registers `/reports` and `/reports/:id`, and the gateway does not rewrite the path (D1=B). The public and direct-port paths match. See [[ADR-0004-gateway-prefix-contract]].

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `MONGO_DB` | Yes | Database name |
| `RABBITMQ_URL` | Yes | RabbitMQ connection string |
| `S3_ENDPOINT` | Yes | RustFS S3 endpoint |
| `S3_REGION` | No | Defaults to `us-east-1` |
| `S3_BUCKET` | Yes | Report bucket; service creates it if missing |
| `S3_ACCESS_KEY` | Yes | RustFS access key |
| `S3_SECRET_KEY` | Yes | RustFS secret key |
| `REPORT_PORT` | No | Defaults to 8084 |
| `JWT_PUBLIC_KEY_PATH` | No | Defaults to `/app/config/jwt-public.pem` |
| `JWT_ISSUER` | No | Defaults to `forgeharbor` |
| `JWT_AUDIENCE` | No | Defaults to `forgeharbor-users` |

Reports creates a compound `user_id`, `scanId`, `createdAt` index for owner-scoped history lookup and a partial pending/creation-time index for the embedded notification outbox. See [[ADR-0007-report-notification-outbox]]. RabbitMQ is required by the background relay but does not block report HTTP startup; new reports retain publication intent until confirmed.

## Build and test

```powershell
Push-Location apps/report-go
go test ./...
go build ./...
Pop-Location
```

Docker path, when Go is not installed locally:

```powershell
docker compose -f deploy/compose/docker-compose.dev.yml build fh-report
```

Owner and validation check:

```powershell
python scripts/check-report-list.py
python scripts/check-report-integrity.py
```

## Known issues

| Severity | Issue | Impact |
|---|---|---|
| P1 | Existing reports without `user_id` are not visible through owner-scoped routes | Legacy reports need a controlled ownership backfill |
| P1 | Outbox backlog alerting/retention and live infrastructure failure drills remain open | The relay now owns its channel; pending records survive failed or ambiguous publication |
| P2 | Artifact cleanup after a confirmed metadata absence is best-effort; unknown insert outcomes retain the object | Failed RustFS deletion or an ambiguous write can leave an orphan object requiring reconciliation |
| P1 | Legacy artifacts without `source: stored-scan-v1` contain unverified caller content | Downloads now return 410; retention, regeneration, or deletion policy is still needed |
| P2 | Automated storage and messaging failure-path coverage remains limited | Operational errors may regress without integration checks |

## Recent changes

- [[2026-11-05-reports-bucket-startup-retry]]: startup retries bucket discovery/creation for up to 30 seconds when RustFS is temporarily unavailable.

- [[2026-11-04-legacy-report-download-provenance]]: downloads fail closed for missing or unknown provenance; Web shows regeneration guidance.

- [[2026-11-03-report-operation-deadlines]]: list/metadata reads are bounded to five seconds; downloads use a twenty-second end-to-end deadline, and infrastructure errors map to generic 503 responses.

- [[2026-11-03-report-artifact-compensation]]: ambiguous MongoDB insert outcomes are verified before cleanup; only confirmed-absent metadata triggers a bounded RustFS delete.

- [[2026-11-03-report-readiness-checks]]: health reflects MongoDB and RustFS availability and fails closed without exposing dependency errors.

- [[2026-11-03-live-browser-service-journey]]: real UI creation/download/restoration and foreign-owner denial, plus outbox notification observation and storage cleanup.

- [[2026-11-03-report-notification-outbox]]: atomic publication intent, mandatory confirmed relay, and pending-event replay verification.

- [[2026-11-03-notification-delivery-hardening]]: stable versioned persistent report events; producer outbox/confirm recovery remains open.

- [[2026-11-03-trusted-scan-reports]]: owned stored-scan evidence, provenance, and integrity fixtures.

- [[2026-11-03-scanner-and-owner-regression-coverage]] — persistent owner and malformed-ID integration checks.

- [[2026-11-03-history-report-actions]] — added owner-scoped metadata lookup by scan IDs for History.

## Related notes

- [[Architecture-Review]]
- [[Gateway-Routing]]
- [[Notify]]
- [[Build]]
- [[Security-Review]]
- [[ADR-0001-polyglot-boundaries]]
- [[2026-11-02-reports-route-and-rustfs]]
