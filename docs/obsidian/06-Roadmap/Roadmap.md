---
type: roadmap
status: active
updated: 2026-11-02
tags: [roadmap, planning]
---

# Roadmap

## Current phase

**Phase 0 — Stabilize.** The stack must start reliably and enforce basic security before new services are added.

## Phase overview

| Phase | Goal | Status | Exit signal |
|---|---|---|---|
| 0 — Stabilize | Make the current stack build, start, route, and enforce auth | In progress | All seven services healthy; P0 security tests pass |
| 1 — Core product | Add async orchestration and make reports/notifications reliable | Not started | Scan jobs survive retries; report and notification paths work end to end |
| 2 — Intelligence | Add Python threat intelligence and deeper file analysis | Not started | Cached, rate-limited enrichment; ClamAV/YARA results |
| 3 — Hardening | Add observability, CI security, load tests, and contracts | Not started | CI matrix green; traces visible; load and contract tests pass |
| 4 — Portfolio polish | Make the project easy to demo and explain | Not started | One-command demo, architecture story, ADRs, video, resume bullets |

## Phase 0 — Stabilize

### Build and startup

- [ ] Fix or replace the Rust Auth service.
- [ ] Move the web image to Node 22.
- [ ] Use a pullable, pinned MinIO image.
- [ ] Fix the Traefik Docker provider.
- [ ] Provide non-blank `GEMINI_API_KEY` and `VIRUSTOTAL_API_KEY` through local configuration.
- [ ] Add a clean-clone bootstrap that generates or documents JWT keys.

### Routing and contracts

- [ ] Choose the gateway convention (strip or no-strip) and record it in an ADR.
- [ ] Align History, Reports, and Notify routes with that convention.
- [ ] Correct README ports and entrypoints.
- [ ] Add a gateway contract test for every documented route, not only `/health`.

### Security

- [ ] Enforce JWT verification in History.
- [ ] Scope History list and detail queries to the caller.
- [ ] Add JWT auth and ownership checks to Reports.
- [ ] Add JWT auth and ownership checks to Notify.
- [ ] Centralize JWT validation at the edge (ForwardAuth or BFF).
- [ ] Add `.dockerignore`; stop copying `.env` and key material into images.
- [ ] Fix malformed-ID handling to return 400.
- [ ] Fix History `type` and `risk` filters.
- [ ] Rotate exposed-looking keys and remove test records.
- [ ] Add auth regression tests from [[Test-Matrix]].

### Frontend

- [ ] Fix file-scan result mapping.
- [ ] Remove the `|| 85` confidence fallback.
- [ ] Use report IDs and malware status in History.
- [ ] Fix the notification path.

## Phase 1 — Core product

- Add a Go scan orchestrator with idempotency, timeouts, retries, and a dead-letter queue.
- Define `scan.requested`, `scan.completed`, and `report.created` event contracts with one versioned envelope.
- Make Reports consume or publish the same event contract as Notify.
- Add PostgreSQL for users, scans, reports, and audit records.
- Add a scan status endpoint and UI state.
- Add pagination limits and indexes.

## Phase 2 — Intelligence

- Add a Python threat-intelligence service for Gemini, VirusTotal, URLhaus, AbuseIPDB, and internal blocklists.
- Cache reputation results by URL and file hash.
- Add rate limits, retry/backoff, and circuit breakers.
- Add ClamAV and YARA to the file-analysis path.
- Keep the Rust engine for binary parsing and CPU-heavy analysis.

## Phase 3 — Hardening

- Add OpenTelemetry traces and structured logs.
- Add a CI matrix for Rust, Go, Python, and TypeScript.
- Add Trivy, gitleaks, and Semgrep.
- Add k6 load tests.
- Add Pact or schema-based contract tests.
- Add backup and restore checks for MongoDB, PostgreSQL, and MinIO.

## Phase 4 — Portfolio polish

- Rewrite the README around the architecture and tradeoffs.
- Add the language-choice story from [[ADR-0001-polyglot-boundaries]].
- Add a short demo video and screenshots.
- Add resume bullets and an interview narrative.
- Add a "what I would consolidate in production" section.

## Sequencing rule

Do not add Phase 2 services while Phase 0 exit criteria are unmet. A smaller stack that works is a stronger portfolio signal than a larger stack that does not start.

## Related notes

- [[Architecture-Review]]
- [[Backlog]]
- [[Milestones]]
- [[Roadmap.canvas]]
- [[Change-Log]]
- [[Security-Review]]
