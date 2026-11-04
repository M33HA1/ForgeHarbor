---
date: 2026-11-03
updated: 2026-11-03
type: change
status: verified
area: [gateway, security, operations]
tags: [change, security, outage, recovery]
---

# Edge Auth outage and recovery

## What changed

- Moved the shared JWT middleware from Auth's Docker labels to a mounted Traefik file provider. The gate remains registered when Auth is stopped; protected routers reference `fh-jwt@file`.
- Added a local Windows Docker outage drill with baseline checks, concurrent outage probes, automatic Auth restoration in `finally`, and recovery checks. It refuses nonlocal gateway/API overrides and remote Docker contexts.
- Extended the strict edge checker with `--auth-unavailable` to assert gateway errors for valid tokens and continued public health availability on all five service prefixes.

## Why

Docker-label middleware is coupled to its container's availability. The file provider keeps the authentication boundary configured while the Auth backend is unavailable. FH-034 needed evidence that this boundary rejects requests during an outage and recovers afterward.

## Verification

- Compose updated successfully with the mounted file configuration.
- The first drill exceeded the original eight-second observation window; Auth restored successfully and recovery checks passed.
- With a 45-second observation ceiling and concurrent probes, all five protected requests returned HTTP 500 in approximately 8.02 seconds; all five public health endpoints remained HTTP 200.
- Automatic Auth restart completed and normal edge checks passed again. No accounts, scans, or provider calls were created by the drill.

## Follow-ups

- Production TLS, internal-only service ports, proxy trust, and CORS origin remain release gates.
- Evaluate the observed eight-second Auth failure latency against the production availability target; this drill proves rejection and recovery, not production latency or load capacity.

## Related notes

- [[ADR-0005-shared-edge-auth]]
- [[2026-11-03-shared-edge-auth]]
- [[Auth]]
- [[Gateway-Routing]]
- [[Security-Review]]
- [[Backlog]]
- [[Change-Log]]
