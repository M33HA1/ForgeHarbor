---
type: testing
status: active
updated: 2026-11-05
tags: [testing, matrix]
---

# Test Matrix

CI implementation: [[2026-11-03-ci-matrix-and-strict-integration]] provides seven language build/test jobs, strict API integration, both browser suites through a headless CLI, and a separate HIGH/CRITICAL security gate. Local verification does not establish a hosted GitHub Actions pass; first hosted execution and finding triage remain pending.

## Coverage by service

| Service | Build | Unit | Integration | Security | Smoke | Current status |
|---|---|---|---|---|---|---|
| Auth | `cargo test --release --locked`, then `cargo build --release --locked` in the image | Credential validation, case-insensitive identity/index settings, Argon2 job saturation/cancellation, trusted peer-IP selection, session-cookie parsing/flags, Redis rate limits/revocation, standard JWKS parsing, HIBP hash-prefix/parser/request contract | Disposable credential boundary/body-limit, known compromised-password denial, mixed-case signup/login and concurrent case-variant uniqueness, signup race and 20+1 IP threshold, account/IP thresholds, and logout revocation for cookie/Bearer/gateway requests | Direct forged `X-Forwarded-For` cannot select an IP bucket; signup rejects a known corpus match and returns retryable 503 on checker failure; signup and login thresholds return 429 with `Retry-After`; logout revokes cookie/Bearer sessions at Auth and ForwardAuth | `/auth/health`, `/auth/jwks`, signup, login, logout, `/me` | Auth image passes 25 release-mode tests; live integration verifies HIBP rejection, unique signup, session revocation, trusted proxy, rate limits, ownership, and scoped cleanup |
| Phishing | `cargo build --release` | Gemini request key-header test | Provider-free scanner auth gate | Missing/forged tokens return 401; valid RS256 reaches JSON validation without calling Gemini | `/phishing/health`, URL scan | Auth gate, request-shape test, build, and health pass; provider analysis remains unverified |
| Malware | `cargo build --release` | Upload-boundary and concurrent scan-slot unit tests | Provider-free scanner auth gate | Missing/forged tokens return 401; valid RS256 reaches empty-file validation without calling VirusTotal; excess concurrent scans receive retryable 503 | `/malware/health`, file scan | Auth gate, 32 MiB upload boundary, and two-slot concurrency cap pass; provider analysis and archive hardening remain |
| History | `npm run build` | Risk-filter and cross-user integration check | Owner/filter/malformed-ID fixture | Other user's detail returns 404; malformed scan ID returns 400; lists remain owner-scoped | `/history/health`, list, detail | Build and integration pass; owner isolation and malformed-ID handling verified |
| Reports | `go test ./...` | Query validation, owner-filter, dependency readiness, bounded bucket-startup retry, request deadlines/error mapping, verified-write-aware artifact compensation, and provenance gate | Owner-scoped scan list/metadata integration check | Anonymous/forged rejected; owner sees own metadata; cross-user metadata/download return 404; missing/unknown provenance download returns 410 before storage access; malformed ID returns 400; dependency failures/timeouts return generic 503 | `/reports/health`, list by scan ID, create, download | Go tests cover bucket retry/cancellation, trusted/legacy provenance, 404-versus-503 mapping, readiness, confirmed absence/commit, unknown outcomes, and canceled-request cleanup; full gateway/storage integration recorded |
| Notify | Image builds | Six worker tests | RS256 owner isolation and real broker/Mongo delivery fixtures | Owner collisions rejected; duplicate IDs remain idempotent; poison/exhausted retries go to dead storage | `/notify/health`, list, report notifications | Consumer hardening and fixtures pass; live broker outage, quorum redrive, retention/replay remain |
| Web | `npm run build` | No separate unit runner | Seven mocked Playwright scenarios plus real local backend journey | HttpOnly session establishment/cleanup, protected return/reload, cookie auth, accessible controls, breached-password privacy disclosure, malformed evidence, legacy report 410 recovery feedback, report actions, logout | Login, signup, URL/file results, History/report, mobile | Web image build and all seven mocked browser scenarios pass with privacy and legacy artifact recovery messaging; live provider/deployment/hosted CI coverage remains |

## Critical security cases

Real browser journey: [[2026-11-03-live-browser-service-journey]] documents `web-live-fixture.py` init/render/seed/cleanup phases and `check-web-live.js`. Actual UI signup/login and Auth-issued sessions reach real History, Reports, object storage, outbox, and Notify; a second owner is denied foreign scan/report/create/download access. Cleanup verifies all scoped state. Provider analysis is not exercised.

Web browser suite: Playwright MCP `browser_run_code_unsafe` with `filename: scripts/check-web-ui.js` creates a fresh browser context and verifies seven scenarios using the real gateway for HTML/assets and deterministic fixtures for APIs. It covers protected return/reload, cookie-session establishment and failure cleanup, signup feedback, scanner threat/zero/malformed result handling, report restoration/create/download/errors/legacy recovery message/filters, cookie-authenticated requests, mobile overflow, and logout. It is not a live-provider or backend-onboarding test.

Reports outbox: Go tests cover positive/negative confirmations, mandatory returns, closed channels, write failures, and timeouts. `python scripts/check-report-integrity.py` verifies published markers, hidden outbox fields, pending-record replay, consumer idempotency, and cleanup. Live broker outage and producer process-crash tests remain open.

Notify worker: `python -m unittest test_worker.py` and `python scripts/check-delivery.py` from `apps/notify-py` cover identity ownership, poison handling, retry exhaustion, confirmed handoff ACK ordering, reconnect attempts, and real local broker/Mongo delivery. Live broker restart remains unverified; producer outbox pending replay is verified separately.

`python scripts/check-report-integrity.py` covers forged report-content rejection, owned stored evidence/provenance, missing/foreign scans, malformed IDs, incomplete results, payload size, foreign downloads, notification delivery, and verified RustFS/MongoDB cleanup. It uses local development storage settings, not storage credentials from `config/.env`.

`node scripts/check-edge-auth.mjs` strictly verifies loaded router attachments, missing/forged/expired/wrong-issuer/wrong-audience/empty-subject rejection, valid reads, exact health exemptions, and scanner preflights on all five protected routers. The local drill `powershell -ExecutionPolicy Bypass -File scripts/check-edge-auth-outage.ps1` verifies outage rejection and recovery; see [[2026-11-03-edge-auth-outage-and-recovery]].

`node scripts/check-cors.mjs` verifies the configured local origins are allowed and a hostile origin receives no CORS grant from Auth, Phishing, or Malware.

Auth credential boundaries: `python scripts/check-auth-inputs.py` creates scoped disposable accounts and verifies malformed emails, short/long/Unicode passwords, the 8 KiB body limit, non-reflective JSON errors, known compromised-password denial, Argon2id storage, successful long-password login, and compatibility with shorter login inputs. Rust tests cover the k-anonymity range request and parser, Argon2 concurrency cap, overload recovery, and request-cancellation resource handling. It contacts only the HIBP password range endpoint with a five-character SHA-1 prefix; signup fails closed if the service cannot be reached. The live fixture uses loopback Auth, local MongoDB, and scoped Redis keys.

| ID | Case | Expected | Current |
|---|---|---|---|
| SEC-T01 | `GET /history` without a token | 401 | Verified by gateway route/auth check |
| SEC-T02 | `GET /history` with a forged unsigned JWT | 401 | Verified by gateway route/auth check |
| SEC-T03 | `GET /history/:id` for another user's scan | 404 | Verified by History integration fixture |
| SEC-T04 | `GET /notify` without a token | 401 | Verified by gateway route/auth check |
| SEC-T05 | `POST /reports` without a token | 401 | Verified by gateway route/auth check |
| SEC-T06 | `GET /reports/:id` for another user's report | 404 | Verified in authenticated RustFS E2E |
| SEC-T07 | Malformed scan ID | 400 | Verified by History integration fixture |
| SEC-T08 | Malformed report ID | 400 | Verified by Reports owner integration fixture |

## Functional cases

| ID | Case | Expected |
|---|---|---|
| FUN-T01 | Signup with a new email | 201 and a user record |
| FUN-T02 | Login with valid credentials | Access token and expiry |
| FUN-T03 | Login with invalid credentials | 401 |
| FUN-T04 | URL scan with a valid token | Analysis result and scan record |
| FUN-T05 | File scan with a valid token | Analysis result and scan record |
| FUN-T06 | History filter `type=url` | Only URL scans |
| FUN-T07 | History filter `risk=high` | Only high-risk scans |
| FUN-T08 | Create report and download it | JSON file with expected content |
| FUN-T09 | Report creation publishes an event | Notify consumes it |
| FUN-T10 | File scan result renders correctly | Malicious/clean state matches API |
| FUN-T11 | Every documented route through the gateway | No 404; `node scripts/check-routes.mjs` passes |
| FUN-T12 | History risk filtering | Canonical and legacy high/low records match owner-scoped filters; invalid values return 400 |

## Commands

```powershell
.\scripts\dev.ps1 test
.\scripts\dev.ps1 health
node scripts/check-routes.mjs
node scripts/check-cors.mjs
Push-Location apps/history-ts; npm run test:integration; Pop-Location
Push-Location apps/notify-py; python scripts/check-ownership.py; Pop-Location
python scripts/check-auth-flow.py
python scripts/check-report-list.py
node scripts/check-scanner-auth.mjs
```

See [[Test]] for per-service commands and test-data hygiene.

## Exit criteria for Phase 0

- All critical security cases pass.
- All functional cases pass or have a documented, accepted exception.
- Every service has at least one build check and one smoke test.
- CI runs the matrix for Rust, Go, Python, and TypeScript.

## Related notes

- [[Test]]
- [[Security-Review]]
- [[Roadmap]]
- [[Backlog]]
- [[Service-Map]]
