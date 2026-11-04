---
type: adr
status: accepted
date: 2026-11-03
updated: 2026-11-03
tags: [adr, security, traefik, auth]
---

# ADR-0005: Shared edge authentication

## Context

FH-034 requires one gateway JWT validation point. Auth already exposes `/auth/me` with RS256 signature, expiry, issuer, audience, and typed claim validation. Service checks also enforce ownership and must remain active for direct development calls.

## Decision

Use Traefik ForwardAuth against the internal `http://fh-auth:8080/auth/me` endpoint for the Phishing, Malware, History, Reports, and Notify routers. Forward Authorization, Cookie, and Origin; do not forward request bodies or trust caller-supplied forwarded headers. Auth rejects empty or whitespace subjects. Browser cookies remain HttpOnly; protected handlers validate the original cookie after ForwardAuth.

Higher-priority public routers exempt only exact GET health paths and OPTIONS requests under each service prefix. Public Auth registration/login/JWKS and Web routes retain their existing contracts. Protected handlers continue to verify JWTs and derive ownership from their verified claims, never from forwarded identity headers.

## Consequences

- Protected gateway traffic now depends on Auth availability and performs an extra internal validation call.
- Tokens must match Auth's issued claim shape, including email and integer issued-at/expiry fields.
- The gateway does not rewrite service paths; [[ADR-0004-gateway-prefix-contract]] remains in force.
- Development ports stay loopback-bound. Production TLS, internal-only service ports, and upstream proxy trust remain release gates. The controlled outage drill verified rejection and recovery in [[2026-11-03-edge-auth-outage-and-recovery]].

## Evidence

`node scripts/check-edge-auth.mjs` checks Traefik's loaded middleware attachments and allowed/denied HTTP behavior. See [[2026-11-03-shared-edge-auth]]. Implementation follows [Traefik ForwardAuth documentation](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/forwardauth/).

## Related notes

- [[Auth]]
- [[Phishing]]
- [[Malware]]
- [[History]]
- [[Reports]]
- [[Notify]]
- [[Gateway-Routing]]
- [[Backlog]]
