---
date: 2026-11-03
type: change
area: [web, reports]
status: verified
related: [[Web]], [[Reports]], [[Backlog]]
tags: [change, frontend, reports]
---

# History report actions

## What changed

- Reports lists metadata by repeated scan IDs with the JWT subject as an ownership filter; History restores report IDs on page load and shows newly created IDs immediately.
- Added a compound owner/scan/date index and bounded lookup input.
- Report creation and download outcomes appear in an accessible status message instead of only in the browser console.

## Why

- Reports were created successfully, but the UI discarded their IDs and gave users no visible confirmation, download path, or way to restore links after refresh.

## Verification

| Check | Command | Result |
|---|---|---|
| Web production build | Vite build during `powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 build` | Passed after persistent report restoration wiring |
| Full Compose build and stack | `powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 build`; `docker compose -f deploy/compose/docker-compose.dev.yml up -d` | All seven images built; stack restarted |
| Reports unit tests | `docker run --rm --mount type=bind,source=C:\Users\Meehal\Desktop\ForgeHarbor\apps\report-go,target=/app -w /app golang:1.22-alpine go test ./...` | Passed query validation, owner-filter, and report-streaming tests |
| Reports owner integration | `python scripts/check-report-list.py` | Passed anonymous/forged-token denial, per-owner result isolation, missing-query validation, and empty results; fixtures and Redis keys removed |
| Route, CORS, health | `powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 test` and `health` | Passed after Reports restart; all eight health probes returned HTTP 200 |

## Follow-ups

- Add automated frontend interaction coverage for report creation, failure feedback, and download.

## Related notes

- [[Change-Log]]
- [[Roadmap]]
