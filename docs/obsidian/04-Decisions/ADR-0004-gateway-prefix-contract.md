---
type: adr
status: accepted
date: 2026-11-02
tags: [adr, routing, gateway, traefik]
---

# ADR-0004: Gateway prefix contract (D1=B)

## Status

Accepted on 2026-11-02. Supersedes the routing options left open in [[Architecture-Review]].

## Context

The gateway and the services disagreed about who owns the public prefix. Traefik stripped `/auth`, `/phishing`, `/malware`, `/history`, `/reports`, and `/notify` before forwarding. Auth, Phishing, and Malware were written for the stripped path; History, Reports, and Notify registered the full prefix and returned 404 through the gateway. Health checks hid the defect because `/history/health` stripped to `/health`, which every service exposes.

Two conventions were defensible:

- **A:** the gateway strips; services own unprefixed routes.
- **B:** the gateway does not strip; services own their full public prefix.

The unacceptable state was the mix.

## Decision

Use **Option B**. Traefik performs no path rewrite, and every service registers its full public prefix.

| Service | Public path | Service route |
|---|---|---|
| Auth | `/auth/*` | `/auth/*` |
| Phishing | `/phishing/*` | `/phishing/*` |
| Malware | `/malware/*` | `/malware/*` |
| History | `/history/*` | `/history/*` |
| Reports | `/reports/*` | `/reports/*` |
| Notify | `/notify/*` | `/notify/*` |

Health routes follow the same rule: `/auth/health`, `/phishing/health`, `/malware/health`, `/history/health`, `/reports/health`, and `/notify/health`.

## Consequences

### Positive

- The public path, the direct-port path, and the service route are identical. A probe against `localhost:8084/reports/health` and a probe through the gateway exercise the same route.
- The frontend paths were already correct, so no client change was needed.
- There is no rewrite middleware to forget when a new service is added.
- A route-contract test (`scripts/check-routes.mjs`) can assert every documented route through the gateway.

### Negative

- Auth, Phishing, and Malware had to change their route registrations.
- The service ports still bypass the gateway. Option B makes that bypass less confusing, but it does not secure it; direct ports must be closed or bound to `127.0.0.1` when edge auth lands.
- Traefik still has to load routes at all; the Docker-provider failure (FH-004) is independent of this decision.

### Follow-ups

- Fix the Traefik Docker provider and run the contract test against the gateway.
- Add edge authentication (ForwardAuth or the Go BFF) and stop publishing service ports.
- Keep the route table in [[API-Contracts]] and `scripts/check-routes.mjs` in sync when an endpoint changes.

## Alternatives considered

| Alternative | Why not |
|---|---|
| A: gateway strips prefixes | Keeps the rewrite invisible; direct-port and gateway paths differ; the defect that caused this decision remains possible |
| Leave the mix and document it | Every new service is a coin flip; health checks keep masking data-route 404s |

## Related notes

- [[Architecture-Review]]
- [[Gateway-Routing]]
- [[API-Contracts]]
- [[Service-Map]]
- [[Backlog]]
- [[Roadmap]]
