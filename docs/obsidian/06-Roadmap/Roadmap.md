---
type: roadmap
status: active
updated: 2026-11-03
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

- [x] Fix the Rust Auth build (pinned stable 1.90.0; Phishing and Malware too).
- [x] Move the web image to Node 22.
- [x] Replace unavailable MinIO image with a pinned, native AMD64 RustFS image; Reports starts after its S3 health check.
- [x] Fix the Traefik Docker provider (upgraded to `traefik:v3.7` for Docker Engine 29 compatibility).
- [ ] Provide non-blank `GEMINI_API_KEY` and `VIRUSTOTAL_API_KEY` through local configuration.
- [x] Add a clean-clone JWT key setup command that safely generates or validates local keys.

### Routing and contracts

- [x] Choose the gateway convention (D1=B) and record it in [[ADR-0004-gateway-prefix-contract]].
- [x] Align every service route with that convention.
- [x] Correct README setup paths, ports, and API entrypoints (FH-019).
- [x] Add a gateway contract test for every documented route (`scripts/check-routes.mjs`).

### Security

- [x] Enforce JWT verification in History; require key, issuer, audience, and expiry.
- [x] Scope History list and detail queries to the caller.
- [x] Add JWT auth and ownership checks to Reports.
- [x] Add JWT auth and ownership checks to Notify.
- [ ] Centralize JWT validation at the edge (ForwardAuth or BFF).
- [x] Add `.dockerignore` files for every application build context and mount public keys at runtime.
- [x] Bind development app and infrastructure host ports to loopback.
- [x] Fix malformed-ID handling to return 400 in History and Reports.
- [x] Make URL and file scan writers persist `risk_level`; align History filtering with canonical values and legacy boolean records. A full versioned scan schema remains under FH-037.
- [ ] Rotate exposed-looking keys and remove test records.
- [~] Add auth regression tests from [[Test-Matrix]]; gateway now checks missing and forged tokens.

### Frontend

- [x] Fix file-scan result mapping.
- [x] Remove the `|| 85` confidence fallback.
- [ ] Use report IDs and malware status in History.
- [x] Fix the notification path (service now registers `/notify`).

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

## Parallel workstream â€” Go service migrations

Run this workstream alongside Phase 0 hardening. Keep the current Rust Auth, TypeScript History, and Python Notify services as the routed path while Go replacements are built and verified without receiving traffic. The Go direction follows [[ADR-0002-go-control-plane]].

1. **Contracts first:** capture and test current routes, request/response shapes, JWT claims, ownership rules, persistence behavior, and queue semantics before replacing a service.
2. **Auth first:** implement the Go replacement against existing MongoDB and Redis interfaces. Match signup, login, `/me`, RS256 validation, account uniqueness, and rate-limit behavior. Test without routing live traffic.
3. **History second:** preserve owner scoping, filters, pagination, and MongoDB record compatibility.
4. **Notify third:** preserve JWT ownership, queue behavior, and idempotency.
5. **Cut over one service at a time:** require contract and security regression checks, runtime health, and a rehearsed rollback before changing gateway traffic. Keep the current implementation available until parity is proven.

Keep the database migration separate from the language migration. Retain MongoDB during Go parity work; plan PostgreSQL adoption separately under FH-022 and [[ADR-0003-postgres-for-history]]. Rust Phishing/Malware remain Rust, and Python remains the target for threat intelligence.

## Related notes

- [[Architecture-Review]]
- [[Backlog]]
- [[Milestones]]
- [[Roadmap.canvas]]
- [[Change-Log]]
- [[Security-Review]]
