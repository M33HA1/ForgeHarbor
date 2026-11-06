---
type: dashboard
status: active
updated: 2026-11-06
tags: [forgeharbor, dashboard, moc]
---

# ForgeHarbor — Project Home

> [!summary] Current phase
> **Phase 0: Stabilize.** The stack builds and passes health probes. Shared edge JWT validation and Auth trusted-peer IP handling are verified in dev; provider configuration, production exposure, and production proxy addresses remain open.

## Status

| Area | State | Evidence |
|---|---|---|
| Repository | Active | Branch `main` |
| Knowledge base | In place | This vault, linked from this dashboard |
| Developer tooling | In place | `scripts/dev.ps1`, `scripts/dev.sh`, `.tool-versions` |
| CI | Hosted runs exposed Go VCS-stamping and dependency compatibility failures; CI Go build fix is now pushed | Seven-service language matrix, strict stack/API/browser suite, and HIGH/CRITICAL security gate; Playwright path uses `RUNNER_TEMP`; [[2026-11-06-ci-go-build-vcs]] |
| Application stack | Running; locally verified, production gates remain | Seven images build; eight health probes, gateway route/CORS checks, Auth credential bounds and rate limits, History/Reports ownership, scanner JWT gates, Notify isolation, trusted report provenance (legacy downloads return 410), artifact storage, and dependency-aware Reports readiness pass; mocked and live browser/API journeys pass; provider and hosted CI coverage remain |
| Architecture | Reviewed | [[Architecture-Review]] — contracts, routing, auth boundary, events, secrets |
| Routing | Contract fixed | D1=B in [[ADR-0004-gateway-prefix-contract]]; `scripts/check-routes.mjs` |
| Security | Shared edge JWT validation deployed | Five service routers use ForwardAuth; cookie and bearer sessions pass owner fixtures and outage recovery; Auth trusts forwarded client IPs only from configured socket peers; production exposure and proxy addresses remain under [[Security-Review]] |
| MCP and coding guidance | Codex migration in progress | 12 project skills documented; GitHub project MCP OAuth remains pending; local server connections need `/mcp` verification |

## Top risks

| Risk | Impact | Tracked in |
|---|---|---|
| Auth is now on the protected gateway request path | Outage rejection/recovery verified; approximately eight-second failure latency and production port restrictions still need deployment review | [[ADR-0005-shared-edge-auth]], [[Security-Review]] |
| Auth has bounded password hashing, signup throttling, breached-password screening, and protected sessions | Logout revocation is checked by ForwardAuth; refresh, production proxy addresses, and HIBP outbound availability remain | [[Auth]], [[Security-Review]] |
| Services share infrastructure but not contracts | Routing, data, and event drift | [[Architecture-Review]] |
| Scans run synchronously in the request | Timeouts, duplicate cost, no retries | [[Architecture-Review]] |
| Live-looking API keys in local config | Credential exposure risk | [[Security-Review]] |

## Next three actions

1. Rotate local provider credentials and verify fresh Gemini/VirusTotal configuration before live scans or publication.
2. Define production TLS/service-port exposure policy and review the observed Auth failure latency against the deployment availability target.
3. Configure production HTTPS/proxy peers and HIBP egress, verify hosted CI/security findings, and add Auth refresh.

The planned Go migrations for Auth, History, and Notify are tracked as a parallel workstream in [[Roadmap]] and FH-040; each replacement stays off live traffic until parity and rollback checks pass.

See [[Roadmap]] for the full sequence.

## Architecture

- [[Architecture-Review]]
- [[System-Overview]]
- [[Service-Map]]
- [[Data-Flow]]
- [[Gateway-Routing]]
- [[System-Architecture.canvas]]

## Services

- [[Auth]]
- [[Phishing]]
- [[Malware]]
- [[History]]
- [[Reports]]
- [[Notify]]
- [[Web]]

## Runbooks

- [[Build]]
- [[Run]]
- [[Debug]]
- [[Test]]
- [[Deploy]]

## Decisions

- [[ADR-0008-web-route-namespace]]

- [[ADR-0007-report-notification-outbox]]

- [[ADR-0006-report-notification-events]]

- [[ADR-0005-shared-edge-auth]]

- [[ADR-0001-polyglot-boundaries]]
- [[ADR-0002-go-control-plane]]
- [[ADR-0003-postgres-for-history]]
- [[ADR-0004-gateway-prefix-contract]]

## Changes

- [[2026-11-06-ci-go-build-vcs]] — Go builds now disable VCS stamping in hosted containers after `go test` passed but `go build` failed without complete repository metadata.

- [[2026-11-05-ci-runner-context-fix]] — removed a disallowed job-level `runner.temp` expression that prevented CI checks from starting; fresh hosted verification pending.

- [[2026-11-05-malware-scan-capacity]] — Malware now bounds in-memory scan uploads to two concurrent requests and returns retry guidance on overload.

- [[2026-11-05-reports-bucket-startup-retry]] — Reports absorbs temporary RustFS startup delays with a bounded, cancellable bucket setup retry.

- [[2026-11-04-legacy-report-download-provenance]] — Reports downloads now require trusted stored-scan provenance; legacy artifacts return 410 and Web explains regeneration.

- Reports list/metadata operations now have five-second budgets and downloads a twenty-second budget; dependency timeouts return generic 503 without changing owner-safe 404 behavior. See [[2026-11-03-report-operation-deadlines]].

- Reports verifies ambiguous metadata writes before cleanup, treats confirmed writes as success, and attempts a bounded RustFS delete only when metadata is absent. Unknown outcomes retain the object for reconciliation. See [[2026-11-03-report-artifact-compensation]].

- Reports readiness now fails with `503` when MongoDB or the RustFS bucket is unavailable, instead of returning a false healthy signal. See [[2026-11-03-report-readiness-checks]].

- [[2026-11-03-auth-breached-password-screening]]: Auth rejects known breached passwords using a privacy-preserving HIBP range query and fails closed when the check cannot complete.

- [[2026-11-03-auth-session-revocation]]: logout revokes token IDs in Redis through expiry; ForwardAuth rejects revoked sessions.

- [[2026-11-03-auth-case-insensitive-email]]: signup identities normalize to lowercase and a case-insensitive unique MongoDB index blocks case-only duplicates.

- [[2026-11-03-auth-standard-jwks]]: Auth now serves a standards-compatible RS256 JWK with modulus, exponent, and stable key thumbprint.

- [[2026-11-03-auth-signup-ip-limit]]: valid registration attempts are limited to 20 per trusted client IP over 15 minutes, with live Redis threshold and cleanup checks.

- [[2026-11-03-http-only-browser-sessions]]: Web stopped storing JWTs in localStorage; HttpOnly Strict cookies are verified through Auth, ForwardAuth, and every protected service.

- [[2026-11-03-auth-trusted-proxy-ip-boundary]]: Auth ignores forwarded IP headers from untrusted peers; fixed dev proxy peers and live threshold regression are verified.

- [[2026-11-03-auth-credential-boundaries-and-password-capacity]]: rejected the five-character password accepted by the old Auth API; added bounded Argon2 work, credential/body limits, and cleaned interrupted disposable tests.

- [[2026-11-03-ci-matrix-and-strict-integration]]: pinned Actions, provider-disabled CI configuration, strict missing-service failures, and headless browser orchestration; first hosted run remains pending.

- [[2026-11-03-live-browser-service-journey]]: real Auth-issued browser sessions, owned History/reports, downloads, notification delivery, and cross-user denial verified with scoped cleanup.

- [[2026-11-03-web-flow-regression-and-route-fixes]]: protected page/API namespace separated and seven browser scenarios pass.

- [[2026-11-03-report-notification-outbox]]: publication intent is committed with report metadata; confirmed pending replay and notification idempotency verified.

- [[2026-11-03-notification-delivery-hardening]]: report-event contract, idempotent delivery, bounded retries, and dead storage verified; end-to-end durability work remains.

- [[2026-11-03-trusted-scan-reports]]: report creation now exports owned stored evidence; integrity and storage cleanup verified.

- [[2026-11-03-edge-auth-outage-and-recovery]]

- [[2026-11-03-shared-edge-auth]]

- [[Change-Log]]
- [[2026-11-02-phase-0-auth-build-and-routes]]
- [[2026-11-02-phase-0-core-security]]
- [[2026-11-02-reports-route-and-rustfs]]
- [[2026-11-02-report-download-e2e]]
- [[2026-11-02-project-skills-and-source-mcp]]
- [[2026-11-02-codex-migration]]
- [[2026-11-03-project-context-skill-and-doc-alignment]]
- [[2026-11-03-scanner-dashboard-visual-refresh]]
- [[2026-11-03-clean-clone-jwt-key-setup-and-stack-verification]]
- [[2026-11-03-history-risk-filter-and-scan-result-alignment]]
- [[2026-11-03-history-report-actions]]
- [[2026-11-03-scanner-and-owner-regression-coverage]]
- [[2026-11-03-auth-login-rate-limit]]
- [[2026-11-03-malware-upload-limit]]
- [[2026-11-03-configured-cors-origins]]
- [[2026-11-03-gemini-key-header]]
- [[2026-11-03-auth-flow-regression-and-log-redaction]]
- [[2026-11-02-initial-audit]]
- [[2026-11-02-architecture-review]]
- [[2026-11-02-project-operating-system]]

## Roadmap

- [[Roadmap]]
- [[Backlog]]
- [[Milestones]]
- [[Roadmap.canvas]]

## Security

- [[Security-Review]]
- [[Threat-Model]]

## Testing

- [[Test-Matrix]]

## Reference

- [[Ports]]
- [[Environment]]
- [[MCP]]
- [[API-Contracts]]
- [[Glossary]]

## Templates

- [[Service]]
- [[ADR]]
- [[Change]]
- [[Runbook]]

## MCP status

| Server | Scope | Purpose | State as of 2026-11-03 |
|---|---|---|---|
| Context7 | Codex project | Current library documentation | Configured; verify in a trusted Codex project |
| Playwright | Codex project | Browser smoke tests and screenshots | Configured; verify in a trusted Codex project |
| GitHub | Codex project | Issues, PRs, Actions, repository metadata | OAuth remains pending; `codex` CLI unavailable in current terminal |
| Obsidian | Codex project | Search and update this vault | Configured; verify in Codex |
| MongoDB | Codex project | Read-only inspection of local data | Configured; needs local DB and env var |
| Source | Codex project | Scoped source filesystem | Configured; verify in Codex |

Use the `forgeharbor-mcp` skill for setup and troubleshooting. Secrets belong in environment variables, never in this vault or in `.codex/config.toml`. Full setup: [[MCP]].

## Conventions

- Every service note links to its runbook, relevant ADRs, and recent changes.
- Every change note links to the affected service and the decision it implements.
- Use `[[wikilinks]]` for internal references and tags for cross-cutting status.
- Update this dashboard after every meaningful change.
- Keep Mermaid diagrams in notes so GitHub readers see the same architecture as Obsidian readers.
- Keep interactive maps in `Canvas/` and commit the `.canvas` files.
