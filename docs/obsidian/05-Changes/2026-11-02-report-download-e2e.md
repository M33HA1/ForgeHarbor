---
date: 2026-11-02
type: change
area: [reports, security, testing]
status: complete
related: [[Reports]], [[Backlog]], [[Security-Review]]
tags: [change, phase-0, reports, rustfs]
---

# Verify report downloads against RustFS

## What changed

- Replaced the Gin stream callback with a single `io.Copy` from the RustFS object body and closed the body after serving it.
- Added a unit test that verifies the response content and headers and checks that the object body closes.
- Verified report creation, owner metadata retrieval, downloaded JSON content, and cross-user metadata denial through the gateway.
- Removed both disposable test users, their report record, notifications, and the RustFS object.

## Why

The previous stream callback returned `true` whenever `io.Copy` returned nil. EOF also returns nil, so Gin continued the stream indefinitely and the download never completed.

## Verification

| Check | Command | Result |
|---|---|---|
| Reports image build | `docker compose -f deploy/compose/docker-compose.dev.yml build fh-report` | Passed |
| Reports unit tests | `go test ./...` in `golang:1.22-alpine` | Passed |
| Authenticated storage E2E | Disposable users via `http://localhost:8088`; create, metadata, download, and second-user request | Passed; second user received 404 |
| Cleanup | Local MongoDB counts for E2E users/reports; RustFS object removal; notification delete by exact test user IDs | Passed; 0 users, 0 reports, 2 notifications removed |

## Follow-ups

- Add persistent integration coverage for History, Reports, and Notify ownership boundaries.
- Address the remaining Reports concurrency and timeout issues in [[Reports]].

## Related notes

- [[Reports]]
- [[Backlog]]
- [[Security-Review]]
- [[Change-Log]]
