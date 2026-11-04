---
date: 2026-11-03
updated: 2026-11-03
type: change
status: verified
area: [auth, security, compose, testing]
related: [[Auth]], [[Security-Review]], [[Test-Matrix]], [[Backlog]]
tags: [change, auth, rate-limit, proxy-trust]
---

# Restrict Auth forwarded client IP trust

## What changed

- Auth uses the socket peer address for login throttling unless that peer is listed in `AUTH_TRUSTED_PROXY_IPS`. Only then does it use the rightmost valid address in `X-Forwarded-For`.
- A malformed trusted-peer allowlist fails startup. An unset allowlist trusts no proxy.
- Dev Compose puts Traefik and Auth on a dedicated fixed-address bridge and configures only Traefik as the normal trusted peer.
- An integration-only Nginx proxy binds to loopback port 8086. The Auth flow regression sends its 60+1 IP threshold through this proxy and retains direct forged-header requests on the host-to-Auth path.
- The CI integration script starts this profile service and stops it on exit.

## Why

Before the change, any caller could rotate `X-Forwarded-For` and select new Redis IP buckets, bypassing the global per-IP login threshold. Trust now depends on the connection peer, which callers cannot choose through an HTTP header.

## Verification

| Check | Result |
|---|---|
| Compose config validation | Passed |
| Auth release image build | Passed; 13 Rust unit tests passed |
| `python scripts/check-auth-flow.py` | Passed signup race, direct forged-header behavior, valid/forged tokens, account limit, trusted-proxy 60+1 IP limit, and scoped user/Redis cleanup |
| Playwright HTTP probes | Gateway `/auth/health` and loopback test-proxy `/auth/health` returned HTTP 200 |
| Compose runtime | Auth, Traefik, and the integration proxy running; Auth and Traefik attached to `forgeharbor-auth-edge` |

## Follow-ups

- Set exact production proxy peer IPs in `AUTH_TRUSTED_PROXY_IPS` and keep Auth inaccessible to untrusted callers.
- Hosted CI, provider credential validation/rotation, production TLS/port policy, and remaining release gates are still pending.

## Related notes

- [[Change-Log]]
- [[00-Home]]
- [[Auth]]
- [[Gateway-Routing]]
- [[Environment]]
- [[Security-Review]]
- [[Test-Matrix]]
- [[Backlog]]
