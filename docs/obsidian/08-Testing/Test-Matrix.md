---
type: testing
status: active
updated: 2026-11-02
tags: [testing, matrix]
---

# Test Matrix

## Coverage by service

| Service | Build | Unit | Integration | Security | Smoke | Current status |
|---|---|---|---|---|---|---|
| Auth | `cargo build --release` | Missing | Missing | JWT and password tests needed | `/health`, signup, login, `/me` | Build broken |
| Phishing | `cargo build --release` | Missing | Missing | Token validation test needed | `/health`, URL scan | Unverified |
| Malware | `cargo build --release` | Missing | Missing | Token and upload-limit tests needed | `/health`, file scan | Unverified |
| History | `npm run build` | Missing | Missing | Anonymous, forged-token, IDOR tests needed | `/health`, list, detail | Security defects |
| Reports | `go test ./...` | Missing | Missing | Auth and ownership tests needed | `/health`, create, download | Auth/routing defects |
| Notify | `python -m compileall .` | Missing | Missing | Auth and ownership tests needed | `/health`, list | Auth/queue defects |
| Web | `npm run build` | Missing | Missing | Token storage and result-rendering tests needed | Login, scan, history, report | Build broken |

## Critical security cases

| ID | Case | Expected | Current |
|---|---|---|---|
| SEC-T01 | `GET /history` without a token | 401 | 200 with all scans |
| SEC-T02 | `GET /history` with a forged unsigned JWT | 401 | Accepted when no public key is configured |
| SEC-T03 | `GET /history/:id` for another user's scan | 403 or 404 | 200 |
| SEC-T04 | `GET /notifications` without a token | 401 | 200 with notifications |
| SEC-T05 | `POST /reports` without a token | 401 | 200 |
| SEC-T06 | `GET /reports/:id` for another user's report | 403 or 404 | 200 |
| SEC-T07 | Malformed scan ID | 400 | 500 |
| SEC-T08 | Malformed report ID | 400 | 400 |

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

## Commands

```powershell
.\scripts\dev.ps1 test
.\scripts\dev.ps1 health
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
