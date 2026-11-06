---
date: 2026-11-06
type: change
area: [security, web]
status: in-progress
related: [[Web]]
tags: [change, security, docker]
---

# Repair the legacy web seed Dockerfile

## What changed

- Re-encoded `apps/web/Dockerfile.seed` as UTF-8.
- Updated its base image from Node 14 to Node 22.

## Why

- Trivy could not parse the file because it was UTF-16LE, which made the security gate report a Dockerfile scanner error.
- Node 14 is end-of-life, so the seed image no longer matches the maintained Node 22 web toolchain.

## Verification

| Check | Command | Result |
|---|---|---|
| Trivy Dockerfile parsing | Hosted high and critical security scan | Awaiting the next run after this change |

## Follow-ups

- Confirm the Trivy parser error is gone and review remaining high severity findings.

## Related notes

- [[Web]]
- [[Security-Review]]
- [[Change-Log]]
- [[Roadmap]]
