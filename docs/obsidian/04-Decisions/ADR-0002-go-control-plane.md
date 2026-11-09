---
type: adr
status: accepted
date: 2026-11-02
updated: 2026-11-09
tags: [adr, architecture, go]
---

# ADR-0002: Go for the control plane

## Status

Accepted as the target direction; implementation is incremental.

## Context

Auth, History, Reports, and Notify are ordinary network services. They are I/O-bound: database calls, HTTP requests, queue operations, and object storage. Rust is excellent for CPU-heavy analysis, but using it for every service raises build and maintenance cost without a matching performance benefit.

The missing architectural piece is a scan orchestrator. Scans currently run in the request path, with no retries, timeouts, idempotency, or reliable completion event.

## Decision

Use Go as the default for the control plane:

- Auth, or an external identity provider
- Scan orchestrator
- History
- Reports
- Notify
- Audit and scheduler services when they are added

Keep Rust for the malware analysis engine and any CPU-heavy binary parsing. Keep Python for threat intelligence and AI. Keep TypeScript for the UI.

Do not rewrite everything at once. Stabilize the current stack first, then migrate one service at a time behind stable contracts.

## Migration order

1. Fix the current Auth build or replace Auth with a small Go service.
2. Add the Go scan orchestrator.
3. Move History to PostgreSQL and Go, preserving the API contract.
4. Keep Reports in Go and add auth and ownership checks.
5. Replace Notify with a Go consumer when the event contract is stable.
6. Keep the Rust malware engine behind a narrow interface.

## Consequences

### Positive

- Simpler deployment: static binaries and small images.
- Fast compile times and a strong standard library.
- Easier concurrency for queue consumers and orchestration.
- Consistent auth, logging, and metrics across control-plane services.

### Negative

- A staged migration creates temporary duplication.
- The team must maintain Go and Rust toolchains.
- Rewrites can break clients if contracts are not pinned first.

### Follow-ups

- Define the scan job and event contracts before writing the orchestrator.
- Add a contract test for each migrated endpoint.
- Track each migration in [[Backlog]] and a dated change note.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep every backend service in Rust | Higher build cost; Rust is not the differentiator for CRUD |
| Rewrite everything in Go immediately | Too risky while the stack does not start |
| Use Python for all backend services | Weaker fit for high-concurrency control-plane work |

## Implementation status — 2026-11-09

The language branch implements Go Auth/History/Notify in one shared module with separate processes, while the frontend migration remains on a separate branch. MongoDB, user IDs, key locations, string JWT audiences, and queue contracts remain compatible. Legacy runtimes remain available through the rollback overlay; local dependency, gateway, real-browser, and rollback checks pass. Auth refuses a non-default user database until a separate data migration is approved. Python threat intelligence and PostgreSQL remain separate roadmap work. See [[2026-11-09-backend-control-plane-pr]].

## Related notes

Authenticator MFA is now implemented in Go Auth. The retained Rust rollback explicitly blocks password-only login for enrolled users and honors session-version changes; restoring MFA sign-in requires Go Auth. See [[2026-11-09-backend-control-plane-pr]].

- [[ADR-0001-polyglot-boundaries]]
- [[System-Overview]]
- [[Data-Flow]]
- [[Roadmap]]
- [[Backlog]]
