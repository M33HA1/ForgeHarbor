---
date: 2026-11-02
type: change
area: [reports, infrastructure, routing]
status: complete
related: [[Reports]], [[ADR-0004-gateway-prefix-contract]], [[Backlog]]
tags: [change, phase-0, reports]
---

# Restore the Reports gateway route

## What changed

- Replaced the unavailable MinIO development image with the official RustFS 1.0.1 glibc image pinned to its native AMD64 manifest digest.
- Configured RustFS to expose the S3 API and console with the development credentials already expected by Reports.
- Added a RustFS health check and made Reports wait for storage health before starting.
- Updated the service, architecture, roadmap, runbook, changelog, and dashboard notes.

## Why

The Reports route labels and `/reports` handlers were correct. The router was absent because `fh-report` had not started: its required `fh-minio` dependency had exited after the old MinIO image could not be pulled.

## Verification

| Check | Command | Result |
|---|---|---|
| Compose validation | `docker compose -f deploy/compose/docker-compose.dev.yml config --quiet` | Passed |
| Image availability | `docker pull ghcr.io/rustfs/rustfs:1.0.1-glibc@sha256:aa7ccf0a266c1421c843a13272d9bf0f09f2f71c890178f55913ba0106532869` | Pulled native AMD64 manifest |
| Services | `docker compose -f deploy/compose/docker-compose.dev.yml up -d --build fh-minio fh-report` | RustFS healthy; Reports started |
| Gateway contract | `powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 test` | Passed; `/reports/health` returned 200 and `POST /reports` returned 400 |

Report artifact create/download against RustFS remains to be verified end to end.

## Follow-ups

- Verify report artifact create/download against RustFS.
- Fix the web image's Node version and continue the auth/ownership backlog.

## Related notes

- [[Reports]]
- [[ADR-0004-gateway-prefix-contract]]
- [[Backlog]]
- [[00-Home]]
