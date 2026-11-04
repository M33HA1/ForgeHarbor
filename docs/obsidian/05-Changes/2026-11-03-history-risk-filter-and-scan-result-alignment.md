---
date: 2026-11-03
type: change
area: [history, scanning, web, testing]
status: complete
related: [[00-Home]], [[History]], [[Phishing]], [[Malware]], [[Web]], [[API-Contracts]], [[Test-Matrix]], [[Roadmap]], [[Backlog]]
tags: [change, contracts, release-readiness]
---

# Align History risk filtering with scan results

## What changed

- Phishing and Malware results now include `result.risk_level` as `high` or `low` on successful analyses.
- History validates `type=url|file` and `risk=high|low`; unsupported values return 400. Legacy records still match through their phishing/malware booleans.
- Added type and risk selectors, loading/error states, and correct malware verdict mapping to the History page.
- Added `npm run test:integration` under History. It creates uniquely tagged synthetic records, verifies canonical and legacy queries through the gateway with an RS256 token, and removes its fixtures.

## Why

- The History service queried `result.risk_level`, but neither scanner stored that field. The History page also did not expose the supported query filters.

## Verification

| Check | Command | Result |
|---|---|---|
| History TypeScript build | `npm.cmd run build` from `apps/history-ts` | Pass; clean install and build |
| History integration | `npm.cmd run test:integration` from `apps/history-ts` | Pass; canonical and legacy filters, invalid-value rejection, other user's detail returns 404, owner-scoped lists |
| Notify ownership integration | `python apps/notify-py/scripts/check-ownership.py` | Pass; caller receives only their synthetic notification |
| Rust service builds | `cargo build --offline` in Phishing and Malware | Pass |
| Malware upload-boundary unit tests | `cargo test --offline` in `apps/malware-rs` | Pass; exact 32 MiB boundary and overflow rejection |
| Web production build | `npm.cmd run build` from `apps/web` | Pass on React Router 7 |
| Dependency audit | `npm.cmd audit` in History and Web | Pass; zero vulnerabilities in both dependency trees |
| Compose rebuild and restart | `docker compose -f deploy/compose/docker-compose.dev.yml build` and `up -d` | Pass; all seven application images built |
| Go Reports unit tests | `docker run ... golang:1.22-alpine go test ./...` | Pass; `report-go/routes` |
| Health and route checks | `scripts/dev.ps1 health` and `scripts/dev.ps1 test` | Pass; eight health probes and gateway route/auth contract |

## Follow-ups

- The services still have service-specific result fields. Define a fully versioned shared scan schema and migration/index policy under FH-037.
- Valid-token cross-user ownership tests and live provider scans remain separate release gates.
- A Docker CLI config access warning appeared during `scripts/dev.ps1 test`; the check itself completed successfully. Resolve local Docker CLI config permissions for a clean developer run.

## Related notes

- [[Change-Log]]
- [[History]]
- [[Data-Flow]]
- [[API-Contracts]]
- [[Test-Matrix]]
- [[Backlog]]
