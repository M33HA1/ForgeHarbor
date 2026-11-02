---
type: service
status: routing-and-auth-defects
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
| GET | `/health` | None | N/A | Returns service status |
| POST | `/reports` | None | None | Body: `{ "scanId": "...", "content": "..." }` |
| GET | `/reports/:id` | None | None | Returns report metadata |
| GET | `/reports/:id/download` | None | None | Streams the stored JSON report |

## Gateway conflict

Traefik strips `/reports` before forwarding. The service registers `/reports` and `/reports/:id`, so it receives `/` and `/:id` and does not match the intended routes. This must be resolved either by removing the strip middleware for this router or by changing the service's route registration.

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
| P0 | Gateway prefix stripping conflicts with `/reports` routes | 404s through the gateway |
| P1 | `report_events` queue is not consumed by Notify | Report notifications never arrive |
| P1 | Report content is accepted from the client without validation | Stored content injection and integrity risk |
| P1 | MinIO image pull failure blocks startup | Reports cannot store objects |
| P2 | No tests in the repository | Behavior is unverified |

## Related notes

- [[Gateway-Routing]]
- [[Notify]]
- [[Build]]
- [[Security-Review]]
- [[ADR-0001-polyglot-boundaries]]
