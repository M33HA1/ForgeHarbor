---
type: service
status: auth-defects
priority: P0
language: go
updated: 2026-11-02
tags: [service/reports, status/p0, area/security, language/go]
---

# Reports

## Responsibility

Creates JSON reports, stores them in S3-compatible object storage, records metadata in MongoDB, and publishes report events to RabbitMQ.

## Ownership

| Field | Value |
|---|---|
| Language | Go, Gin |
| Direct port | 8084 |
| Public route | `/reports` through Traefik |
| Data stores | MongoDB (`forgeharbor.reports`), MinIO |
| Message broker | RabbitMQ, queue `report_events` |
| Auth | None in the current code |

## Endpoints

| Method | Path | Auth | Ownership | Notes |
|---|---|---|---|---|
| GET | `/reports/health` | None | N/A | Returns service status |
| POST | `/reports` | None | None | Body: `{ "scanId": "...", "content": "..." }` |
| GET | `/reports/:id` | None | None | Returns report metadata |
| GET | `/reports/:id/download` | None | None | Streams the stored JSON report |

## Gateway contract

Reports registers `/reports` and `/reports/:id`, and the gateway does not rewrite the path (D1=B). The public and direct-port paths match. See [[ADR-0004-gateway-prefix-contract]].

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `MONGO_DB` | Yes | Database name |
| `RABBITMQ_URL` | Yes | RabbitMQ connection string |
| `S3_ENDPOINT` | Yes | MinIO endpoint |
| `S3_REGION` | No | Defaults to `us-east-1` |
| `S3_BUCKET` | Yes | Report bucket; service creates it if missing |
| `S3_ACCESS_KEY` | Yes | MinIO access key |
| `S3_SECRET_KEY` | Yes | MinIO secret key |
| `REPORT_PORT` | No | Defaults to 8084 |

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

## Known issues

| Severity | Issue | Impact |
|---|---|---|
| P0 | No JWT authentication or ownership checks | Anyone can create, read, or download reports |
| P1 | `report_events` queue is not consumed by Notify | Report notifications never arrive |
| P1 | One AMQP channel is shared across concurrent Gin handlers | Data race and connection corruption |
| P1 | Bucket creation uses `log.Fatal` at startup; MinIO may not be ready | Crash loop on startup |
| P1 | Report content is accepted from the client without validation | Stored content injection and integrity risk |
| P1 | MinIO image pull failure blocks startup | Reports cannot store objects |
| P2 | S3, Mongo, and RabbitMQ calls use `context.TODO()` with no timeout | Requests can hang |
| P2 | No tests in the repository | Behavior is unverified |

## Related notes

- [[Architecture-Review]]
- [[Gateway-Routing]]
- [[Notify]]
- [[Build]]
- [[Security-Review]]
- [[ADR-0001-polyglot-boundaries]]
