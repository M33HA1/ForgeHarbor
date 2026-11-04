---
date: 2026-11-03
updated: 2026-11-03
type: change
area: [auth, gateway, security]
status: verified
tags: [change, security, gateway]
---

# Shared edge authentication

## What changed

- Attached one ForwardAuth JWT gate to all five protected service routers using Auth's internal `/auth/me` validator.
- Kept exact GET health paths and service OPTIONS preflights public through higher-priority routers.
- Rejected blank JWT subjects in Auth after an edge regression probe demonstrated that a signed empty subject previously reached the Phishing handler.
- Added strict loaded-configuration and HTTP regression checks; updated Notify's fixture to match Auth's issued token claims.

## Why

FH-034 calls for a shared authentication boundary before service dispatch. Ownership remains enforced by each service. ForwardAuth sends no scan/upload body to Auth and copies no caller identity headers into ownership decisions.

## Verification

- Auth image rebuild passed; updated Compose services started.
- Edge regression initially failed for empty subject (400 reached handler instead of 401); after the Auth fix it rejects that token.
- Missing/forged/expired/wrong-issuer/wrong-audience tokens, spoofed forwarded identity, valid token reads, exact health exemptions, and scanner preflights are covered by `node scripts/check-edge-auth.mjs`.
- Gateway health, scanner input validation, and History/Reports/Notify ownership checks are run against the new edge.

## Follow-ups

- Controlled Auth-outage rejection and recovery are now verified in [[2026-11-03-edge-auth-outage-and-recovery]]; the shared gate now uses the file provider.
- Configure production TLS, internal-only service/infrastructure ports, CORS origin, and proxy trust. Provider credentials and Web session storage remain separate release blockers.

## Related notes

- [[ADR-0005-shared-edge-auth]]
- [[Auth]]
- [[Gateway-Routing]]
- [[Security-Review]]
- [[Backlog]]
- [[Change-Log]]
