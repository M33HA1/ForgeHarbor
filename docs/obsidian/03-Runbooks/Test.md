---
type: runbook
status: active
updated: 2026-11-02
tags: [runbook, test]
---

# Test

## When to use

Use this runbook before claiming a change works, before a release, or when adding a regression test.

## Test layers

| Layer | Purpose | Current state |
|---|---|---|
| Unit | Pure functions and handlers | Missing in most services |
| Integration | Service with MongoDB/Redis/RabbitMQ | Partial manual testing only |
| Contract | Frontend and service request/response shapes | Missing |
| Smoke | Health and critical user path | Manual only |
| Security | Auth bypass, IDOR, secrets | Manual findings in [[Security-Review]] |

## Commands

```powershell
# Everything the scripts know how to check
.\scripts\dev.ps1 test

# Web
Push-Location apps/web
npm run build
Pop-Location

# History
Push-Location apps/history-ts
npm run build
Pop-Location

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
```

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
```

## Security regression tests

These should become automated tests before the project is called portfolio-ready:

1. `GET /history` without a token must return 401, not all scans.
2. `GET /history` with a forged unsigned JWT must return 401.
3. `GET /history/:id` for another user's scan must return 404 or 403.
4. `GET /notifications` without a token must return 401.
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
