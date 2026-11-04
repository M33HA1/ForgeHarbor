---
date: 2026-11-03
updated: 2026-11-03
type: change
status: verified
area: [auth, web, gateway, security]
related: [[Auth]], [[Web]], [[Security-Review]], [[Test-Matrix]], [[Backlog]]
tags: [change, auth, cookie, session]
---

# Move browser sessions to HttpOnly cookies

## What changed

- Auth sets a one-hour `fh_access` cookie with `HttpOnly`, `SameSite=Strict`, and `Path=/`. `Secure` defaults on; the local HTTP Compose stack explicitly disables it. Login no longer returns the JWT in JSON.
- `POST /auth/logout` clears the browser cookie. `/auth/me` accepts the cookie or a Bearer RS256 token.
- Traefik ForwardAuth passes the session cookie to Auth. Phishing, Malware, History, Reports, and Notify continue to validate RS256 claims and ownership when requests carry the cookie; Bearer clients remain supported.
- The Web API client no longer stores or sends JWTs from JavaScript. Same-origin browser requests carry the HttpOnly cookie automatically.
- Regression coverage now checks cookie flags, direct and gateway `/auth/me`, logout, all protected service routes, browser reload, report/notification access, cross-owner denial, and verified fixture cleanup.

## Why

The prior Web client stored bearer JWTs in `localStorage`, where injected JavaScript could read and persist them. The browser now relies on an HttpOnly cookie that application JavaScript cannot inspect.

## Verification

| Check | Result |
|---|---|
| All seven service image builds | Passed; Auth release-mode unit tests include cookie extraction and Secure flag checks |
| `node scripts/check-edge-auth.mjs` | Passed; loaded ForwardAuth includes Cookie and valid cookie sessions reach all five protected services |
| `node scripts/check-scanner-auth.mjs` | Passed; cookie credentials reached Phishing and Malware input validation; missing/forged credentials returned 401 |
| Mocked Playwright UI suite | All seven scenarios passed, including HttpOnly cookie setup, failed-login cleanup, and logout |
| Real local browser journey | Passed signup/login, HttpOnly Strict cookie, protected-page reload, History, report download, Notify, cross-owner denial, logout; fixture cleanup verified |
| Full local integration runner | Passed health, routes, CORS, edge/scanner auth, Auth, History, Reports, and Notify suites |

## Follow-ups

- Configure production HTTPS and retain `AUTH_COOKIE_SECURE=true`.
- Add refresh/revocation controls and validate same-origin deployment assumptions for production domains.
- Hosted CI/security results and provider-backed scan coverage remain open.

## Related notes

- [[Change-Log]]
- [[00-Home]]
- [[Auth]]
- [[Web]]
- [[Gateway-Routing]]
- [[Environment]]
- [[Security-Review]]
- [[Test-Matrix]]
- [[Backlog]]
