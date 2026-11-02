---
date: 2026-11-02
type: change
area: [architecture, docs, routing, security]
status: complete
related: ["[[Architecture-Review]]", "[[Gateway-Routing]]", "[[Data-Flow]]", "[[Security-Review]]", "[[Backlog]]"]
tags: [change]
---

# Architecture review and documentation alignment

## What changed

- Added [[Architecture-Review]] with eight findings (AR-01 through AR-08), evidence, a target architecture, three open decisions (D1 routing convention, D2 auth boundary, D3 data-store timing), and a phased sequence.
- Corrected [[Gateway-Routing]]: History, Reports, and Notify all 404 through Traefik because the prefix strip does not match their registered routes. Added a route-contract table and the D1 decision.
- Updated [[Data-Flow]] with the asynchronous target flow, the `report_events`/`notifications` mismatch, the missing `scan.completed` event, and the result-schema drift.
- Updated [[System-Overview]] and [[Service-Map]] with the assessment, corrected statuses, and new blockers.
- Added SEC-015 through SEC-018 to [[Security-Review]]: secrets in build contexts and images, the Gemini key in the query string, blank Compose overrides, and the `localStorage` token.
- Added FH-033 through FH-039 to [[Backlog]] and marked FH-006 as superseded by FH-033.
- Updated [[Roadmap]] and [[Milestones]] with the route contract, edge auth, image-secret, and event-envelope criteria.
- Updated the affected service notes: [[Auth]], [[Phishing]], [[Malware]], [[History]], [[Reports]], [[Notify]], and [[Web]].
- Updated [[00-Home]], [[Change-Log]], and `CHANGELOG.md`.
- No application code, Compose file, or runtime configuration was changed.

## Why

The previous notes captured a subset of the problems: Reports routing, the queue-name mismatch, and the per-service auth defects. A full read of the services showed that the same root causes affect more of the system:

- History and Notify have the same prefix-strip defect as Reports.
- Auth is duplicated in four places, and two services have none.
- Three writers use different result shapes for the same collection, so the History filters silently match nothing.
- The Auth image ships `.env` and the private key.
- Scans block for up to 20 seconds with no timeout or retry.

Documenting the whole set gives Phase 0 an accurate scope and gives the later phases a target to migrate toward.

## Verification

| Check | Command | Result |
|---|---|---|
| Tooling, links, JSON, shell, Python | `.\scripts\dev.ps1 test` | Passed — 40 notes, zero broken links; JSON, shell, and Python checks pass |
| POSIX tooling path | Git Bash `./scripts/dev.sh test` | Passed — same checks |
| Whitespace and secrets | `git diff --check` plus a key-pattern scan | Clean; no key material in the changed files |

## Follow-ups

- Decide D1 (routing convention) and D2 (auth boundary) and record them in an ADR.
- Execute Phase 0 in [[Backlog]] in the documented order.
- Keep [[Architecture-Review]] current as findings are fixed; move each to "verified" with a command result.

## Related notes

- [[Architecture-Review]]
- [[Gateway-Routing]]
- [[Data-Flow]]
- [[Security-Review]]
- [[Backlog]]
- [[Roadmap]]
- [[Change-Log]]
