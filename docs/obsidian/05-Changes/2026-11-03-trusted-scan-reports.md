---
date: 2026-11-03
updated: 2026-11-03
type: change
status: verified
area: [reports, web, security]
tags: [change, reports, ownership, integrity]
---

# Generate reports from owned stored scans

## What changed

- Reports creation now accepts a scan ID, loads the matching scan with both ObjectId and verified JWT owner, and exports stored scan evidence. Caller-supplied content is ignored.
- Exports include only scan ID, owner, type, input, result, and creation time, serialized as MongoDB Extended JSON. Incomplete records return 409; absent or foreign records both return 404; malformed IDs return 400.
- New metadata carries `source: stored-scan-v1`. Existing artifacts retain their original bytes and absent provenance; they are not retroactively certified as trusted exports.
- The create request has a 64 KiB cap and a 20-second request-derived budget for the scan lookup, object upload, and metadata write.
- Web sends only the scan ID. Added export unit coverage and a disposable local RustFS/MongoDB integration fixture, including notification observation and verified object/record cleanup.

## Why

SEC-012 allowed callers to invent report results and reference scans without proving ownership. The new fixture reproduced this against the previous service: a forged clean result appeared in the downloaded artifact. The corrected service uses stored evidence and checks ownership before writing storage or metadata.

## Verification

- Reports and Web images built successfully and restarted.
- Go unit tests passed in the Go 1.22 container, including export evidence preservation, internal-field exclusion, and incomplete record rejection.
- `python scripts/check-report-integrity.py` verifies stored evidence despite forged caller content, scan ownership, omitted content, validation, report download denial, notification delivery, and cleanup.
- Existing Reports owner/list fixtures continue to pass.
- Final integrity fixture passed for owned file and URL scans, including `stored-scan-v1` provenance, notification observation, S3 DELETE/HEAD cleanup verification, and zero remaining scoped database fixtures.
- Gateway route/CORS/tooling checks passed after deployment; all eight health probes returned HTTP 200; `git diff --check` passed.

## Follow-ups

- Legacy artifacts without provenance still require a deliberate retention/re-generation policy; do not trust their original client content as server evidence.
- Storage/metadata/event atomicity, orphan cleanup on storage-success/database-failure, messaging reliability, and remaining Reports request deadlines remain operational work.
- Provider scan accuracy and production configuration remain separate release gates.

## Related notes

- [[Reports]]
- [[Web]]
- [[Security-Review]]
- [[API-Contracts]]
- [[Test-Matrix]]
- [[Change-Log]]
