---
date: 2026-11-03
updated: 2026-11-03
type: change
status: verified
area: [reports, reliability]
tags: [change, reports, rustfs, cleanup]
---

# Reports artifact compensation

## What changed

- If MongoDB returns an error after a report artifact uploads, Reports checks whether the report document committed before considering cleanup.
- A confirmed committed document is treated as success; confirmed absence triggers an artifact delete with a fresh five-second context, even if the HTTP request context was canceled. A confirmed write returns the normal success response; absent or unverifiable writes retain the existing generic failure response.
- If MongoDB cannot establish whether the document exists, the object is retained to avoid breaking a possibly committed report. Delete failures produce a generic log message without the artifact key or dependency error details.
- Added tests for confirmed absence, confirmed commit, unknown outcome, canceled-request cleanup, and retaining the artifact after a successful insert.

## Why

- RustFS upload and MongoDB metadata insertion are separate operations, and a MongoDB write error can be ambiguous. Safe verification prevents deleting artifacts referenced by committed reports while still cleaning up confirmed failures.

## Verification

| Check | Command | Result |
|---|---|---|
| Reports Go tests | `docker run --rm --mount type=bind,source=C:\Users\Meehal\Desktop\ForgeHarbor\apps\report-go,target=/app -w /app golang:1.22-alpine go test ./...` | Passed; route package tests passed |
| Reports image build | `docker compose -f deploy/compose/docker-compose.dev.yml build fh-report` | Passed |
| Live report and gateway integration | `scripts/ci/integration.sh` | Passed with exit code 0; all service health probes, gateway/auth contracts, report ownership/integrity/outbox replay, and notification delivery checks passed |

## Follow-ups

- Compensation is best-effort; a RustFS delete failure or an unverifiable MongoDB write can still leave an orphan and needs a periodic reconciliation process.
- Keep outbox backlog monitoring, live broker failure drills, production TLS/exposure, secrets, and hosted CI tracked as release work.

## Related notes

- [[Reports]]
- [[ADR-0007-report-notification-outbox]]
- [[Backlog]]
- [[Change-Log]]
