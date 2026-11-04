---
date: 2026-11-03
updated: 2026-11-03
type: change
status: verified
area: [web, routing, testing]
tags: [change, web, regression, accessibility]
---

# Web flow regression coverage and route fixes

## What changed

- Added a repeatable Playwright MCP suite at `scripts/check-web-ui.js` covering the built React app with local API fixtures, including authenticated request headers. Document loads use the real gateway; fixture mutations and provider calls are intercepted. Unknown data/mutation requests are blocked.
- The mock login/logout fixture explicitly sets and clears the isolated HttpOnly cookie in the browser context; intercepted `Set-Cookie` responses alone do not persist cookies in this Playwright route fixture.
- Moved protected pages to `/app/...` to resolve the `/history` API/document collision. Login returns to the requested allowlisted protected page and defaults to the dashboard.
- Connected form labels, added mobile navigation/upload names and keyboard upload activation, prevented repeated pending form submissions, and exposed auth success/error feedback through status/alert roles.
- Failed login/profile verification clears partial token/user state. Missing or malformed scan evidence now produces an analysis error instead of a safe result.
- Added canonical HTML document routes to the gateway contract check and ignored generated browser artifacts.

## Verification

- The initial browser run exposed missing labels, failed protected navigation, and unnamed mobile controls. A real unauthenticated document request to the old `/history` returned HTTP 401.
- Web image rebuilt and restarted. Seven browser scenarios pass: protected login return/pending state; login/profile failures; signup feedback; URL threat/zero-confidence/malformed results; file threat/malformed results/removal; report restoration after refresh, creation by scan ID, download/error feedback and filters; mobile navigation/layout/logout.
- The suite verifies no uncaught page errors, authenticated fixture cookies, no horizontal dashboard overflow at 390 pixels, and no unexpected API requests. It clears isolated fixture storage/routes afterward. The latest local Playwright MCP run passed all seven scenarios.
- The reusable script now creates and closes its own fresh context. The final run passed all seven scenarios with service workers blocked and no backend/provider mutations. Gateway checks confirm `/app/dashboard`, `/app/history`, and `/app/profile` return HTML while `/history` remains protected; route/CORS/tooling checks, all eight health probes, and `git diff --check` passed.

## Follow-ups

- Browser coverage uses mocked data APIs; real provider-backed scans and full browser-to-backend onboarding still need deployment regression coverage. Existing API fixtures independently verify backend auth/ownership.
- Browser JWT storage moved to an HttpOnly cookie under [[2026-11-03-http-only-browser-sessions]]. CI browser integration, broader keyboard/accessibility checks, pagination races, and production configuration remain open.
- Direct History page bookmarks must use `/app/history`; `/history` remains the API.

## Related notes

- [[ADR-0008-web-route-namespace]]
- [[Web]]
- [[Gateway-Routing]]
- [[Test-Matrix]]
- [[Backlog]]
- [[Change-Log]]
