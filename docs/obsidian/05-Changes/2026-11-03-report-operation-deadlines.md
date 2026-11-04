---
date: 2026-11-03
updated: 2026-11-04
type: change
status: verified
area: [reports, reliability]
tags: [change, reports, deadlines]
---

# Reports operation deadlines

## What changed

- Owner-scoped report list and metadata reads now use five-second request contexts.
- Report downloads share a twenty-second end-to-end context across the metadata lookup, RustFS request, and response streaming.
- Dependency and timeout errors return generic HTTP 503 responses; missing and foreign report IDs remain indistinguishable HTTP 404 responses.
- Added tests for not-found versus timeout/database-failure response mapping.

## Why

- Report reads and downloads previously used unbounded contexts and could hold handlers open while MongoDB or RustFS stalled.
- Read errors were also reported as 404, hiding dependency outages from callers and monitors.

## Verification

| Check | Command | Result |
|---|---|---|
| Reports Go tests | `docker run --rm --mount type=bind,source=C:\Users\Meehal\Desktop\ForgeHarbor\apps\report-go,target=/app -w /app golang:1.22-alpine go test ./...` | Passed; route package tests passed |
| Reports image build | `docker compose -f deploy/compose/docker-compose.dev.yml build fh-report` | Passed |
| Live Reports and gateway integration | `scripts/ci/integration.sh` | Passed with exit code 0; service health, route/auth contracts, report ownership and download checks passed |

## Follow-ups

- Other services still need deadline audits for every database, storage, and provider call.
- Live provider-backed scans, production deployment settings, and hosted CI remain release work.

## Related notes

- [[Reports]]
- [[Security-Review]]
- [[Backlog]]
- [[Change-Log]]
