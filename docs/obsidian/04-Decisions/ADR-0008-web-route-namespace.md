---
type: adr
status: accepted
date: 2026-11-03
updated: 2026-11-03
tags: [adr, web, routing]
---

# ADR-0008: Protected web page namespace

## Context

React's former `/history` page collided with the existing History API prefix at the gateway. A direct document request to `/history` returned HTTP 401 from the API instead of the React shell. Client navigation alone concealed this refresh failure.

## Decision

Use `/app/dashboard`, `/app/history`, and `/app/profile` as canonical protected browser pages. Update navigation and login return paths. Keep API prefixes unchanged under [[ADR-0004-gateway-prefix-contract]]. The web server returns the public React shell at these paths; protected data still requires service authentication and ownership.

`/dashboard` and `/profile` remain client redirects. The React `/history` alias redirects when already running in the SPA, but a direct gateway `/history` request remains the authenticated API. Existing direct History page bookmarks must change to `/app/history`.

Login returns only to an allowlisted protected page or defaults to `/app/dashboard`. UI regression tests pass document requests through the real gateway and intercept data/mutation requests with local fixtures, so the page/API namespace boundary is exercised.

## Related notes

- [[Web]]
- [[Gateway-Routing]]
- [[2026-11-03-web-flow-regression-and-route-fixes]]
