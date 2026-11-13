---
type: runbook
status: active
updated: 2026-11-14
tags: [runbook, test]
---

# Test

CI entry points: `bash scripts/ci/integration.sh` requires a running local stack and executes health, tooling, route/CORS, edge/scanner auth, Auth, History, Reports, and Notify integration checks. It starts the loopback-only Auth test proxy using the `integration` Compose profile and stops it on exit. Set `PYTHON` to an absolute interpreter path when using a virtual environment. `node scripts/ci/browser.mjs` runs both existing browser suites headlessly; install Playwright separately and set `PLAYWRIGHT_MODULE` to its absolute `index.mjs` path if it is outside the repository. Install Playwright Chromium, or use `PLAYWRIGHT_CHANNEL=chrome` / `msedge` for an existing local browser; CI uses its installed Chromium. The CLI cleans its disposable live fixtures in `finally`. See [[2026-11-03-ci-matrix-and-strict-integration]].

`.github/workflows/ci.yml` adds eight language build/test jobs (including retained rollback implementations), provider-disabled ephemeral Compose environment, strict integration/browser job, and a separate HIGH/CRITICAL vulnerability/secret/configuration gate. All Actions references use immutable commit hashes. All 11 jobs passed in [CI run #209](https://github.com/M33HA1/ForgeHarbor/actions/runs/42642752091) on PR #69 head `9d41051`, including the real-store Go race suite and full-stack browser/API checks. Required-check policy and production deployment remain separate. CI reports finding IDs/counts without secret matches or source snippets. Only the ephemeral hosted workflow removes its volumes; the reusable local scripts preserve stack data.

Offline route/CORS checks retain their local skip behavior. Set `FH_REQUIRE_RUNNING=1` (or `CI=true`) to make unreachable services fail; the integration runner always enables this requirement.

Live local browser service journey: follow [[2026-11-03-live-browser-service-journey]] for `web-live-fixture.py` init, render-create, seed, render-verify, and cleanup actions. Pass rendered code to Playwright MCP. Always invoke cleanup in the orchestrator finally block, retaining the run ID for scoped recovery. This uses real disposable Auth accounts and seeded scans, not provider calls.

Web browser regression: with the stack running, invoke Playwright MCP `browser_run_code_unsafe` with `filename: scripts/check-web-ui.js`. The script creates/closes an isolated context, loads built pages through the gateway, intercepts API data/mutations, and checks seven scenarios. Generated screenshots/downloads are ignored under `.playwright-mcp/`. API/provider browser integration remains separate. See [[2026-11-03-web-flow-regression-and-route-fixes]].

Report outbox recovery: `python scripts/check-report-integrity.py` creates disposable owned scans/reports, verifies confirmation markers, replays an already-delivered pending record to exercise the confirmation/marker crash window, and checks notification idempotency plus cleanup. It does not stop infrastructure. See [[ADR-0007-report-notification-outbox]].

Notification delivery: from `apps/notify-py`, run `python -m unittest test_worker.py` then `python scripts/check-delivery.py`. The integration check uses unique local queues and scoped Mongo fixtures and removes them after the run; it never purges the application queue. See [[ADR-0006-report-notification-events]].

Report evidence integrity: `python scripts/check-report-integrity.py` uses local MongoDB and development RustFS credentials, creates disposable scan/report fixtures, checks downloaded evidence and owner boundaries, observes notifications, and removes test objects/records. See [[2026-11-03-trusted-scan-reports]].

Auth credential boundaries: `python scripts/check-auth-inputs.py` verifies signup email/password limits, Unicode length accounting, the 8 KiB JSON cap, redacted body errors, Argon2id storage, and short-password login compatibility using disposable accounts and scoped rate keys. The active Go Auth suite covers these behaviors; retained Rust Auth also runs its unit tests in CI. See [[2026-11-03-auth-credential-boundaries-and-password-capacity]].

Local outage drill: `powershell -ExecutionPolicy Bypass -File scripts/check-edge-auth-outage.ps1`. This intentionally stops only local Auth, asserts protected HTTP failures and public health, then restores Auth in `finally` and verifies recovery. It requires local Docker engine access, a running Auth service, and the default local URLs. Do not interrupt it while Auth is stopped. Evidence: [[2026-11-03-edge-auth-outage-and-recovery]].

Shared edge authentication (running stack and Traefik API required): `node scripts/check-edge-auth.mjs`. This strict check covers loaded router attachments and token/health/preflight boundaries. See [[ADR-0005-shared-edge-auth]].

## Disposable fixture resources

`scripts/check-mfa.ps1` and `scripts/check-go-parity.ps1` generate unique Compose project names. Their `finally` blocks remove fixture containers, anonymous volumes and networks, then only the exact per-run application image tags. Shared MongoDB/Redis/RabbitMQ images, development volumes and reusable build caches remain. `scripts/ci/test-resources.test.ps1` verifies project/image allowlists and failure handling without contacting Docker.

A failed Compose teardown fails the suite; MFA retains its temporary Compose/key directory for scoped recovery instead of deleting mounted inputs. Temporary environment variables are restored even when cleanup fails. A forcibly killed process or Docker outage can still leave resources: inspect Compose project labels and exact generated image names before targeted cleanup; do not use a global system/volume prune. See [[2026-11-14-test-resource-cleanup]].

## When to use

Use this runbook before claiming a change works, before a release, or when adding a regression test.

## Test layers

| Layer | Purpose | Current state |
|---|---|---|
| Unit | Pure functions and handlers | Go Auth/History/Notify and Reports, Rust scanners/rollback Auth, and legacy Notify have focused CI tests; Web has browser fixtures |
| Integration | Service with MongoDB/Redis/RabbitMQ | Automated disposable fixtures; hosted Go race contracts and full-stack/API checks passed on PR #69 |
| Contract | Frontend and service request/response shapes | Go store/API parity and browser fixtures exist; generated OpenAPI/schema contracts remain open |
| Smoke | Health and critical user path | Automated health/routes and mocked/live local browser suites; provider paths pending |
| Security | Auth bypass, IDOR, secrets | Automated auth/owner checks plus CI scanner gate; high/critical gate passed on PR #69; report-only findings in [[Security-Review]] |

## Commands

```powershell
# Everything the scripts know how to check
.\scripts\dev.ps1 test

# Web
Push-Location apps/web
npm run build
Pop-Location

# Active Go Auth/History/Notify
Push-Location apps/controlplane-go
go test ./...
go vet -tags=integration ./...
Pop-Location
.\scripts\check-go-parity.ps1

# Legacy History rollback
Push-Location apps/history-ts
npm run build
Pop-Location

# History risk filter (requires the local Compose stack and Auth key pair)
Push-Location apps/history-ts
npm run test:integration
Pop-Location

# Notify ownership check (requires local Compose stack and Auth key pair)
python apps/notify-py/scripts/check-ownership.py

# Reports
Push-Location apps/report-go
go test ./...
Pop-Location

# Python syntax check
Push-Location apps/notify-py
python -m compileall .
Pop-Location

# Rust
Push-Location apps/auth-rs
cargo test
Pop-Location
Push-Location apps/phishing-rs
cargo test
Pop-Location
Push-Location apps/malware-rs
cargo test
Pop-Location

# Exact-origin CORS contract (part of dev.ps1 test)
node scripts/check-cors.mjs
```

The History integration check uses a unique synthetic subject and tagged MongoDB fixtures; it removes those fixtures after the run. It does not call Gemini or VirusTotal.

## Smoke tests

```powershell
# Direct health endpoints (paths include the public prefix)
@{
  8080 = '/auth/health'
  8081 = '/phishing/health'
  8082 = '/malware/health'
  8083 = '/history/health'
  8084 = '/reports/health'
  8085 = '/notify/health'
}.GetEnumerator() | ForEach-Object {
  try {
    $r = Invoke-WebRequest "http://localhost:$($_.Key)$($_.Value)" -UseBasicParsing -TimeoutSec 2
    "port $($_.Key) -> $($r.StatusCode)"
  } catch {
    "port $($_.Key) -> unavailable"
  }
}

# Every documented route through the gateway
node scripts/check-routes.mjs
node scripts/check-cors.mjs
```

## Security regression tests

These cases are exercised by the existing integration suites; rerun them for authentication changes:

1. `GET /history` without a token must return 401, not all scans.
2. `GET /history` with a forged unsigned JWT must return 401.
3. `GET /history/:id` for another user's scan must return 404 or 403.
4. `GET /notify` without a token must return 401.
5. `POST /reports` without a token must return 401.
6. `GET /reports/:id` for another user's report must return 404 or 403.
7. Malformed scan and report IDs must return 400, not 500.

## Test data hygiene

- Use a disposable user such as `test+<timestamp>@example.invalid`.
- Tag test records with `test: true`.
- Remove test users, scans, reports, and notifications after the run.
- Do not use production API keys for load or fuzz tests.

## Related notes

- [[Test-Matrix]]
- [[Debug]]
- [[Security-Review]]
- [[History]]
- [[Reports]]
- [[Notify]]
