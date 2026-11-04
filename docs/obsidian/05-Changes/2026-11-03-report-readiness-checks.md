---
date: 2026-11-03
updated: 2026-11-03
type: change
status: verified
area: [reports, reliability]
tags: [change, health, readiness]
---

# Reports dependency readiness checks

## What changed

- The public Reports health route now checks MongoDB and the configured RustFS bucket concurrently with a two-second deadline.
- It returns HTTP 503 with a generic degraded status if either required dependency is unavailable; internal dependency errors are not returned to callers.
- Added route-handler tests for healthy, MongoDB-failure, and object-storage-failure responses.

## Why

- Reports previously returned HTTP 200 unconditionally, even when its metadata or artifact dependency could not serve report operations.
- A false healthy signal prevents local and deployment health probes from detecting a failed dependency.

## Verification

| Check | Command | Result |
|---|---|---|
| Reports unit tests | `docker run --rm --mount type=bind,source=C:\Users\Meehal\Desktop\ForgeHarbor\apps\report-go,target=/app -w /app golang:1.22-alpine go test ./...` | Passed; route package tests passed |
| Reports image build | `docker compose -f deploy/compose/docker-compose.dev.yml build fh-report` | Passed |
| Direct and gateway health | `GET http://localhost:8084/reports/health` and `GET http://localhost:8088/reports/health` | Both returned HTTP 200 with live MongoDB and RustFS |
| Full live integration | `scripts/ci/integration.sh` with the local Python 3.13 interpreter | Passed with exit code 0; gateway, all service health probes, owner fixtures, report integrity/outbox replay, and notification delivery checks passed |

## Follow-ups

- Keep live broker outage/restart drills, outbox backlog alerting, and reviewed dead-message replay tracked under FH-036.
- Production TLS/exposure, secret management, backups, and hosted CI remain release blockers.

## Related notes

- [[Reports]]
- [[Notify]]
- [[Backlog]]
- [[Change-Log]]
