---
type: change
status: verified
date: 2026-11-05
updated: 2026-11-05
tags: [reports, reliability, rustfs]
---

# Reports bucket startup retry

## Summary

Reports now retries RustFS bucket discovery and creation for up to 30 seconds during startup. The retry uses cancellable S3 calls and exits with a bounded startup failure if storage does not become available.

## Why

RustFS may take longer to become ready than the Reports process. A single failed bucket check previously terminated Reports immediately and could trigger a restart loop.

## Verification

| Check | Result |
|---|---|
| Go unit tests, including transient retry and cancellation | Passed (`go test ./...`) |
| Reports image build and live health | Passed; Reports container healthy on the local stack |
| Full local integration suite | Passed (`scripts/ci/integration.sh`; all health, auth, ownership, storage, delivery, and cleanup checks) |
| Links and diff check | Passed (85 notes checked; `git diff --check`) |

## Related

- [[Reports]]
- [[Build]]
- [[Test-Matrix]]
