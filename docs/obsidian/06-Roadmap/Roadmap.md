---
type: roadmap
status: active
updated: 2026-11-13
tags: [roadmap, planning]
---

# Roadmap

## Current phase

**Phase 0 — Stabilize.** The stack must start reliably and enforce basic security before new services are added.

## Active resume-demo delivery workstream

The core demo and brand/UX changes are merged through PR #73. AWS preparation is now active under [[AWS-Deployment]], separately from the larger product expansion phases below. [[2026-11-13-aws-report-storage]] delivers the Reports credential-chain prerequisite locally; Terraform and HTTPS deployment configuration are next. Live provider keys, rotation and actual cloud verification still gate publication.

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
- [x] Centralize development gateway JWT validation with ForwardAuth; production HTTPS/exposure remains a release gate.
- [x] Add `.dockerignore` files for every application build context and mount public keys at runtime.
- [x] Bind development app and infrastructure host ports to loopback.
- [x] Fix malformed-ID handling to return 400 in History and Reports.
- [x] Make URL and file scan writers persist `risk_level`; align History filtering with canonical values and legacy boolean records. A full versioned scan schema remains under FH-037.
- [ ] Rotate exposed-looking keys and remove test records.
- [~] Add auth regression tests from [[Test-Matrix]]; gateway now checks missing and forged tokens.

### Frontend

- [x] Fix file-scan result mapping.
- [x] Remove the `|| 85` confidence fallback.
- [x] Use report IDs and malware status in History; existing browser/API regression checks pass.
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

Go Auth, History and Notify merged in PR #69 (`bbb8055`) and are now the development Compose defaults. PR-head run #209 passed Go race-enabled MongoDB/Redis/RabbitMQ contracts, all language builds, the security gate and full-stack health/API/browser checks. See [[2026-11-09-backend-control-plane-pr]].

Retain the Rust Auth, TypeScript History and Python Notify implementations for `docker-compose.language-rollback.yml`. Updated Rust Auth refuses enrolled password-only login; return to Go Auth for enrolled login. Frontend TypeScript, MFA browser screens and redesign remain separate. Production cutover requires the gates in [[Deploy]].

Keep the database migration separate from the language migration. Retain MongoDB during Go parity work; plan PostgreSQL adoption separately under FH-022 and [[ADR-0003-postgres-for-history]]. Rust Phishing/Malware remain Rust, and Python remains the target for threat intelligence.

## Related notes

- [[Architecture-Review]]
- [[Backlog]]
- [[Milestones]]
- [[Roadmap.canvas]]
- [[Change-Log]]
- [[Security-Review]]
