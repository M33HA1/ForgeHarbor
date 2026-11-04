---
date: 2026-11-03
type: change
area: [security, testing, services]
status: verified
related: [[Auth]], [[History]], [[Reports]], [[Phishing]], [[Malware]], [[Test-Matrix]]
tags: [change, regression-tests, ownership, auth]
---

# Scanner and owner regression coverage

## What changed

- Added persistent Auth coverage for concurrent duplicate signup and retained rate-limit checks.
- Added gateway probes for missing, forged, and valid RS256 tokens against Phishing and Malware without invoking external providers.
- Extended History and Reports fixtures for malformed IDs, owner scoping, and cross-owner report metadata/download denial.
- Updated the test matrix, service notes, and FH-020 to reflect passing checks and remaining UI/provider gaps.

## Why

- Authentication and ownership changes need repeatable regression checks at service boundaries.
- Provider-free scanner probes verify the JWT gate without requiring or disclosing third-party credentials.

## Verification

| Check | Command | Result |
|---|---|---|
| Full image build | `powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 build` | All seven application images built |
| Rebuilt runtime health | `docker compose -f deploy/compose/docker-compose.dev.yml up -d` then `powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 health` | Stack restarted; all eight probes returned HTTP 200 |
| Auth signup race and rate limits | `python scripts/check-auth-flow.py` | Passed; one concurrent signup succeeds and the duplicate receives 409; account/IP limits verified |
| History ownership and malformed ID | `Push-Location apps/history-ts; npm.cmd run test:integration; Pop-Location` | Passed against the rebuilt stack |
| Reports owner list, metadata/download denial, malformed ID | `python scripts/check-report-list.py` | Passed |
| Phishing and Malware auth gates | `node scripts/check-scanner-auth.mjs` | Passed; missing/forged tokens return 401 and valid tokens reach input validation |
| Gateway routes and CORS | `powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 test` | Passed |
| Web auth page smoke | Playwright at 390 × 844 on `/login` and `/signup` | Both forms render; no horizontal overflow or browser console errors |

## Follow-ups

- Add automated Web UI regression coverage and provider-backed scan tests after provider credentials are verified and rotated.
- Keep FH-020 open until those coverage gaps are closed.

## Related notes

- [[Change-Log]]
- [[Backlog]]
- [[Security-Review]]
