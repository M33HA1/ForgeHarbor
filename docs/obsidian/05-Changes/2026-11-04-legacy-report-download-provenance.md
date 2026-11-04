---
type: change
status: verified
date: 2026-11-04
updated: 2026-11-05
tags: [reports, security, web]
---

# Legacy report download provenance gate

## Summary

Reports now serves a download only when its owner-scoped metadata has the exact `source: stored-scan-v1` marker. Missing or unknown provenance returns HTTP 410 before RustFS is read. The Web History view displays the service's regeneration guidance so users know how to recover.

## Why

Older artifacts can contain caller-supplied content that cannot be tied to trusted stored scan evidence. Ownership alone does not establish the integrity of those bytes.

## Verification

| Check | Result |
|---|---|
| Go unit tests and Reports image build | Passed (`go test ./...`; Reports image built) |
| Web image build and mocked browser suite | Passed (Web image built; seven Playwright scenarios, including legacy recovery feedback) |
| Full local API/storage integration | Passed (`scripts/ci/integration.sh`; legacy artifact 410, trusted downloads, owner checks, outbox/delivery, cleanup) |
| Link, diff, and live health checks | Passed (86 notes checked; `git diff --check`; all eight health probes HTTP 200) |

## Follow-ups

- Define retention, regeneration, or deletion for inaccessible legacy report objects.
- [[Reports]]
- [[Web]]
- [[Security-Review]]
- [[Test-Matrix]]
