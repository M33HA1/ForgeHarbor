---
type: service
status: protected
priority: P1
language: go
updated: 2026-11-09
tags: [service/notify, status/p0, area/security, language/go]
---

# Notify

## Go language migration

Development Compose now runs Notify from `apps/controlplane-go` behind the existing API/data contract. Merged in [PR #69](https://github.com/M33HA1/ForgeHarbor/pull/69); hosted build, security, real-store race contracts and full-stack browser checks passed on PR head `9d41051`. A legacy rollback overlay is retained; see [[2026-11-09-backend-control-plane-pr]]. The legacy implementation remains available through the language rollback overlay.

Protected gateway requests use the shared Auth ForwardAuth gate; service JWT and ownership checks remain active. Exact GET health paths and CORS preflights remain public. See [[ADR-0005-shared-edge-auth]] and [[2026-11-03-shared-edge-auth]].

## Runtime hardening

The active Go runtime runs as UID 65532. The legacy Python image retains UID 10001.

## Responsibility

Consumes RabbitMQ messages, stores notifications in MongoDB, and exposes a read API.

## Ownership

| Field | Value |
|---|---|
| Language | Go, net/http with AMQP consumer |
| Direct port | 8085 |
| Public route | `/notify` through Traefik |
| Data store | MongoDB (`forgeharbor.notifications`) |
| Message broker | RabbitMQ, queue `notifications` |
| Auth | Required RS256 JWT; Auth public key mounted read-only |

## Endpoints

| Method | Path | Auth | Ownership | Notes |
|---|---|---|---|---|
| GET | `/notify/health` | None | N/A | 200 only when MongoDB responds and the consumer is connected; otherwise 503 |
| GET | `/notify` | Required | Filtered by JWT `sub` | Returns at most 100 notifications |

The frontend calls `/notify`, and the service now registers `/notify`; the gateway does not rewrite the path (D1=B). See [[ADR-0004-gateway-prefix-contract]].

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `MONGO_DB` | No | Defaults to `forgeharbor` |
| `RABBITMQ_URL` | Yes | RabbitMQ connection string |
| `NOTIFY_QUEUE` | No | Defaults to `notifications` |
| `NOTIFY_PORT` | No | Defaults to 8085 |
| `JWT_PUBLIC_KEY_PATH` | No | Defaults to `/app/config/jwt-public.pem` |
| `JWT_ISSUER` | No | Defaults to `forgeharbor` |
| `JWT_AUDIENCE` | No | Defaults to `forgeharbor-users` |

## Build and test

Use `scripts/check-go-parity.ps1` for the active Go consumer, including real RabbitMQ retry exhaustion, dead storage, and idempotency with race checks. The commands below exercise the retained Python worker and shared HTTP ownership fixture; Python delivery checks validate the legacy worker, not the Go consumer.

```powershell
Push-Location apps/notify-py
python -m compileall .
python -m unittest test_worker.py
python scripts/check-delivery.py
python scripts/check-ownership.py
Pop-Location
```

The integration check signs disposable RS256 tokens, inserts uniquely tagged records for two synthetic owners, verifies the gateway returns only the caller's record, and removes the fixtures.

## Known issues

| Severity | Issue | Impact |
|---|---|---|
| P1 | Existing records without a matching `user` subject are not visible to callers | Legacy data may need a controlled ownership backfill |
| P1 | Live broker restart and reconnect still need an operational drill | Reconnect/backoff is implemented and unit-tested; broker failure evidence is still needed |
| P1 | Classic retry redrive and unverified broker-failure behavior still limit end-to-end durability | Consumer confirms, three bounded retries, and dead storage are implemented; Reports outbox is implemented; quorum redrive policy remains |
| P1 | Dead-message retention, monitoring, and reviewed replay are not configured | Operations need a safe recovery workflow |

## Delivery behavior

See [[ADR-0006-report-notification-events]] for the event contract, legacy compatibility, insert-only idempotency, five-second retries (three retries maximum), and confirmed dead-letter handoff. The original queue is unchanged; new durable `.retry` and `.dead` queues preserve failed messages. See [[2026-11-03-notification-delivery-hardening]].

## Related notes

- [[Architecture-Review]]
- [[Reports]]
- [[Gateway-Routing]]
- [[Security-Review]]
- [[Test-Matrix]]
- [[ADR-0001-polyglot-boundaries]]
