---
type: adr
status: accepted
date: 2026-11-02
updated: 2026-11-09
tags: [adr, architecture, languages]
---

# ADR-0001: Polyglot boundaries

## Status

Accepted.

## Context

ForgeHarbor uses Rust, Go, Python, and TypeScript. The breadth is intentional: it demonstrates the ability to choose and operate different languages. The risk is a stack that looks like a language collection instead of an engineered system.

The current code also has operational problems that language choice alone cannot fix: synchronous scans, missing auth, broken routing, and a build that does not start.

## Decision

Keep the four languages, but give each one a credible specialty.

| Language | Specialty | Services |
|---|---|---|
| Rust | CPU-heavy, memory-safe analysis | Malware analysis engine; keep existing Auth and Phishing until they are deliberately migrated |
| Go | Control-plane APIs and orchestration | Reports now; target default for Auth, scan orchestrator, History, and Notify |
| Python | AI, threat intelligence, feed normalization | Notify now; target Threat Intelligence and ML enrichment |
| TypeScript | User interface and API integration | Web now; History is acceptable for read-heavy CRUD |
| SQL | Relational data and reporting | Target PostgreSQL for users, scans, reports, and audit records |

Do not add another service language for the sake of language count. Add SQL and Terraform as the next portfolio-relevant technologies.

## Consequences

### Positive

- The stack has a defensible reason for each language.
- Rust remains where its performance and safety characteristics matter.
- Go gives ordinary network services simple deployment and predictable concurrency.
- Python has the best ecosystem for AI and threat-intelligence work.
- The README and interviews can explain tradeoffs instead of listing technologies.

### Negative

- Four runtimes increase CI, dependency, and debugging overhead.
- Shared contracts and observability become mandatory, not optional.
- The current Rust Auth service is not the best use of Rust and should eventually move to Go or an identity provider.

### Follow-ups

- Add OpenAPI or protobuf contracts for every service.
- Add OpenTelemetry trace propagation across service boundaries.
- Document the migration path in [[ADR-0002-go-control-plane]].
- Keep the language table in the README aligned with this ADR.

## Alternatives considered

| Alternative | Why not |
|---|---|
| One backend language (Go) | Strong operational choice, but loses the intentional polyglot showcase |
| Add another service language | Increases count without increasing engineering signal |
| Keep every service in its current language forever | Preserves accidental choices rather than deliberate ones |

## Implementation status — 2026-11-09

The language branch implements Go Auth/History/Notify in one shared module with separate processes, while the frontend migration remains on a separate branch. MongoDB, user IDs, key locations, string JWT audiences, and queue contracts remain compatible. Legacy runtimes remain available through the rollback overlay; local dependency, gateway, real-browser, and rollback checks pass. Auth refuses a non-default user database until a separate data migration is approved. Python threat intelligence and PostgreSQL remain separate roadmap work. See [[2026-11-09-backend-control-plane-pr]].

## Related notes

- [[System-Overview]]
- [[Service-Map]]
- [[ADR-0002-go-control-plane]]
- [[ADR-0003-postgres-for-history]]
- [[Roadmap]]
