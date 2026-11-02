---
type: service
status: auth-and-queue-defects
priority: P0
language: python
updated: 2026-11-02
tags: [service/notify, status/p0, area/security, language/python]
---

# Notify

## Responsibility

Consumes RabbitMQ messages, stores notifications in MongoDB, and exposes a read API.

## Ownership

| Field | Value |
|---|---|
| Language | Python, FastAPI |
| Direct port | 8085 |
| Public route | `/notify` through Traefik |
| Data store | MongoDB (`forgeharbor.notifications`) |
| Message broker | RabbitMQ, queue `notifications` |
| Auth | None in the current code |

## Endpoints

| Method | Path | Auth | Ownership | Notes |
|---|---|---|---|---|
| GET | `/health` | None | N/A | Returns service status |
| GET | `/notifications` | None | None | Returns every notification in the database |

The frontend calls `/notify`, but the service exposes `/notifications`. Traefik strips `/notify`, so the service receives `/` for that request, not `/notifications`.

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `MONGO_DB` | No | Defaults to `forgeharbor` |
| `RABBITMQ_URL` | Yes | RabbitMQ connection string |
| `NOTIFY_QUEUE` | No | Defaults to `notifications` |
| `NOTIFY_PORT` | No | Defaults to 8085 |

## Build and test

```powershell
Push-Location apps/notify-py
python -m compileall .
Pop-Location
```

## Known issues

| Severity | Issue | Impact |
|---|---|---|
| P0 | No authentication and no user filter | Every caller can read every notification |
| P0 | Queue name mismatch: Reports publishes to `report_events`, Notify consumes `notifications` | Report notifications are never processed |
| P1 | Route mismatch: frontend calls `/notify`, service exposes `/notifications` | 404 through the gateway |
| P1 | Notification `user` field is stored as a raw value and never scoped to a caller | Cannot enforce ownership |
| P1 | The error path returns a tuple, which FastAPI serializes as an array instead of a 500 response | Clients receive a malformed body |
| P1 | The consumer has no reconnect or backoff after a broker restart | The worker stops silently |
| P1 | No dead-letter queue or retry policy | Failed messages are lost or stuck |
| P2 | `pyyaml==5.3.1` is pinned despite being old | Dependency risk; remove if unused |

## Related notes

- [[Architecture-Review]]
- [[Reports]]
- [[Gateway-Routing]]
- [[Security-Review]]
- [[Test-Matrix]]
- [[ADR-0001-polyglot-boundaries]]
