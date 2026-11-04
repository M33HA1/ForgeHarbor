---
type: change-index
status: active
updated: 2026-11-05
tags: [change, changelog]
---

# Change Log

- [[2026-11-05-malware-scan-capacity]] — Malware caps in-memory file scans at two concurrent requests and returns 503 with `Retry-After` when saturated.
- [[2026-11-05-reports-bucket-startup-retry]] — Reports retries bucket discovery/creation for up to 30 seconds to tolerate brief RustFS startup delays.

- [[2026-11-04-legacy-report-download-provenance]] — Reports blocks legacy or unknown-provenance downloads with 410; Web shows the regeneration guidance.

- [[2026-11-03-report-operation-deadlines]] — Reports list/read calls are bounded to five seconds and download calls to twenty seconds; dependency errors return generic 503.

- [[2026-11-03-report-artifact-compensation]] — Reports attempts a five-second RustFS cleanup if metadata insert fails, even after request cancellation.

- [[2026-11-03-report-readiness-checks]] — Reports health now verifies MongoDB and RustFS concurrently and returns 503 when either is unavailable.

- [[2026-11-03-auth-breached-password-screening]] — signup rejects known breached passwords using a privacy-preserving HIBP range query and fails closed on screening errors.

- [[2026-11-03-auth-session-revocation]] — logout revokes token IDs in Redis through expiry; ForwardAuth rejects revoked sessions and fails closed on Redis errors.

- [[2026-11-03-auth-signup-ip-limit]] — Auth now rate-limits valid signups by trusted client IP, returning 429 with `Retry-After` and failing closed if Redis is unavailable.

- [[2026-11-03-http-only-browser-sessions]] — browser JWTs moved from localStorage to a Strict HttpOnly cookie accepted by the gateway and protected services.

- [[2026-11-03-auth-trusted-proxy-ip-boundary]] — Auth only accepts forwarded login IPs from explicitly trusted peers; the dev edge and live threshold regression pass.

This is the vault view of the root [`CHANGELOG.md`](../../../CHANGELOG.md). The root file is the release-level history; this page links the detailed change notes.

## Unreleased

### Fixed

- Auth canonicalizes new email identities and enforces case-insensitive uniqueness and login lookup: [[2026-11-03-auth-case-insensitive-email]].
- Auth's JWKS now exposes standard RSA modulus/exponent parameters and a stable thumbprint key ID that matches issued JWT headers: [[2026-11-03-auth-standard-jwks]].

### Changed

- Fixed the mocked browser session fixture to establish and clear HttpOnly cookies in the isolated Playwright context; all seven UI scenarios pass: [[2026-11-03-web-flow-regression-and-route-fixes]].

### Added

- Auth credential validation, an 8 KiB request cap, a bounded Argon2 pool, and API/UI regression coverage: [[2026-11-03-auth-credential-boundaries-and-password-capacity]].

- Seven-service CI matrix, strict local integration entry point, headless browser orchestration, and a HIGH/CRITICAL security gate; hosted execution pending: [[2026-11-03-ci-matrix-and-strict-integration]].

- Real local browser-to-service signup/session, owned History/report/download, outbox notification, and cross-user denial coverage with verified cleanup: [[2026-11-03-live-browser-service-journey]].

- Seven fixture-driven browser scenarios and fixes for protected page routing, login cleanup/return, accessible controls, and malformed scan evidence: [[2026-11-03-web-flow-regression-and-route-fixes]].

- Embedded report notification outbox, mandatory confirmed relay, and real pending-record replay checks: [[2026-11-03-report-notification-outbox]].

- Versioned report notifications, idempotent consumption, bounded retry/dead-letter handling, reconnect/backoff, and broker-backed regression fixtures: [[2026-11-03-notification-delivery-hardening]].

- Owned stored-scan report generation, provenance, and disposable integrity/storage regression coverage: [[2026-11-03-trusted-scan-reports]].

- Stable file-provider edge authentication and a controlled local Auth outage/recovery drill: [[2026-11-03-edge-auth-outage-and-recovery]].

- Shared ForwardAuth JWT gate, empty-subject rejection, and loaded-router/token regression coverage: [[2026-11-03-shared-edge-auth]].

- Added Redis-backed Auth login throttling and a self-cleaning integration check for account and IP limits: [[2026-11-03-auth-login-rate-limit]].
- Added owner-scoped report lookup by scan IDs; History restores download links and exposes accessible report action feedback: [[2026-11-03-history-report-actions]].
- Added persistent Auth signup-race, History/Reports ownership and malformed-ID, and provider-free scanner-auth regression checks: [[2026-11-03-scanner-and-owner-regression-coverage]].
- Project operating system: `AGENTS.md`, `CHANGELOG.md`, project-local `forgeharbor-*` skills, and repo-local Obsidian vault.
- Architecture, service, runbook, decision, security, testing, and reference notes.
- Architecture review: [[Architecture-Review]] with eight findings, a target shape, and three open decisions.
- Codex MCP configuration includes Context7, Playwright, GitHub, Obsidian, source filesystem, and read-only MongoDB.
- Added eleven project skills and a scoped source filesystem MCP for coding work: [[2026-11-02-project-skills-and-source-mcp]].
- Fixed and verified authenticated report downloads against RustFS: [[2026-11-02-report-download-e2e]].
- Added a project context skill, aligned stale service/security/test notes, and corrected README setup/routes (FH-019): [[2026-11-03-project-context-skill-and-doc-alignment]].
- Refreshed the scanner dashboard with a task-first responsive layout and coordinated URL/file controls: [[2026-11-03-scanner-dashboard-visual-refresh]].
- Added safe clean-clone RSA key setup and rebuilt/started the full Compose stack with passing health and gateway contract checks: [[2026-11-03-clean-clone-jwt-key-setup-and-stack-verification]].
- Aligned scanner risk fields, History query validation, and the History page filters; added a self-cleaning integration check: [[2026-11-03-history-risk-filter-and-scan-result-alignment]].
- Upgraded Web dependencies, removed unused Firebase, and cleared Web and History npm audits; rebuilt the stack and ran the History integration and Reports unit checks.
- Added a 32 MiB Malware upload ceiling and unit-tested its exact boundary and overflow behavior: [[2026-11-03-malware-upload-limit]].
- Replaced wildcard Rust service CORS with configured exact origins and restricted methods/headers: [[2026-11-03-configured-cors-origins]].
- Moved Gemini authentication from the URL query string to `x-goog-api-key` and added a request-shape unit test: [[2026-11-03-gemini-key-header]].
- Redacted Auth user and connection data from logs and added a disposable-user API integration check.
- Build and status scripts for PowerShell and POSIX shells.
- Toolchain pinning and a safe environment example.
- `scripts/check-routes.mjs`, a gateway route-contract test.
- [[ADR-0004-gateway-prefix-contract]] and the Phase 0 route alignment.

### Changed

- `.gitignore` now excludes Obsidian workspace state and Superpowers scratch files.
- README setup paths, ports, and API routes match the current development stack (FH-019).
- Gateway routing now documents the History, Reports, and Notify prefix conflicts instead of treating Reports as the only case.
- All Rust services build on pinned stable Rust 1.90.0; the nightly async-drop cycle is gone.
- Every service registers its full public prefix, and the gateway no longer strips it (D1=B).
- Health probes use the prefixed paths.

### Security

- Documented the current auth, ownership, routing, and secret-management findings.
- The Auth image no longer copies `config`; Phishing and Malware copy only the public key.
- Added `.dockerignore` to the Rust apps.

### Known issues

- Web uses Node 14 and cannot build Vite 7.
- Compose passes blank API keys.
- History, Reports, and Notify have auth and ownership defects.
- The frontend misreads file-scan results.

## Change notes

| Date | Note | Area |
|---|---|---|
| 2026-11-03 | [[2026-11-03-parallel-go-migration-plan]] | Roadmap, architecture |
| 2026-11-02 | [[2026-11-02-phase-0-auth-build-and-routes]] | Build, routing, security |
| 2026-11-02 | [[2026-11-02-phase-0-core-security]] | Security, frontend, build, messaging |
| 2026-11-02 | [[2026-11-02-reports-route-and-rustfs]] | Reports, infrastructure, routing |
| 2026-11-02 | [[2026-11-02-project-skills-and-source-mcp]] | Tooling, developer experience, MCP |
| 2026-11-02 | [[2026-11-02-codex-migration]] | Tooling, MCP, Codex |
| 2026-11-02 | [[2026-11-02-initial-audit]] | Audit, security, build |
| 2026-11-02 | [[2026-11-02-architecture-review]] | Architecture, routing, contracts |
| 2026-11-02 | [[2026-11-02-project-operating-system]] | Tooling, docs, MCP |
| 2026-11-03 | [[2026-11-03-project-context-skill-and-doc-alignment]] | Context, documentation |
| 2026-11-03 | [[2026-11-03-scanner-dashboard-visual-refresh]] | Web UI |
| 2026-11-03 | [[2026-11-03-clean-clone-jwt-key-setup-and-stack-verification]] | Bootstrap, build, runtime verification |
| 2026-11-03 | [[2026-11-03-history-risk-filter-and-scan-result-alignment]] | History, scan schema, frontend, integration, build verification |
| 2026-11-03 | [[2026-11-03-malware-upload-limit]] | Malware, upload security, unit tests |
| 2026-11-03 | [[2026-11-03-configured-cors-origins]] | Rust services, browser security, CORS checks |
| 2026-11-03 | [[2026-11-03-gemini-key-header]] | Phishing, API key handling, unit test |
| 2026-11-03 | [[2026-11-03-auth-flow-regression-and-log-redaction]] | Auth, privacy, integration tests |
| 2026-11-03 | [[2026-11-03-auth-login-rate-limit]] | Auth, Redis, security, integration tests |
| 2026-11-03 | [[2026-11-03-history-report-actions]] | Web, Reports, UI state |
| 2026-11-03 | [[2026-11-03-scanner-and-owner-regression-coverage]] | Auth, ownership, scanner security tests |

## Related notes

- [[00-Home]]
- [[Roadmap]]
- [[Backlog]]
