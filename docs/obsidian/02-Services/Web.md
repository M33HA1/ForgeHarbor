---
type: service
status: broken-build
priority: P0
language: typescript
updated: 2026-11-02
tags: [service/web, status/p0, area/frontend, language/typescript]
---

# Web

## Responsibility

React single-page application for signup, login, URL scans, file scans, history, reports, notifications, and service health.

## Ownership

| Field | Value |
|---|---|
| Language | JavaScript/JSX with Vite; TypeScript conversion is a target |
| Direct port | 3000 |
| Public route | `/` through Traefik |
| API base | `VITE_API_BASE_URL` or `window.location.origin` |
| Auth storage | `localStorage` key `access_token` |

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
| Report metadata | `GET /reports/:id` | Matches Reports |
| Report download | `GET /reports/:id/download` | Matches Reports |
| Notifications | `GET /notify` | Does not match Notify's `/notifications` |
| Health checks | `/auth/health`, `/phishing/health`, etc. | Depends on gateway routing |

## Known issues

| Severity | Issue | Impact |
|---|---|---|
| P0 | Dockerfile uses `node:14` while Vite 7 requires Node 20.19+ or 22.12+ | Image build fails |
| P0 | File scan result reads top-level `is_malicious` and `is_phishing`; API returns nested `status` and `result` | Malicious files render as clean |
| P0 | History, Reports, and Notify data calls return 404 through the gateway | History, reports, and notifications do not load |
| P1 | Confidence fallback uses `|| 85`, so a real `0` becomes 85 | Misleading scores |
| P1 | History ignores report IDs and malware status | Incomplete UI state |
| P1 | Notification path is `/notify` but the service exposes `/notifications` | Notifications do not load |
| P1 | API base defaults to the current origin, which is correct only when served through Traefik | Direct-port development breaks |
| P2 | The JWT is stored in `localStorage` | XSS can steal the session |
| P2 | No frontend tests | Regressions are easy |

## Build and test

```powershell
Push-Location apps/web
npm install
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
