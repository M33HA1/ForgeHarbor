---
type: service
status: partially-verified
priority: P0
language: typescript
updated: 2026-11-11
tags: [service/web, status/p0, area/frontend, language/typescript]
---

# Web

## Current interface and integration

`codex/project-finalisation` integrates strict TypeScript and browser MFA with the Go control plane. The interface uses locally bundled Manrope, a quiet public introduction and interactive illustrative evidence preview, and a dark workspace sidebar with light scan/history/account surfaces. Controls retain visible focus, keyboard submission, reduced-motion support, provider disclosures and explicit incomplete/error states. An unknown page has a working return path.

Ten deterministic browser groups cover auth errors/returns/logout, URL/file evidence, reports, mobile navigation, 320/768/1440 layouts, upload bounds and the unknown route. Real-store MFA and hosted full-stack verification are tracked in [[2026-11-11-demo-finalisation]]. No seed, challenge, recovery code or JWT is written to browser storage. Screenshots and passing fixtures do not establish WCAG conformance or production readiness.

## Runtime hardening

The runtime container runs as the built-in unprivileged Node.js user.

## Responsibility

React single-page application for signup, login, URL scans, file scans, history, reports, notifications, and service health.

## Ownership

| Field | Value |
|---|---|
| Language | JavaScript/JSX with Vite; TypeScript conversion is a target |
| Direct port | 3000 |
| Public route | `/` through Traefik |
| API base | `VITE_API_BASE_URL` or `window.location.origin` |
| Auth storage | HttpOnly `fh_access` cookie set by Auth; no JWT in Web storage |

## API calls

| Action | Call | Service expectation |
|---|---|---|
| Signup | `POST /auth/signup` | Matches Auth |
| Login | `POST /auth/login` | Matches Auth |
| Profile | `GET /auth/me` | Matches Auth |
| URL scan | `POST /phishing/v1/url/check` | Matches Phishing |
| File scan | `POST /malware/v1/file/analyze` | Matches Malware |
| History | `GET /history` | Matches History |
| Scan detail | `GET /history/:id` | Matches History |
| Create report | `POST /reports` | Matches Reports |
| Restore reports for history | `GET /reports?scan_id=...` | Returns only caller-owned reports for the requested scans |
| Report metadata | `GET /reports/:id` | Matches Reports |
| Report download | `GET /reports/:id/download` | Matches Reports |
| Notifications | `GET /notify` | Matches Notify's authenticated `/notify` route |
| Health checks | `/auth/health`, `/phishing/health`, etc. | Depends on gateway routing |

## Known issues

| Severity | Issue | Impact |
|---|---|---|
| P1 | Data views require a valid browser session or API bearer token | Expired or missing sessions receive 401 and need reauthentication |
| P1 | API base defaults to the current origin, which is correct only when served through Traefik | Direct-port development breaks |
| P2 | Hosted browser CI and provider-backed scan UI coverage remain incomplete | Seven deterministic flows and a real local backend journey pass; headless CI runner implemented; first hosted run and provider/deployment coverage remain open |

## Browser routes and regression coverage

Canonical protected pages are `/app/dashboard`, `/app/history`, and `/app/profile`. `/history` remains the authenticated API at the gateway. Login returns to an allowlisted requested protected page. See [[ADR-0008-web-route-namespace]].

Run Playwright MCP `browser_run_code_unsafe` with `filename: scripts/check-web-ui.js` against the running gateway. The script creates/closes its own isolated browser context, uses deterministic API fixtures, and blocks unknown data/mutation requests. No test packages or backend/provider writes are required. See [[2026-11-03-web-flow-regression-and-route-fixes]].

## Current UI

- Signup explains that Auth checks a partial password hash against known breach data and never sends the password itself.
- The dashboard presents URL and file analysis in a shared, task-first workspace with responsive layouts and accessible input focus styling.
- Scan submission and result mapping remain connected to the existing API service; ten fixture-driven browser groups cover auth, scan-result rendering, report actions, filters, and mobile controls; real local backend journey coverage now passes; provider-backed scans and production deployment coverage remain open.
- History restores caller-owned report IDs from Reports and shows creation/download feedback; fixture and real local browser coverage now pass; production deployment coverage remains open; final revision CI is tracked in [[2026-11-11-demo-finalisation]].
- Visual direction draws on Watermelon UI's component hierarchy, Manus's task-first workspace, Cult UI's component ideas. Refero was checked as a reference index but readable designs were unavailable; see the dated research record.

## Recent changes

- [[2026-11-04-legacy-report-download-provenance]]: History displays the Reports service's regeneration guidance when a legacy artifact download returns 410.

- [[2026-11-03-auth-breached-password-screening]]: signup explains the privacy-preserving breached-password check before account creation.

- [[2026-11-03-ci-matrix-and-strict-integration]]: headless CLI runs the existing mock and live local browser suites with fixture cleanup; first hosted workflow run pending.

- [[2026-11-03-http-only-browser-sessions]]: browser JWTs moved from localStorage to a Strict HttpOnly cookie; protected routes and cross-service ownership work with cookies.

- [[2026-11-03-live-browser-service-journey]]: real UI account/session, History/report/download, Notify delivery, ownership denials, and verified cleanup.

- [[2026-11-03-web-flow-regression-and-route-fixes]]: protected page namespace, auth cleanup/return, accessible controls, strict result handling, and seven browser scenarios.

- [[2026-11-03-trusted-scan-reports]]: History sends only the stored scan ID for server-generated reports.

- [[2026-11-03-scanner-dashboard-visual-refresh]]
- [[2026-11-03-history-report-actions]]
- Removed unused Firebase, upgraded React Router to v7, and cleared npm audit findings; production build passes with `npm ci`.

## Build and test

```powershell
Push-Location apps/web
npm ci
npm run build
npm run dev
Pop-Location
```

## Related notes

- [[Architecture-Review]]
- [[Gateway-Routing]]
- [[History]]
- [[Reports]]
- [[Notify]]
- [[Build]]
- [[Test-Matrix]]
